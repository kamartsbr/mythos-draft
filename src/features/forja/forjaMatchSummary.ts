import type { LobbyConfig } from '../../types';
import type { ForjaLiveMatchSummary } from './types';

type ForjaLobbySummarySource = {
  id: string;
  status?: string;
  scoreA?: number | null;
  scoreB?: number | null;
  config?: Partial<LobbyConfig> | null;
};

export function resolveForjaDateValue(value: ForjaLiveMatchSummary['scheduledDate'] | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value < 10000000000 ? value * 1000 : value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) return value;
  if (typeof value.toMillis === 'function') return new Date(value.toMillis());
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor((value.nanoseconds ?? 0) / 1000000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function resolveForjaMatchDateTime(
  scheduledDate: ForjaLiveMatchSummary['scheduledDate'] | undefined,
  scheduledTime?: string | null
): Date | null {
  if (!scheduledDate) return null;

  if (typeof scheduledDate === 'string') {
    const parts = scheduledDate.split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      const [year, month, day] = parts;
      const [hour, minute] = (scheduledTime || '00:00').split(':').map(Number);
      return new Date(year, month - 1, day, hour || 0, minute || 0);
    }
  }

  const date = resolveForjaDateValue(scheduledDate);
  if (!date) return null;
  if (scheduledTime) {
    const [hour, minute] = scheduledTime.split(':').map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0);
  }
  return date;
}

function getForjaDateMillis(value: ForjaLiveMatchSummary['scheduledDate'] | undefined): number {
  return resolveForjaDateValue(value)?.getTime() ?? 0;
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
      scheduledDate: config.scheduledDate as ForjaLiveMatchSummary['scheduledDate'],
      scheduledTime: config.scheduledTime,
      streamerUrl: config.streamerUrl,
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
