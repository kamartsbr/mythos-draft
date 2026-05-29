import { describe, expect, it } from 'vitest';
import {
  forjaLobbyToLiveMatchSummary,
  isOfficialForjaLobbyData,
  mergeForjaLiveMatches,
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
});
