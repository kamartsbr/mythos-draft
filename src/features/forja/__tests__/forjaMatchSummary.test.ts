import { describe, expect, it } from 'vitest';
import {
  forjaLobbyToLiveMatchSummary,
  isOfficialForjaLobbyData,
  mergeForjaLiveMatches,
  resolveForjaDateValue,
  resolveForjaMatchDateTime,
  sortForjaLiveMatches,
} from '../forjaMatchSummary';

describe('FORJA match summary helpers', () => {
  it('keeps completed official lobby scores for standings', () => {
    const summary = forjaLobbyToLiveMatchSummary({
      id: 'old-completed-match',
      status: 'completed',
      scoreA: 2,
      scoreB: 1,
      config: {
        name: 'Grupo A - Team Alpha x Team Beta',
        preset: 'FORJA',
        isOfficialForjaMatch: true,
        tournamentStage: 'GROUP',
        forjaGroupId: 'A',
        forjaTeamA: 'team-alpha',
        forjaTeamB: 'team-beta',
      },
    });

    expect(summary.status).toBe('completed');
    expect(summary.scoreA).toBe(2);
    expect(summary.scoreB).toBe(1);
    expect(summary.stage).toBe('GROUP');
    expect(summary.config?.forjaGroupId).toBe('A');
  });

  it('only treats official FORJA lobbies as standings sources', () => {
    expect(isOfficialForjaLobbyData({
      config: {
        preset: 'FORJA',
        isOfficialForjaMatch: true,
      },
    })).toBe(true);
    expect(isOfficialForjaLobbyData({
      config: {
        preset: 'FORJA',
        forjaTeamA: 'team-alpha',
      },
    })).toBe(true);
    expect(isOfficialForjaLobbyData({
      config: {
        preset: 'FORJA',
        isCustomDraft: true,
      },
    })).toBe(false);
    expect(isOfficialForjaLobbyData({
      config: {
        preset: 'MCL',
        isOfficialForjaMatch: true,
      },
    })).toBe(false);
  });

  it('merges historical lobby fallback with compact summary by lobby id', () => {
    const merged = mergeForjaLiveMatches(
      [{
        id: 'match-1',
        name: 'Old value',
        status: 'waiting',
        scoreA: 0,
        scoreB: 0,
        stage: 'GROUP',
        config: {
          forjaTeamA: 'team-alpha',
          forjaTeamB: 'team-beta',
          forjaGroupId: 'A',
          tournamentStage: 'GROUP',
        },
      }],
      [{
        id: 'match-1',
        name: 'Updated value',
        status: 'completed',
        scoreA: 2,
        scoreB: 0,
        stage: 'GROUP',
        config: {
          forjaTeamA: 'team-alpha',
          forjaTeamB: 'team-beta',
          forjaGroupId: 'A',
          tournamentStage: 'GROUP',
        },
      }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'match-1',
      name: 'Updated value',
      status: 'completed',
      scoreA: 2,
      scoreB: 0,
    });
  });

  it('parses Firestore timestamp objects restored from session cache', () => {
    const scheduledDate = { seconds: 1800000000, nanoseconds: 500000000 };
    const parsed = resolveForjaDateValue(scheduledDate);

    expect(parsed?.getTime()).toBe(1800000000500);
  });

  it('combines a local scheduled date string with the saved time', () => {
    const parsed = resolveForjaMatchDateTime('2026-05-30', '22:30');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(30);
    expect(parsed?.getHours()).toBe(22);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('applies scheduled time to cached Firestore timestamp objects', () => {
    const parsed = resolveForjaMatchDateTime({ seconds: 1800000000, nanoseconds: 0 }, '22:30');

    expect(parsed?.getHours()).toBe(22);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('lets fresh official lobby data override stale compact summaries', () => {
    const staleSummary = {
      id: 'match-1',
      name: 'GrA - Team Alpha x Team Beta',
      status: 'waiting',
      scoreA: 0,
      scoreB: 0,
      stage: 'GROUP',
      config: {
        forjaTeamA: 'team-alpha',
        forjaTeamB: 'team-beta',
        forjaGroupId: 'A',
        tournamentStage: 'GROUP',
      },
    };
    const officialLobby = {
      ...staleSummary,
      status: 'finished',
      scoreA: 2,
      scoreB: 1,
      scheduledDate: { seconds: 1800000000, nanoseconds: 0 },
      scheduledTime: '20:30',
    };

    const merged = mergeForjaLiveMatches([staleSummary], [officialLobby]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'match-1',
      status: 'finished',
      scoreA: 2,
      scoreB: 1,
      scheduledTime: '20:30',
    });
  });

  it('sorts cached Firestore timestamp objects chronologically', () => {
    const ordered = sortForjaLiveMatches([
      {
        id: 'late',
        name: 'Late',
        status: 'waiting',
        scoreA: 0,
        scoreB: 0,
        stage: 'GROUP',
        scheduledDate: { seconds: 2000, nanoseconds: 0 },
      },
      {
        id: 'early',
        name: 'Early',
        status: 'waiting',
        scoreA: 0,
        scoreB: 0,
        stage: 'GROUP',
        scheduledDate: { seconds: 1000, nanoseconds: 0 },
      },
    ]);

    expect(ordered.map((match) => match.id)).toEqual(['early', 'late']);
  });
});
