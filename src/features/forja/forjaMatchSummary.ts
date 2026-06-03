import type { LobbyConfig } from '../../types';
import type { ForjaLiveMatchSummary } from './types';

type ForjaLobbySummarySource = {
  id: string;
  status?: string;
  scoreA?: number | null;
  scoreB?: number | null;
  config?: Partial<LobbyConfig> | null;
};

const BRT_UTC_OFFSET_HOURS = 3;

function parseScheduledTime(scheduledTime?: string | null): { hour: number; minute: number } {
  const [rawHour, rawMinute] = (scheduledTime || '00:00').split(':').map(Number);
  return {
    hour: Number.isFinite(rawHour) ? rawHour : 0,
    minute: Number.isFinite(rawMinute) ? rawMinute : 0,
  };
}

function createBrtDateTime(year: number, month: number, day: number, scheduledTime?: string | null): Date {
  const { hour, minute } = parseScheduledTime(scheduledTime);
  return new Date(Date.UTC(year, month - 1, day, hour + BRT_UTC_OFFSET_HOURS, minute));
}

function getBrtDateParts(date: Date): { year: number; month: number; day: number } {
  const brtTime = new Date(date.getTime() - BRT_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: brtTime.getUTCFullYear(),
    month: brtTime.getUTCMonth() + 1,
    day: brtTime.getUTCDate(),
  };
}

export function formatForjaDateInputValue(date: Date): string {
  const { year, month, day } = getBrtDateParts(date);
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function resolveForjaDateValue(value: ForjaLiveMatchSummary['scheduledDate'] | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return new Date(value < 10000000000 ? value * 1000 : value);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
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
      return createBrtDateTime(year, month, day, scheduledTime);
    }
  }

  const date = resolveForjaDateValue(scheduledDate);
  if (!date) return null;
  if (scheduledTime) {
    const { year, month, day } = getBrtDateParts(date);
    return createBrtDateTime(year, month, day, scheduledTime);
  }
  return date;
}

function getForjaDateMillis(match: ForjaLiveMatchSummary): number {
  return resolveForjaMatchDateTime(match.scheduledDate, match.scheduledTime)?.getTime() ?? 0;
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
      forjaPlayoffMatchId: config.forjaPlayoffMatchId,
      forjaPlayoffRound: config.forjaPlayoffRound,
      forjaPlayoffSourceA: config.forjaPlayoffSourceA,
      forjaPlayoffSourceB: config.forjaPlayoffSourceB,
      externalLink: config.externalDraftLink ?? '',
      scheduledDate: config.scheduledDate as ForjaLiveMatchSummary['scheduledDate'],
      scheduledTime: config.scheduledTime,
      streamerUrl: config.streamerUrl,
    },
  };
}

export function sortForjaLiveMatches(matches: ForjaLiveMatchSummary[]): ForjaLiveMatchSummary[] {
  return [...matches].sort((left, right) => {
    const leftTs = getForjaDateMillis(left);
    const rightTs = getForjaDateMillis(right);
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
