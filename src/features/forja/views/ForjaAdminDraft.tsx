/**
 * Forja de Hefesto — Painel Admin: Snake Draft
 * Admin controla o draft ao vivo: define tiers, escolhe capitães e faz os picks.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { ForjaViewProps, ForjaPlayer, ForjaTier } from '../types';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { useForjaTeams }   from '../hooks/useForjaTeams';
import { useForjaDraftSession } from '../hooks/useForjaDraftSession';
import { RankedPlayer } from '../forjaUtils';
import { useForjaSettings } from '../hooks/useForjaSettings';
// Adicionamos o updatePlayerProfile na importação
import {
  setPlayerTier, startForjaDraft, makeDraftPick, resetForjaDraft, undoLastDraftPick, updatePlayerProfile, unbanForjaPlayer
} from '../services/forjaService';
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

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

// ─── Modal de Edição Manual (Modo Deus) ──────────────────────────────────────
function PlayerEditModal({ player, onClose, onSave }: { player: ForjaPlayer, onClose: () => void, onSave: (discordId: string, data: Partial<ForjaPlayer>) => Promise<void> }) {
  const [nick, setNick] = useState(player.nick || '');
  const [profileId, setProfileId] = useState(player.aom_profile_id?.toString() || player.aom_id?.toString() || '');
  const [avatarUrl, setAvatarUrl] = useState(player.avatar_url || '');
  const [elo1v1, setElo1v1] = useState(player.elo_1v1 || 0);
  const [eloTg, setEloTg] = useState(player.elo_tg || 0);
  // @ts-ignore - forçando a leitura caso não exista na tipagem
  const [esportsElo, setEsportsElo] = useState(player.esports_elo || 0);
  const [gods, setGods] = useState((player.top_gods_admin || player.top_gods?.map(g => g.god) || []).join(', '));
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const topGodsArray = gods.split(',').map(g => g.trim()).filter(Boolean);
    
    await onSave(player.discord_id, {
      nick,
      aom_profile_id: profileId ? Number(profileId) : null,
      avatar_url: avatarUrl,
      elo_1v1: Number(elo1v1),
      elo_tg: Number(eloTg),
      esports_elo: Number(esportsElo),
      top_gods_admin: topGodsArray
    } as any);
    
    setIsSaving(false);
    onClose();
  };

  const inputStyle = {
    width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: 'white', marginTop: '0.25rem'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '450px', color: '#f8fafc', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>✏️ Editar: {player.nick}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          <div><label>Nick:</label><input style={inputStyle} value={nick} onChange={e => setNick(e.target.value)} /></div>
          <div><label>AoM Profile ID:</label><input style={inputStyle} value={profileId} onChange={e => setProfileId(e.target.value)} /></div>
          <div><label>Avatar URL:</label><input style={inputStyle} value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} /></div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}><label>ELO 1v1:</label><input type="number" style={inputStyle} value={elo1v1} onChange={e => setElo1v1(Number(e.target.value))} /></div>
            <div style={{ flex: 1 }}><label>ELO TG:</label><input type="number" style={inputStyle} value={eloTg} onChange={e => setEloTg(Number(e.target.value))} /></div>
          </div>
          
          <div><label>Esports ELO (Custom):</label><input type="number" style={inputStyle} value={esportsElo} onChange={e => setEsportsElo(Number(e.target.value))} /></div>
          <div><label>Top Deuses (Vírgula):</label><input style={inputStyle} value={gods} placeholder="Ex: Zeus, Hades, Isis" onChange={e => setGods(e.target.value)} /></div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="forja-btn forja-btn--ghost" disabled={isSaving}>Cancelar</button>
            <button type="submit" className="forja-btn forja-btn--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </form>
      </div>
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
  onEdit: () => void;
  onUnban?: () => void;
}

function PlayerRow({
  player, isSelected, isCaptain, isDraftActive, isCurrentPick,
  onToggleCaptain, onPick, onTierChange, onEdit, onUnban
}: PlayerRowProps) {
  const [imgErr, setImgErr] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${parseInt(player.discord_id.slice(-1)) % 6}.png`;

  const isBanned = player.status === 'banned';

  return (
    <div
      className={`forja-admin-player-row
        ${isSelected ? 'forja-admin-player-row--drafted' : ''}
        ${isCurrentPick ? 'forja-admin-player-row--current-pick' : ''}
        ${isBanned ? 'forja-admin-player-row--banned' : ''}
      `}
      style={isBanned ? { opacity: 0.8, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)'} : {}}
    >
      <img
        src={imgErr ? fallback : player.avatar_url || fallback}
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
          {/* @ts-ignore */}
          {player.esports_elo ? <span style={{ color: '#fbbf24', marginLeft: '6px' }}>Esports: {player.esports_elo}</span> : null}
        </span>
      </div>

      {isBanned ? (
        <button
          className="forja-btn forja-btn--ghost"
          style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#68d391', borderColor: 'rgba(104, 211, 145, 0.4)' }}
          onClick={onUnban}
        >
          ♻️ Desbanir
        </button>
      ) : (
        <>
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

          {/* Botoes de Ação (só antes do draft) */}
          {!isDraftActive && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className={`forja-btn ${isCaptain ? 'forja-btn--primary' : 'forja-btn--ghost'}`}
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                onClick={onToggleCaptain}
                title={isCaptain ? 'Remover como Capitão' : 'Definir como Capitão'}
              >
                {isCaptain ? '👑 Cap' : '+ Cap'}
              </button>
              <button
                className="forja-btn forja-btn--ghost"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: '#cbd5e1' }}
                onClick={onEdit}
                title="Editar Jogador Manualmente"
              >
                ✏️
              </button>
            </div>
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
        </>
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
  const { rankedPlayers: players, bannedPlayers, loading: playersLoading } = useForjaPlayers();
  const { teams }                                            = useForjaTeams();
  const { session, loading: sessionLoading } = useForjaDraftSession();
  const { tierMode } = useForjaSettings();

  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([]);
  const [tierFilter, setTierFilter]             = useState<'all'|'A'|'B'|'C'|'banned'>('all');
  const [isBusy, setIsBusy]                     = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  
  // Estado para Snapshot Progress
  const [snapshotProgress, setSnapshotProgress] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(doc(db, 'forja_status/snapshot'), (docSnap) => {
      if (docSnap.exists()) {
        setSnapshotProgress(docSnap.data());
      }
    });
    return () => unsub();
  }, [isAdmin]);

  // Estado para controlar quem estamos editando manualmente
  const [editingPlayer, setEditingPlayer] = useState<ForjaPlayer | null>(null);

  const isDraftActive = !!session;

  const draftedIds = useMemo(
    () => new Set(players.filter(p => p.status === 'drafted').map(p => p.discord_id)),
    [players]
  );

  const visiblePlayers = useMemo(() => {
    if (tierFilter === 'banned') return [...bannedPlayers];
    const base = tierFilter === 'all'
      ? players
      : players.filter(p => (p as any).computedTier === tierFilter);
    return [...base];
  }, [players, bannedPlayers, tierFilter]);

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

  // ── Save Manual Edit ─────────────────────────────────────────────────────
  const handleSaveEdit = async (discordId: string, data: Partial<ForjaPlayer>) => {
    try {
      await updatePlayerProfile(discordId, data);
    } catch (err: any) {
      setError(err.message);
    }
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

  // ── Make pick ──────────────────────────────────────────────────────────────
  const handlePick = async (player: ForjaPlayer) => {
    if (!session) return;
    setIsBusy(true); setError(null);
    try { await makeDraftPick(session, player, true); }
    catch (e: any) { setError(e.message); }
    finally { setIsBusy(false); }
  };

  // ── Undo last pick ───────────────────────────────────────────────────────
  const handleUndo = async () => {
    if (!session || session.picks.length === 0) return;
    if (!confirm('Desfazer a última escolha de draft? O jogador será devolvido ao pool.')) return;
    setIsBusy(true); setError(null);
    try { await undoLastDraftPick(session); }
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

  // ── Snapshot ELO (Backend) ───────────────────────────────────────────────
  const handleSnapshot = async () => {
    if (!confirm(`Atenção: Isso vai iniciar o processamento em lote no servidor para atualizar o ELO e Top Deuses de todos os ${players.length} inscritos. Deseja continuar?`)) return;
    
    setIsBusy(true); 
    setError(null);

    try {
      const functions = getFunctions(undefined, 'us-central1');
      const runSnapshot = httpsCallable(functions, 'updateEloSnapshot');
      const result = await runSnapshot();
      
      alert(`Snapshot finalizado com sucesso!`);
      console.log("Resultado do Snapshot:", result.data);
    } catch (err: any) {
      console.error("[Forja Snapshot] Erro:", err);
      setError("Falha ao rodar o Snapshot: " + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnban = async (player: ForjaPlayer) => {
    if (!confirm(`Deseja desbanir ${player.nick}? Ele será devolvido à lista de jogadores disponíveis.`)) return;
    setIsBusy(true); setError(null);
    try {
      await unbanForjaPlayer(player.discord_id);
      // Optional: alert(`Jogador ${player.nick} desbanido com sucesso.`);
    } catch (err: any) {
      setError('Erro ao desbanir jogador: ' + err.message);
    } finally {
      setIsBusy(false);
    }
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
      {/* Modal de Edição */}
      {editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={handleSaveEdit}
        />
      )}

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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isDraftActive && (
            <>
              <button
                className="forja-btn forja-btn--ghost"
                style={{ borderColor: '#60a5fa', color: '#60a5fa' }}
                onClick={handleSnapshot}
                disabled={isBusy || (snapshotProgress && snapshotProgress.status === 'running')}
              >
                {isBusy || (snapshotProgress && snapshotProgress.status === 'running') ? '📸 Atualizando Servidor...' : '📸 Snapshot de ELO'}
              </button>
              <button
                id="forja-admin-start-draft-btn"
                className="forja-btn forja-btn--primary"
                onClick={handleStartDraft}
                disabled={isBusy || selectedCaptains.length < 2}
              >
                {isBusy ? '⏳ Iniciando...' : '🚀 Iniciar Draft'}
              </button>
            </>
          )}
          {isDraftActive && session?.status === 'completed' && (
            <span className="forja-admin-completed-badge">🏆 Draft Concluído!</span>
          )}
          {isDraftActive && session?.picks.length > 0 && (
            <button
              className="forja-btn forja-btn--ghost"
              style={{ color: '#facc15', borderColor: '#facc15' }}
              onClick={handleUndo}
              disabled={isBusy}
              title="Desfazer Última Escolha"
            >
              ↩ Undo Pick
            </button>
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

      {/* Snapshot Progress */}
      {snapshotProgress && snapshotProgress.status === 'running' && (
        <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#93c5fd', fontWeight: 600 }}>
            <span>📸 Atualização de ELO/Gods em andamento...</span>
            <span>{snapshotProgress.processed_count} / {snapshotProgress.total_players}</span>
          </div>
          <div style={{ width: '100%', background: '#0f172a', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', 
                width: `${Math.min(100, Math.round(((snapshotProgress.processed_count || 0) / (snapshotProgress.total_players || 1)) * 100))}%`,
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <span>Jogador atual: <strong style={{ color: '#fff' }}>{snapshotProgress.current_player || '...'}</strong></span>
            <span>Atualizados com sucesso: <strong style={{ color: '#10b981' }}>{snapshotProgress.updated_count}</strong></span>
          </div>
        </div>
      )}

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
          <div className="forja-filter-row" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
            {(['all','A','B','C', 'banned'] as const).map(f => (
              <button
                key={f}
                className={`forja-filter-btn ${tierFilter === f ? 'forja-filter-btn--active' : ''}`}
                onClick={() => setTierFilter(f)}
                style={f === 'banned' ? { borderColor: 'rgba(239, 68, 68, 0.5)', color: tierFilter === 'banned' ? '#fff' : '#fca5a5', background: tierFilter === 'banned' ? '#dc2626' : undefined } : {}}
              >
                {f === 'all' ? 'Todos' : f === 'banned' ? '🚫 Banidos' : `Tier ${f}`}
              </button>
            ))}
            <span className="forja-filter-count">{availablePlayers.length} {tierFilter === 'banned' ? 'banidos' : 'disponíveis'}</span>
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
                  isCurrentPick={
                    isDraftActive && 
                    session?.current_team_id !== null && 
                    ((player as RankedPlayer).computedTier === session?.current_round || 
                     (tierMode === 'AB' && session?.current_round === 'C' && (player as RankedPlayer).computedTier === 'B'))
                  }
                  onToggleCaptain={() => toggleCaptain(player.discord_id)}
                  onPick={() => handlePick(player)}
                  onTierChange={t => handleTierChange(player.discord_id, t)}
                  onEdit={() => setEditingPlayer(player)}
                  onUnban={() => handleUnban(player)}
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
                  onEdit={() => setEditingPlayer(player)}
                  onUnban={() => handleUnban(player)}
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