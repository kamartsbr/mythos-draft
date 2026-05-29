import { getFunctions, httpsCallable } from 'firebase/functions';
import type { AomProfileData, ForjaGodStat } from '../types';

export interface AomApiResult {
  elo_1v1: number;
  elo_tg: number;
  top_gods: ForjaGodStat[];
  alias: string;
  avatar_url: string | null;
}

type RawAomGodStat = Partial<ForjaGodStat> | string;

interface RawAomProfileResult {
  isError?: boolean;
  message?: string;
  elo_1v1?: number;
  elo_tg?: number;
  top_gods?: RawAomGodStat[] | null;
  alias?: string | null;
  avatar_url?: string | null;
}

export function normalizeAomGodStats(topGods: RawAomGodStat[] | null | undefined): ForjaGodStat[] {
  if (!Array.isArray(topGods)) return [];

  return topGods
    .map((entry): ForjaGodStat | null => {
      if (typeof entry === 'string') {
        const god = entry.trim();
        return god ? { god, godName: god, winRate: 0, playRate: 0 } : null;
      }

      const god = typeof entry.god === 'string'
        ? entry.god.trim()
        : typeof entry.godName === 'string'
          ? entry.godName.trim()
          : '';

      if (!god) return null;

      return {
        god,
        godName: entry.godName,
        winRate: typeof entry.winRate === 'number' && Number.isFinite(entry.winRate) ? entry.winRate : 0,
        playRate: typeof entry.playRate === 'number' && Number.isFinite(entry.playRate) ? entry.playRate : 0,
      };
    })
    .filter((entry): entry is ForjaGodStat => entry !== null)
    .slice(0, 5);
}

export function toAomProfileData(profileId: number, data: AomApiResult): AomProfileData {
  return {
    profile_id: profileId,
    avatar_url: data.avatar_url,
    elo_1v1: data.elo_1v1,
    elo_tg: data.elo_tg,
    elo_efetivo: Math.round((data.elo_1v1 + data.elo_tg) / 2) || 0,
    top_gods: data.top_gods,
    alias: data.alias || null,
    verified: false,
  };
}

/**
 * Calls the centralized AoM profile callable in us-central1 and normalizes its schema.
 */
export async function fetchAomProfileForPlayer(profileId: number): Promise<AomApiResult> {
  const functions = getFunctions(undefined, 'us-central1');
  const fetchAomProfile = httpsCallable<{ id: number }, RawAomProfileResult>(functions, 'fetchaomprofile');
  const result = await fetchAomProfile({ id: profileId });
  const data = result.data;

  if (!data || data.isError) {
    throw new Error(data?.message ?? 'Erro inesperado no retorno da API');
  }

  return {
    elo_1v1: data.elo_1v1 ?? 0,
    elo_tg: data.elo_tg ?? 0,
    top_gods: normalizeAomGodStats(data.top_gods),
    alias: data.alias || String(profileId),
    avatar_url: data.avatar_url ?? null,
  };
}
