import { Timestamp, FieldValue } from 'firebase/firestore';

export type DraftTimestampWrite = Timestamp | FieldValue | Date | number | string | null;
export type DraftTimestampRead = Timestamp | Date | number | string;

export type God = {
  id: string;
  name: string;
  culture: 'Greek' | 'Egyptian' | 'Norse' | 'Atlantean' | 'Japanese' | 'Chinese' | 'Aztec';
  image: string;
  focus?: string;
  powers?: string[];
  minorGods?: string[];
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
export type DraftPhase = 'waiting' | 'ready' | 'setup' | 'roster_edit' | 'drafting' | 'map_ban' | 'map_pick' | 'god_ban' | 'god_pick' | 'ready_picker' | 'god_picker' | 'revealing' | 'post_draft' | 'reporting' | 'finished' | 'coin_toss';

export type TurnAction = 'PICK' | 'BAN' | 'SNIPE' | 'STEAL' | 'REVEAL' | 'COIN_TOSS';
export type TurnModifier = 'GLOBAL' | 'EXCLUSIVE' | 'NONEXCLUSIVE';
export type TurnExecution = 'NORMAL' | 'PARALLEL' | 'HIDDEN' | 'AS_OPPONENT';
export type TurnTarget = 'GOD' | 'MAP' | 'COIN';

export type DraftTurn = {
  player: 'A' | 'B' | 'BOTH' | 'ADMIN';
  action: TurnAction;
  target: TurnTarget;
  modifier: TurnModifier;
  execution: TurnExecution;
};

export type DraftActionOptions = {
  isRandom?: boolean;
  force?: boolean;
  isTimeoutAutoResolve?: boolean;
};

export type TeamSize = 1 | 2 | 3;
export type SeriesType = 'BO1' | 'BO3' | 'BO5' | 'BO7' | 'BO9' | 'CUSTOM' | '3G';

export type PickType = 'alternated' | 'blind';
export type GodBanScope = 'PER_MAP' | 'SERIES';
export type MCLPlayoffsPhase = 'QUARTERFINALS' | 'SEMIFINALS' | 'FINALS' | 'GRAND_FINALS';

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
  streamerHudSize?: number;
  preset?: string;
  mclRound?: number;
  tournamentStage?: 'GROUP' | 'PLAYOFFS' | 'PLAYOFFS_BO3' | 'PLAYOFFS_BO5' | 'TIEBREAKER';
  
  // Forja Integration
  forjaMatchId?: string;
  forjaTeamA?: string;
  forjaTeamB?: string;
  forjaGroupId?: string;

  // Forja Custom Draft Flags
  /** Se true, o Game 3 terá o mapa sorteado via pool cacheada da Forja (ADMIN turn automático) */
  hasMap3RandomRoll?: boolean;
  /** Se true, introduz 1 Ban de Deus por time (Host + Guest) antes dos god picks em CADA mapa */
  hasPerMapBans?: boolean;
  /** MCL Tiebreaker: controls whether configured god bans reset every map or stay banned for the full series. */
  godBanScope?: GodBanScope;
  /** Se true, a partida foi criada oficialmente pela tabela e será exibida no painel principal */
  isOfficialForjaMatch?: boolean;
  /** Se true, a partida é um draft customizado e não deve ser exibida no hub do Forja */
  isCustomDraft?: boolean;
  /** IDs do Discord dos capitães oficiais (para bloqueio de vaga no preset FORJA) */
  captainA_discordId?: string;
  captainB_discordId?: string;
  /** Agendamento */
  scheduledDate?: DraftTimestampWrite;
  scheduledTime?: string;
  streamerUrl?: string;
  /** Link para draft externo (caso não tenha sido feito no Mythos) */
  externalDraftLink?: string;
  /** MCL Playoffs: mapa placeholder do último jogo (G5 em MD5, G7 em MD7). Injetado em seriesMaps[N-1] ao criar o lobby. */
  playoffsLastMap?: string;
  /** MCL Playoffs: bracket phase that determines series length and the predetermined final map. */
  mclPlayoffsPhase?: MCLPlayoffsPhase;
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
  mapId?: string;
  winner: 'A' | 'B';
  scoreA?: number;
  scoreB?: number;
  picksA?: string[];
  picksB?: string[];
  colorsA?: string[];
  colorsB?: string[];
  rosterA?: PickEntry[];
  rosterB?: PickEntry[];
  isWO?: boolean;
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
  position: number;
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
  timestamp: DraftTimestampWrite;
};

export type LobbySummary = {
  id: string;
  captain1?: string | null;
  captain2?: string | null;
  name: string;
  teamSize: number;
  /** Present when summary is built from Firestore; both required for public list visibility */
  captain1Name?: string;
  captain2Name?: string;
  teamAName?: string;
  teamBName?: string;
  status: LobbyStatus;
  phase: DraftPhase;
  preset?: string | null;
  mclRound?: number;
  tournamentStage?: 'GROUP' | 'PLAYOFFS' | 'TIEBREAKER';
  lastActivityAt: DraftTimestampRead | null;
  createdAt: DraftTimestampRead | null;
};

export type LobbyIndex = {
  activeLobbies: LobbySummary[];
  lastUpdated: DraftTimestampRead;
};

export type Lobby = {
  id: string;
  status: LobbyStatus;
  captain1: string | null;
  captain2: string | null;
  captain1Name?: string;
  captain2Name?: string | null;
  teamAName?: string;
  teamBName?: string;
  teamAPlayers?: TeamPlayer[];
  teamBPlayers?: TeamPlayer[];
  playerA1?: string;
  playerA2?: string;
  playerA3?: string;
  playerB1?: string;
  playerB2?: string;
  playerB3?: string;
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
  gameResults?: GameResult[];
  replayLog: ReplayStep[];
  rosterA?: Record<number, PickEntry>;
  rosterB?: Record<number, PickEntry>;
  lastWinner: 'A' | 'B' | null;
  mapPool?: string[];
  timerStart: DraftTimestampWrite;
  createdAt: DraftTimestampRead;
  turnOrder: DraftTurn[];
  hiddenActions: { turnIndex: number; actionId: string; targetPlayerId?: number; playerName?: string }[];
  spectators: { id: string; name: string }[];
  adminId?: string;
  isPaused?: boolean;
  timerPausedAt?: DraftTimestampWrite;
  captain1Active?: boolean;
  captain2Active?: boolean;
  isPermanent?: boolean;
  discordWebhookUrl?: string | null;
  discordMessageId?: string | null;
  lastActivityAt?: DraftTimestampWrite;
  pausedTimeLeft?: number;
  reportStartAt?: DraftTimestampWrite;
  isHidden?: boolean;
  hoveredGodIdA?: string | null;
  hoveredGodIdB?: string | null;
  turnEndsAt?: DraftTimestampWrite;
  coinWinner?: 'A' | 'B' | null;
};

export type ChatMessage = {
  id: string;
  lobbyId: string;
  senderId: string;
  senderName: string;
  senderRole: 'Host' | 'Guest' | 'ADMIN' | 'Spectator';
  text: string;
  timestamp: DraftTimestampRead;
};
