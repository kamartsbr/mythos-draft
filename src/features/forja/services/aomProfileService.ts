import { getFunctions, httpsCallable } from 'firebase/functions';
import type { AomProfileData, ForjaGodStat } from '../types';

const AOM_FUNCTIONS_REGION = 'us-central1';
const AOM_FETCH_PROFILE_CALLABLE = 'fetchaomprofile';

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

function resolveGodName(entry: RawAomGodStat): string {
  if (typeof entry === 'string') return entry.trim();
  return (typeof entry.god === 'string' ? entry.god : entry.godName ?? '').trim();
}

/**
 * Normalizes the callable's top-gods payload. The backend may return legacy
 * string IDs or object stats; invalid/empty god identifiers are discarded.
 */
export function normalizeAomGodStats(topGods: RawAomGodStat[] | null | undefined): ForjaGodStat[] {
  if (!Array.isArray(topGods)) return [];

  return topGods
    .map((entry): ForjaGodStat | null => {
      const god = resolveGodName(entry);
      if (!god) return null;

      return {
        god,
        godName: typeof entry === 'string' ? god : entry.godName,
        winRate: typeof entry !== 'string' && typeof entry.winRate === 'number' && Number.isFinite(entry.winRate) ? entry.winRate : 0,
        playRate: typeof entry !== 'string' && typeof entry.playRate === 'number' && Number.isFinite(entry.playRate) ? entry.playRate : 0,
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
    // Admin confirmation is a separate moderation step; fetched data starts unverified.
    verified: false,
  };
}

/**
 * Calls the centralized AoM profile callable in us-central1 and normalizes its schema.
 */
export async function fetchAomProfileForPlayer(profileId: number): Promise<AomApiResult> {
  const functions = getFunctions(undefined, AOM_FUNCTIONS_REGION);
  const fetchAomProfile = httpsCallable<{ id: number }, RawAomProfileResult>(functions, AOM_FETCH_PROFILE_CALLABLE);
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
