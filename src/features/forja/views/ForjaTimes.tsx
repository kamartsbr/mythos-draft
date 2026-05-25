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

// ─── Utility ──────────────────────────────────────────────────────────────────
function sanitizePlayerName(nick: string): string {
  if (!nick) return '';
  return nick
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/(?:CaOK\s*[|_]?\s*)/gi, '')
    .replace(/^[|_\s]+|[|_\s]+$/g, '')
    .trim();
}

// ─── Team Card ────────────────────────────────────────────────────────────────
const TEAM_COLORS = ['#f59e0b','#60a5fa','#a78bfa','#4ade80','#f87171','#fb923c'];

/**
 * Render a team card displaying the team's image, name, stats and members, with inline edit controls for admins or the team captain.
 *
 * Shows a blurred background and foreground image when `team.image_url` is present, otherwise a placeholder. Displays average TG ELO, pick order, and a list of members with avatar fallbacks, captain crown, tier label, and TG ELO. When `isAdmin` or `isCaptain` is true, provides UI to rename the team and to add/replace the team image URL.
 *
 * @param team - The team object to display (includes id, team_name, image_url, pick_order, captain_id, etc.)
 * @param members - Array of player objects belonging to the team (used to compute average ELO and render member rows)
 * @param colorIdx - Index used to pick the accent color for the card (cycled through TEAM_COLORS)
 * @param isAdmin - Whether the current user has global admin privileges (enables management controls)
 * @param isCaptain - Whether the current user is the team's captain (enables management controls)
 * @returns The JSX element representing the rendered team card.
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
    <div className="forja-team-card-compact relative" style={{ borderTopColor: color, '--team-color': color } as any}>
      {/* Header: badge + nome + pick order */}
      <div className="flex items-center gap-2 relative">
        <div 
          className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700 relative group cursor-pointer" 
          onClick={() => { if(canEdit) setShowImageEdit(!showImageEdit); }}
        >
          {team.image_url ? (
            <img src={team.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-slate-500 uppercase">{team.team_name[0]}</span>
          )}
          {canEdit && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold text-white">IMG</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-1">
              <input
                className="forja-reg-input text-sm font-black text-white px-1 py-0.5 w-full bg-slate-900 border border-slate-700"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              />
              <button className="text-[10px] text-green-400 font-bold" onClick={handleSave} disabled={saving}>✓</button>
              <button className="text-[10px] text-red-400 font-bold" onClick={() => { setEditing(false); setName(team.team_name); }}>✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div className="text-sm font-black text-white truncate cursor-pointer" onClick={() => { if(canEdit) setEditing(true); }}>
                {team.team_name}
              </div>
              {canEdit && (
                <button className="text-[10px] opacity-0 group-hover:opacity-100 text-slate-400" onClick={() => setEditing(true)}>✏️</button>
              )}
            </div>
          )}
          <div className="text-[9px] text-slate-500 font-bold uppercase">
            ELO médio TG: <span className="text-amber-500">{avgElo || '—'}</span>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          #{team.pick_order}
        </div>
      </div>

      {showImageEdit && (
        <div className="absolute z-20 top-12 left-0 w-full bg-slate-900 border border-amber-500/30 p-2 rounded-lg shadow-xl shadow-black/50 flex flex-col gap-2">
          <input 
            className="forja-reg-input text-[10px] p-1.5"
            placeholder="URL da Imagem..."
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />
          <div className="flex gap-1">
            <button className="flex-1 forja-btn forja-btn--primary text-[9px] py-1" onClick={handleSaveImage} disabled={savingImage}>Salvar</button>
            <button className="flex-1 forja-btn forja-btn--ghost text-[9px] py-1" onClick={() => setShowImageEdit(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Members: compact list */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800/50 pt-2">
        {members.map(m => {
          const isCap = m.discord_id === team.captain_id;
          return (
            <div key={m.discord_id} className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <img 
                  src={m.avatar_url} 
                  className="w-5 h-5 rounded object-cover" 
                  alt="" 
                  onError={e => {
                    const idx = parseInt(m.discord_id.slice(-1)) % 6;
                    (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
                  }} 
                />
                {isCap && <span className="absolute -top-1 -right-1 text-[8px] leading-none drop-shadow">👑</span>}
              </div>
              <a
                href={m.aom_profile_id ? `https://aomstats.io/profile/${m.aom_profile_id}` : `https://aomstats.io/profile/${encodeURIComponent(m.nick)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={["text-[10px] font-bold truncate flex-1 hover:underline decoration-amber-500 transition-colors", isCap ? "text-white hover:text-amber-400" : "text-slate-400 hover:text-slate-200"].filter(Boolean).join(" ")}
                onClick={(e) => e.stopPropagation()}
                title={`Ver perfil de ${m.nick} no aomstats`}
              >
                {m.nick}
              </a>
              <div className="flex items-center gap-1 flex-shrink-0">
                {m.tier && (
                  <span className={["text-[8px] font-black uppercase px-1 rounded", m.tier === 'A' ? "bg-amber-500/20 text-amber-500" : m.tier === 'B' ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-400"].filter(Boolean).join(" ")}>
                    T{m.tier}
                  </span>
                )}
                {m.elo_tg > 0 && <span className="text-[9px] font-bold text-slate-500">TG {m.elo_tg}</span>}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6 w-full">
          {teams.map((team, i) => {
            const members = team.members ? team.members.map(id => playerMap[id]).filter(Boolean) : [];
            const isCaptain = discordUser?.discord_id === team.captain_id;
            
            return (
              <React.Fragment key={team.id || i}>
                <TeamCard
                  team={team}
                  members={members}
                  colorIdx={i}
                  isAdmin={isAdmin}
                  isCaptain={isCaptain}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
