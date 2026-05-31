import { PickEntry, TeamPlayer } from '../../types';

export type DraftPlayerTarget = {
  name: string;
  isAssigned: boolean;
  targetPlayerId: number | null;
};

export function resolveDraftPlayerTargets(
  teamPlayers: TeamPlayer[],
  teamPicks: PickEntry[]
): DraftPlayerTarget[] {
  const currentTargetPick = teamPicks.find((pick) => pick.godId === null) ?? null;

  return teamPlayers.map((player) => {
    const normalizedName = player.name.toLowerCase().trim();
    const isAssigned = teamPicks.some(
      (pick) => pick.godId !== null && pick.playerName?.toLowerCase().trim() === normalizedName
    );

    return {
      name: player.name,
      isAssigned,
      targetPlayerId: currentTargetPick?.playerId ?? null,
    };
  });
}
