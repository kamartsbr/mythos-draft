/**
 * Forja de Hefesto — Aba: Times
 * Passo 4: dados reais do Firestore via useForjaTeams + useForjaPlayers.
 */
import React, { useState, useMemo } from 'react';
import { ForjaViewProps, ForjaTeam, ForjaPlayer } from '../types';
import { useForjaTeams }   from '../hooks/useForjaTeams';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { updateTeamName }  from '../services/forjaService';

// ─── Team Card ────────────────────────────────────────────────────────────────
const TEAM_COLORS = ['#f59e0b','#60a5fa','#a78bfa','#4ade80','#f87171','#fb923c'];

function TeamCard({ team, members, colorIdx, isAdmin, isCaptain }: {
  team: ForjaTeam;
  members: ForjaPlayer[];
  colorIdx: number;
  isAdmin: boolean;
  isCaptain: boolean;
}) {
  const color = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(team.team_name);
  const [saving, setSaving]   = useState(false);

  const canEdit = isAdmin || isCaptain;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await updateTeamName(team.id, name.trim()); setEditing(false); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const avgElo = members.length > 0
    ? Math.round(members.reduce((s, m) => s + (m.elo_tg || m.elo_1v1 || 0), 0) / members.length)
    : 0;

  return (
    <div className="forja-team-card" style={{ '--team-color': color, borderTopColor: color } as any}>
      {/* Team Name */}
      <div className="forja-team-card__header">
        {editing ? (
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <input
              className="forja-reg-input"
              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            />
            <button className="forja-btn forja-btn--primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              onClick={handleSave} disabled={saving}>{saving ? '...' : '✓'}</button>
            <button className="forja-btn forja-btn--ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => { setEditing(false); setName(team.team_name); }}>✕</button>
          </div>
        ) : (
          <>
            <h3 className="forja-team-name" style={{ color }}>
              {team.team_name}
            </h3>
            {canEdit && (
              <button
                className="forja-btn forja-btn--ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.68rem' }}
                onClick={() => setEditing(true)}
              >
                ✏️ Renomear
              </button>
            )}
          </>
        )}
      </div>

      {/* Stats */}
      <div className="forja-team-stats">
        <span>ELO médio TG: <strong style={{ color }}>{avgElo || '—'}</strong></span>
        <span>Pick #{team.pick_order}</span>
      </div>

      {/* Members */}
      <div className="forja-team-members">
        {members.map(member => {
          const isCap = member.discord_id === team.captain_id;
          return (
            <div key={member.discord_id} className={`forja-team-member ${isCap ? 'forja-team-member--captain' : ''}`}>
              <div style={{ position: 'relative' }}>
                <img
                  src={member.avatar_url}
                  alt={member.nick}
                  className="forja-team-member__avatar"
                  referrerPolicy="no-referrer"
                  onError={e => {
                    const idx = parseInt(member.discord_id.slice(-1)) % 6;
                    (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
                  }}
                />
                {isCap && <span className="forja-team-captain-crown">👑</span>}
              </div>
              <div className="forja-team-member__info">
                <span className="forja-team-member__nick">{member.nick}</span>
                <span className="forja-team-member__elo">
                  {member.tier && <span style={{ color: member.tier === 'A' ? '#facc15' : member.tier === 'B' ? '#60a5fa' : '#94a3b8', marginRight: '0.3rem' }}>T{member.tier}</span>}
                  {member.elo_tg > 0 && `TG ${member.elo_tg}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaTimes({ discordUser, isAdmin }: ForjaViewProps) {
  const { teams, loading: teamsLoading, error: teamsError } = useForjaTeams();
  const { rankedPlayers: players, loading: playersLoading } = useForjaPlayers();

  const playerMap = useMemo(() => {
    const m: Record<string, ForjaPlayer> = {};
    players.forEach(p => { m[p.discord_id] = p; });
    return m;
  }, [players]);

  const loading = teamsLoading || playersLoading;

  return (
    <section className="forja-view forja-view--times">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🛡️</span> Times da Forja</h2>
          <p className="forja-page-subtitle">
            {teams.length > 0
              ? `${teams.length} time(s) formado(s) via Snake Draft`
              : 'Os times serão formados após o Snake Draft'}
          </p>
        </div>
      </div>

      {teamsError && <div className="forja-modal-error" style={{ marginBottom: '1rem' }}>⚠️ {teamsError}</div>}

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : teams.length === 0 ? (
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>⚔️</span>
          <p>O Snake Draft ainda não aconteceu. Os times serão revelados aqui após o evento.</p>
          {isAdmin && (
            <button
              className="forja-btn forja-btn--secondary"
              style={{ marginTop: '1rem' }}
              onClick={() => window.location.href = '/forja?tab=admin-draft'}
            >
              🐍 Ir para o Painel de Draft
            </button>
          )}
        </div>
      ) : (
        <div className="forja-times-grid">
          {teams.map((team, i) => {
            const members = team.members.map(id => playerMap[id]).filter(Boolean);
            const isCaptain = discordUser?.discord_id === team.captain_id;
            return (
              <TeamCard
                key={team.id}
                team={team}
                members={members}
                colorIdx={i}
                isAdmin={isAdmin}
                isCaptain={isCaptain}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
