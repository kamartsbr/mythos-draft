/**
 * ============================================================
 *  FORJA DE HEFESTO — Utilitários de Cálculo
 *  Lógica pura: effectiveElo, Tiers dinâmicos e sort.
 *  Nenhuma dessas funções escreve no Firestore.
 * ============================================================
 */

import { ForjaPlayer, ForjaTier } from './types';

// ─── Tiers (baseado em 48 players) ───────────────────────────────────────────
const TIER_A_MAX = 16;
const TIER_B_MAX = 32;

/**
 * Retorna o Tier dinâmico com base na posição (1-indexed) no rank geral.
 * Posição 1–16  → A
 * Posição 17–32 → B
 * Posição 33–48 → C
 */
export function getTierByRank(rank: number): ForjaTier {
  if (rank <= TIER_A_MAX) return 'A';
  if (rank <= TIER_B_MAX) return 'B';
  return 'C';
}

// ─── Effective ELO ────────────────────────────────────────────────────────────

/**
 * ELO efetivo de um jogador — nunca salvo, sempre computado.
 * Prioridade:
 *  1. esports_elo_enabled === true → usa esports_elo_value (Admin toggle)
 *  2. esports_elo legado (campo antigo, compatibilidade)
 *  3. elo_1v1 (padrão)
 */
export function getEffectiveElo(player: ForjaPlayer): number {
  if (player.esports_elo_enabled && player.esports_elo_value != null) {
    return player.esports_elo_value;
  }
  if (player.esports_elo && player.esports_elo > 0) {
    return player.esports_elo;
  }
  return player.elo_1v1 ?? 0;
}

/**
 * Retorna true se o jogador tem algum Esports ELO ativo
 * (seja pelo toggle v2 ou pelo campo legado).
 */
export function hasEsportsElo(player: ForjaPlayer): boolean {
  return (
    (player.esports_elo_enabled === true && (player.esports_elo_value ?? 0) > 0) ||
    (player.esports_elo != null && player.esports_elo > 0)
  );
}

/**
 * Valor a exibir como Esports ELO (undefined = não exibe).
 */
export function getEsportsEloDisplay(player: ForjaPlayer): number | undefined {
  if (player.esports_elo_enabled && player.esports_elo_value != null) {
    return player.esports_elo_value;
  }
  if (player.esports_elo && player.esports_elo > 0) {
    return player.esports_elo;
  }
  return undefined;
}

// ─── Sort & Tier Computation ──────────────────────────────────────────────────

export interface RankedPlayer extends ForjaPlayer {
  /** Posição no rank (1-indexed, derivado do sort) */
  rank: number;
  /** Tier calculado dinamicamente — sobrepõe player.tier */
  computedTier: ForjaTier;
  /** ELO efetivo pré-calculado */
  effectiveElo: number;
}

/**
 * Recebe um array de ForjaPlayer e retorna:
 * - Ordenado do maior para o menor effectiveElo
 * - Com rank (1-indexed) e computedTier atribuídos
 * - Players is_reserve === true são incluídos por último (sem tier)
 */
export function computeRankedPlayers(players: ForjaPlayer[]): RankedPlayer[] {
  // Separa reservas e participantes ativos
  const active  = players.filter(p => !p.is_reserve);
  const reserve = players.filter(p => p.is_reserve);

  // Sort decrescente por effectiveElo, tiebreak por elo_tg
  const sorted = [...active].sort((a, b) => {
    const eloA = getEffectiveElo(a);
    const eloB = getEffectiveElo(b);
    if (eloB !== eloA) return eloB - eloA;
    return (b.elo_tg ?? 0) - (a.elo_tg ?? 0);
  });

  const rankedActive: RankedPlayer[] = sorted.map((p, idx) => ({
    ...p,
    rank: idx + 1,
    computedTier: getTierByRank(idx + 1),
    effectiveElo: getEffectiveElo(p),
  }));

  const rankedReserve: RankedPlayer[] = reserve.map((p, idx) => ({
    ...p,
    rank: rankedActive.length + idx + 1,
    computedTier: null,
    effectiveElo: getEffectiveElo(p),
  }));

  return [...rankedActive, ...rankedReserve];
}

// ─── Cor de ELO ───────────────────────────────────────────────────────────────

/** Cor semântica baseada no ELO (compatível com as paletas existentes). */
export function eloColor(elo: number): string {
  if (elo >= 2000) return '#f59e0b'; // Ouro
  if (elo >= 1800) return '#60a5fa'; // Azul
  return '#94a3b8';                  // Cinza
}

// ─── Tier Display Helpers ─────────────────────────────────────────────────────

export const TIER_META: Record<string, {
  bg: string; border: string; text: string; glow: string; label: string;
}> = {
  A: {
    bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.5)',
    text: '#facc15', glow: 'rgba(234,179,8,0.3)', label: 'Tier A (1º–16º)',
  },
  B: {
    bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.5)',
    text: '#60a5fa', glow: 'rgba(59,130,246,0.3)', label: 'Tier B (17º–32º)',
  },
  C: {
    bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.5)',
    text: '#94a3b8', glow: 'rgba(100,116,139,0.2)', label: 'Tier C (33º–48º)',
  },
};

export const AVAILABILITY_LABELS: Record<string, { label: string; icon: string }> = {
  'weekday-eve': { label: 'Semana/Noite', icon: '🌙' },
  'weekend-aft': { label: 'FDS/Tarde',    icon: '☀️' },
  'weekend-eve': { label: 'FDS/Noite',    icon: '🌃' },
  'late-night':  { label: 'Madrugada',    icon: '🦉' },
};
