/**
 * Forja de Hefesto — Modo OBS / Transmissão
 * View limpa para captura de tela durante o Snake Draft ao vivo.
 * Acesso: /forja?tab=obs
 */
import React, { useMemo } from 'react';
import { ForjaViewProps } from '../types';
import { useForjaPlayers }      from '../hooks/useForjaPlayers';
import { useForjaTeams }        from '../hooks/useForjaTeams';
import { useForjaDraftSession } from '../hooks/useForjaDraftSession';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEAM_PALETTE = ['#f59e0b','#60a5fa','#a78bfa','#4ade80','#f87171','#fb923c'];

function EmptySlot() {
  return (
    <div className="forja-obs-member forja-obs-member--empty">
      <div className="forja-obs-member__avatar forja-obs-member__avatar--empty">?</div>
      <span className="forja-obs-member__nick">Aguardando pick...</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaDraftOBS(_: ForjaViewProps) {
  const { rankedPlayers: players } = useForjaPlayers();
  const { teams }              = useForjaTeams();
  const { session, loading }   = useForjaDraftSession();

  const playerMap = useMemo(() => {
    const m: Record<string, (typeof players)[0]> = {};
    players.forEach(p => { m[p.discord_id] = p; });
    return m;
  }, [players]);

  const currentTeam = teams.find(t => t.id === session?.current_team_id);

  if (loading) {
    return (
      <div className="forja-obs-root forja-obs-loading">
        <div className="forja-loader-spinner" style={{ width: '3rem', height: '3rem', borderWidth: '4px', borderTopColor: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)' }} />
        <p>Conectando ao draft...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="forja-obs-root forja-obs-standby">
        <div className="forja-obs-standby__logo">🔥</div>
        <h2 className="forja-obs-standby__title">Forja de Hefesto</h2>
        <p className="forja-obs-standby__sub">Draft ainda não iniciado · Aguardando Admin</p>
        <div className="forja-obs-standby__pulse" />
      </div>
    );
  }

  const totalPicks   = session.pick_order_sequence.length;
  const donePicks    = session.picks.length;
  const progressPct  = totalPicks > 0 ? (donePicks / (totalPicks + teams.length)) * 100 : 0;

  return (
    <div className="forja-obs-root">
      {/* Status bar */}
      <div className="forja-obs-statusbar">
        <span className="forja-obs-statusbar__title">
          🔥 Forja de Hefesto <span className="forja-obs-live-dot">● AO VIVO</span>
        </span>
        <div className="forja-obs-progress-mini">
          <div className="forja-obs-progress-mini__fill" style={{ width: `${progressPct}%` }} />
        </div>
        {session.status === 'active' && currentTeam && (
          <span className="forja-obs-statusbar__turn">
            Vez de: <strong style={{ color: '#f59e0b' }}>{currentTeam.team_name}</strong>
          </span>
        )}
        {session.status === 'completed' && (
          <span className="forja-obs-statusbar__turn" style={{ color: '#4ade80' }}>
            🏆 Draft Concluído!
          </span>
        )}
      </div>

      {/* Teams grid */}
      <div
        className="forja-obs-teams"
        style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 3)}, 1fr)` }}
      >
        {teams.map((team, teamIdx) => {
          const color = TEAM_PALETTE[teamIdx % TEAM_PALETTE.length];
          const captain = playerMap[team.captain_id];
          const members = team.members.map(id => playerMap[id]).filter(Boolean);
          // Sempre mostrar 3 slots
          const slots = [...members];
          while (slots.length < 3) slots.push(undefined as any);

          const isCurrentTurn = session.status === 'active' && session.current_team_id === team.id;

          return (
            <div
              key={team.id}
              className={`forja-obs-team ${isCurrentTurn ? 'forja-obs-team--active' : ''}`}
              style={{ '--team-color': color } as any}
            >
              <div className="forja-obs-team__header">
                <span className="forja-obs-team__name">{team.team_name}</span>
                {isCurrentTurn && (
                  <span className="forja-obs-team__picking">PICKANDO</span>
                )}
              </div>

              <div className="forja-obs-members">
                {slots.map((member, i) => (
                  member ? (
                    <div key={member.discord_id} className="forja-obs-member">
                      <div className="forja-obs-member__avatar-wrap">
                        <img
                          src={member.avatar_url}
                          alt={member.nick}
                          className="forja-obs-member__avatar"
                          referrerPolicy="no-referrer"
                          onError={e => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/${i}.png`; }}
                        />
                        {member.discord_id === captain?.discord_id && (
                          <span className="forja-obs-captain-crown">👑</span>
                        )}
                      </div>
                      <span className="forja-obs-member__nick">{member.nick}</span>
                      {member.tier && (
                        <span className="forja-obs-member__tier" style={{
                          color: member.tier === 'A' ? '#facc15' : member.tier === 'B' ? '#60a5fa' : '#94a3b8',
                        }}>
                          T{member.tier}
                        </span>
                      )}
                    </div>
                  ) : (
                    <EmptySlot key={`empty-${i}`} />
                  )
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pick feed (últimos 5 picks) */}
      {session.picks.length > 0 && (
        <div className="forja-obs-feed">
          <span className="forja-obs-feed__label">Últimos Picks:</span>
          <div className="forja-obs-feed__items">
            {[...session.picks].reverse().slice(0, 6).map((pick, i) => {
              const p    = playerMap[pick.player_id];
              const team = teams.find(t => t.id === pick.team_id);
              return (
                <div key={i} className="forja-obs-feed__item">
                  <img
                    src={p?.avatar_url ?? ''}
                    alt={p?.nick ?? ''}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                  />
                  <span>{p?.nick ?? '?'}</span>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ color: '#f59e0b' }}>{team?.team_name ?? '?'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
