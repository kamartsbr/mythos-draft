/**
 * Forja de Hefesto — Painel Admin: Snake Draft
 * Admin controla o draft ao vivo: define tiers, escolhe capitães e faz os picks.
 */
import React, { useState, useMemo } from 'react';
import { ForjaViewProps, ForjaPlayer, ForjaTier } from '../types';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { useForjaTeams }   from '../hooks/useForjaTeams';
import { useForjaDraftSession } from '../hooks/useForjaDraftSession';
import {
  setPlayerTier, startForjaDraft, makeDraftPick, resetForjaDraft,
} from '../services/forjaService';

// ─── Tier Badge ───────────────────────────────────────────────────────────────
const TIER_COLOR: Record<string, string> = { A: '#facc15', B: '#60a5fa', C: '#94a3b8' };

function TierSelect({ player, onSet }: { player: ForjaPlayer; onSet: (t: ForjaTier) => void }) {
  return (
    <div className="forja-admin-tier-select">
      {(['A','B','C'] as ForjaTier[]).map(t => (
        <button
          key={t!}
          className={`forja-admin-tier-btn ${player.tier === t ? 'forja-admin-tier-btn--active' : ''}`}
          style={{ '--tier-color': TIER_COLOR[t!] } as any}
          onClick={() => onSet(player.tier === t ? null : t)}
          title={`Definir Tier ${t}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Player Row (Admin) ───────────────────────────────────────────────────────
interface PlayerRowProps {
  player: ForjaPlayer;
  isSelected: boolean;
  isCaptain: boolean;
  isDraftActive: boolean;
  isCurrentPick: boolean;
  onToggleCaptain: () => void;
  onPick: () => void;
  onTierChange: (t: ForjaTier) => void;
}

function PlayerRow({
  player, isSelected, isCaptain, isDraftActive, isCurrentPick,
  onToggleCaptain, onPick, onTierChange,
}: PlayerRowProps) {
  const [imgErr, setImgErr] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${parseInt(player.discord_id.slice(-1)) % 6}.png`;

  return (
    <div
      className={`forja-admin-player-row
        ${isSelected ? 'forja-admin-player-row--drafted' : ''}
        ${isCurrentPick ? 'forja-admin-player-row--current-pick' : ''}
      `}
    >
      <img
        src={imgErr ? fallback : player.avatar_url}
        alt={player.nick}
        onError={() => setImgErr(true)}
        className="forja-admin-player-avatar"
        referrerPolicy="no-referrer"
      />
      <div className="forja-admin-player-info">
        <span className="forja-admin-player-nick">{player.nick}</span>
        <span className="forja-admin-player-elo">
          1v1: <strong>{player.elo_1v1 || '—'}</strong>
          &nbsp;·&nbsp;TG: <strong>{player.elo_tg || '—'}</strong>
        </span>
      </div>

      {/* Tier selector (só antes do draft) */}
      {!isDraftActive && (
        <TierSelect player={player} onSet={onTierChange} />
      )}

      {/* Status badge */}
      {player.tier && (
        <span className="forja-admin-tier-badge" style={{ color: TIER_COLOR[player.tier] }}>
          Tier {player.tier}
        </span>
      )}

      {/* Capitão toggle (só antes do draft) */}
      {!isDraftActive && (
        <button
          className={`forja-btn ${isCaptain ? 'forja-btn--primary' : 'forja-btn--ghost'}`}
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.7rem' }}
          onClick={onToggleCaptain}
          title={isCaptain ? 'Remover como Capitão' : 'Definir como Capitão'}
        >
          {isCaptain ? '👑 Cap.' : '+ Cap.'}
        </button>
      )}

      {/* Pick button (durante o draft, jogador disponível) */}
      {isDraftActive && !isSelected && isCurrentPick && (
        <button
          className="forja-btn forja-btn--primary"
          style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
          onClick={onPick}
        >
          ✓ Pick
        </button>
      )}

      {isSelected && (
        <span className="forja-admin-drafted-badge">✓ Drafted</span>
      )}
    </div>
  );
}

// ─── Draft Board (estado atual do draft) ─────────────────────────────────────
function DraftBoard({ session, teams, players }: {
  session: NonNullable<ReturnType<typeof useForjaDraftSession>['session']>;
  teams: ReturnType<typeof useForjaTeams>['teams'];
  players: ForjaPlayer[];
}) {
  const playerMap = useMemo(() => {
    const m: Record<string, ForjaPlayer> = {};
    players.forEach(p => { m[p.discord_id] = p; });
    return m;
  }, [players]);

  const currentTeam = teams.find(t => t.id === session.current_team_id);
  const progress = session.picks.length;
  const total    = session.pick_order_sequence.length;

  return (
    <div className="forja-draft-board">
      {/* Progress */}
      <div className="forja-draft-progress">
        <div className="forja-draft-progress__bar">
          <div
            className="forja-draft-progress__fill"
            style={{ width: `${(progress / total) * 100}%` }}
          />
        </div>
        <span className="forja-draft-progress__label">
          Pick {progress + 1} de {total + 1}
          {session.status === 'completed' && ' — COMPLETO'}
        </span>
      </div>

      {/* Current team */}
      {session.status === 'active' && currentTeam && (
        <div className="forja-draft-current-turn">
          <span>🎯 Vez de:</span>
          <strong style={{ color: '#f59e0b' }}>{currentTeam.team_name}</strong>
          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
            (Cap: {playerMap[currentTeam.captain_id]?.nick ?? '—'})
          </span>
        </div>
      )}

      {/* Pick history */}
      <div className="forja-draft-history">
        {session.picks.map((pick, i) => {
          const pickedPlayer = playerMap[pick.player_id];
          const pickTeam     = teams.find(t => t.id === pick.team_id);
          return (
            <div key={i} className="forja-draft-pick-item">
              <span className="forja-draft-pick-item__num">#{i + 1}</span>
              <img
                src={pickedPlayer?.avatar_url ?? ''}
                alt={pickedPlayer?.nick ?? ''}
                className="forja-draft-pick-item__avatar"
                referrerPolicy="no-referrer"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="forja-draft-pick-item__nick">{pickedPlayer?.nick ?? pick.player_id}</span>
              <span className="forja-draft-pick-item__arrow">→</span>
              <span className="forja-draft-pick-item__team">{pickTeam?.team_name ?? '?'}</span>
              {pick.forced_by_admin && (
                <span className="forja-draft-pick-item__forced">Admin</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaAdminDraft({ isAdmin }: ForjaViewProps) {
  const { players, loading: playersLoading } = useForjaPlayers();
  const { teams }                            = useForjaTeams();
  const { session, loading: sessionLoading } = useForjaDraftSession();

  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([]);
  const [tierFilter, setTierFilter]             = useState<'all'|'A'|'B'|'C'>('all');
  const [isBusy, setIsBusy]                     = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  const isDraftActive = !!session;

  const draftedIds = useMemo(
    () => new Set(players.filter(p => p.status === 'drafted').map(p => p.discord_id)),
    [players]
  );

  const visiblePlayers = useMemo(() => {
    const base = tierFilter === 'all' ? players : players.filter(p => p.tier === tierFilter);
    return base.sort((a, b) => (a.tier ?? 'Z').localeCompare(b.tier ?? 'Z') || (a.seed ?? 99) - (b.seed ?? 99));
  }, [players, tierFilter]);

  const availablePlayers = useMemo(
    () => visiblePlayers.filter(p => !draftedIds.has(p.discord_id)),
    [visiblePlayers, draftedIds]
  );

  // ── Tier change ──────────────────────────────────────────────────────────
  const handleTierChange = async (discordId: string, tier: ForjaTier) => {
    try { await setPlayerTier(discordId, tier); }
    catch (e: any) { setError(e.message); }
  };

  // ── Toggle captain ───────────────────────────────────────────────────────
  const toggleCaptain = (discordId: string) => {
    setSelectedCaptains(prev =>
      prev.includes(discordId)
        ? prev.filter(id => id !== discordId)
        : [...prev, discordId]
    );
  };

  // ── Start draft ──────────────────────────────────────────────────────────
  const handleStartDraft = async () => {
    if (selectedCaptains.length < 2) { setError('Selecione pelo menos 2 capitães.'); return; }
    if (!confirm(`Iniciar o Snake Draft com ${selectedCaptains.length} capitães? Isso criará os times no Firestore.`)) return;
    setIsBusy(true); setError(null);
    try { await startForjaDraft(selectedCaptains); }
    catch (e: any) { setError(e.message); }
    finally { setIsBusy(false); }
  };

  // ── Make pick ────────────────────────────────────────────────────────────
  const handlePick = async (playerId: string) => {
    if (!session) return;
    setIsBusy(true); setError(null);
    try { await makeDraftPick(session, playerId); }
    catch (e: any) { setError(e.message); }
    finally { setIsBusy(false); }
  };

  // ── Reset draft ──────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!confirm('Resetar TODO o draft? Todos os times serão apagados e os jogadores voltam ao estado "disponível".')) return;
    setIsBusy(true); setError(null);
    try { await resetForjaDraft(); setSelectedCaptains([]); }
    catch (e: any) { setError(e.message); }
    finally { setIsBusy(false); }
  };

  if (!isAdmin) {
    return (
      <section className="forja-view">
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <p>Acesso restrito a administradores.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="forja-view forja-view--admin-draft">
      {/* Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🐍</span> Controle do Snake Draft</h2>
          <p className="forja-page-subtitle">
            {isDraftActive
              ? `Draft em andamento · ${session!.picks.length} picks realizados`
              : `${players.length} inscritos · ${selectedCaptains.length} capitão(es) selecionado(s)`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isDraftActive && (
            <button
              id="forja-admin-start-draft-btn"
              className="forja-btn forja-btn--primary"
              onClick={handleStartDraft}
              disabled={isBusy || selectedCaptains.length < 2}
            >
              {isBusy ? '⏳ Iniciando...' : '🚀 Iniciar Draft'}
            </button>
          )}
          {isDraftActive && session?.status === 'completed' && (
            <span className="forja-admin-completed-badge">🏆 Draft Concluído!</span>
          )}
          <button
            id="forja-admin-reset-draft-btn"
            className="forja-btn forja-btn--danger"
            onClick={handleReset}
            disabled={isBusy}
          >
            🗑 Reset Draft
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="forja-modal-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div className="forja-admin-draft-layout">
        {/* Left: Player Pool */}
        <div className="forja-admin-pool">
          <h3 className="forja-section-title">
            <span>👥</span> Pool de Jogadores
          </h3>

          {/* Tier filter */}
          <div className="forja-filter-row" style={{ marginBottom: '1rem' }}>
            {(['all','A','B','C'] as const).map(f => (
              <button
                key={f}
                className={`forja-filter-btn ${tierFilter === f ? 'forja-filter-btn--active' : ''}`}
                onClick={() => setTierFilter(f)}
              >
                {f === 'all' ? 'Todos' : `Tier ${f}`}
              </button>
            ))}
            <span className="forja-filter-count">{availablePlayers.length} disponíveis</span>
          </div>

          {/* Player list */}
          {playersLoading ? (
            <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
          ) : (
            <div className="forja-admin-player-list">
              {/* Available players */}
              {availablePlayers.map(player => (
                <PlayerRow
                  key={player.discord_id}
                  player={player}
                  isSelected={false}
                  isCaptain={selectedCaptains.includes(player.discord_id)}
                  isDraftActive={isDraftActive}
                  isCurrentPick={isDraftActive && session?.current_team_id !== null}
                  onToggleCaptain={() => toggleCaptain(player.discord_id)}
                  onPick={() => handlePick(player.discord_id)}
                  onTierChange={t => handleTierChange(player.discord_id, t)}
                />
              ))}
              {/* Drafted players (greyed) */}
              {visiblePlayers.filter(p => draftedIds.has(p.discord_id)).map(player => (
                <PlayerRow
                  key={player.discord_id}
                  player={player}
                  isSelected={true}
                  isCaptain={selectedCaptains.includes(player.discord_id)}
                  isDraftActive={isDraftActive}
                  isCurrentPick={false}
                  onToggleCaptain={() => {}}
                  onPick={() => {}}
                  onTierChange={() => {}}
                />
              ))}
              {players.length === 0 && (
                <div className="forja-empty" style={{ minHeight: '200px' }}>
                  <span>📋</span>
                  <p>Nenhum jogador inscrito ainda.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Draft Board */}
        <div className="forja-admin-right">
          {/* Captains selection (pre-draft) */}
          {!isDraftActive && selectedCaptains.length > 0 && (
            <div className="forja-admin-captains-panel">
              <h3 className="forja-section-title"><span>👑</span> Capitães Selecionados</h3>
              <div className="forja-admin-captains-list">
                {selectedCaptains.map((id, i) => {
                  const cap = players.find(p => p.discord_id === id);
                  return (
                    <div key={id} className="forja-admin-captain-item">
                      <span className="forja-admin-captain-order">#{i + 1}</span>
                      <img
                        src={cap?.avatar_url ?? ''}
                        alt={cap?.nick ?? id}
                        className="forja-admin-player-avatar"
                        referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span>{cap?.nick ?? id}</span>
                      <button
                        className="forja-auth-logout"
                        onClick={() => setSelectedCaptains(prev => prev.filter(c => c !== id))}
                        title="Remover"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
              <p className="forja-reg-hint" style={{ marginTop: '0.5rem' }}>
                A ordem acima é a ordem de pick da Rodada 1. O Snake inverte nas rodadas seguintes.
              </p>
            </div>
          )}

          {/* Draft board (active) */}
          {isDraftActive && session && !sessionLoading && (
            <DraftBoard session={session} teams={teams} players={players} />
          )}

          {/* Teams formed */}
          {teams.length > 0 && (
            <div className="forja-admin-teams-summary">
              <h3 className="forja-section-title" style={{ marginTop: '1.5rem' }}><span>🛡️</span> Times Formados</h3>
              {teams.map(team => {
                const memberPlayers = team.members.map(id => players.find(p => p.discord_id === id)).filter(Boolean);
                return (
                  <div key={team.id} className="forja-admin-team-card">
                    <div className="forja-admin-team-header">
                      <strong style={{ color: '#f59e0b' }}>{team.team_name}</strong>
                      <span style={{ color: '#475569', fontSize: '0.7rem' }}>Pick #{team.pick_order}</span>
                    </div>
                    <div className="forja-admin-team-members">
                      {memberPlayers.map(p => (
                        <span key={p!.discord_id} className="forja-admin-team-member">
                          <img src={p!.avatar_url} alt={p!.nick} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} referrerPolicy="no-referrer" />
                          {p!.nick}
                          {p!.discord_id === team.captain_id && ' 👑'}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
