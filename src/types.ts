export type God = {
  id: string;
  name: string;
  culture: 'Greek' | 'Egyptian' | 'Norse' | 'Atlantean' | 'Japanese' | 'Chinese' | 'Aztec';
  image: string;
};

export type MapPosition = {
  playerId: number;
  x: number; // percentage
  y: number; // percentage
};

export type MapInfo = {
  id: string;
  name: string;
  image: string;
  isRanked: boolean;
  positions?: MapPosition[];
};

export type LobbyStatus = 'waiting' | 'drafting' | 'finished' | 'INCOMPLETE';
export type DraftPhase = 'waiting' | 'ready' | 'setup' | 'roster_edit' | 'drafting' | 'map_ban' | 'map_pick' | 'god_ban' | 'god_pick' | 'ready_picker' | 'god_picker' | 'revealing' | 'post_draft' | 'reporting' | 'finished';

export type TurnAction = 'PICK' | 'BAN' | 'SNIPE' | 'STEAL' | 'REVEAL';
export type TurnModifier = 'GLOBAL' | 'EXCLUSIVE' | 'NONEXCLUSIVE';
export type TurnExecution = 'NORMAL' | 'PARALLEL' | 'HIDDEN' | 'AS_OPPONENT';
export type TurnTarget = 'GOD' | 'MAP';

export type DraftTurn = {
  player: 'A' | 'B' | 'BOTH' | 'ADMIN';
  action: TurnAction;
  target: TurnTarget;
  modifier: TurnModifier;
  execution: TurnExecution;
};

export type TeamSize = 1 | 2 | 3;
export type SeriesType = 'BO1' | 'BO3' | 'BO5' | 'BO7' | 'BO9' | 'CUSTOM';

export type PickType = 'alternated' | 'blind';

export type LobbyConfig = {
  teamSize: TeamSize;
  hasBans: boolean;
  banCount: number;
  isExclusive: boolean;
  isPrivate: boolean;
  allowedPantheons: string[];
  allowedMaps: string[];
  pickType: PickType;
  seriesType: SeriesType;
  customGameCount?: number;
  mapBanCount: number;
  firstMapRandom: boolean;
  acePick: boolean;
  acePickHidden: boolean;
  mapTurnOrder: DraftTurn[];
  godTurnOrder: DraftTurn[];
  name: string;
  loserPicksNextMap: boolean;
  timerDuration?: number;
  preset?: string;
  mclRound?: number;
  tournamentStage?: 'GROUP' | 'PLAYOFFS';
};

export type PickEntry = {
  playerId: number;
  playerName?: string;
  assignedPlayerName?: string;
  godId: string | null;
  team: 'A' | 'B';
  color: string;
  position: 'corner' | 'middle';
  turnIndex?: number;
  isRandom?: boolean;
};

export type GameResult = {
  gameNumber: number;
  mapId: string;
  winner: 'A' | 'B';
  picksA: string[];
  picksB: string[];
  colorsA?: string[];
  colorsB?: string[];
  rosterA?: PickEntry[];
  rosterB?: PickEntry[];
};

export type ReplayStep = {
  gameNumber: number;
  turnIndex: number;
  player: 'A' | 'B' | 'ADMIN' | 'BOTH';
  action: TurnAction;
  target: TurnTarget;
  id: string;
  timestamp: string;
  playerId?: number;
  isRandom?: boolean;
};

export type TeamPlayer = {
  name: string;
  position: number; // 1-6
};

export type Substitution = {
  team: 'A' | 'B';
  playerIn: string;
  playerOut: string;
  position: 'corner' | 'middle';
};

export type ResetRequest = {
  requestedBy: 'A' | 'B';
  status: 'pending' | 'accepted' | 'declined';
  timestamp: any;
};

export type LobbySummary = {
  id: string;
  name: string;
  teamSize: number;
  /** Present when summary is built from Firestore; both required for public list visibility */
  captain1?: string | null;
  captain2?: string | null;
  captain1Name: string;
  captain2Name: string;
  status: LobbyStatus;
  phase: DraftPhase;
  preset?: string;
  mclRound?: number;
  tournamentStage?: 'GROUP' | 'PLAYOFFS';
  lastActivityAt: any;
  createdAt: any;
};

export type LobbyIndex = {
  activeLobbies: LobbySummary[];
  lastUpdate: any;
};

export type Lobby = {
  id: string;
  status: LobbyStatus;
  captain1: string | null;
  captain2: string | null;
  captain1Name?: string;
  captain2Name?: string | null;
  teamAPlayers?: TeamPlayer[];
  teamBPlayers?: TeamPlayer[];
  readyA: boolean;
  readyB: boolean;
  readyA_report?: boolean;
  readyB_report?: boolean;
  readyA_nextGame?: boolean;
  readyB_nextGame?: boolean;
  rosterChangedA?: boolean;
  rosterChangedB?: boolean;
  lastSubs?: Substitution[];
  resetRequest?: ResetRequest | null;
  config: LobbyConfig;
  selectedMap: string | null;
  seriesMaps: string[];
  mapBans: string[];
  turn: number;
  phase: DraftPhase;
  bans: string[];
  picks: PickEntry[];
  scoreA: number;
  scoreB: number;
  reportVoteA: 'A' | 'B' | null;
  reportVoteB: 'A' | 'B' | null;
  voteConflict: boolean;
  voteConflictCount: number;
  currentGame: number;
  pickerVoteA?: string | null;
  pickerVoteB?: string | null;
  pickerPlayerA?: number | null;
  pickerPlayerB?: number | null;
  history: GameResult[];
  replayLog: ReplayStep[];
  rosterA?: Record<number, PickEntry>;
  rosterB?: Record<number, PickEntry>;
  lastWinner: 'A' | 'B' | null;
  mapPool?: string[];
  timerStart: any;
  createdAt: any;
  turnOrder: DraftTurn[];
  hiddenActions: { turnIndex: number; actionId: string }[];
  spectators: { id: string; name: string }[];
  adminId?: string;
  isPaused?: boolean;
  timerPausedAt?: any;
  captain1Active?: boolean;
  captain2Active?: boolean;
  isPermanent?: boolean;
  discordWebhookUrl?: string | null;
  discordMessageId?: string | null;
  lastActivityAt?: any;
  pausedTimeLeft?: number;
  reportStartAt?: any;
  isHidden?: boolean;
  hoveredGodIdA?: string | null;
  hoveredGodIdB?: string | null;
};

export type ChatMessage = {
  id: string;
  lobbyId: string;
  senderId: string;
  senderName: string;
  senderRole: 'Host' | 'Guest' | 'ADMIN' | 'Spectator';
  text: string;
  timestamp: any;
};
