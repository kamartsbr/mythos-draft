/**
 * Forja de Hefesto — Aba: Times
 * Passo 4: dados reais do Firestore via useForjaTeams + useForjaPlayers.
 */
import React, { useState, useMemo } from 'react';
import { ForjaViewProps, ForjaTeam, ForjaPlayer } from '../types';
import { useForjaTeams }   from '../hooks/useForjaTeams';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { updateTeamName, updateTeamImageUrl }  from '../services/forjaService';

const ForjaTimesManager = React.lazy(() => import('../components/ForjaTimesManager'));

// ─── Team Card ────────────────────────────────────────────────────────────────
const TEAM_COLORS = ['#f59e0b','#60a5fa','#a78bfa','#4ade80','#f87171','#fb923c'];

/**
 * Render a team card showing the team's image, name, stats, and member list, and optionally expose inline edit controls for admins or the team's captain.
 *
 * When editing is allowed, provides controls to rename the team and to add, change, or remove the team's image URL.
 *
 * @param team - Team data to display (id, team_name, image_url, pick_order, captain_id, etc.)
 * @param members - Players belonging to the team (used to compute average ELO and render member rows)
 * @param colorIdx - Index selecting the accent color for the card (cycled through TEAM_COLORS)
 * @param isAdmin - Whether the current user has global admin privileges (enables management controls)
 * @param isCaptain - Whether the current user is the team's captain (enables management controls)
 * @returns The JSX element representing the rendered team card
 */
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
  const [showImageEdit, setShowImageEdit] = useState(false);
  const [imageUrl, setImageUrl] = useState(team.image_url || '');
  const [savingImage, setSavingImage] = useState(false);

  // Sync local state when Firestore updates the team data
  React.useEffect(() => {
    setImageUrl(team.image_url || '');
  }, [team.image_url]);

  const canEdit = isAdmin || isCaptain;

  const handleSaveImage = async () => {
    // Early exit if image URL hasn't changed
    if (imageUrl.trim() === (team.image_url || '')) {
      setShowImageEdit(false);
      return;
    }

    setSavingImage(true);
    try {
      await updateTeamImageUrl(team.id, imageUrl.trim() || null);
      setShowImageEdit(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await updateTeamName(team.id, name.trim()); setEditing(false); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const avgElo = members.length > 0
  ? Math.round(members.reduce((sum, m) => sum + (m.elo_tg || 0), 0) / members.length)
  : 0;

  return (
    <div className="forja-team-card" style={{ '--team-color': color, borderTopColor: color } as any}>
      {/* Team Image Block */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        {team.image_url ? (
          <div style={{ 
            width: '100%', 
            aspectRatio: '16/9', 
            borderRadius: '0.75rem', 
            overflow: 'hidden', 
            border: '1px solid rgba(255,255,255,0.05)',
            background: '#020617',
            boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            {/* Background Borrado */}
            <img 
              src={team.image_url} 
              alt=""
              style={{ 
                position: 'absolute',
                inset: 0,
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                filter: 'blur(12px) brightness(0.4)',
                opacity: 0.6,
                transform: 'scale(1.1)'
              }}
            />
            {/* Imagem Real (Inteira) */}
            <img 
              src={team.image_url} 
              alt={team.team_name} 
              style={{ 
                position: 'relative',
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                zIndex: 1
              }}
            />
          </div>
        ) : (
          <div style={{ 
            width: '100%', 
            aspectRatio: '16/9', 
            borderRadius: '0.75rem', 
            background: 'rgba(2,6,23,0.4)', 
            border: '2px dashed rgba(51,65,85,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            color: '#475569',
            fontSize: '0.7rem'
          }}>
            <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>🛡️</span>
            Sem imagem do time
          </div>
        )}
        
        {canEdit && (
          <button 
            onClick={() => setShowImageEdit(!showImageEdit)}
            style={{ 
              position: 'absolute', 
              top: '0.5rem', 
              right: '0.5rem', 
              background: 'rgba(15,23,42,0.85)', 
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '0.5rem',
              padding: '0.3rem 0.6rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#facc15',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s',
              zIndex: 5
            }}
          >
            📷 {team.image_url ? 'Alterar' : 'Adicionar'}
          </button>
        )}
        
        {showImageEdit && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'rgba(15,23,42,0.96)', 
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '1.25rem',
            justifyContent: 'center',
            gap: '0.75rem',
            zIndex: 10,
            border: '1px solid rgba(250,204,21,0.2)'
          }}>
            <label style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>URL da Imagem</label>
            <input 
              className="forja-reg-input"
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              placeholder="Ex: https://i.imgur.com/..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="forja-btn forja-btn--primary" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                onClick={handleSaveImage}
                disabled={savingImage}
              >
                {savingImage ? 'Salvando...' : 'Confirmar'}
              </button>
              <button 
                className="forja-btn forja-btn--ghost" 
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
                onClick={() => setShowImageEdit(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

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

/**
 * Render the Forja teams page, showing team cards, loading/empty/error states, and an optional admin visual manager.
 *
 * @param discordUser - The current Discord user (may be undefined).
 * @param isAdmin - Whether the current user has administrative privileges.
 * @returns The React element tree for the Forja teams view, including a toggleable admin visual manager when `isAdmin` is true.
 */
export default function ForjaTimes({ discordUser, isAdmin }: ForjaViewProps) {
  const [showManager, setShowManager] = useState(false);
  const { teams, loading: teamsLoading, error: teamsError } = useForjaTeams(true);
  const { rankedPlayers: players, loading: playersLoading } = useForjaPlayers(true);

  const playerMap = useMemo(() => {
    const m: Record<string, ForjaPlayer> = {};
    players.forEach(p => { m[p.discord_id] = p; });
    return m;
  }, [players]);

  const loading = teamsLoading || playersLoading;

  if (isAdmin && showManager) {
    return (
      <>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="forja-btn forja-btn--ghost"
            onClick={() => setShowManager(false)}
          >
            📋 Voltar para Visualização de Cards
          </button>
        </div>
        <React.Suspense fallback={<div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>}>
          <ForjaTimesManager discordUser={discordUser} isAdmin={isAdmin} />
        </React.Suspense>
      </>
    );
  }

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
        {isAdmin && teams.length > 0 && (
          <button 
            className="forja-btn forja-btn--secondary"
            onClick={() => setShowManager(true)}
          >
            ⚙️ Gestão Visual (Drag & Drop)
          </button>
        )}
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
