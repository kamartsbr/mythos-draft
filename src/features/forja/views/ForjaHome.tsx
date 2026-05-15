/**
 * Forja de Hefesto — Aba: Início (Hub)
 * Resumo visual do torneio: status, fase atual, tabela compacta com hover,
 * próximas partidas e premiação.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ForjaViewProps, ForjaPlayer, ForjaTeam } from '../types';
import { useForjaSettings } from '../hooks/useForjaSettings';
import { useForjaTeams } from '../hooks/useForjaTeams';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { useForjaSchedule } from '../hooks/useForjaSchedule';
import { getForjaContentOnce } from '../services/forjaService';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../../../lib/utils';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface StandingRow extends ForjaTeam {
  gamesWon: number;
  gamesLost: number;
  matchesPlayed: number;
  points: number;
}

interface UpcomingMatch {
  id: string;
  name: string;
  status: string;
  scoreA?: number;
  scoreB?: number;
  stage: string;
  scheduledDate?: any; // Firestore Timestamp
  scheduledTime?: string;
  streamerUrl?: string;
  config?: {
    forjaTeamA?: string;
    forjaTeamB?: string;
    forjaGroupId?: string;
    tournamentStage?: string;
  };
}

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
  const fallback = `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.discord_id.slice(-1)) || 0) % 6}.png`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <img
        src={imgErr ? fallback : member.avatar_url}
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
 * Renders a prize summary card showing the total prize pool and the placement distributions.
 *
 * @param total - Total prize amount (numeric value in the provided currency)
 * @param currency - Currency code; when `'BRL'` values are prefixed with `R$`, otherwise with `$`
 * @param distribution - Array of placement entries where `percent` is the percentage share (0–100) for that place
 * @returns The JSX element representing the prize card with formatted currency values
 */

function MatchCountdownCard({ match, isAdmin, onEdit }: { match: UpcomingMatch; isAdmin?: boolean; onEdit?: (m: UpcomingMatch) => void }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  const targetDate = useMemo(() => {
    if (!match.scheduledDate) return null;
    
    // 🔥 ULTIMATE TIMEZONE FIX: Split matemático para garantir fuso local sem conversão UTC
    if (typeof match.scheduledDate === 'string') {
      const [year, month, day] = match.scheduledDate.split('-').map(Number);
      const [hour, minute] = (match.scheduledTime || '00:00').split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute);
    }

    // Se for Timestamp do Firebase, pegamos os componentes para reconstruir em local
    const d = match.scheduledDate?.toDate ? match.scheduledDate.toDate() : new Date(match.scheduledDate);
    if (match.scheduledTime) {
      const [hh, mm] = match.scheduledTime.split(':').map(Number);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    }

    return d;
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
        {match.streamerUrl && (
          <a 
            href={match.streamerUrl.startsWith('http') ? match.streamerUrl : `https://${match.streamerUrl}`}
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
  const { teams } = useForjaTeams(true);
  const { rankedPlayers } = useForjaPlayers(true);
  const { entries: schedule } = useForjaSchedule();

  const [prizeData, setPrizeData] = useState<any>(null);
  const [lobbies, setLobbies] = useState<UpcomingMatch[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [editingMatch, setEditingMatch] = useState<UpcomingMatch | null>(null);

  const handleUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    try {
      const lobbyRef = doc(db, 'lobbies', editingMatch.id);
      const form = e.target as HTMLFormElement;
      const scheduledDate = (form.elements.namedItem('date') as HTMLInputElement).value;
      const scheduledTime = (form.elements.namedItem('time') as HTMLInputElement).value;
      const streamerUrl = (form.elements.namedItem('streamer') as HTMLInputElement).value;

      await updateDoc(lobbyRef, {
        'config.scheduledDate': scheduledDate,
        'config.scheduledTime': scheduledTime,
        'config.streamerUrl': streamerUrl
      });

      // Atualiza estado local para UX instantânea
      setLobbies(prev => prev.map(l => l.id === editingMatch.id ? { 
        ...l, 
        scheduledDate, 
        scheduledTime, 
        streamerUrl 
      } : l));

      setEditingMatch(null);
      alert('Agendamento atualizado!');
    } catch (err: any) {
      alert(`Erro ao atualizar: ${err.message}`);
    }
  };

  // Cold-fetch de prizes + lobbies
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getForjaContentOnce('prizes').catch(() => null),
      getDocs(query(
        collection(db, 'lobbies'),
        where('config.preset', '==', 'FORJA'),
        orderBy('createdAt', 'desc')
      )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as any))).catch(() => []),
    ]).then(([prizes, lobbiesRaw]) => {
      if (cancelled) return;
      setPrizeData(prizes);
      // Upcoming: lobbies não concluídos primeiro, depois os mais recentes
      const officialLobbies = (lobbiesRaw as any[]).filter(l => l.config?.isOfficialForjaMatch || l.config?.forjaTeamA);

      const mapped: UpcomingMatch[] = officialLobbies.map(l => ({
        id: l.id,
        name: l.config?.name ?? 'Partida',
        status: l.status ?? 'waiting',
        scoreA: l.scoreA ?? l.teamAScore ?? 0,
        scoreB: l.scoreB ?? l.teamBScore ?? 0,
        stage: l.config?.tournamentStage ?? 'GROUP',
        scheduledDate: l.config?.scheduledDate,
        scheduledTime: l.config?.scheduledTime,
        streamerUrl: l.config?.streamerUrl,
        config: {
          forjaTeamA: l.config?.forjaTeamA,
          forjaTeamB: l.config?.forjaTeamB,
          forjaGroupId: l.config?.forjaGroupId,
          tournamentStage: l.config?.tournamentStage
        }
      }));
      // Debug helper: expose raw lobbies in dev mode only (not shipped to production)
      if (import.meta.env.DEV) {
        (window as any).__forjaLobbiesRaw__ = lobbiesRaw;
      }
      setLobbies(mapped);
      setDataLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Standings por grupo
  const calculateStandings = (groupId: string): StandingRow[] => {
    const groupTeams = teams.filter(t => t.groupId === groupId);
    const groupLobbies = lobbies.filter(l => l.stage === 'GROUP' && l.config?.forjaGroupId === groupId && (l.status === 'completed' || l.status === 'finished'));

    return groupTeams.map(team => {
      let gamesWon = 0, gamesLost = 0, matchesPlayed = 0;
      groupLobbies.forEach(l => {
        if (l.config?.forjaTeamA === team.id) {
          gamesWon += (l.scoreA ?? 0);
          gamesLost += (l.scoreB ?? 0);
          if (l.status === 'completed' || l.status === 'finished') matchesPlayed++;
        } else if (l.config?.forjaTeamB === team.id) {
          gamesWon += (l.scoreB ?? 0);
          gamesLost += (l.scoreA ?? 0);
          if (l.status === 'completed' || l.status === 'finished') matchesPlayed++;
        }
      });
      return { ...team, gamesWon, gamesLost, matchesPlayed, points: gamesWon };
    }).sort((a, b) => b.points - a.points || (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost));
  };

  const groups = ['A', 'B', 'C', 'D'].filter(g => teams.some(t => t.groupId === g));
  const activeGroups = groups.length > 0 ? groups : [];

  const phase = settings?.current_phase ?? 'pre_tournament';
  const phaseMeta = PHASE_LABELS[phase] ?? PHASE_LABELS.pre_tournament;
  const playoffFmt = settings?.playoff_format ?? 'single_elim';
  const totalPlayers = rankedPlayers.filter(p => !p.is_reserve).length;
  const isRegistered = rankedPlayers.some(p => p.discord_id === discordUser?.discord_id);

  // Upcoming lobbies (não finalizados, máx 3)
  const upcoming = lobbies.filter(l => l.status !== 'completed' && l.status !== 'finished').slice(0, 3);

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
              src={discordUser.avatar_url}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              🎮 Próximas Partidas
            </h3>
            <button
              className="forja-btn forja-btn--ghost"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}
              onClick={() => onTabChange?.('tabela')}
            >
              Ver tabela completa →
            </button>
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              📊 Classificação — Fase de Grupos
            </h3>
            <button
              className="forja-btn forja-btn--ghost"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}
              onClick={() => onTabChange?.('tabela')}
            >
              Ver completo →
            </button>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '0.75rem', marginTop: '-0.25rem', opacity: 0.8, fontStyle: 'italic' }}>
            Passe o mouse sobre um time para ver os membros
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {activeGroups.map(g => (
              <CompactStandings
                key={g}
                group={g}
                standings={calculateStandings(g)}
                players={rankedPlayers}
              />
            ))}
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
                  defaultValue={typeof editingMatch.scheduledDate === 'string' ? editingMatch.scheduledDate : ''} 
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
