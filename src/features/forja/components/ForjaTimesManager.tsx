/**
 * ============================================================
 *  ForjaTimesManager — Fase 3
 *  Gestão visual de times com Drag & Drop.
 *  Admin pode:
 *   - Criar/deletar times manualmente
 *   - Arrastar jogadores do pool para times ou reservas
 *   - Arrastar entre times
 *   - Definir capitão de um time
 *  Público: exibição read-only dos times formados.
 * ============================================================
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  DragDropContext, Droppable, Draggable,
  DropResult, DraggableProvided, DroppableProvided, DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import { ForjaViewProps, ForjaTeam } from '../types';
import { RankedPlayer } from '../forjaUtils';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { useForjaTeams }   from '../hooks/useForjaTeams';
import {
  createForjaTeam, deleteForjaTeam,
  movePlayerToTeam, movePlayerToReserve, movePlayerToPool,
  updateTeamName,
} from '../services/forjaService';

// ─── Constants ────────────────────────────────────────────────────────────────

const POOL_ID    = '__pool__';
const RESERVE_ID = '__reserve__';

const TEAM_COLORS = [
  '#f59e0b','#60a5fa','#a78bfa','#4ade80',
  '#f87171','#fb923c','#34d399','#e879f9',
];

// ─── DraggablePlayerChip ──────────────────────────────────────────────────────

function PlayerChip({
  player, provided, snapshot, showTier = true,
}: {
  player: RankedPlayer;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  showTier?: boolean;
}) {
  const tierColor = player.computedTier === 'A'
    ? '#facc15' : player.computedTier === 'B'
    ? '#60a5fa' : '#94a3b8';

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{
        ...provided.draggableProps.style,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.45rem 0.65rem', borderRadius: '0.5rem', cursor: 'grab',
        background: snapshot.isDragging
          ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)',
        border: snapshot.isDragging
          ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
        boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
        userSelect: 'none', marginBottom: '0.3rem',
        transition: snapshot.isDragging ? 'none' : 'background 0.15s',
      }}
    >
      <img
        src={player.avatar_url} alt={player.nick}
        style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', flexShrink: 0 }}
        referrerPolicy="no-referrer"
        onError={e => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
      />
      <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500, flex: 1 }}>
        {player.nick}
      </span>
      {showTier && player.computedTier && (
        <span style={{
          fontSize: '0.6rem', fontWeight: 800, color: tierColor,
          background: `${tierColor}15`, border: `1px solid ${tierColor}40`,
          padding: '0.1rem 0.35rem', borderRadius: '0.25rem',
        }}>T{player.computedTier}</span>
      )}
      <span style={{ fontSize: '0.6rem', color: '#475569', flexShrink: 0 }}>
        {player.elo_1v1 > 0 ? player.elo_1v1 : '—'}
      </span>
    </div>
  );
}

// ─── DroppableZone ────────────────────────────────────────────────────────────

function DroppableZone({
  id, label, color, players, isAdmin, minHeight = '80px', onDelete,
  onSetCaptain, captainId,
}: {
  id: string;
  label: React.ReactNode;
  color?: string;
  players: RankedPlayer[];
  isAdmin: boolean;
  minHeight?: string;
  onDelete?: () => void;
  onSetCaptain?: (playerId: string) => void;
  captainId?: string;
}) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: `1px solid ${color ? color + '44' : '#1e293b'}`,
      borderRadius: '0.875rem', overflow: 'hidden',
      boxShadow: color ? `0 0 20px ${color}11` : 'none',
    }}>
      {/* Zone Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.65rem 1rem',
        background: color ? `${color}12` : 'rgba(255,255,255,0.03)',
        borderBottom: `1px solid ${color ? color + '30' : '#1e293b'}`,
      }}>
        {color && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />}
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: color ?? '#94a3b8', flex: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#475569' }}>{players.length} jogadores</span>
        {onDelete && isAdmin && (
          <button
            onClick={onDelete} title="Deletar time"
            style={{ background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >🗑</button>
        )}
      </div>

      {/* Droppable body */}
      <Droppable droppableId={id}>
        {(provided: DroppableProvided, snap) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              padding: '0.5rem 0.75rem',
              minHeight,
              background: snap.isDraggingOver ? 'rgba(245,158,11,0.05)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            {players.length === 0 && !snap.isDraggingOver && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '3rem', color: '#334155', fontSize: '0.72rem', fontStyle: 'italic',
              }}>
                {isAdmin ? 'Arraste jogadores aqui' : 'Nenhum jogador'}
              </div>
            )}
            {players.map((p, i) => (
              <Draggable
                key={p.discord_id}
                draggableId={p.discord_id}
                index={i}
                isDragDisabled={!isAdmin}
              >
                {(prov, snap2) => (
                  <div style={{ position: 'relative' }}>
                    <PlayerChip player={p} provided={prov} snapshot={snap2} />
                    {/* Captain badge / set captain button */}
                    {isAdmin && onSetCaptain && (
                      <button
                        onClick={() => onSetCaptain(p.discord_id)}
                        title={captainId === p.discord_id ? 'Capitão atual' : 'Definir como Capitão'}
                        style={{
                          position: 'absolute', right: '2.5rem', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.7rem', opacity: captainId === p.discord_id ? 1 : 0.3,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = captainId === p.discord_id ? '1' : '0.3')}
                      >
                        👑
                      </button>
                    )}
                    {/* Public captain badge */}
                    {!isAdmin && captainId === p.discord_id && (
                      <span style={{
                        position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.7rem',
                      }}>👑</span>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaTimesManager({ discordUser, isAdmin }: ForjaViewProps) {
  const { rankedPlayers, loading: playersLoading } = useForjaPlayers(true);
  const { teams, loading: teamsLoading }           = useForjaTeams(true);

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating]       = useState(false);
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const loading = playersLoading || teamsLoading;

  // ── Player → team mapping ──────────────────────────────────────────────────

  // Jogadores que não estão em nenhum time nem na reserva
  const poolPlayers = useMemo(() =>
    rankedPlayers.filter(p => !p.team_id && !p.is_reserve),
    [rankedPlayers]
  );

  const reservePlayers = useMemo(() =>
    rankedPlayers.filter(p => p.is_reserve),
    [rankedPlayers]
  );

  const getTeamPlayers = useCallback((teamId: string) =>
    rankedPlayers.filter(p => p.team_id === teamId),
    [rankedPlayers]
  );

  // ── Drag End ───────────────────────────────────────────────────────────────

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId: playerId, source, destination } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const srcId  = source.droppableId;
    const destId = destination.droppableId;

    // Previous team (null if was in pool or reserve)
    const prevTeamId = (srcId === POOL_ID || srcId === RESERVE_ID) ? null : srcId;

    setBusy(true); setError(null);
    try {
      if (destId === RESERVE_ID) {
        await movePlayerToReserve(playerId, prevTeamId);
      } else if (destId === POOL_ID) {
        await movePlayerToPool(playerId, prevTeamId);
      } else {
        // Destino é um time
        await movePlayerToTeam(playerId, destId, prevTeamId);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Create Team ────────────────────────────────────────────────────────────

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      await createForjaTeam(newTeamName.trim());
      setNewTeamName('');
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  // ── Delete Team ────────────────────────────────────────────────────────────

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Deletar o time "${teamName}"? Os jogadores voltam ao pool.`)) return;
    setBusy(true);
    try { await deleteForjaTeam(teamId); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ── Set Captain ────────────────────────────────────────────────────────────

  const handleSetCaptain = async (teamId: string, playerId: string) => {
    setBusy(true);
    try { await updateTeamName(teamId, undefined as any, playerId); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="forja-view">
      {/* Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🛡️</span> Times da Forja</h2>
          <p className="forja-page-subtitle">
            {isAdmin
              ? `Arraste jogadores para montar os times · ${teams.length} times · ${poolPlayers.length} no pool`
              : `${teams.length} time(s) formados`}
          </p>
        </div>

        {/* Admin: Create team */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="forja-reg-input"
              placeholder="Nome do novo time..."
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTeam(); }}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', width: '180px' }}
              id="new-team-name-input"
            />
            <button
              className="forja-btn forja-btn--primary"
              onClick={handleCreateTeam}
              disabled={creating || !newTeamName.trim()}
              id="create-team-btn"
              style={{ fontSize: '0.78rem' }}
            >
              {creating ? '⏳' : '+ Criar Time'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="forja-modal-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {busy && (
        <div style={{ textAlign: 'center', padding: '0.5rem', color: '#64748b', fontSize: '0.78rem' }}>
          ⏳ Atualizando...
        </div>
      )}

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '1.5rem' }}>

            {/* Left: Pool + Reserve */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Pool */}
              <DroppableZone
                id={POOL_ID}
                label={`🎯 Pool — ${poolPlayers.length} disponíveis`}
                players={poolPlayers}
                isAdmin={isAdmin}
                minHeight="120px"
              />

              {/* Reserve */}
              <DroppableZone
                id={RESERVE_ID}
                label={`🪑 Reservas — ${reservePlayers.length}`}
                players={reservePlayers}
                isAdmin={isAdmin}
                color="#94a3b8"
                minHeight="80px"
              />
            </div>

            {/* Right: Teams grid */}
            <div>
              {teams.length === 0 ? (
                <div className="forja-empty" style={{ minHeight: '200px' }}>
                  <span style={{ fontSize: '2.5rem' }}>⚔️</span>
                  <p>{isAdmin ? 'Crie um time à esquerda para começar.' : 'Os times serão revelados após o Draft.'}</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '1rem',
                }}>
                  {teams.map((team: ForjaTeam, i: number) => {
                    const color  = TEAM_COLORS[i % TEAM_COLORS.length];
                    const players = getTeamPlayers(team.id);
                    return (
                      <DroppableZone
                        key={team.id}
                        id={team.id}
                        label={<TeamNameLabel team={team} isAdmin={isAdmin} />}
                        color={color}
                        players={players}
                        isAdmin={isAdmin}
                        minHeight="120px"
                        captainId={team.captain_id}
                        onSetCaptain={isAdmin ? (pid) => handleSetCaptain(team.id, pid) : undefined}
                        onDelete={isAdmin ? () => handleDeleteTeam(team.id, team.team_name) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DragDropContext>
      )}
    </section>
  );
}

// ─── Team Name Label (inline rename) ─────────────────────────────────────────

function TeamNameLabel({ team, isAdmin }: { team: ForjaTeam; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(team.team_name);
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    if (!name.trim() || name === team.team_name) { setEditing(false); return; }
    setSaving(true);
    try { await updateTeamName(team.id, name.trim()); setEditing(false); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (!isAdmin) return <>{team.team_name}</>;

  return editing ? (
    <input
      value={name}
      onChange={e => setName(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      autoFocus
      style={{
        background: 'transparent', border: 'none', outline: 'none',
        color: 'inherit', fontWeight: 700, fontSize: 'inherit',
        fontFamily: 'inherit', width: '100%', cursor: 'text',
      }}
      disabled={saving}
    />
  ) : (
    <span
      onClick={() => setEditing(true)}
      style={{ cursor: 'text' }}
      title="Clique para renomear"
    >
      {team.team_name} <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>✏️</span>
    </span>
  );
}
