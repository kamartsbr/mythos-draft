import type { LobbyConfig } from '../../types';
import type { ForjaLiveMatchSummary } from './types';

type ForjaLobbySummarySource = {
  id: string;
  status?: string;
  scoreA?: number | null;
  scoreB?: number | null;
  config?: Partial<LobbyConfig> | null;
};

function getForjaDateMillis(value: ForjaLiveMatchSummary['scheduledDate'] | undefined): number {
  if (!value) return 0;
  if (typeof value === 'number') return value < 10000000000 ? value * 1000 : value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

export function isOfficialForjaLobbyData(lobby: unknown): boolean {
  if (!lobby || typeof lobby !== 'object') return false;
  const config = (lobby as { config?: Partial<LobbyConfig> | null }).config;
  return config?.preset === 'FORJA'
    && (config.isOfficialForjaMatch === true || !!config.forjaTeamA);
}

export function forjaLobbyToLiveMatchSummary(lobby: ForjaLobbySummarySource): ForjaLiveMatchSummary {
  const config = lobby.config ?? {};
  return {
    id: lobby.id,
    name: config.name ?? 'Partida',
    status: lobby.status ?? 'waiting',
    scoreA: lobby.scoreA ?? 0,
    scoreB: lobby.scoreB ?? 0,
    stage: config.tournamentStage ?? 'GROUP',
    scheduledDate: config.scheduledDate as ForjaLiveMatchSummary['scheduledDate'],
    scheduledTime: config.scheduledTime,
    streamerUrl: config.streamerUrl,
    externalLink: config.externalDraftLink ?? '',
    config: {
      name: config.name ?? 'Partida',
      forjaTeamA: config.forjaTeamA,
      forjaTeamB: config.forjaTeamB,
      forjaGroupId: config.forjaGroupId,
      tournamentStage: config.tournamentStage,
      externalLink: config.externalDraftLink ?? '',
    },
  };
}

export function sortForjaLiveMatches(matches: ForjaLiveMatchSummary[]): ForjaLiveMatchSummary[] {
  return [...matches].sort((left, right) => {
    const leftTs = getForjaDateMillis(left.scheduledDate);
    const rightTs = getForjaDateMillis(right.scheduledDate);
    if (leftTs === rightTs) return left.name.localeCompare(right.name);
    return leftTs - rightTs;
  });
}

export function mergeForjaLiveMatches(
  ...matchLists: Array<ForjaLiveMatchSummary[] | null | undefined>
): ForjaLiveMatchSummary[] {
  const byId = new Map<string, ForjaLiveMatchSummary>();
  for (const matches of matchLists) {
    if (!Array.isArray(matches)) continue;
    for (const match of matches) {
      const existing = byId.get(match.id);
      byId.set(match.id, existing ? { ...existing, ...match } : match);
    }
  }
  return sortForjaLiveMatches(Array.from(byId.values()));
}
