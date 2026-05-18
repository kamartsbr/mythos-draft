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
  const [imgErr, setImgErr]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${(parseInt(player.discord_id.slice(-1)) || 0) % 6}.png`;

  const esportsEloValue = getEsportsEloDisplay(player);
  const isOwnCard = currentUserId === player.discord_id;
  const canClick  = isAdmin || isOwnCard;

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
      style={{ opacity: removing ? 0.4 : 1, transition: 'opacity 0.3s',
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

// ─── StandingRow, Popover & CompactStandings ───────────────────────────────────

interface StandingRow extends ForjaTeam {
  gamesWon: number;
  gamesLost: number;
  matchesPlayed: number;
  points: number;
}

function MemberRow({ member, isCaptain }: { member: ForjaPlayer; isCaptain: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.discord_id.slice(-1)) || 0) % 6}.png`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <img
        src={imgErr || !member.avatar_url ? fallback : member.avatar_url}
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

// ─── Props ────────────────────────────────────────────────────────────────────

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
  const [filter, setFilter]    = useState<'all' | 'A' | 'B' | 'C' | 'reserve'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [adminModalPlayer,      setAdminModalPlayer]      = useState<RankedPlayer | null>(null);
  const [selfServiceModalPlayer, setSelfServiceModalPlayer] = useState<RankedPlayer | null>(null);
  const [showSettingsModal,     setShowSettingsModal]     = useState(false);
  const [showAddPlayerModal,    setShowAddPlayerModal]    = useState(false);

  const currentUserId = discordUser?.discord_id ?? null;

  // ─── Match Center Merged States ────────────────────────────────────────────
  const { teams } = useForjaTeams(true);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<'A' | 'B' | 'C' | 'D' | 'PLAYOFFS'>('A');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLobby, setEditingLobby] = useState<any>(null);

  // Match Creator Form States
  const [selectedTeamA, setSelectedTeamA] = useState('');
  const [selectedTeamB, setSelectedTeamB] = useState('');
  const [matchStage, setMatchStage] = useState<'GROUP' | 'PLAYOFFS_BO3' | 'PLAYOFFS_BO5'>('GROUP');
  const [matchGroup, setMatchGroup] = useState<string>('A');
  const [groupRound, setGroupRound] = useState<string>('1');
  const [playoffRound, setPlayoffRound] = useState<string>('Quartas');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [streamerUrl, setStreamerUrl] = useState<string>('');

  useEffect(() => {
    const q = query(
      collection(db, 'lobbies'),
      where('config.preset', '==', 'FORJA'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLobbies(docs.filter((d: any) => d.config?.isOfficialForjaMatch || d.config?.forjaTeamA));
      },
      err => {
        console.error('Erro ao buscar partidas Forja', err);
      }
    );
    return () => unsub();
  }, []);

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

  const handleCreateMatch = async () => {
    if (!selectedTeamA || !selectedTeamB || selectedTeamA === selectedTeamB) {
      alert('Selecione dois times diferentes.');
      return;
    }

    const teamA = teams.find(t => t.id === selectedTeamA);
    const teamB = teams.find(t => t.id === selectedTeamB);

    let matchName = '';
    if (matchStage === 'GROUP') {
      matchName = `Gr${matchGroup} - R${groupRound} - ${teamA?.team_name} x ${teamB?.team_name}`;
    } else {
      matchName = `${playoffRound} - ${teamA?.team_name} x ${teamB?.team_name}`;
    }

    const isPlayoffs = matchStage !== 'GROUP';

    const config: LobbyConfig = {
      name: matchName,
      preset: 'FORJA',
      isOfficialForjaMatch: true,
      tournamentStage: matchStage,
      forjaTeamA: teamA?.id,
      forjaTeamB: teamB?.id,
      forjaGroupId: matchStage === 'GROUP' ? matchGroup : undefined,
      seriesType: matchStage === 'GROUP' ? '3G' : (matchStage === 'PLAYOFFS_BO5' ? 'BO5' : 'BO3'),
      teamSize: 3,
      customGameCount: matchStage === 'GROUP' ? 3 : (matchStage === 'PLAYOFFS_BO5' ? 5 : 3),
      pickType: 'alternated',
      isExclusive: true,
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
      hasPerMapBans: isPlayoffs,
      captainA_discordId: teamA?.captain_id,
      captainB_discordId: teamB?.captain_id,
      scheduledDate: (() => {
        if (!scheduledDate) return null;
        const [year, month, day] = scheduledDate.split('-').map(Number);
        const [hours, minutes] = (scheduledTime || '00:00').split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
      })(),
      scheduledTime: scheduledTime || null,
      streamerUrl: streamerUrl || null,
    };

    const populateTeam = (team: any) => {
      if (!team || !team.members) return [];
      return team.members.slice(0, 3).map((discordId: string, idx: number) => {
        return { name: `Player ${idx + 1}` };
      });
    };

    const id = generateId();
    const lobby: Lobby = {
      id,
      status: 'waiting',
      phase: 'waiting',
      captain1: null,
      captain2: null,
      captain1Name: '',
      captain2Name: null,
      teamAPlayers: populateTeam(teamA),
      teamBPlayers: populateTeam(teamB),
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
      seriesMaps: Array(config.customGameCount ?? 3).fill(''),
      mapBans: [],
      turn: 0,
      turnOrder: [],
      bans: [],
      picks: getMCLPicks(1, null, null),
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
      timerStart: serverTimestamp() as any,
      createdAt: serverTimestamp() as any,
      lastActivityAt: serverTimestamp() as any,
      hiddenActions: [],
    };

    try {
      await lobbyService.createLobby(id, lobby);

      if (streamerUrl) {
        try {
          const castersRef = collection(db, 'casters');
          const cleanUrl = streamerUrl.trim().toLowerCase();
          const castersQuery = query(castersRef, where('streamUrl', '==', cleanUrl));
          
          onSnapshot(castersQuery, async (snap) => {
            if (snap.empty) {
              const namePart = cleanUrl.includes('twitch.tv/') 
                ? cleanUrl.split('twitch.tv/')[1]?.split('/')[0] 
                : 'Caster Oficial';
              await updateDoc(doc(db, 'casters', generateId()), {
                name: namePart.toUpperCase(),
                streamUrl: cleanUrl,
                status: 'approved',
                createdAt: serverTimestamp()
              });
            }
          });
        } catch (e) {
          console.error('[Caster Registration Error]', e);
        }
      }

      alert(`Partida criada com sucesso!`);
      setSelectedTeamA('');
      setSelectedTeamB('');
      setScheduledDate('');
      setScheduledTime('');
      setStreamerUrl('');
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
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
      setEditingLobby(null);
    } catch (err: any) {
      alert(`Erro ao encerrar: ${err.message}`);
    }
  };

  const handleDeleteMatch = async (lobbyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta partida? Esta ação é irreversível.')) return;
    try {
      await deleteForjaLobby(lobbyId);
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`);
    }
  };

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
    if (filter === 'all')     return rankedPlayers;
    return rankedPlayers.filter(p => p.computedTier === filter && !p.is_reserve);
  }, [rankedPlayers, filter]);

  const hasReserves = rankedPlayers.some(p => p.is_reserve);

  // Standings por grupo
  const calculateStandings = (groupId: string): StandingRow[] => {
    const groupTeams = teams.filter(t => t.groupId === groupId);
    const groupLobbies = lobbies.filter(l => l.config?.tournamentStage === 'GROUP' && l.config?.forjaGroupId === groupId && (l.status === 'completed' || l.status === 'finished'));

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
      return { ...team, gamesWon, gamesLost, matchesPlayed, points: gamesWon } as StandingRow;
    }).sort((a, b) => b.points - a.points || (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost));
  };

  const groups = ['A', 'B', 'C', 'D'].filter(g => teams.some(t => t.groupId === g));
  const activeGroups = groups.length > 0 ? groups : [];

  const filteredLobbies = useMemo(() => {
    return lobbies.filter(lobby => {
      const isPlayoffStage = lobby.config?.tournamentStage && lobby.config.tournamentStage.startsWith('PLAYOFF');
      if (selectedPhase === 'PLAYOFFS') {
        return isPlayoffStage;
      }
      return lobby.config?.tournamentStage === 'GROUP' && lobby.config?.forjaGroupId === selectedPhase;
    });
  }, [lobbies, selectedPhase]);

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

      {isAdmin && (
        <div style={{ marginBottom: '2rem' }}>
          <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(12px)',
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
            <div style={{
              marginTop: '1rem',
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              borderRadius: '1.25rem',
              padding: '1.75rem',
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc', marginBottom: '1.5rem', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#facc15' }}>⚡</span> Configuração de Novo Confronto Oficial
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {/* Etapa */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Fase da Partida</label>
                  <select 
                    value={matchStage} 
                    onChange={e => setMatchStage(e.target.value as any)}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                    className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                  >
                    <option value="GROUP">Fase de Grupos</option>
                    <option value="PLAYOFFS_BO3">Playoffs (MD3)</option>
                    <option value="PLAYOFFS_BO5">Playoffs (MD5)</option>
                  </select>
                </div>

                {matchStage === 'GROUP' ? (
                  <>
                    {/* Grupo */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>Grupo</label>
                      <select 
                        value={matchGroup} 
                        onChange={e => setMatchGroup(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', background: '#090d16', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, outline: 'none' }}
                        className="focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                      >
                        <option value="A">Grupo A</option>
                        <option value="B">Grupo B</option>
                        <option value="C">Grupo C</option>
                        <option value="D">Grupo D</option>
                      </select>
                    </div>

                    {/* Rodada */}
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

      {/* ── Classificação - Fase de Grupos ── */}
      {activeGroups.length > 0 && (
        <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 Classificação — Fase de Grupos
            </h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '1.25rem', marginTop: '-0.25rem', opacity: 0.8, fontStyle: 'italic' }}>
            Passe o mouse sobre um time para ver os membros
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 w-full">
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

      {/* ── Match Center (O Histórico de Partidas) ── */}
      <div style={{ marginTop: '3.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2.5rem' }}>
        <h3 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🏟️</span> Match Center Oficial
        </h3>

        {/* Sub-navegação interna (Pills estilo Tailwind) */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
          {['A', 'B', 'C', 'D', 'PLAYOFFS'].map((phaseCode) => {
            const label = phaseCode === 'PLAYOFFS' ? 'Playoffs' : `Grupo ${phaseCode}`;
            const isActive = selectedPhase === phaseCode;
            return (
              <button
                key={phaseCode}
                onClick={() => setSelectedPhase(phaseCode as any)}
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
        {filteredLobbies.length === 0 ? (
          <div className="forja-empty" style={{ padding: '3rem 2rem' }}>
            <span style={{ fontSize: '2.5rem' }}>⚔️</span>
            <p style={{ marginTop: '0.75rem', color: '#64748b' }}>Nenhuma partida registrada nesta fase.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {filteredLobbies.map(lobby => (
              <MatchConfrontationCard
                key={lobby.id}
                lobby={lobby}
                isAdmin={isAdmin}
                onEdit={setEditingLobby}
                onDelete={handleDeleteMatch}
                teams={teams}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Encerramento Manual */}
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingLobby(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Cancelar</button>
              <button 
                onClick={() => {
                  const sA = parseInt((document.getElementById('scoreA') as HTMLInputElement).value) || 0;
                  const sB = parseInt((document.getElementById('scoreB') as HTMLInputElement).value) || 0;
                  const ext = (document.getElementById('externalLink') as HTMLInputElement).value;
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
    </section>
  );
}