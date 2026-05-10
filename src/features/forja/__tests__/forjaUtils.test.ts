/**
 * ============================================================
 *  TESTES: forjaUtils.ts
 *  Cobertura: getTierCutoffs, getTierByRank, getEffectiveElo,
 *             computeRankedPlayers (com settings e sem)
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import {
  getTierCutoffs,
  getTierByRank,
  getEffectiveElo,
  hasEsportsElo,
  computeRankedPlayers,
} from '../forjaUtils';
import type { ForjaPlayer } from '../types';

// ─── Helper de mock ─────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<ForjaPlayer> = {}): ForjaPlayer {
  return {
    discord_id:         '100000000000000001',
    aom_profile_id:     1001,
    aom_id:             '1001',
    nick:               'TestPlayer',
    avatar_url:         'https://cdn.discordapp.com/embed/avatars/0.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    is_brazilian:       true,
    pitch_quote:        'Testando.',
    availability:       [],
    elo_1v1:            1800,
    elo_tg:             1600,
    top_gods:           [],
    elo_snapshot:       1800,
    status:             'available',
    tier:               null,
    team_id:            null,
    seed:               null,
    registered_at:      null,
    consent_rules:      true,
    consent_format:     true,
    role:               'player',
    ...overrides,
  };
}

// ─── getTierCutoffs ──────────────────────────────────────────────────────────

describe('getTierCutoffs', () => {
  it('usa defaults de 48 players (16/16/16) quando sem settings', () => {
    const { tierAMax, tierBMax, tierASize, tierBSize, tierCSize } = getTierCutoffs();
    expect(tierAMax).toBe(16);
    expect(tierBMax).toBe(32);
    expect(tierASize).toBe(16);
    expect(tierBSize).toBe(16);
    expect(tierCSize).toBe(16);
  });

  it('respeita max_participants customizado (30 players → 10/10/10 por default)', () => {
    const { tierASize, tierBSize, tierCSize } = getTierCutoffs({ max_participants: 30 });
    expect(tierASize).toBe(10); // floor(30/3)
    expect(tierBSize).toBe(10); // floor((30-10)/2)
    expect(tierCSize).toBe(10);
  });

  it('usa tier_a_size e tier_b_size individuais (Opção B)', () => {
    const { tierAMax, tierBMax, tierASize, tierBSize, tierCSize } = getTierCutoffs({
      max_participants: 30,
      tier_a_size:      10,
      tier_b_size:      12,
    });
    expect(tierASize).toBe(10);
    expect(tierBSize).toBe(12);
    expect(tierCSize).toBe(8);  // 30 - 10 - 12
    expect(tierAMax).toBe(10);
    expect(tierBMax).toBe(22);  // 10 + 12
  });

  it('fallback: tier_a_size sem tier_b_size divide o restante igualmente', () => {
    const { tierBSize, tierCSize } = getTierCutoffs({
      max_participants: 30,
      tier_a_size:      6,
    });
    // remaining = 24, floor(24/2) = 12
    expect(tierBSize).toBe(12);
    expect(tierCSize).toBe(12);
  });
});

// ─── getTierByRank ───────────────────────────────────────────────────────────

describe('getTierByRank', () => {
  it('rank 1 → Tier A com defaults', () => {
    expect(getTierByRank(1)).toBe('A');
  });

  it('rank 16 → Tier A (limite máximo)', () => {
    expect(getTierByRank(16)).toBe('A');
  });

  it('rank 17 → Tier B', () => {
    expect(getTierByRank(17)).toBe('B');
  });

  it('rank 32 → Tier B (limite máximo)', () => {
    expect(getTierByRank(32)).toBe('B');
  });

  it('rank 33 → Tier C', () => {
    expect(getTierByRank(33)).toBe('C');
  });

  it('rank 48 → Tier C', () => {
    expect(getTierByRank(48)).toBe('C');
  });

  it('settings customizadas: top 10 → Tier A', () => {
    const settings = { max_participants: 30, tier_a_size: 10, tier_b_size: 10 };
    expect(getTierByRank(1,  settings)).toBe('A');
    expect(getTierByRank(10, settings)).toBe('A');
    expect(getTierByRank(11, settings)).toBe('B');
    expect(getTierByRank(20, settings)).toBe('B');
    expect(getTierByRank(21, settings)).toBe('C');
    expect(getTierByRank(30, settings)).toBe('C');
  });
});

// ─── getEffectiveElo ─────────────────────────────────────────────────────────

describe('getEffectiveElo', () => {
  it('retorna média de elo_1v1 e elo_tg', () => {
    const player = makePlayer({ elo_1v1: 2000, elo_tg: 1800 });
    expect(getEffectiveElo(player)).toBe(1900);
  });

  it('arredonda para inteiro', () => {
    const player = makePlayer({ elo_1v1: 2001, elo_tg: 1800 });
    expect(getEffectiveElo(player)).toBe(1901); // round(3801/2)
  });

  it('retorna 0 quando ambos são 0', () => {
    const player = makePlayer({ elo_1v1: 0, elo_tg: 0 });
    expect(getEffectiveElo(player)).toBe(0);
  });

  it('usa 0 como fallback quando elo_tg é undefined', () => {
    const player = makePlayer({ elo_1v1: 2000, elo_tg: undefined });
    expect(getEffectiveElo(player)).toBe(1000);
  });
});

// ─── hasEsportsElo ───────────────────────────────────────────────────────────

describe('hasEsportsElo', () => {
  it('retorna true quando esports_elo_enabled e valor > 0', () => {
    const p = makePlayer({ esports_elo_enabled: true, esports_elo_value: 2500 });
    expect(hasEsportsElo(p)).toBe(true);
  });

  it('retorna false quando esports_elo_enabled mas value é 0', () => {
    const p = makePlayer({ esports_elo_enabled: true, esports_elo_value: 0 });
    expect(hasEsportsElo(p)).toBe(false);
  });

  it('retorna false quando esports_elo_enabled é false', () => {
    const p = makePlayer({ esports_elo_enabled: false, esports_elo_value: 2500 });
    expect(hasEsportsElo(p)).toBe(false);
  });

  it('retorna true via campo legado esports_elo', () => {
    const p = makePlayer({ esports_elo: 2400 });
    expect(hasEsportsElo(p)).toBe(true);
  });
});

// ─── computeRankedPlayers ────────────────────────────────────────────────────

describe('computeRankedPlayers', () => {
  it('ordena por ELO efetivo decrescente', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 1500, elo_tg: 1400 }), // 1450
      makePlayer({ discord_id: '2', elo_1v1: 2000, elo_tg: 1800 }), // 1900
      makePlayer({ discord_id: '3', elo_1v1: 1700, elo_tg: 1600 }), // 1650
    ];
    const ranked = computeRankedPlayers(players);
    expect(ranked[0].discord_id).toBe('2'); // 1900
    expect(ranked[1].discord_id).toBe('3'); // 1650
    expect(ranked[2].discord_id).toBe('1'); // 1450
  });

  it('atribui rank 1-indexed corretamente', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 2000, elo_tg: 2000 }),
      makePlayer({ discord_id: '2', elo_1v1: 1000, elo_tg: 1000 }),
    ];
    const ranked = computeRankedPlayers(players);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('exclui banidos do ranking', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 2000, elo_tg: 2000, status: 'banned' }),
      makePlayer({ discord_id: '2', elo_1v1: 1500, elo_tg: 1500 }),
    ];
    const ranked = computeRankedPlayers(players);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].discord_id).toBe('2');
  });

  it('reserves marcados como is_reserve aparecem após ativos, sem tier', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 2000, elo_tg: 2000 }),
      makePlayer({ discord_id: '2', elo_1v1: 2500, elo_tg: 2500, is_reserve: true }),
    ];
    const ranked = computeRankedPlayers(players);
    expect(ranked[0].discord_id).toBe('1');        // ativo vem primeiro
    expect(ranked[1].discord_id).toBe('2');        // reserva por último
    expect(ranked[1].computedTier).toBeNull();     // sem tier
  });

  it('com max_participants=2: 3º jogador vira reserva dinâmica (is_reserve=true local)', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 2000, elo_tg: 2000 }),
      makePlayer({ discord_id: '2', elo_1v1: 1800, elo_tg: 1800 }),
      makePlayer({ discord_id: '3', elo_1v1: 1600, elo_tg: 1600 }), // overflow
    ];
    const ranked = computeRankedPlayers(players, { max_participants: 2 });
    // Os 2 primeiros ficam dentro do limite e recebem tier
    expect(ranked[0].computedTier).not.toBeNull();
    expect(ranked[1].computedTier).not.toBeNull();
    // O 3º é tratado como reserva dinâmica
    expect(ranked[2].is_reserve).toBe(true);
    expect(ranked[2].computedTier).toBeNull();
  });

  it('com max_participants=2 e tier_a_size=1: rank 1 → A, rank 2 → B', () => {
    const players = [
      makePlayer({ discord_id: '1', elo_1v1: 2000, elo_tg: 2000 }),
      makePlayer({ discord_id: '2', elo_1v1: 1800, elo_tg: 1800 }),
    ];
    const ranked = computeRankedPlayers(players, { max_participants: 2, tier_a_size: 1, tier_b_size: 1 });
    expect(ranked[0].computedTier).toBe('A'); // 1º dos 2 → Tier A
    expect(ranked[1].computedTier).toBe('B'); // 2º dos 2 → Tier B
  });

  it('usa tier_a_size e tier_b_size custom corretamente', () => {
    const players = Array.from({ length: 6 }, (_, i) =>
      makePlayer({ discord_id: String(i + 1), elo_1v1: 2000 - i * 100, elo_tg: 2000 - i * 100 })
    );
    const settings = { max_participants: 6, tier_a_size: 2, tier_b_size: 2 };
    const ranked = computeRankedPlayers(players, settings);
    expect(ranked[0].computedTier).toBe('A');
    expect(ranked[1].computedTier).toBe('A');
    expect(ranked[2].computedTier).toBe('B');
    expect(ranked[3].computedTier).toBe('B');
    expect(ranked[4].computedTier).toBe('C');
    expect(ranked[5].computedTier).toBe('C');
  });
});
