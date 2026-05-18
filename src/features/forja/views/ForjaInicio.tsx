/**
 * Forja de Hefesto — Aba: Início
 * Fase 2: Banner Inteligente + Botão Sair do Torneio
 * Fase 3: Elo Efetivo (Média) Integrado
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ForjaViewProps, ForjaGodStat, ForjaTier, ForjaTeam, ForjaPlayer } from '../types';
import { RankedPlayer, TIER_META, AVAILABILITY_LABELS, eloColor, getEsportsEloDisplay } from '../forjaUtils';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { useForjaSettings } from '../hooks/useForjaSettings';
import { useForjaTeams } from '../hooks/useForjaTeams';
import { removeForjaPlayer, deleteForjaLobby, updateTeamGroup } from '../services/forjaService';
import { MAJOR_GODS } from '../../../data/gods';
import { FORJA_MAP_POOL, getMCLPicks } from '../../../constants';
import { LobbyConfig, Lobby } from '../../../types';
import { lobbyService, generateId } from '../../../services/lobbyService';
import { db } from '../../../firebase';
import { collection, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../../../lib/utils';
import AdminPlayerModal from '../components/AdminPlayerModal';
import PlayerSelfServiceModal from '../components/PlayerSelfServiceModal';
import ForjaTournamentSettingsModal from '../components/ForjaTournamentSettingsModal';
import ForjaAddPlayerModal from '../components/ForjaAddPlayerModal';

// ─── TierBadge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ForjaTier }) {
  if (!tier) return null;
  const c = TIER_META[tier];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem',
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: '0.7rem', fontWeight: 900,
      letterSpacing: '0.05em', boxShadow: `0 0 10px ${c.glow}`,
    }}>
      {tier}
    </span>
  );
}

// ─── TierSeparator ────────────────────────────────────────────────────────────

function TierSeparator({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const c = TIER_META[tier];
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.5rem 0', margin: '0.25rem 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: c.border, opacity: 0.4 }} />
      <span style={{
        color: c.text, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase', background: c.bg,
        border: `1px solid ${c.border}`, padding: '0.25rem 0.75rem',
        borderRadius: '2rem', boxShadow: `0 0 12px ${c.glow}`,
      }}>
        ⚔ {c.label}
      </span>
      <div style={{ flex: 1, height: '1px', background: c.border, opacity: 0.4 }} />
    </div>
  );
}

// ─── GodIcon ──────────────────────────────────────────────────────────────────

// Remove diacritics (e.g. ü→u) so "Nüwa" matches id "nuwa"
const normalizeId = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function GodIcon({ god }: { god: any }) {
  if (!god) return null;

  let godName = '';
  if (typeof god === 'string') godName = god;
  else if (typeof god === 'object' && god.god && typeof god.god === 'string') godName = god.god;

  if (!godName) return null;

  const normalizedName = normalizeId(godName);

  const godData = (MAJOR_GODS || []).find(g => {
    if (!g || !g.id || typeof g.id !== 'string') return false;
    return normalizeId(g.id) === normalizedName;
  });

  return (
    <div className="forja-god-icon" title={godName}>
      {godData?.image ? (
        <img src={godData.image} alt={godName} referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <span style={{ fontSize: '1.1rem' }}>⚡</span>
      )}
    </div>
  );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, isAdmin, currentUserId, onCardClick,
}: {
  player: RankedPlayer;
  isAdmin: boolean;
  currentUserId: string | null;
  onCardClick: (p: RankedPlayer) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${(parseInt(player.discord_id.slice(-1)) || 0) % 6}.png`;

  const esportsEloValue = getEsportsEloDisplay(player);
  const isOwnCard = currentUserId === player.discord_id;
  const canClick = isAdmin || isOwnCard;

  // CÁLCULO ELO EFETIVO (MÉDIA)
  const effectiveElo = player.effectiveElo || Math.round(((player.elo_1v1 || 0) + (player.elo_tg || 0)) / 2);

  const handleRemove = async () => {
    if (!window.confirm(`Remover a inscrição de ${player.nick}?`)) return;
    setRemoving(true);
    try { await removeForjaPlayer(player.discord_id); }
    catch (e) { console.error(e); setRemoving(false); }
  };

  return (
    <article
      className="forja-player-card"
      style={{
        opacity: removing ? 0.4 : 1, transition: 'opacity 0.3s',
        cursor: canClick ? 'pointer' : 'default',
        outline: canClick ? undefined : 'none',
      }}
      onClick={() => canClick && onCardClick(player)}
      title={isAdmin ? 'Clique para editar (Admin)' : isOwnCard ? 'Clique para editar seu perfil' : undefined}
    >
      {/* Rank Badge */}
      <div className="forja-seed-badge">#{player.rank}</div>

      {/* Esports Badge */}
      {esportsEloValue && (
        <div className="forja-seed-badge" style={{
          right: '2.5rem',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.3) 100%)',
          color: '#fcd34d',
          borderColor: 'rgba(245,158,11,0.6)',
          textShadow: '0 0 5px rgba(245,158,11,0.4)',
          fontWeight: 800,
          padding: '0.15rem 0.5rem',
          boxShadow: '0 0 10px rgba(245,158,11,0.1)'
        }}>🏆 PRO: {esportsEloValue}</div>
      )}

      {/* Admin Remove */}
      {isAdmin && (
        <button className="forja-card-remove-btn" onClick={e => { e.stopPropagation(); handleRemove(); }}
          disabled={removing} title="Remover inscrição" id={`forja-remove-${player.discord_id}`}>
          {removing ? '…' : '✕'}
        </button>
      )}

      {/* Edit hint badge */}
      {canClick && !isAdmin && isOwnCard && (
        <div style={{
          position: 'absolute', top: '0.4rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)',
          color: '#60a5fa', fontSize: '0.55rem', fontWeight: 700,
          padding: '0.1rem 0.45rem', borderRadius: '2rem', letterSpacing: '0.06em',
          pointerEvents: 'none',
        }}>✏️ SEU PERFIL</div>
      )}

      {/* Reserve Badge */}
      {player.is_reserve && (
        <div style={{
          position: 'absolute', top: '0.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(100,116,139,0.3)', border: '1px solid #475569',
          color: '#94a3b8', fontSize: '0.6rem', fontWeight: 700,
          padding: '0.15rem 0.5rem', borderRadius: '2rem', letterSpacing: '0.08em',
        }}>RESERVA</div>
      )}

      {/* Header */}
      <div className="forja-player-card__header">
        <div className="forja-player-avatar">
          <img src={imgErr || !player.avatar_url ? fallback : player.avatar_url} alt={player.nick}
            onError={() => setImgErr(true)} referrerPolicy="no-referrer" loading="lazy" />
          <span className="forja-player-flag" title={player.is_brazilian ? 'Brasil' : 'Portugal'}>
            {player.is_brazilian ? '🇧🇷' : '🇵🇹'}
          </span>
        </div>
        <div className="forja-player-info">
          <h3 className="forja-player-nick">{player.nick}</h3>
          <a href={player.profile_link || `https://aomstats.io/profile/${player.aom_profile_id}`}
            target="_blank" rel="noreferrer noopener"
            className="forja-player-aomlink" title="Ver perfil">
            {player.profile_link ? 'Perfil' : 'AoMStats'}
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <TierBadge tier={player.computedTier} />
          </div>
        </div>
      </div>

      {/* ELO Stats com Média Centralizada (Ponto 3) */}
      <div className="forja-player-elos" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
        <div className="forja-elo-block">
          <span className="forja-elo-label">1v1 ELO</span>
          <span className="forja-elo-value" style={{ color: eloColor(player.elo_1v1), fontSize: '0.8rem' }}>
            {player.elo_1v1 > 0 ? player.elo_1v1.toLocaleString() : '—'}
          </span>
        </div>

        <div className="forja-elo-block" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.4rem' }}>
          <span className="forja-elo-label" style={{ color: '#f59e0b', fontWeight: 800 }}>MÉDIA</span>
          <span className="forja-elo-value" style={{ fontWeight: 900 }}>
            {effectiveElo > 0 ? effectiveElo.toLocaleString() : '—'}
          </span>
        </div>

        <div className="forja-elo-block">
          <span className="forja-elo-label">TG ELO</span>
          <span className="forja-elo-value" style={{ color: eloColor(player.elo_tg), fontSize: '0.8rem' }}>
            {player.elo_tg > 0 ? player.elo_tg.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Top Gods */}
      {Array.isArray(player.top_gods) && player.top_gods.length > 0 && (
        <div className="forja-player-gods">
          <span className="forja-player-gods__label">TOP DEUSES MAIS JOGADOS</span>
          <div className="forja-player-gods__row">
            {player.top_gods.slice(0, 5).map((g: any, i: number) => (
              <GodIcon key={i} god={g} />
            ))}
          </div>
        </div>
      )}

      {/* Availability (Recuperado) */}
      {player.availability?.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '1rem', justifyContent: 'center' }}>
          {[...player.availability].sort((a, b) => {
            const order: Record<string, number> = { 'weekday-eve': 1, 'weekend-aft': 2, 'weekend-eve': 3, 'late-night': 4 };
            return (order[a] || 99) - (order[b] || 99);
          }).map(a => {
            const lbl = AVAILABILITY_LABELS[a] || { label: a, icon: '⏱️' };
            return (
              <span key={a} style={{
                fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)',
                padding: '0.2rem 0.5rem', borderRadius: '1rem', color: '#cbd5e1',
              }}>{lbl.icon} {lbl.label}</span>
            );
          })}
        </div>
      )}

      {/* Catchphrase (Recuperado) */}
      {(player.catchphrase || player.pitch_quote) && (
        <div className="forja-player-pitch" style={{ marginTop: '0.75rem' }}>
          <span className="forja-pitch-quote">"{player.catchphrase || player.pitch_quote}"</span>
        </div>
      )}
    </article>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ players, isLive }: { players: RankedPlayer[]; isLive: boolean }) {
  const tierCount = { A: 0, B: 0, C: 0 };
  players.forEach(p => { if (p.computedTier) tierCount[p.computedTier as 'A' | 'B' | 'C']++; });
  const reserve = players.filter(p => p.is_reserve).length;

  return (
    <div className="forja-stats-bar">
      <div className="forja-stats-item">
        <span className="forja-stats-value">{players.length - reserve}</span>
        <span className="forja-stats-label">Inscritos</span>
      </div>
      {reserve > 0 && (
        <>
          <div className="forja-stats-divider" />
          <div className="forja-stats-item">
            <span className="forja-stats-value" style={{ color: '#94a3b8' }}>{reserve}</span>
            <span className="forja-stats-label">Reservas</span>
          </div>
        </>
      )}
      <div className="forja-stats-divider" />
      {(['A', 'B', 'C'] as const).map((t, i) => (
        <React.Fragment key={t}>
          {i > 0 && <div className="forja-stats-divider" />}
          <div className="forja-stats-item">
            <span className="forja-stats-value" style={{ color: TIER_META[t].text }}>{tierCount[t]}</span>
            <span className="forja-stats-label">Tier {t}</span>
          </div>
        </React.Fragment>
      ))}
      <div className="forja-stats-divider" />
      <div className="forja-stats-item">
        <span className="forja-stats-value" style={{ color: isLive ? '#4ade80' : '#f59e0b', fontSize: '0.75rem' }}>
          {isLive ? '● AO VIVO' : '◌ DEMO'}
        </span>
        <span className="forja-stats-label">{isLive ? 'Firestore' : 'Mock'}</span>
      </div>
    </div>
  );
}

// ─── PlayerSkeleton ───────────────────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <div className="forja-player-card forja-skeleton">
      <div className="forja-skeleton-avatar" />
      <div className="forja-skeleton-line" style={{ width: '60%' }} />
      <div className="forja-skeleton-line" style={{ width: '40%' }} />
      <div className="forja-skeleton-line" style={{ width: '80%', height: '2.5rem' }} />
    </div>
  );
}

// ─── PlayerTable ──────────────────────────────────────────────────────────────

function PlayerTable({ players, isAdmin }: { players: RankedPlayer[]; isAdmin: boolean }) {
  const [sortConfig, setSortConfig] = useState<{ key: 'effectiveElo' | 'elo_1v1' | 'elo_tg'; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: 'effectiveElo' | 'elo_1v1' | 'elo_tg') => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'desc' }; // maior elo no topo por padrão (decrescente)
      }
      if (current.direction === 'desc') {
        return { key, direction: 'asc' };
      }
      return null; // desativa ordenação customizada, volta ao ranking original
    });
  };

  const sortedPlayers = useMemo(() => {
    if (!sortConfig) return players;

    return [...players].sort((a, b) => {
      const getVal = (p: RankedPlayer, k: typeof sortConfig.key) => {
        if (k === 'effectiveElo') {
          return p.effectiveElo || Math.round(((p.elo_1v1 || 0) + (p.elo_tg || 0)) / 2);
        }
        return p[k] || 0;
      };

      const valA = getVal(a, sortConfig.key);
      const valB = getVal(b, sortConfig.key);

      if (valA !== valB) {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      // Se empatar, mantém pelo rank original
      return a.rank - b.rank;
    });
  }, [players, sortConfig]);

  return (
    <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '1rem', border: '1px solid #1e293b' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
        <thead style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
          <tr>
            <th style={{ padding: '1rem' }}>#</th>
            <th style={{ padding: '1rem' }}>Jogador</th>

            {/* ELO MÉDIO HEADER */}
            <th
              onClick={() => handleSort('effectiveElo')}
              style={{
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                color: sortConfig?.key === 'effectiveElo' ? '#f59e0b' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              className="hover:text-slate-200"
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center', width: '100%' }}>
                <span>ELO MÉDIO</span>
                {sortConfig?.key === 'effectiveElo' && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                    {sortConfig.direction === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </th>

            <th style={{ padding: '1rem' }}>Tier</th>
            <th style={{ padding: '1rem' }}>Esports ELO</th>

            {/* 1v1 ELO HEADER */}
            <th
              onClick={() => handleSort('elo_1v1')}
              style={{
                padding: '1rem',
                cursor: 'pointer',
                userSelect: 'none',
                color: sortConfig?.key === 'elo_1v1' ? '#60a5fa' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              className="hover:text-slate-200"
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>1v1 ELO</span>
                {sortConfig?.key === 'elo_1v1' && (
                  <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                    {sortConfig.direction === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </th>

            {/* TG ELO HEADER */}
            <th
              onClick={() => handleSort('elo_tg')}
              style={{
                padding: '1rem',
                cursor: 'pointer',
                userSelect: 'none',
                color: sortConfig?.key === 'elo_tg' ? '#60a5fa' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              className="hover:text-slate-200"
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>TG ELO</span>
                {sortConfig?.key === 'elo_tg' && (
                  <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                    {sortConfig.direction === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </div>
            </th>

            <th style={{ padding: '1rem' }}>Disponibilidade</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p, idx) => {
            const esportsEloValue = getEsportsEloDisplay(p);
            const effectiveElo = p.effectiveElo || Math.round(((p.elo_1v1 || 0) + (p.elo_tg || 0)) / 2);
            const prevTier = idx > 0 ? sortedPlayers[idx - 1].computedTier : null;

            // Oculta o separador de Tier caso exista ordenação customizada ativa para evitar layout bagunçado
            const needsSep = !sortConfig && p.computedTier && p.computedTier !== prevTier && !p.is_reserve;

            return (
              <React.Fragment key={p.discord_id}>
                {needsSep && (
                  <tr>
                    <td colSpan={8} style={{ padding: '0.25rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 1rem' }}>
                        <div style={{ flex: 1, height: '1px', background: TIER_META[p.computedTier!].border, opacity: 0.4 }} />
                        <span style={{
                          color: TIER_META[p.computedTier!].text, fontSize: '0.65rem',
                          fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                          background: TIER_META[p.computedTier!].bg,
                          border: `1px solid ${TIER_META[p.computedTier!].border}`,
                          padding: '0.2rem 0.6rem', borderRadius: '2rem',
                        }}>⚔ {TIER_META[p.computedTier!].label}</span>
                        <div style={{ flex: 1, height: '1px', background: TIER_META[p.computedTier!].border, opacity: 0.4 }} />
                      </div>
                    </td>
                  </tr>
                )}
                <tr style={{
                  borderBottom: '1px solid #1e293b', color: '#f8fafc',
                  background: p.is_reserve ? 'rgba(100,116,139,0.06)' : undefined,
                  opacity: p.is_reserve ? 0.7 : 1,
                }}>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {p.is_reserve ? '—' : `#${p.rank}`}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={p.avatar_url || `https://cdn.discordapp.com/embed/avatars/${(parseInt(p.discord_id?.slice(-1)) || 0) % 6}.png`} style={{ width: '2rem', height: '2rem', borderRadius: '0.2rem' }}
                      referrerPolicy="no-referrer" alt={p.nick} />
                    {p.nick}
                    {p.is_reserve && (
                      <span style={{ background: '#1e293b', color: '#64748b', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', fontSize: '0.6rem' }}>RESERVA</span>
                    )}
                  </td>

                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontWeight: 900, border: '1px solid rgba(245,158,11,0.3)' }}>
                      {effectiveElo > 0 ? effectiveElo.toLocaleString() : '—'}
                    </span>
                  </td>

                  <td style={{ padding: '0.75rem 1rem' }}><TierBadge tier={p.computedTier} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#facc15', fontWeight: 'bold' }}>
                    {esportsEloValue ? esportsEloValue.toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: eloColor(p.elo_1v1) }}>{p.elo_1v1 > 0 ? p.elo_1v1.toLocaleString() : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: eloColor(p.elo_tg) }}>{p.elo_tg > 0 ? p.elo_tg.toLocaleString() : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {p.availability?.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {p.availability.map(a => {
                          const lbl = AVAILABILITY_LABELS[a];
                          return <span key={a} style={{ background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '0.2rem', whiteSpace: 'nowrap' }}>{lbl?.icon} {lbl?.label}</span>;
                        })}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ─── PlayerCardsGrid ──────────────────────────────────────────────────────────

function PlayerCardsGrid({
  players, isAdmin, currentUserId, onCardClick,
}: {
  players: RankedPlayer[];
  isAdmin: boolean;
  currentUserId: string | null;
  onCardClick: (p: RankedPlayer) => void;
}) {
  const elements: React.ReactNode[] = [];
  let lastTier: ForjaTier = undefined as any;

  players.forEach((p) => {
    if (p.computedTier !== lastTier && p.computedTier && !p.is_reserve) {
      elements.push(<TierSeparator key={`sep-${p.computedTier}`} tier={p.computedTier} />);
      lastTier = p.computedTier;
    }
    elements.push(
      <PlayerCard
        key={p.discord_id}
        player={p}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onCardClick={onCardClick}
      />
    );
  });

  return <div className="forja-players-grid">{elements}</div>;
}

interface ForjaInicioProps extends ForjaViewProps {
  onRegisterClick: () => void;
}

/**
 * Render the Forja de Hefesto "Início" view, including player listings, filters, registration controls, and admin/self modals.
 *
 * @param discordUser - The currently authenticated Discord user or `null` when not logged in
 * @param isAdmin - Whether the current user has admin privileges (enables admin controls and modals)
 * @param onRegisterClick - Called when the register/reserve CTA is activated
 * @returns The root React element for the Forja Inicio view
 */

export default function ForjaInicio({ discordUser, isAdmin, onRegisterClick }: ForjaInicioProps) {
  const { rankedPlayers, loading, error, isLive } = useForjaPlayers(true);
  const { settings, maxParticipants, tierASize, isRegistrationOpen, deadlineMs } = useForjaSettings();
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C' | 'reserve'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [adminModalPlayer, setAdminModalPlayer] = useState<RankedPlayer | null>(null);
  const [selfServiceModalPlayer, setSelfServiceModalPlayer] = useState<RankedPlayer | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

  const currentUserId = discordUser?.discord_id ?? null;

  // Inscrições fechadas se: toggle off OU deadline passou OU máx atingido
  const now = Date.now();
  const deadlinePassed = deadlineMs ? now > deadlineMs : false;
  const activePlayersCount = rankedPlayers.filter(p => !p.is_reserve).length;
  const limitReached = activePlayersCount >= maxParticipants;
  const isReservesOpen = settings?.reserves_open ?? false;

  // Inscrições fechadas se: (toggle off OU deadline passou OU máx atingido) E reserves_open for false
  // Se reserves_open for true, a inscrição nunca é totalmente bloqueada (sempre permite reserva)
  const registrationBlocked = (!isRegistrationOpen || deadlinePassed || limitReached) && !isReservesOpen;

  const registrationBlockReason = !isRegistrationOpen && !isReservesOpen
    ? 'Inscrições encerradas pelo organizador.'
    : deadlinePassed && !isReservesOpen
      ? 'O prazo de inscrições encerrou.'
      : (limitReached || !isRegistrationOpen || deadlinePassed) && isReservesOpen
        ? `Inscrições principais encerradas. Novos jogadores entram como reserva.`
        : limitReached
          ? `Limite de ${maxParticipants} participantes atingido. Novos jogadores entram como reserva.`
          : null;

  const isRegistered = useMemo(() =>
    rankedPlayers.some(p => p.discord_id === currentUserId),
    [rankedPlayers, currentUserId]
  );

  const handleCardClick = (player: RankedPlayer) => {
    if (isAdmin) {
      setAdminModalPlayer(player);
    } else if (currentUserId === player.discord_id) {
      setSelfServiceModalPlayer(player);
    }
  };

  // Ao clicar em Inscrever quando limite atingido, vai para reserva (via onRegisterClick normal,
  // mas a lógica de reserva pode ser implementada no modal de registro)
  const handleRegisterClick = () => {
    onRegisterClick();
  };

  const handleLeaveTournament = async () => {
    if (!discordUser) return;
    const confirm = window.confirm("Deseja realmente sair do torneio? Sua inscrição será removida imediatamente.");
    if (confirm) {
      try {
        await removeForjaPlayer(discordUser.discord_id);
      } catch (err) {
        alert("Erro ao remover inscrição. Tente novamente.");
      }
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'reserve') return rankedPlayers.filter(p => p.is_reserve);
    if (filter === 'all') return rankedPlayers;
    return rankedPlayers.filter(p => p.computedTier === filter && !p.is_reserve);
  }, [rankedPlayers, filter]);

  const hasReserves = rankedPlayers.some(p => p.is_reserve);

  return (
    <section className="forja-view forja-view--inicio">
      <AdminPlayerModal player={adminModalPlayer} onClose={() => setAdminModalPlayer(null)} />
      <PlayerSelfServiceModal player={selfServiceModalPlayer} onClose={() => setSelfServiceModalPlayer(null)} />

      {/* Modais de Admin */}
      {showSettingsModal && discordUser && (
        <ForjaTournamentSettingsModal
          discordUserId={discordUser.discord_id}
          currentSettings={settings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showAddPlayerModal && discordUser && (
        <ForjaAddPlayerModal
          discordUserId={discordUser.discord_id}
          discordUsername={discordUser.username}
          onClose={() => setShowAddPlayerModal(false)}
        />
      )}

      {isRegistered ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.5)', border: '1px solid #1e293b', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/logo-forja.png" alt="Logo" style={{ width: '40px', filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.5))' }} />
            <div>
              <h3 style={{ color: '#f8fafc', fontSize: '0.9rem', margin: 0, fontWeight: 700 }}>Inscrição Confirmada</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>Você faz parte da Forja de Hefesto!</p>
            </div>
          </div>
          <button className="forja-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', padding: '0.4rem 1rem' }} onClick={handleLeaveTournament}>
            Sair do Torneio
          </button>
        </div>
      ) : (
        <div className="forja-inicio-hero">
          <div className="forja-inicio-hero__text">
            <div className="flex justify-center md:justify-start mb-6">
              <img src="/logo-forja.png" alt="Logo Forja de Hefesto" className="w-64 md:w-80 lg:w-[400px] drop-shadow-[0_0_25px_rgba(255,165,0,0.4)] hover:scale-105 transition-transform duration-300" />
            </div>
            <h2 className="forja-inicio-hero__title">
              Forje seu legado.<br />
              <span style={{ color: '#f59e0b' }}>A batalha está chegando.</span>
            </h2>
            <p className="forja-inicio-hero__desc">
              O maior torneio 3v3 de Age of Mythology: Retold da comunidade BR/PT.
              Inscreva-se, seja triado por um Capitão e represente sua forja.
            </p>
          </div>
          <div className="forja-inicio-hero__cta">
            {/* Aviso de inscrições bloqueadas */}
            {registrationBlockReason && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem',
                color: '#fca5a5', fontSize: '0.8rem', textAlign: 'center',
              }}>
                🔒 {registrationBlockReason}
              </div>
            )}
            <button
              id="forja-cta-register-btn"
              className="forja-btn forja-btn--primary forja-btn--lg forja-btn--glow"
              onClick={handleRegisterClick}
              disabled={registrationBlocked}
              style={registrationBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              <span>🔥</span> {(limitReached || !isRegistrationOpen || deadlinePassed) ? 'Entrar como Reserva' : 'Inscreva-se no Torneio'}
            </button>
            <span className="forja-cta-note">
              {discordUser ? `Logado como ${discordUser.username}` : 'Necessário login com Discord'}
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="forja-admin-banner" style={{ borderColor: 'rgba(251,191,36,0.3)', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && <StatsBar players={rankedPlayers} isLive={isLive} />}

      <div className="forja-filter-row" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="forja-filter-label">Filtrar:</span>
          {(['all', 'A', 'B', 'C'] as const).map(f => (
            <button key={f} id={`forja-filter-${f}`} className={`forja-filter-btn ${filter === f ? 'forja-filter-btn--active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : `Tier ${f}`}
            </button>
          ))}
          {hasReserves && (
            <button id="forja-filter-reserve" className={`forja-filter-btn ${filter === 'reserve' ? 'forja-filter-btn--active' : ''}`} style={{ color: '#94a3b8', borderColor: '#334155' }} onClick={() => setFilter('reserve')}>
              🪑 Reservas
            </button>
          )}
          {!loading && (
            <span className="forja-filter-count">
              {filtered.length} jogador{filtered.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`forja-btn ${viewMode === 'cards' ? 'forja-btn--primary' : 'forja-btn--ghost'}`} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setViewMode('cards')}>🃏 Cards</button>
          <button className={`forja-btn ${viewMode === 'table' ? 'forja-btn--primary' : 'forja-btn--ghost'}`} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setViewMode('table')}>📋 Tabela</button>
        </div>
      </div>

      {loading ? (
        <div className="forja-players-grid">
          {[1, 2, 3, 4, 5, 6].map(i => <PlayerSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        viewMode === 'cards'
          ? <PlayerCardsGrid players={filtered} isAdmin={isAdmin} currentUserId={currentUserId} onCardClick={handleCardClick} />
          : <PlayerTable players={filtered} isAdmin={isAdmin} />
      ) : (
        <div className="forja-empty">
          <span>🔍</span>
          <p>Nenhum jogador encontrado neste tier.</p>
        </div>
      )}

      {isAdmin && !loading && (
        <div className="forja-admin-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span>🛡️ Modo Admin ativo — tiers calculados por ELO efetivo ({maxParticipants} participantes, Tier A: {tierASize} capitães)</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="forja-add-player-btn"
              onClick={() => setShowAddPlayerModal(true)}
              style={{
                background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)',
                color: '#60a5fa', borderRadius: '0.5rem', padding: '0.4rem 0.875rem',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
              }}
            >
              ➕ Adicionar Jogador
            </button>
            <button
              id="forja-tournament-settings-btn"
              onClick={() => setShowSettingsModal(true)}
              style={{
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                color: '#f59e0b', borderRadius: '0.5rem', padding: '0.4rem 0.875rem',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
              }}
            >
              ⚙️ Configurações
            </button>
          </div>
        </div>
      )}

    </section>
  );
}

