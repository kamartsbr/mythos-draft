/**
 * Forja de Hefesto — Aba: Início
 * Passo 3: lista em tempo real via useForjaPlayers (Firestore).
 */

import React, { useState } from 'react';
import { ForjaViewProps, ForjaPlayer, ForjaGodStat, ForjaTier } from '../types';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { removeForjaPlayer } from '../services/forjaService';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const GOD_IMAGES: Record<string, string> = {
  zeus: 'https://static.wikia.nocookie.net/ageofempires/images/1/14/AoMRT_Greek_Zeus.webp/revision/latest/scale-to-width-down/64?cb=20250701110532',
  hades: 'https://static.wikia.nocookie.net/ageofempires/images/5/5e/AoMRT_Greek_Hades.webp/revision/latest/scale-to-width-down/64?cb=20250701110530',
  poseidon: 'https://static.wikia.nocookie.net/ageofempires/images/e/e6/AoMRT_Greek_Poseidon.webp/revision/latest/scale-to-width-down/64?cb=20250701110531',
  ra: 'https://static.wikia.nocookie.net/ageofempires/images/6/67/AoMRT_Egyptian_Ra.webp/revision/latest/scale-to-width-down/64?cb=20250701110519',
  isis: 'https://static.wikia.nocookie.net/ageofempires/images/d/dd/AoMRT_Egyptian_Isis.webp/revision/latest/scale-to-width-down/64?cb=20250701110517',
  set: 'https://static.wikia.nocookie.net/ageofempires/images/3/3e/AoMRT_Egyptian_Set-scaled.webp/revision/latest/scale-to-width-down/64?cb=20250701110515',
  thor: 'https://static.wikia.nocookie.net/ageofempires/images/5/55/AoMRT_Norse_Thor.webp/revision/latest/scale-to-width-down/64?cb=20250701110503',
  loki: 'https://static.wikia.nocookie.net/ageofempires/images/7/7c/AoMRT_Norse_Loki.webp/revision/latest/scale-to-width-down/64?cb=20250701110502',
  odin: 'https://static.wikia.nocookie.net/ageofempires/images/9/9a/AoMRT_Norse_Odin.webp/revision/latest/scale-to-width-down/64?cb=20250701110501',
  kronos: 'https://static.wikia.nocookie.net/ageofempires/images/e/e7/AoMRT_Atlantean_Kronos.webp/revision/latest/scale-to-width-down/64?cb=20250701110454',
  oranos: 'https://static.wikia.nocookie.net/ageofempires/images/3/37/AoMRT_Atlantean_Oranos.webp/revision/latest/scale-to-width-down/64?cb=20250701110455',
  gaia: 'https://static.wikia.nocookie.net/ageofempires/images/0/00/AoMRT_Atlantean_Gaia.webp/revision/latest/scale-to-width-down/64?cb=20250701110453',
  amaterasu: 'https://static.wikia.nocookie.net/ageofempires/images/3/3e/Amaterasu_artwork_new_AoMR.png/revision/latest/scale-to-width-down/64?cb=20250730190329',
  fuxi: 'https://static.wikia.nocookie.net/ageofempires/images/f/f5/Fuxi_artwork_AoMR.png/revision/latest/scale-to-width-down/64?cb=20250204185506',
  nuwa: 'https://static.wikia.nocookie.net/ageofempires/images/4/45/Nuwa_artwork_AoMR.png/revision/latest/scale-to-width-down/64?cb=20250204185423',
};

const MOCK_PLAYERS: ForjaPlayer[] = [
  {
    discord_id: '111111111111111111',
    aom_id: 'omoradin',
    nick: 'Omoradin',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    is_brazilian: true,
    pitch_quote: 'Zeus ou morte, não tem meio-termo!',
    elo_1v1: 2150,
    elo_tg: 1980,
    top_gods: [
      { god: 'zeus', godName: 'Zeus', winRate: 68, playRate: 45 },
      { god: 'hades', godName: 'Hades', winRate: 61, playRate: 22 },
      { god: 'thor', godName: 'Thor', winRate: 55, playRate: 18 },
      { god: 'ra', godName: 'Ra', winRate: 50, playRate: 10 },
      { god: 'kronos', godName: 'Kronos', winRate: 48, playRate: 5 },
    ],
    status: 'available',
    tier: 'A',
    team_id: null,
    seed: 1,
    registered_at: null,
  },
  {
    discord_id: '222222222222222222',
    aom_id: 'kamaRTS',
    nick: 'KamaRTS',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png',
    is_brazilian: true,
    pitch_quote: 'Loki main. Chaos is the plan.',
    elo_1v1: 2080,
    elo_tg: 2010,
    top_gods: [
      { god: 'loki', godName: 'Loki', winRate: 72, playRate: 55 },
      { god: 'odin', godName: 'Odin', winRate: 60, playRate: 20 },
      { god: 'set', godName: 'Set', winRate: 57, playRate: 12 },
      { god: 'isis', godName: 'Isis', winRate: 53, playRate: 8 },
      { god: 'oranos', godName: 'Oranos', winRate: 45, playRate: 5 },
    ],
    status: 'available',
    tier: 'A',
    team_id: null,
    seed: 2,
    registered_at: null,
  },
  {
    discord_id: '333333333333333333',
    aom_id: 'thunderaxe99',
    nick: 'ThunderAxe',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png',
    is_brazilian: true,
    pitch_quote: 'Thor TG é science, não opinião.',
    elo_1v1: 1920,
    elo_tg: 2100,
    top_gods: [
      { god: 'thor', godName: 'Thor', winRate: 70, playRate: 60 },
      { god: 'odin', godName: 'Odin', winRate: 58, playRate: 20 },
      { god: 'poseidon', godName: 'Poseidon', winRate: 54, playRate: 10 },
      { god: 'ra', godName: 'Ra', winRate: 50, playRate: 7 },
      { god: 'gaia', godName: 'Gaia', winRate: 44, playRate: 3 },
    ],
    status: 'available',
    tier: 'B',
    team_id: null,
    seed: 3,
    registered_at: null,
  },
  {
    discord_id: '444444444444444444',
    aom_id: 'mythkeeper_br',
    nick: 'MythKeeper',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png',
    is_brazilian: true,
    pitch_quote: 'Isis e fé, sempre. Vai que vai.',
    elo_1v1: 1850,
    elo_tg: 1900,
    top_gods: [
      { god: 'isis', godName: 'Isis', winRate: 65, playRate: 50 },
      { god: 'ra', godName: 'Ra', winRate: 59, playRate: 25 },
      { god: 'amaterasu', godName: 'Amaterasu', winRate: 52, playRate: 12 },
      { god: 'set', godName: 'Set', winRate: 49, playRate: 8 },
      { god: 'zeus', godName: 'Zeus', winRate: 46, playRate: 5 },
    ],
    status: 'available',
    tier: 'B',
    team_id: null,
    seed: 4,
    registered_at: null,
  },
  {
    discord_id: '555555555555555555',
    aom_id: 'dragonlord_pt',
    nick: 'DragonLord_PT',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png',
    is_brazilian: false,
    pitch_quote: 'De Portugal para o mundo!',
    elo_1v1: 1780,
    elo_tg: 1820,
    top_gods: [
      { god: 'kronos', godName: 'Kronos', winRate: 63, playRate: 42 },
      { god: 'oranos', godName: 'Oranos', winRate: 58, playRate: 30 },
      { god: 'fuxi', godName: 'Fuxi', winRate: 51, playRate: 15 },
      { god: 'hades', godName: 'Hades', winRate: 47, playRate: 8 },
      { god: 'loki', godName: 'Loki', winRate: 43, playRate: 5 },
    ],
    status: 'available',
    tier: 'B',
    team_id: null,
    seed: 5,
    registered_at: null,
  },
  {
    discord_id: '666666666666666666',
    aom_id: 'goldenspear7',
    nick: 'GoldenSpear',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/5.png',
    is_brazilian: true,
    pitch_quote: 'Cada partida é uma forja da alma.',
    elo_1v1: 1710,
    elo_tg: 1750,
    top_gods: [
      { god: 'nuwa', godName: 'Nüwa', winRate: 61, playRate: 38 },
      { god: 'fuxi', godName: 'Fuxi', winRate: 55, playRate: 28 },
      { god: 'amaterasu', godName: 'Amaterasu', winRate: 50, playRate: 20 },
      { god: 'gaia', godName: 'Gaia', winRate: 46, playRate: 9 },
      { god: 'poseidon', godName: 'Poseidon', winRate: 42, playRate: 5 },
    ],
    status: 'available',
    tier: 'C',
    team_id: null,
    seed: 6,
    registered_at: null,
  },
];

// ─── Tier Badge ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  A: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.5)', text: '#facc15', glow: 'rgba(234,179,8,0.3)' },
  B: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.5)', text: '#60a5fa', glow: 'rgba(59,130,246,0.3)' },
  C: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.5)', text: '#94a3b8', glow: 'rgba(100,116,139,0.2)' },
};

function TierBadge({ tier }: { tier: ForjaTier }) {
  if (!tier) return null;
  const c = TIER_COLORS[tier];
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

// ─── God Icon ─────────────────────────────────────────────────────────────────

function GodIcon({ god, godName, winRate }: ForjaGodStat) {
  const src = GOD_IMAGES[god];
  return (
    <div className="forja-god-icon" title={`${godName ?? god} — ${winRate}% WR`}>
      {src
        ? <img src={src} alt={godName ?? god} referrerPolicy="no-referrer" loading="lazy" />
        : <span style={{ fontSize: '1.1rem' }}>⚡</span>
      }
      <span className="forja-god-wr">{winRate}%</span>
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, isAdmin }: { player: ForjaPlayer; isAdmin: boolean }) {
  const [imgErr, setImgErr]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${(parseInt(player.discord_id.slice(-1)) || 0) % 6}.png`;

  const eloColor = (elo: number) =>
    elo >= 2000 ? '#f59e0b' : elo >= 1800 ? '#60a5fa' : '#94a3b8';

  const handleRemove = async () => {
    if (!window.confirm(`Remover a inscrição de ${player.nick}?`)) return;
    setRemoving(true);
    try {
      await removeForjaPlayer(player.discord_id);
    } catch (e) {
      console.error(e);
      setRemoving(false);
    }
  };

  return (
    <article className="forja-player-card" style={{ opacity: removing ? 0.4 : 1, transition: 'opacity 0.3s' }}>
      {/* Seed Badge */}
      {player.seed && <div className="forja-seed-badge">#{player.seed}</div>}

      {/* Admin Remove */}
      {isAdmin && (
        <button
          className="forja-card-remove-btn"
          onClick={handleRemove}
          disabled={removing}
          title="Remover inscrição"
          id={`forja-remove-${player.discord_id}`}
        >
          {removing ? '…' : '✕'}
        </button>
      )}

      {/* Header: Avatar + Nome + Tier */}
      <div className="forja-player-card__header">
        <div className="forja-player-avatar">
          <img
            src={imgErr ? fallback : player.avatar_url}
            alt={player.nick}
            onError={() => setImgErr(true)}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <span className="forja-player-flag" title={player.is_brazilian ? 'Brasil' : 'Portugal'}>
            {player.is_brazilian ? '🇧🇷' : '🇵🇹'}
          </span>
        </div>

        <div className="forja-player-info">
          <h3 className="forja-player-nick">{player.nick}</h3>
          <a
            href={`https://aomstats.io/players/${player.aom_id}`}
            target="_blank" rel="noreferrer noopener"
            className="forja-player-aomlink" title="Ver no AoMStats"
          >
            @{player.aom_id}
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <TierBadge tier={player.tier} />
          </div>
        </div>
      </div>

      {/* ELO Stats */}
      <div className="forja-player-elos">
        <div className="forja-elo-block">
          <span className="forja-elo-label">1v1 ELO</span>
          <span className="forja-elo-value" style={{ color: eloColor(player.elo_1v1) }}>
            {player.elo_1v1 > 0 ? player.elo_1v1.toLocaleString() : '—'}
          </span>
        </div>
        <div className="forja-elo-divider" />
        <div className="forja-elo-block">
          <span className="forja-elo-label">TG ELO</span>
          <span className="forja-elo-value" style={{ color: eloColor(player.elo_tg) }}>
            {player.elo_tg > 0 ? player.elo_tg.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Top 5 Gods */}
      {player.top_gods.length > 0 && (
        <div className="forja-player-gods">
          <span className="forja-player-gods__label">TOP DEUSES</span>
          <div className="forja-player-gods__row">
            {player.top_gods.slice(0, 5).map(g => (
              <GodIcon key={g.god} {...g} />
            ))}
          </div>
        </div>
      )}

      {/* Pitch Quote */}
      {player.pitch_quote && (
        <div className="forja-player-pitch">
          <span className="forja-pitch-quote">"{player.pitch_quote}"</span>
        </div>
      )}
    </article>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ players, isLive }: { players: ForjaPlayer[]; isLive: boolean }) {
  const tierCount = { A: 0, B: 0, C: 0 };
  players.forEach(p => { if (p.tier) tierCount[p.tier as 'A'|'B'|'C']++; });

  return (
    <div className="forja-stats-bar">
      <div className="forja-stats-item">
        <span className="forja-stats-value">{players.length}</span>
        <span className="forja-stats-label">Inscritos</span>
      </div>
      <div className="forja-stats-divider" />
      <div className="forja-stats-item">
        <span className="forja-stats-value" style={{ color: '#facc15' }}>{tierCount.A}</span>
        <span className="forja-stats-label">Tier A</span>
      </div>
      <div className="forja-stats-divider" />
      <div className="forja-stats-item">
        <span className="forja-stats-value" style={{ color: '#60a5fa' }}>{tierCount.B}</span>
        <span className="forja-stats-label">Tier B</span>
      </div>
      <div className="forja-stats-divider" />
      <div className="forja-stats-item">
        <span className="forja-stats-value" style={{ color: '#94a3b8' }}>{tierCount.C}</span>
        <span className="forja-stats-label">Tier C</span>
      </div>
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


// ─── Props ────────────────────────────────────────────────────────────────────

interface ForjaInicioProps extends ForjaViewProps {
  onRegisterClick: () => void;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaInicio({ discordUser, isAdmin, onRegisterClick }: ForjaInicioProps) {
  const { players, loading, error, isLive } = useForjaPlayers();
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');

  const filtered = filter === 'all' ? players : players.filter(p => p.tier === filter);

  return (
    <section className="forja-view forja-view--inicio">

      {/* Hero CTA */}
      <div className="forja-inicio-hero">
        <div className="forja-inicio-hero__text">
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
          <button
            id="forja-cta-register-btn"
            className="forja-btn forja-btn--primary forja-btn--lg forja-btn--glow"
            onClick={onRegisterClick}
          >
            <span>🔥</span>
            Inscreva-se no Torneio
          </button>
          <span className="forja-cta-note">
            {discordUser ? `Logado como ${discordUser.username}` : 'Necessário login com Discord'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="forja-admin-banner" style={{ borderColor: 'rgba(251,191,36,0.3)', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Live Stats Bar */}
      {!loading && <StatsBar players={players} isLive={isLive} />}

      {/* Filter Tabs */}
      <div className="forja-filter-row">
        <span className="forja-filter-label">Filtrar por Tier:</span>
        {(['all', 'A', 'B', 'C'] as const).map(f => (
          <button
            key={f}
            id={`forja-filter-${f}`}
            className={`forja-filter-btn ${filter === f ? 'forja-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : `Tier ${f}`}
          </button>
        ))}
        {!loading && (
          <span className="forja-filter-count">
            {filtered.length} jogador{filtered.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Player Grid */}
      {loading ? (
        <div className="forja-players-grid">
          {[1,2,3,4,5,6].map(i => <PlayerSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="forja-players-grid">
          {filtered.map(player => (
            <PlayerCard key={player.discord_id} player={player} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div className="forja-empty">
          <span>🔍</span>
          <p>Nenhum jogador encontrado neste tier.</p>
        </div>
      )}

      {/* Admin Note */}
      {isAdmin && !loading && (
        <div className="forja-admin-banner">
          🛡️ Modo Admin — Clique em ✕ em qualquer card para remover a inscrição
        </div>
      )}
    </section>
  );
}
