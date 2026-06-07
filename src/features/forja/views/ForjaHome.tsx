/**
 * Forja de Hefesto — Aba: Início (Hub)
 * Resumo visual do torneio: status, fase atual, tabela compacta com hover,
 * próximas partidas e premiação.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ForjaViewProps, ForjaPlayer, ForjaTeam, ForjaLiveMatchSummary, ForjaPrizeConfig } from '../types';
import { useForjaSettings } from '../hooks/useForjaSettings';
import { useForjaTeams } from '../hooks/useForjaTeams';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import {
  getForjaContentOnce,
  getForjaLiveMatchesSummaryOnce,
  getForjaOfficialMatchesOnce,
} from '../services/forjaService';
import { formatForjaDateInputValue, mergeForjaLiveMatches, resolveForjaMatchDateTime } from '../forjaMatchSummary';
import {
  buildForjaPlayoffBracket,
  FORJA_BRACKET_ROUNDS,
  FORJA_GROUP_IDS,
  getForjaPlayoffRoundLabel,
  isForjaBracketSlotReady,
  type ForjaBracketMatch,
  type ForjaBracketSlot,
  type ForjaGroupId,
  type ForjaStandingRow,
} from '../forjaPlayoffs';
import { FORJA_MAP_POOL, hydrateMclPicksWithRosterNames } from '../../../constants';
import { LobbyConfig, Lobby, TeamPlayer, SeriesType, ForjaPlayoffMatchId, ForjaPlayoffRound } from '../../../types';
import { lobbyService, generateId, lobbyToForjaLiveMatchSummary, upsertForjaLiveMatchSummary, removeForjaLiveMatchSummary } from '../../../services/lobbyService';
import { MAJOR_GODS } from '../../../data/gods';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { cn } from '../../../lib/utils';
import { toSafeExternalUrl } from '../../../lib/safeExternalUrl';
import { getForjaAvatarUrl } from '../utils/avatar';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type StandingRow = ForjaStandingRow;
type ForjaMatchStage = 'GROUP' | 'PLAYOFFS_BO3' | 'PLAYOFFS_BO5';
type ForjaMatchCenterPhase = ForjaGroupId | 'PLAYOFFS';

const MATCH_CENTER_PHASES: readonly ForjaMatchCenterPhase[] = ['A', 'B', 'C', 'D', 'PLAYOFFS'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pre_tournament: { label: 'Pré-Torneio', color: '#94a3b8', icon: '⏳' },
  group_stage: { label: 'Fase de Grupos', color: '#60a5fa', icon: '🏟️' },
  playoffs: { label: 'Playoffs', color: '#f59e0b', icon: '🏆' },
  finished: { label: 'Encerrado', color: '#4ade80', icon: '✅' },
};

const PLAYOFF_FORMAT_LABEL: Record<string, string> = {
  single_elim: 'Eliminação Simples',
  double_elim: 'Eliminação Dupla',
};

const UPCOMING_MATCH_LIMIT = 6;
const FORJA_PLAYOFF_RULES_COPY = 'Times do mesmo grupo ficam em lados opostos na chave principal do campeonato e só podem se reencontrar na Final. A disputa de 3º lugar pode reunir times do mesmo grupo dependendo dos resultados das semifinais.';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

function isForjaMatchStage(value: string): value is ForjaMatchStage {
  return value === 'GROUP' || value === 'PLAYOFFS_BO3' || value === 'PLAYOFFS_BO5';
}

function isForjaGroupId(value: string): value is ForjaGroupId {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function isMatchCompleted(match: ForjaLiveMatchSummary | null | undefined): boolean {
  return match?.status === 'completed' || match?.status === 'finished';
}

function getSlotLabel(slot: ForjaBracketSlot): string {
  return slot.kind === 'team' ? slot.team.team_name : slot.label;
}

function getSlotSeed(slot: ForjaBracketSlot): string | null {
  return slot.kind === 'team' ? slot.seedLabel ?? null : null;
}

function getForjaSeriesDisplayLabel(seriesType: Extract<SeriesType, 'BO3' | 'BO5'>): string {
  return seriesType === 'BO5' ? 'MD5' : 'MD3';
}

/**
 * Renders a team member row with avatar, nickname, and an optional captain badge.
 *
 * If the member's avatar fails to load, uses a Discord CDN fallback avatar chosen from the
 * default embed avatars based on the last digit of `member.discord_id`.
 *
 * @param member - The ForjaPlayer to display (avatar, nick, and discord_id used for fallback)
 * @param isCaptain - Whether to display the "CAP" badge for this member
 * @returns The rendered member row element
 */

function MemberRow({ member, isCaptain }: { member: ForjaPlayer; isCaptain: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const avatarUrl = getForjaAvatarUrl(member.avatar_url, member.discord_id);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <img
        src={imgErr ? getForjaAvatarUrl(null, member.discord_id) : avatarUrl}
        onError={() => setImgErr(true)}
        alt={member.nick}
        referrerPolicy="no-referrer"
        style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.3rem', objectFit: 'cover' }}
      />
      <span style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>{member.nick}</span>
      {isCaptain && (
        <span style={{ fontSize: '0.6rem', color: '#facc15', fontWeight: 700, background: 'rgba(250,204,21,0.1)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem' }}>CAP</span>
      )}
    </div>
  );
}

/**
 * Render a fixed-position popover that displays a team's name and its member rows at a given screen coordinate.
 *
 * @param team - The standing row for the team, containing `team_name`, `members` (array of discord IDs) and `captain_id`
 * @param players - Array of `ForjaPlayer` objects used to resolve member details from `team.members`
 * @param anchor - Screen coordinates `{ x, y }` where the popover's top-left corner will be placed
 * @returns The popover JSX element positioned at `anchor` containing the team's title and member entries, or `null` if the team has no resolvable members
 */
function TeamMemberPopover({
  team,
  players,
  anchor,
}: {
  team: StandingRow;
  players: ForjaPlayer[];
  anchor: { x: number; y: number };
}) {
  const members = team.members
    .map(id => players.find(p => p.discord_id === id))
    .filter(Boolean) as ForjaPlayer[];

  if (members.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: anchor.x,
        top: anchor.y,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.97)',
        border: '1px solid rgba(250,204,21,0.25)',
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        minWidth: '200px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(250,204,21,0.1)',
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
        {team.team_name}
      </div>
      {members.map(p => (
        <MemberRow key={p.discord_id} member={p} isCaptain={p.discord_id === team.captain_id} />
      ))}
    </div>
  );
}

/**
 * Renders a compact standings card for a group with hoverable rows that show a delayed member popover.
 *
 * @param group - Group label (e.g., "A", "B") displayed in the card header
 * @param standings - Array of standing rows to render in rank order; each row supplies team id, name, matches/games stats and points
 * @param players - List of players used to populate the member popover for each team
 * @returns A styled compact standings table for the given group that reveals a team member popover when hovering a row
 */

function CompactStandings({
  group,
  standings,
  players,
}: {
  group: string;
  standings: StandingRow[];
  players: ForjaPlayer[];
}) {
  const [hovered, setHovered] = useState<{ team: StandingRow; x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (team: StandingRow, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position popover to the right of the row, or left if near right edge
    const popX = rect.right + 8 < window.innerWidth - 220 ? rect.right + 8 : rect.left - 220;
    const popY = Math.min(rect.top, window.innerHeight - 180);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHovered({ team, x: popX, y: popY }), 150);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(null);
  };

  return (
    <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-amber-500/5 border-b border-slate-800">
            <th className="py-2.5 px-4 text-left">
              <span className="text-amber-500 font-black text-[0.72rem] tracking-[0.15em] uppercase">GRUPO {group}</span>
            </th>
            <th className="w-8 text-center text-[0.65rem] font-black text-slate-500 uppercase">J</th>
            <th className="w-8 text-center text-[0.65rem] font-black text-slate-500 uppercase">G+</th>
            <th className="w-8 text-center text-[0.65rem] font-black text-slate-500 uppercase">G-</th>
            <th className="w-10 text-center text-[0.65rem] font-black text-amber-500/80 uppercase">Pts</th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {standings.map((row, idx) => {
            const isTop2 = idx < 2;
            return (
              <tr
                key={row.id}
                onMouseEnter={e => handleMouseEnter(row, e)}
                onMouseLeave={handleMouseLeave}
                className={cn(
                  "border-b border-slate-800/40 transition-colors cursor-default hover:bg-slate-800/40",
                  isTop2 && "bg-emerald-500/[0.03] border-l-2 border-l-emerald-500"
                )}
              >
                <td className="py-2.5 px-4 font-bold text-[0.78rem] whitespace-nowrap overflow-hidden max-w-[140px] truncate">
                  <span className={cn("mr-2 text-[0.65rem] tabular-nums opacity-50", isTop2 && "text-emerald-500 opacity-100")}>
                    {idx + 1}.
                  </span>
                  {row.team_name}
                </td>
                <td className="w-8 text-center text-slate-500 text-[0.75rem] tabular-nums font-medium">{row.matchesPlayed}</td>
                <td className="w-8 text-center text-emerald-400 text-[0.75rem] tabular-nums font-bold">{row.gamesWon}</td>
                <td className="w-8 text-center text-rose-400/80 text-[0.75rem] tabular-nums font-medium">{row.gamesLost}</td>
                <td className="w-10 text-center text-amber-400 text-[0.8rem] tabular-nums font-black">{row.points}</td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr><td colSpan={5} className="p-6 text-center text-slate-600 text-[0.75rem] italic">Nenhum time</td></tr>
          )}
        </tbody>
      </table>

      {hovered && (
        <TeamMemberPopover team={hovered.team} players={players} anchor={{ x: hovered.x, y: hovered.y }} />
      )}
    </div>
  );
}

/**
 * Renders a match card showing the competing teams, phase/status pill, score (or "VS" when not finished),
 * lobby/external draft links, and optional admin controls for editing or deleting the match.
 *
 * @param lobby - Match/lobby object containing config (team ids/names, tournamentStage, forjaGroupId, externalLink), status, scores, and id
 * @param isAdmin - When `true`, shows admin action buttons for manual close/edit and deletion
 * @param onEdit - Callback invoked with the `lobby` when the admin presses the edit/close button
 * @param onDelete - Callback invoked with the `lobby.id` when the admin confirms deletion
 * @param teams - Array of team records used to resolve team names and captain metadata
 * @param players - Array of player records used to resolve captain nicknames
 * @returns The JSX element for the confrontation card populated with names, status, score, links, and admin actions
 */

function MatchConfrontationCard({ lobby, isAdmin, onEdit, onDelete, teams, players }: {
  lobby: ForjaLiveMatchSummary;
  isAdmin: boolean;
  onEdit: (lobby: ForjaLiveMatchSummary) => void;
  onDelete: (lobbyId: string) => void;
  teams: ForjaTeam[];
  players: ForjaPlayer[];
}) {
  const teamA = teams.find(t => t.id === lobby.config?.forjaTeamA);
  const teamB = teams.find(t => t.id === lobby.config?.forjaTeamB);

  const getCaptainNick = (team: ForjaTeam | undefined) => {
    if (!team || !team.captain_id) return '';
    const cap = players.find(p => p.discord_id === team.captain_id);
    return cap ? ` (Cap. ${cap.nick})` : '';
  };

  const nameA = teamA ? `${teamA.team_name}${getCaptainNick(teamA)}` : 'Time A';
  const nameB = teamB ? `${teamB.team_name}${getCaptainNick(teamB)}` : 'Time B';

  const isCompleted = isMatchCompleted(lobby);
  const scoreA = lobby.scoreA ?? 0;
  const scoreB = lobby.scoreB ?? 0;
  const safeExternalLink = toSafeExternalUrl(lobby.externalLink);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-amber-500/30 transition-all group relative overflow-hidden">
      {/* Header com Fase / Info */}
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {lobby.config?.tournamentStage === 'GROUP' ? `Fase de Grupos — Grupo ${lobby.config?.forjaGroupId || ''}` : 'Playoffs'}
        </span>
        {lobby.status === 'drafting' ? (
          <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> AO VIVO
          </span>
        ) : isCompleted ? (
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">
            Concluído
          </span>
        ) : (
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">
            Agendado
          </span>
        )}
      </div>

      {/* Nome dos times e placar */}
      <div className="flex items-center justify-between gap-3 my-2">
        {/* Time A */}
        <div className="flex-1 text-left min-w-0" title={nameA}>
          <p className={cn(
            "text-sm font-bold line-clamp-2",
            isCompleted && scoreA > scoreB ? "text-emerald-400 font-black" : "text-slate-200"
          )}>
            {nameA}
          </p>
        </div>

        {/* Placar ou VS */}
        <div className="flex items-center justify-center bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 min-w-[70px]">
          {isCompleted ? (
            <div className="flex items-center gap-1.5 text-sm font-black">
              <span className={scoreA > scoreB ? "text-emerald-400" : "text-slate-400"}>{scoreA}</span>
              <span className="text-slate-600 font-normal">x</span>
              <span className={scoreB > scoreA ? "text-emerald-400" : "text-slate-400"}>{scoreB}</span>
            </div>
          ) : (
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">VS</span>
          )}
        </div>

        {/* Time B */}
        <div className="flex-1 text-right min-w-0" title={nameB}>
          <p className={cn(
            "text-sm font-bold line-clamp-2",
            isCompleted && scoreB > scoreA ? "text-emerald-400 font-black" : "text-slate-200"
          )}>
            {nameB}
          </p>
        </div>
      </div>

      {/* Footer com link do lobby / external link e admin controls */}
      <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 mt-1">
        <div className="flex gap-2">
          {!isCompleted && (
            <a
              href={`/lobby/${lobby.id}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              Lobby →
            </a>
          )}
          {safeExternalLink && (
            <a
              href={safeExternalLink}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider transition-all"
            >
              Draft Externo 🔗
            </a>
          )}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => onEdit(lobby)}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-amber-500 hover:text-slate-950 text-amber-500 flex items-center justify-center transition-all border border-slate-800"
              title="Encerrar Partida Manual"
            >
              📝
            </button>
            <button
              onClick={() => onDelete(lobby.id)}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-rose-500 hover:text-white text-rose-400 flex items-center justify-center transition-all border border-slate-800"
              title="Remover Partida"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a match countdown card showing stage, name, localized scheduled date/time, dynamic countdown or live/ongoing status, streamer and lobby links, and an optional admin edit control.
 *
 * Displays:
 * - Stage badge ("Fase de Grupos" or "Playoffs") and a live pill when the match status is `drafting`.
 * - Localized weekday and time label using the pt-BR locale.
 * - A dynamic countdown in the form "Começa em: Xd Yh Zm" while the match is in the future, switches to "AO VIVO" when `status === 'drafting'` or to "Em andamento" when the scheduled time has passed.
 * - Streamer link (prepends `https://` when the URL does not start with `http`) and a lobby link to `/lobby/{match.id}`.
 *
 * @param match - The upcoming match object containing id, name, stage, status, optional scheduledDate (string|Date|Firebase Timestamp), optional scheduledTime ("HH:MM"), and optional streamerUrl.
 * @param isAdmin - When true, shows an edit button that invokes `onEdit`.
 * @param onEdit - Callback invoked with the match when the admin edit button is clicked.
 * @returns The rendered match card element.
 */
function MatchCountdownCard({ match, isAdmin, onEdit }: { match: ForjaLiveMatchSummary; isAdmin?: boolean; onEdit?: (m: ForjaLiveMatchSummary) => void }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const safeStreamerUrl = toSafeExternalUrl(match.streamerUrl);

  const targetDate = useMemo(() => {
    return resolveForjaMatchDateTime(match.scheduledDate, match.scheduledTime);
  }, [match.scheduledDate, match.scheduledTime]);

  useEffect(() => {
    if (!targetDate) return;

    const update = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft(match.status === 'drafting' ? 'AO VIVO' : 'Em andamento');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`Começa em: ${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m`);
    };

    update();
    const timer = setInterval(update, 30000); // Atualiza a cada 30s
    return () => clearInterval(timer);
  }, [targetDate, match.status]);

  const dateLabel = useMemo(() => {
    if (!targetDate) return '';
    const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(targetDate);
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    const timeStr = new Intl.DateTimeFormat('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(targetDate);

    return `${capitalizedDay}, ${timeStr}`;
  }, [targetDate]);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-amber-500/30 transition-all group">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-amber-500/10 text-amber-500 text-[0.65rem] font-black px-2 py-0.5 rounded uppercase tracking-wider">
            {match.stage === 'GROUP' ? 'Fase de Grupos' : 'Playoffs'}
          </span>
          {match.status === 'drafting' && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-[0.65rem] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> AO VIVO
            </span>
          )}
        </div>
        <h4 className="text-white font-black text-lg group-hover:text-amber-400 transition-colors">{match.name}</h4>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-slate-400 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>{dateLabel || 'Data a definir'}</span>
          </div>
          {timeLeft && (
            <div className="flex items-center gap-1.5 text-amber-500/90 font-bold">
              <span>⏰</span>
              <span>{timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        {safeStreamerUrl && (
          <a 
            href={safeStreamerUrl}
            target="_blank" 
            rel="noreferrer"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#9146FF]/10 hover:bg-[#9146FF] text-[#9146FF] hover:text-white border border-[#9146FF]/20 px-4 py-2 rounded-lg text-xs font-black transition-all"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M11.571 4.714h1.715v5.143H11.57V4.714zm4.715 0h1.714v5.143h-1.714V4.714zM4.714 0L1.714 3v16.286h5.143V24l4.286-4.714h3.428L22.286 12V0H4.714zm15.857 11.143l-3.428 3.428h-3.857l-3 3v-3H6.857V1.714h13.714v9.429z"/>
            </svg>
            AO VIVO
          </a>
        )}
        <a
          href={`/lobby/${match.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg text-xs font-black transition-all"
        >
          LOBBY →
        </a>

        {isAdmin && (
          <button
            onClick={() => onEdit?.(match)}
            className="flex items-center justify-center bg-slate-800/50 hover:bg-amber-500 hover:text-slate-900 text-amber-500 w-10 h-10 rounded-lg transition-all border border-slate-700"
            title="Editar Agendamento"
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}

function PlayoffSlotRow({
  slot,
  score,
  isWinner,
}: {
  slot: ForjaBracketSlot;
  score: number | null;
  isWinner: boolean;
}) {
  const seed = getSlotSeed(slot);
  const [imageFailed, setImageFailed] = useState(false);
  const team = slot.kind === 'team' ? slot.team : null;
  const imageUrl = team?.image_url && !imageFailed ? team.image_url : null;
  const fallbackInitial = team?.team_name.trim().charAt(0).toUpperCase() || seed?.charAt(0) || '?';

  return (
    <div className={cn("forja-bracket-slot", isWinner && "forja-bracket-slot--winner", slot.kind === 'pending' && "forja-bracket-slot--pending")}>
      {team && (
        <div className="forja-bracket-team-logo" aria-hidden="true">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{fallbackInitial}</span>
          )}
        </div>
      )}
      <div className="forja-bracket-slot__team">
        {seed && <span className="forja-bracket-seed">{seed}</span>}
        <span>{getSlotLabel(slot)}</span>
      </div>
      {score !== null && <span className="forja-bracket-score">{score}</span>}
    </div>
  );
}

function PlayoffMatchCard({
  match,
  isAdmin,
  busy,
  onCreateMatch,
  onReportMatch,
}: {
  match: ForjaBracketMatch;
  isAdmin: boolean;
  busy: boolean;
  onCreateMatch: (match: ForjaBracketMatch) => void;
  onReportMatch: (match: ForjaLiveMatchSummary) => void;
}) {
  const lobby = match.lobby;
  const completed = isMatchCompleted(lobby);
  const scoreA = lobby ? lobby.scoreA ?? 0 : null;
  const scoreB = lobby ? lobby.scoreB ?? 0 : null;
  const teamAWon = completed && scoreA !== null && scoreB !== null && scoreA > scoreB;
  const teamBWon = completed && scoreA !== null && scoreB !== null && scoreB > scoreA;
  const safeExternalLink = toSafeExternalUrl(lobby?.externalLink);
  const statusLabel = !lobby
    ? match.canCreate ? 'Pronto' : 'Aguardando'
    : lobby.status === 'drafting' ? 'Ao vivo'
      : completed ? 'Concluido'
        : 'Agendado';
  const lobbyActionLabel = completed ? 'Ver draft' : lobby?.status === 'drafting' ? 'Ver draft' : 'Iniciar draft';

  return (
    <article className={cn("forja-bracket-match", `forja-bracket-match--${match.round.toLowerCase()}`)}>
      <div className="forja-bracket-match__top">
        <div>
          <div className="forja-bracket-match__meta">
            <span className="forja-bracket-match__label">{match.label}</span>
            <span className="forja-bracket-series">{getForjaSeriesDisplayLabel(match.seriesType)}</span>
          </div>
          <h4>{match.title}</h4>
        </div>
        <span className={cn("forja-bracket-status", completed && "forja-bracket-status--done", lobby?.status === 'drafting' && "forja-bracket-status--live")}>
          {statusLabel}
        </span>
      </div>

      <div className="forja-bracket-match__slots">
        <PlayoffSlotRow slot={match.teamA} score={scoreA} isWinner={teamAWon} />
        <PlayoffSlotRow slot={match.teamB} score={scoreB} isWinner={teamBWon} />
      </div>

      <div className="forja-bracket-match__actions">
        {lobby ? (
          <>
            <a href={`/lobby/${lobby.id}`} target="_blank" rel="noreferrer" className="forja-bracket-action forja-bracket-action--primary">
              {lobbyActionLabel}
            </a>
            {safeExternalLink && (
              <a href={safeExternalLink} target="_blank" rel="noreferrer" className="forja-bracket-action">
                Detalhes
              </a>
            )}
            {isAdmin && !completed && (
              <button type="button" className="forja-bracket-action" onClick={() => onReportMatch(lobby)}>
                Reportar
              </button>
            )}
          </>
        ) : (
          <>
            {isAdmin && match.canCreate && (
              <button type="button" className="forja-bracket-action forja-bracket-action--primary" disabled={busy} onClick={() => onCreateMatch(match)}>
                {busy ? 'Criando...' : 'Criar partida'}
              </button>
            )}
            {!match.canCreate && <span className="forja-bracket-pending">{match.teamA.kind === 'pending' || match.teamB.kind === 'pending' ? 'Esperando resultado' : 'Sem lobby'}</span>}
          </>
        )}
      </div>
    </article>
  );
}

function PlayoffBracketPanel({
  bracket,
  isAdmin,
  busyMatchId,
  onGenerateQuarterfinals,
  onCreateMatch,
  onReportMatch,
}: {
  bracket: ReturnType<typeof buildForjaPlayoffBracket>;
  isAdmin: boolean;
  busyMatchId: ForjaPlayoffMatchId | 'QUARTERFINALS' | null;
  onGenerateQuarterfinals: () => void;
  onCreateMatch: (match: ForjaBracketMatch) => void;
  onReportMatch: (match: ForjaLiveMatchSummary) => void;
}) {
  const totalRequired = FORJA_GROUP_IDS.reduce((sum, groupId) => sum + bracket.groupCompletion[groupId].requiredMatches, 0);
  const totalCompleted = FORJA_GROUP_IDS.reduce((sum, groupId) => sum + bracket.groupCompletion[groupId].completedMatches, 0);
  const totalExpected = totalRequired || 24;
  const totalRemaining = Math.max(totalExpected - totalCompleted, 0);
  const remainingLabel = totalRemaining === 1
    ? 'Falta 1 confronto da Fase de Grupos.'
    : `Faltam ${totalRemaining} confrontos da Fase de Grupos.`;

  return (
    <section className="forja-playoffs-panel">
      <div className="forja-playoffs-panel__header">
        <div>
          <span className="forja-playoffs-kicker">Mata-mata oficial</span>
          <h3>Playoffs FORJA</h3>
          <p>Top 2 de cada grupo. {FORJA_PLAYOFF_RULES_COPY}</p>
        </div>
        <div className="forja-playoffs-gate">
          <span>{totalCompleted}/{totalExpected} partidas encerradas</span>
          {isAdmin && (
            <div className="forja-playoffs-actions">
              <button
                type="button"
                className="forja-btn forja-btn--primary"
                disabled={!bracket.canGenerateQuarterfinals || busyMatchId !== null}
                onClick={onGenerateQuarterfinals}
              >
                {busyMatchId === 'QUARTERFINALS' ? 'Gerando...' : bracket.hasQuarterfinals ? 'Bracket existente' : 'Gerar Quartas'}
              </button>
              {!bracket.allGroupsComplete && (
                <span className="forja-playoffs-actions__helper">
                  Disponível após todos os grupos chegarem a 6/6 confrontos.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!bracket.allGroupsComplete && (
        <div className="forja-playoffs-blocked">
          <div className="forja-playoffs-blocked__header">
            <strong>Playoffs bloqueados</strong>
            <span>{remainingLabel}</span>
          </div>
          <p>Complete todos os confrontos da Fase de Grupos para liberar a geração automática da bracket.</p>
          <div className="forja-playoffs-blocked__groups">
            {FORJA_GROUP_IDS.map((groupId) => {
              const completion = bracket.groupCompletion[groupId];
              return (
                <span key={groupId}>
                  Grupo {groupId}: {completion.completedMatches}/{completion.requiredMatches || 6}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="forja-playoffs-groups">
        {FORJA_GROUP_IDS.map((groupId) => {
          const completion = bracket.groupCompletion[groupId];
          return (
            <div key={groupId} className={cn("forja-playoffs-group-chip", completion.isComplete && "forja-playoffs-group-chip--complete")}>
              <span>Grupo {groupId}</span>
              <strong>{completion.completedMatches}/{completion.requiredMatches || 6}</strong>
            </div>
          );
        })}
      </div>

      <div className="forja-bracket-board">
        {FORJA_BRACKET_ROUNDS.map((round) => {
          const roundMatches = bracket.matches
            .filter((match) => match.round === round)
            .sort((left, right) => left.order - right.order);
          return (
            <div key={round} className="forja-bracket-round">
              <div className="forja-bracket-round__title">{getForjaPlayoffRoundLabel(round)}</div>
              <div className="forja-bracket-round__matches">
                {roundMatches.map((match) => (
                  <PlayoffMatchCard
                    key={match.id}
                    match={match}
                    isAdmin={isAdmin}
                    busy={busyMatchId === match.id}
                    onCreateMatch={onCreateMatch}
                    onReportMatch={onReportMatch}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Render a prize summary card showing the total prize pool and the per-place distribution.
 *
 * @param total - Total prize pool amount (number)
 * @param currency - Currency code; `'BRL'` formats with `R$`, otherwise `$`
 * @param distribution - Array of distribution entries where each entry specifies:
 *   - `place`: numeric rank (1 for first place, etc.)
 *   - `label`: display label for the place (e.g., "1º Lugar")
 *   - `percent`: percentage of `total` awarded to this place (0–100)
 * @returns A React element displaying the formatted total prize and the calculated amount for each distribution entry
 */
function PrizeCard({ total, currency, distribution }: {
  total: number;
  currency: string;
  distribution: Array<{ place: number; label: string; percent: number }>;
}) {
  const fmt = (val: number) => `${currency === 'BRL' ? 'R$' : '$'} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const PLACE_COLORS = ['#facc15', '#94a3b8', '#c2884f', '#64748b'];
  const PLACE_ICONS = ['🥇', '🥈', '🥉', '🏅'];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(30,41,59,0.9) 100%)',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: '1rem',
      padding: '1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>🏆 Premiação</span>
        <span style={{ color: '#facc15', fontWeight: 900, fontSize: '1.1rem' }}>{fmt(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {Array.isArray(distribution) && distribution.map((d, i) => (
          <div key={`${d.place}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: PLACE_COLORS[i] ?? '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
              {PLACE_ICONS[i] ?? '🏅'} {d.label}
            </span>
            <span style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700 }}>
              {fmt(Math.round(total * d.percent / 100))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ForjaHomeProps extends ForjaViewProps {
  onRegisterClick: () => void;
  onTabChange?: (tab: string) => void;
}

type CreateOfficialForjaMatchInput = {
  matchName: string;
  teamA: ForjaTeam;
  teamB: ForjaTeam;
  tournamentStage: ForjaMatchStage;
  seriesType: Extract<SeriesType, '3G' | 'BO3' | 'BO5'>;
  groupId?: ForjaGroupId;
  playoffMatchId?: ForjaPlayoffMatchId;
  playoffRound?: ForjaPlayoffRound;
  playoffSourceA?: ForjaPlayoffMatchId;
  playoffSourceB?: ForjaPlayoffMatchId;
  scheduledDate?: Date | null;
  scheduledTime?: string | null;
  streamerUrl?: string | null;
};

/**
 * Renders the Forja tournament home dashboard with registration status, current phase, participants, prize display, upcoming matches, and compact group standings.
 *
 * @param discordUser - Authenticated Discord user profile shown in the registration status area; omitted when not provided.
 * @param isAdmin - When true, displays an admin hint banner with configuration guidance.
 * @param onRegisterClick - Callback invoked when the user clicks the register button.
 * @param onTabChange - Optional callback used to navigate to other tabs (for example 'inscritos' or 'tabela').
 * @returns The JSX element for the Forja home/dashboard view.
 */
export default function ForjaHome({ discordUser, isAdmin, onRegisterClick, onTabChange }: ForjaHomeProps) {
  const { settings } = useForjaSettings();
  const { teams } = useForjaTeams(isAdmin);
  const { rankedPlayers } = useForjaPlayers(isAdmin);

  const [prizeData, setPrizeData] = useState<Partial<ForjaPrizeConfig> | null>(null);
  const [lobbies, setLobbies] = useState<ForjaLiveMatchSummary[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [editingMatch, setEditingMatch] = useState<ForjaLiveMatchSummary | null>(null);
  const [busyPlayoffMatchId, setBusyPlayoffMatchId] = useState<ForjaPlayoffMatchId | 'QUARTERFINALS' | null>(null);

  // Match Creator Form States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTeamA, setSelectedTeamA] = useState('');
  const [selectedTeamB, setSelectedTeamB] = useState('');
  const [matchStage, setMatchStage] = useState<ForjaMatchStage>('GROUP');
  const [matchGroup, setMatchGroup] = useState<ForjaGroupId>('A');
  const [groupRound, setGroupRound] = useState<string>('1');
  const [playoffRound, setPlayoffRound] = useState<string>('Quartas');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [streamerUrl, setStreamerUrl] = useState<string>('');

  // Match Center Tab State
  const [selectedPhase, setSelectedPhase] = useState<ForjaMatchCenterPhase>('A');

  // Manual editing lobby state (Match Center)
  const [editingLobby, setEditingLobby] = useState<ForjaLiveMatchSummary | null>(null);

  // Reset selected teams on changes
  useEffect(() => {
    setSelectedTeamA('');
    setSelectedTeamB('');
  }, [matchGroup, matchStage]);

  const availableTeamsForA = useMemo(() => {
    if (matchStage === 'GROUP') {
      return teams.filter(t => t.groupId === matchGroup);
    }
    return teams;
  }, [teams, matchGroup, matchStage]);

  const availableTeamsForB = useMemo(() => {
    return availableTeamsForA.filter(t => t.id !== selectedTeamA);
  }, [availableTeamsForA, selectedTeamA]);

  const handleUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    try {
      const lobbyRef = doc(db, 'lobbies', editingMatch.id);
      const form = e.target as HTMLFormElement;
      const scheduledDate = (form.elements.namedItem('date') as HTMLInputElement).value;
      const scheduledTime = (form.elements.namedItem('time') as HTMLInputElement).value;
      const streamerUrl = (form.elements.namedItem('streamer') as HTMLInputElement).value;

      const finalDate = resolveForjaMatchDateTime(scheduledDate, scheduledTime);
      if (!finalDate) {
        throw new Error('Data da partida invalida.');
      }

      await updateDoc(lobbyRef, {
        'config.scheduledDate': finalDate,
        'config.scheduledTime': scheduledTime,
        'config.streamerUrl': streamerUrl
      });
      await lobbyService.syncPublicMetadataForLobby(editingMatch.id);

      // Local state update for instant feedback
      setLobbies(prev => prev.map(l => l.id === editingMatch.id ? { 
        ...l, 
        scheduledDate: finalDate,
        scheduledTime,
        streamerUrl,
        config: {
          ...l.config,
          scheduledDate: finalDate,
          scheduledTime,
          streamerUrl,
        },
      } : l));

      setEditingMatch(null);
      alert('Agendamento atualizado!');
    } catch (err) {
      alert(`Erro ao atualizar: ${getErrorMessage(err)}`);
    }
  };

  const buildTeamPlayers = (team: ForjaTeam): TeamPlayer[] => (
    team.members.slice(0, 3).map((discordId, idx) => {
      const player = rankedPlayers.find(p => p.discord_id === discordId);
      return { name: player?.nick || `Player ${idx + 1}`, position: idx };
    })
  );

  const createOfficialForjaLobby = async (input: CreateOfficialForjaMatchInput): Promise<Lobby> => {
    if (!discordUser) {
      throw new Error('Login Discord necessario para criar partidas oficiais.');
    }

    const customGameCount = input.seriesType === 'BO5' ? 5 : 3;
    const teamAPlayers = buildTeamPlayers(input.teamA);
    const teamBPlayers = buildTeamPlayers(input.teamB);
    const config: LobbyConfig = {
      name: input.matchName,
      preset: 'FORJA',
      isOfficialForjaMatch: true,
      tournamentStage: input.tournamentStage,
      forjaTeamA: input.teamA.id,
      forjaTeamB: input.teamB.id,
      forjaGroupId: input.groupId,
      forjaPlayoffMatchId: input.playoffMatchId,
      forjaPlayoffRound: input.playoffRound,
      forjaPlayoffSourceA: input.playoffSourceA,
      forjaPlayoffSourceB: input.playoffSourceB,
      seriesType: input.seriesType,
      teamSize: 3,
      customGameCount,
      pickType: 'alternated',
      isExclusive: false,
      hasBans: false,
      banCount: 0,
      mapBanCount: 0,
      mapTurnOrder: [],
      godTurnOrder: [],
      allowedMaps: FORJA_MAP_POOL,
      allowedPantheons: MAJOR_GODS.map(g => g.id),
      firstMapRandom: false,
      loserPicksNextMap: false,
      acePick: false,
      acePickHidden: false,
      isPrivate: false,
      timerDuration: 60,
      hasMap3RandomRoll: true,
      captainA_discordId: input.teamA.captain_id,
      captainB_discordId: input.teamB.captain_id,
      scheduledDate: input.scheduledDate ?? null,
      scheduledTime: input.scheduledTime || null,
      streamerUrl: input.streamerUrl || null,
    };

    const id = generateId();
    const lobby: Lobby = {
      id,
      status: 'waiting',
      phase: 'waiting',
      captain1: null,
      captain2: null,
      captain1Name: input.teamA.team_name,
      captain2Name: input.teamB.team_name,
      teamAName: input.teamA.team_name,
      teamBName: input.teamB.team_name,
      teamAPlayers,
      teamBPlayers,
      readyA: false,
      readyB: false,
      readyA_report: false,
      readyB_report: false,
      readyA_nextGame: false,
      readyB_nextGame: false,
      rosterChangedA: false,
      rosterChangedB: false,
      lastSubs: [],
      resetRequest: null,
      spectators: [],
      config,
      selectedMap: null,
      seriesMaps: Array(customGameCount).fill(''),
      mapBans: [],
      turn: 0,
      turnOrder: [],
      bans: [],
      picks: hydrateMclPicksWithRosterNames(1, teamAPlayers, teamBPlayers),
      scoreA: 0,
      scoreB: 0,
      reportVoteA: null,
      reportVoteB: null,
      voteConflict: false,
      voteConflictCount: 0,
      currentGame: 1,
      pickerVoteA: null,
      pickerVoteB: null,
      pickerPlayerA: null,
      pickerPlayerB: null,
      history: [],
      replayLog: [],
      lastWinner: null,
      mapPool: [],
      timerStart: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      hiddenActions: [],
      adminId: discordUser.discord_id,
    };

    await lobbyService.createLobby(id, lobby);
    return lobby;
  };

  const handleCreateMatch = async () => {
    if (!selectedTeamA || !selectedTeamB || selectedTeamA === selectedTeamB) {
      alert('Selecione dois times diferentes.');
      return;
    }

    const teamA = teams.find(t => t.id === selectedTeamA);
    const teamB = teams.find(t => t.id === selectedTeamB);
    if (!teamA || !teamB) {
      alert('Times selecionados nao encontrados.');
      return;
    }

    const matchName = matchStage === 'GROUP'
      ? `Gr${matchGroup} - R${groupRound} - ${teamA.team_name} x ${teamB.team_name}`
      : `${playoffRound} - ${teamA.team_name} x ${teamB.team_name}`;

    try {
      const lobby = await createOfficialForjaLobby({
        matchName,
        teamA,
        teamB,
        tournamentStage: matchStage,
        groupId: matchStage === 'GROUP' ? matchGroup : undefined,
        seriesType: matchStage === 'GROUP' ? '3G' : (matchStage === 'PLAYOFFS_BO5' ? 'BO5' : 'BO3'),
        scheduledDate: scheduledDate ? resolveForjaMatchDateTime(scheduledDate, scheduledTime) : null,
        scheduledTime,
        streamerUrl,
      });

      if (streamerUrl) {
        try {
          const castersRef = collection(db, 'casters');
          const cleanUrl = streamerUrl.trim().toLowerCase();
          const castersQuery = query(castersRef, where('streamUrl', '==', cleanUrl));

          const snap = await getDocs(castersQuery);
          if (snap.empty) {
            const namePart = cleanUrl.includes('twitch.tv/')
              ? cleanUrl.split('twitch.tv/')[1]?.split('/')[0]
              : 'Caster Oficial';
            await setDoc(doc(db, 'casters', generateId()), {
              name: namePart.toUpperCase(),
              streamUrl: cleanUrl,
              status: 'approved',
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error('[Caster Registration Error]', e);
        }
      }

      setLobbies(prev => upsertForjaLiveMatchSummary(prev, lobbyToForjaLiveMatchSummary(lobby)));
      alert(`Partida criada com sucesso!`);
      setSelectedTeamA('');
      setSelectedTeamB('');
      setScheduledDate('');
      setScheduledTime('');
      setStreamerUrl('');
    } catch (err) {
      alert(`Erro: ${getErrorMessage(err)}`);
    }
  };

  const handleManualClose = async (lobbyId: string, teamAScore: number, teamBScore: number, externalLink?: string) => {
    if (!confirm('Deseja encerrar esta partida manualmente?')) return;
    try {
      const lobbyRef = doc(db, 'lobbies', lobbyId);
      await updateDoc(lobbyRef, {
        status: 'completed',
        phase: 'finished',
        scoreA: teamAScore,
        scoreB: teamBScore,
        'config.externalDraftLink': externalLink || null,
        finishedAt: serverTimestamp(),
      });
      await lobbyService.syncPublicMetadataForLobby(lobbyId);
      setLobbies(prev => prev.map(l => l.id === lobbyId ? {
        ...l,
        status: 'completed',
        scoreA: teamAScore,
        scoreB: teamBScore,
        externalLink: externalLink || '',
      } : l));
      setEditingLobby(null);
    } catch (err) {
      alert(`Erro ao encerrar: ${getErrorMessage(err)}`);
    }
  };

  const handleDeleteMatch = async (lobbyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta partida? Esta ação é irreversível.')) return;
    try {
      await lobbyService.deleteLobby(lobbyId);
      setLobbies(prev => removeForjaLiveMatchSummary(prev, lobbyId));
    } catch (err) {
      alert(`Erro ao remover: ${getErrorMessage(err)}`);
    }
  };

  const filteredLobbies = useMemo(() => {
    return lobbies.filter(l => {
      if (selectedPhase === 'PLAYOFFS') {
        return l.stage !== 'GROUP';
      }
      return l.stage === 'GROUP' && l.config?.forjaGroupId === selectedPhase;
    });
  }, [lobbies, selectedPhase]);

  const playoffBracket = useMemo(() => buildForjaPlayoffBracket(teams, lobbies), [teams, lobbies]);

  const refreshOfficialMatches = async (): Promise<ForjaLiveMatchSummary[]> => {
    const officialMatches = await getForjaOfficialMatchesOnce({ forceRefresh: true });
    const merged = mergeForjaLiveMatches(lobbies, officialMatches);
    setLobbies(merged);
    return merged;
  };

  const createPlayoffLobbyForMatch = async (match: ForjaBracketMatch): Promise<Lobby> => {
    if (!isForjaBracketSlotReady(match.teamA) || !isForjaBracketSlotReady(match.teamB)) {
      throw new Error('Partida ainda depende de resultados anteriores.');
    }

    const tournamentStage: ForjaMatchStage = match.seriesType === 'BO5' ? 'PLAYOFFS_BO5' : 'PLAYOFFS_BO3';
    return createOfficialForjaLobby({
      matchName: `${match.label} - ${match.teamA.team.team_name} x ${match.teamB.team.team_name}`,
      teamA: match.teamA.team,
      teamB: match.teamB.team,
      tournamentStage,
      seriesType: match.seriesType,
      playoffMatchId: match.id,
      playoffRound: match.round,
      playoffSourceA: match.sourceA?.matchId,
      playoffSourceB: match.sourceB?.matchId,
    });
  };

  const handleCreatePlayoffMatch = async (match: ForjaBracketMatch) => {
    if (busyPlayoffMatchId) return;
    setBusyPlayoffMatchId(match.id);

    try {
      const refreshedMatches = await refreshOfficialMatches();
      const refreshedBracket = buildForjaPlayoffBracket(teams, refreshedMatches);
      const freshMatch = refreshedBracket.matches.find((item) => item.id === match.id);
      if (!freshMatch) throw new Error('Partida do bracket nao encontrada.');
      if (freshMatch.lobby) throw new Error('Esta partida ja possui lobby.');

      const lobby = await createPlayoffLobbyForMatch(freshMatch);
      setLobbies(prev => upsertForjaLiveMatchSummary(prev, lobbyToForjaLiveMatchSummary(lobby)));
    } catch (err) {
      alert(`Erro ao criar partida: ${getErrorMessage(err)}`);
    } finally {
      setBusyPlayoffMatchId(null);
    }
  };

  const handleGenerateQuarterfinals = async () => {
    if (busyPlayoffMatchId) return;
    setBusyPlayoffMatchId('QUARTERFINALS');

    try {
      const refreshedMatches = await refreshOfficialMatches();
      const refreshedBracket = buildForjaPlayoffBracket(teams, refreshedMatches);
      if (!refreshedBracket.allGroupsComplete) {
        throw new Error('Fase de grupos ainda incompleta.');
      }
      if (refreshedBracket.hasQuarterfinals) {
        throw new Error('Bracket de quartas ja existe.');
      }

      let nextMatches = refreshedMatches;
      const quarterfinals = refreshedBracket.matches.filter((match) => match.round === 'QUARTERFINALS' && match.canCreate);
      for (const quarterfinal of quarterfinals) {
        const lobby = await createPlayoffLobbyForMatch(quarterfinal);
        nextMatches = upsertForjaLiveMatchSummary(nextMatches, lobbyToForjaLiveMatchSummary(lobby));
      }
      setLobbies(nextMatches);
    } catch (err) {
      alert(`Erro ao gerar bracket: ${getErrorMessage(err)}`);
    } finally {
      setBusyPlayoffMatchId(null);
    }
  };

  // Cold summary fetch
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getForjaLiveMatchesSummaryOnce(),
      getForjaOfficialMatchesOnce().catch((err) => {
        console.error('Erro ao buscar partidas oficiais Forja', err);
        return [];
      }),
    ])
      .then(([summary, officialMatches]) => {
        if (!isMounted) return;
        const summaryMatches = Array.isArray(summary?.matches) ? summary.matches : [];
        setLobbies(mergeForjaLiveMatches(summaryMatches, officialMatches));
        setDataLoaded(true);
      })
      .catch((err) => {
        console.error('Erro ao buscar resumo de partidas Forja', err);
        if (isMounted) setDataLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch prizes
  useEffect(() => {
    getForjaContentOnce<ForjaPrizeConfig>('prizes')
      .then(prizes => {
        setPrizeData(prizes);
      })
      .catch(err => {
        console.error('Erro ao buscar premiações', err);
      });
  }, []);

  const groups = FORJA_GROUP_IDS.filter(g => teams.some(t => t.groupId === g));
  const activeGroups = groups.length > 0 ? groups : [];

  const phase = settings?.current_phase ?? 'pre_tournament';
  const phaseMeta = PHASE_LABELS[phase] ?? PHASE_LABELS.pre_tournament;
  const playoffFmt = settings?.playoff_format ?? 'single_elim';
  const totalPlayers = rankedPlayers.filter(p => !p.is_reserve).length;
  const isRegistered = rankedPlayers.some(p => p.discord_id === discordUser?.discord_id);

  // Upcoming lobbies (não finalizados, máx 6)
  const upcoming = lobbies
    .filter(l => l.status !== 'completed' && l.status !== 'finished')
    .sort((a, b) => {
      const getMs = (l: ForjaLiveMatchSummary) => {
        return resolveForjaMatchDateTime(l.scheduledDate, l.scheduledTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      };

      const aMs = getMs(a);
      const bMs = getMs(b);

      // Secondary sort: if dates are equal, LIVE matches should come first.
      if (aMs === bMs) {
        if (a.status === 'drafting' && b.status !== 'drafting') return -1;
        if (b.status === 'drafting' && a.status !== 'drafting') return 1;
      }

      return aMs - bMs;
    })
    .slice(0, UPCOMING_MATCH_LIMIT);

  return (
    <section className="forja-view forja-view--home">

      {/* ── Status de Inscrição (compacto) ─────────────────────────────────── */}
      {discordUser && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: isRegistered
            ? 'rgba(74,222,128,0.06)'
            : 'rgba(245,158,11,0.06)',
          border: `1px solid ${isRegistered ? 'rgba(74,222,128,0.2)' : 'rgba(245,158,11,0.2)'}`,
          borderRadius: '0.75rem', padding: '0.75rem 1.25rem',
          marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={discordUser.avatar_url || undefined}
              alt={discordUser.username}
              style={{ width: '2rem', height: '2rem', borderRadius: '50%' }}
              referrerPolicy="no-referrer"
            />
            <div>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.88rem' }}>{discordUser.username}</span>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: isRegistered ? '#4ade80' : '#f59e0b', fontWeight: 700 }}>
                {isRegistered ? '✓ Inscrito' : '— Não inscrito'}
              </span>
            </div>
          </div>
          {!isRegistered && (
            <button
              className="forja-btn forja-btn--primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              onClick={onRegisterClick}
            >
              🔥 Inscrever-se
            </button>
          )}
          {isRegistered && (
            <button
              className="forja-btn forja-btn--ghost"
              style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#94a3b8' }}
              onClick={() => onTabChange?.('inscritos')}
            >
              Ver perfil →
            </button>
          )}
        </div>
      )}

      {/* ── Admin Match Creator Accordion ─────────────────────────────────── */}
      {isAdmin && (
        <div style={{ marginBottom: '2rem' }}>
          <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '1rem',
              background: 'rgba(30, 41, 59, 0.4)',
              border: '2px dashed rgba(245, 158, 11, 0.2)',
              borderRadius: '1rem',
              color: '#facc15',
              fontWeight: 800,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="hover:bg-slate-900/60 hover:border-amber-400 hover:text-white"
          >
            <span>{showCreateForm ? '✕' : '➕'}</span>
            <span>{showCreateForm ? 'Fechar Formulário de Criação' : 'Criar Lobby Oficial de Partida'}</span>
          </button>
          {showCreateForm && (
            <div style={{ marginTop: '1rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '1rem', padding: '1.5rem' }}>
              <h3 style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                ⚙️ Criar Nova Partida Oficial do Forja
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                {/* Stage Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Fase da Partida</label>
                  <select 
                    value={matchStage} 
                    onChange={e => {
                      if (isForjaMatchStage(e.target.value)) setMatchStage(e.target.value);
                    }}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="GROUP">Fase de Grupos</option>
                    <option value="PLAYOFFS_BO3">Playoffs (BO3)</option>
                    <option value="PLAYOFFS_BO5">Playoffs (BO5)</option>
                  </select>
                </div>

                {/* Conditional Fields based on Stage */}
                {matchStage === 'GROUP' ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Grupo</label>
                      <select 
                        value={matchGroup} 
                        onChange={e => {
                          if (isForjaGroupId(e.target.value)) setMatchGroup(e.target.value);
                        }}
                        style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                        className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                      >
                        <option value="A">Grupo A</option>
                        <option value="B">Grupo B</option>
                        <option value="C">Grupo C</option>
                        <option value="D">Grupo D</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Rodada</label>
                      <select 
                        value={groupRound} 
                        onChange={e => setGroupRound(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                        className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                      >
                        <option value="1">1ª Rodada</option>
                        <option value="2">2ª Rodada</option>
                        <option value="3">3ª Rodada</option>
                      </select>
                    </div>
                  </>
                ) : (
                  /* Playoffs Stage */
                  <div>
                    <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Rodada Playoffs</label>
                    <select 
                      value={playoffRound} 
                      onChange={e => setPlayoffRound(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                      className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                    >
                      <option value="Quartas">Quartas de Final</option>
                      <option value="Semifinal">Semifinal</option>
                      <option value="Decisão 3º Lugar">Decisão de 3º Lugar</option>
                      <option value="Grande Final">Grande Final</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Seleção de Times */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Time A (Host)</label>
                  <select 
                    value={selectedTeamA} 
                    onChange={e => setSelectedTeamA(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="">Selecione o Time A</option>
                    {availableTeamsForA.map(t => (
                      <option key={t.id} value={t.id}>{t.team_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Time B (Guest)</label>
                  <select 
                    value={selectedTeamB} 
                    onChange={e => setSelectedTeamB(e.target.value)}
                    disabled={!selectedTeamA}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none', opacity: selectedTeamA ? 1 : 0.5 }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="">Selecione o Time B</option>
                    {availableTeamsForB.map(t => (
                      <option key={t.id} value={t.id}>{t.team_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data, Horário e Caster */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Data do Jogo</label>
                  <input 
                    type="date" 
                    value={scheduledDate} 
                    onChange={e => setScheduledDate(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Horário (Local BRT)</label>
                  <input 
                    type="time" 
                    value={scheduledTime} 
                    onChange={e => setScheduledTime(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Canal de Transmissão (URL)</label>
                  <input 
                    type="text" 
                    placeholder="twitch.tv/nome_do_caster"
                    value={streamerUrl} 
                    onChange={e => setStreamerUrl(e.target.value)}
                    style={{ width: '100%', padding: '0.7rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  />
                </div>
              </div>

              {/* Botão de Envio */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
                <button 
                  onClick={handleCreateMatch}
                  disabled={!selectedTeamA || !selectedTeamB}
                  style={{
                    background: selectedTeamA && selectedTeamB ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)' : '#1e293b',
                    color: selectedTeamA && selectedTeamB ? '#0f172a' : '#64748b',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 2rem',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    cursor: selectedTeamA && selectedTeamB ? 'pointer' : 'not-allowed',
                    boxShadow: selectedTeamA && selectedTeamB ? '0 4px 15px rgba(234, 179, 8, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover:scale-[1.02]"
                >
                  🚀 Inicializar Partida Oficial
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Grid principal ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>

        {/* Fase atual */}
        <div style={{
          background: 'rgba(30,41,59,0.7)', border: '1px solid #1e293b',
          borderRadius: '1rem', padding: '1rem 1.25rem',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Fase Atual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{phaseMeta.icon}</span>
            <span style={{ color: phaseMeta.color, fontWeight: 800, fontSize: '1rem' }}>{phaseMeta.label}</span>
          </div>
          {phase === 'playoffs' && (
            <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '0.2rem' }}>
              {PLAYOFF_FORMAT_LABEL[playoffFmt] ?? 'Eliminação Simples'}
            </div>
          )}
        </div>

        {/* Participantes */}
        <div style={{
          background: 'rgba(30,41,59,0.7)', border: '1px solid #1e293b',
          borderRadius: '1rem', padding: '1rem 1.25rem',
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Participantes</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ color: '#f8fafc', fontWeight: 900, fontSize: '1.8rem' }}>{teams.length}</span>
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>times</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '0.25rem' }}>/ {totalPlayers} jogadores</span>
          </div>
        </div>

        {/* Premiação */}
        {prizeData?.total_prize ? (
          <PrizeCard
            total={prizeData.total_prize}
            currency={prizeData.currency ?? 'BRL'}
            distribution={prizeData.distribution ?? []}
          />
        ) : (
          <div style={{
            background: 'rgba(30,41,59,0.7)', border: '1px solid #1e293b',
            borderRadius: '1rem', padding: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.75rem' }}>🏆</span>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Premiação</div>
              <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: '0.25rem' }}>A ser divulgada</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Próximas Partidas ──────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              🎮 Próximas Partidas
            </h3>
          </div>
          <div className="grid gap-3">
            {upcoming.map(match => (
              <MatchCountdownCard 
                key={match.id} 
                match={match} 
                isAdmin={isAdmin} 
                onEdit={setEditingMatch} 
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Tabela de Grupos Compacta ──────────────────────────────────────── */}
      {activeGroups.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              📊 Classificação — Fase de Grupos
            </h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '0.75rem', marginTop: '-0.25rem', opacity: 0.8, fontStyle: 'italic' }}>
            Passe o mouse sobre um time para ver os membros
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 w-full">
            {activeGroups.map(g => (
              <CompactStandings
                key={g}
                group={g}
                standings={playoffBracket.standingsByGroup[g]}
                players={rankedPlayers}
              />
            ))}
          </div>
        </div>
      )}

      {activeGroups.length > 0 && (
        <PlayoffBracketPanel
          bracket={playoffBracket}
          isAdmin={isAdmin}
          busyMatchId={busyPlayoffMatchId}
          onGenerateQuarterfinals={handleGenerateQuarterfinals}
          onCreateMatch={handleCreatePlayoffMatch}
          onReportMatch={setEditingLobby}
        />
      )}

      {/* ── Match Center (O Histórico de Partidas) ────────────────────────── */}
      <div style={{ marginTop: '3.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2.5rem' }}>
        <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🏟️</span> Match Center Oficial
        </h3>

        {/* Sub-navegação interna (Pills estilo Tailwind) */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
          {MATCH_CENTER_PHASES.map((phaseCode) => {
            const label = phaseCode === 'PLAYOFFS' ? 'Playoffs' : `Grupo ${phaseCode}`;
            const isActive = selectedPhase === phaseCode;
            return (
              <button
                key={phaseCode}
                onClick={() => setSelectedPhase(phaseCode)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '9999px',
                  background: isActive ? '#facc15' : 'rgba(30, 41, 59, 0.4)',
                  color: isActive ? '#0f172a' : '#94a3b8',
                  border: isActive ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 4px 15px rgba(250, 204, 21, 0.3)' : 'none'
                }}
                className="hover:scale-105"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Lista de Partidas Filtradas */}
        {selectedPhase === 'PLAYOFFS' ? (
          <PlayoffBracketPanel
            bracket={playoffBracket}
            isAdmin={isAdmin}
            busyMatchId={busyPlayoffMatchId}
            onGenerateQuarterfinals={handleGenerateQuarterfinals}
            onCreateMatch={handleCreatePlayoffMatch}
            onReportMatch={setEditingLobby}
          />
        ) : filteredLobbies.length === 0 ? (
          <div className="forja-empty" style={{ padding: '3rem 2rem' }}>
            <span style={{ fontSize: '2.5rem' }}>⚔️</span>
            <p style={{ marginTop: '0.75rem', color: '#64748b' }}>Nenhuma partida registrada nesta fase.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredLobbies.map(lobby => (
              <MatchConfrontationCard
                key={lobby.id}
                lobby={lobby}
                isAdmin={isAdmin}
                onEdit={setEditingLobby}
                onDelete={handleDeleteMatch}
                teams={teams}
                players={rankedPlayers}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Encerramento Manual de Partida */}
      {editingLobby && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">Encerrar Partida Manual</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">{editingLobby.config?.name || 'Partida'}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Placar Host</label>
                <input 
                  type="number" 
                  id="scoreA"
                  defaultValue={editingLobby.scoreA || 0}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 block">Placar Guest</label>
                <input 
                  type="number" 
                  id="scoreB"
                  defaultValue={editingLobby.scoreB || 0}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Link do Draft Externo (Opcional)</label>
              <input 
                type="text" 
                id="externalLink"
                placeholder="ex: mythosdraft.com/lobby/abc123xyz"
                defaultValue={editingLobby.externalLink || ''}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingLobby(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Cancelar</button>
              <button 
                onClick={() => {
                  const scoreAInput = document.getElementById('scoreA');
                  const scoreBInput = document.getElementById('scoreB');
                  const externalLinkInput = document.getElementById('externalLink');
                  if (!(scoreAInput instanceof HTMLInputElement)
                    || !(scoreBInput instanceof HTMLInputElement)
                    || !(externalLinkInput instanceof HTMLInputElement)) {
                    alert('Formulario de placar invalido.');
                    return;
                  }
                  const sA = parseInt(scoreAInput.value) || 0;
                  const sB = parseInt(scoreBInput.value) || 0;
                  const ext = externalLinkInput.value;
                  handleManualClose(editingLobby.id, sA, sB, ext);
                }}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado vazio (pré-torneio) ─────────────────────────────────────── */}
      {activeGroups.length === 0 && !dataLoaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="forja-loader-spinner" />
        </div>
      )}
      {activeGroups.length === 0 && dataLoaded && phase === 'pre_tournament' && (
        <div className="forja-empty" style={{ marginTop: '2rem' }}>
          <span>⏳</span>
          <p>O torneio ainda não começou. Acompanhe as inscrições na aba <strong>Inscritos</strong>.</p>
          <button
            className="forja-btn forja-btn--ghost"
            style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
            onClick={() => onTabChange?.('inscritos')}
          >
            Ver inscritos →
          </button>
        </div>
      )}

      {/* ── Admin Match Editor Modal ───────────────────────── */}
      {editingMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              ✏️ Editar Agendamento
            </h3>
            
            <form onSubmit={handleUpdateMatch} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Data da Partida</label>
                <input
                  name="date"
                  type="date"
                  defaultValue={(() => {
                    const d = resolveForjaMatchDateTime(
                      editingMatch.scheduledDate,
                      editingMatch.scheduledTime
                    );
                    if (d) return formatForjaDateInputValue(d);
                    return '';
                  })()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Horário (Local)</label>
                <input 
                  name="time" 
                  type="time" 
                  defaultValue={editingMatch.scheduledTime || ''} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">URL da Stream (Opcional)</label>
                <input 
                  name="streamer" 
                  type="text" 
                  placeholder="twitch.tv/seu_canal"
                  defaultValue={editingMatch.streamerUrl || ''} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin hint ─────────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="forja-admin-banner" style={{ marginTop: '2rem', fontSize: '0.78rem' }}>
          🛡️ Configure a fase atual e o formato dos playoffs nas <strong>Configurações</strong> da aba Inscritos.
        </div>
      )}
    </section>
  );
}
