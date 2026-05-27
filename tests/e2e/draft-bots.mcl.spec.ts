import { chromium, expect, firefox, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type Actor = 'host' | 'guest' | 'runner';
type Team = 'A' | 'B';
type DraftStatus = 'waiting' | 'drafting' | 'finished' | 'INCOMPLETE';
type DraftPhase = 'waiting' | 'ready' | 'setup' | 'roster_edit' | 'drafting' | 'map_ban' | 'map_pick' | 'god_ban' | 'god_pick' | 'ready_picker' | 'god_picker' | 'revealing' | 'post_draft' | 'reporting' | 'finished';
type TurnPlayer = Team | 'BOTH' | 'ADMIN';
type TurnAction = 'PICK' | 'BAN' | 'SNIPE' | 'STEAL' | 'REVEAL';
type TurnTarget = 'GOD' | 'MAP';
type TurnModifier = 'GLOBAL' | 'EXCLUSIVE' | 'NONEXCLUSIVE';
type TurnExecution = 'NORMAL' | 'PARALLEL' | 'HIDDEN' | 'AS_OPPONENT';

type PresetScenario = {
  id: string;
  label: string;
  expectedPreset: 'MCL' | 'MCL_PLAYOFFS' | 'MCL_TIEBREAKER' | 'FORJA';
  expectedGames: number;
  winners: Team[];
  setup: (page: Page) => Promise<void>;
};

type E2EPickSnapshot = {
  playerId: number;
  playerName?: string;
  godId: string | null;
  team: Team;
  position: 'corner' | 'middle';
};

type E2EStateSnapshot = {
  lobbyId: string | null;
  guestId: string | null;
  isAuthReady: boolean;
  isCaptain1: boolean;
  isCaptain2: boolean;
  isAdmin: boolean;
  vibeMode: string | null;
  href: string;
  lobby: {
    id: string;
    status: DraftStatus;
    phase: DraftPhase;
    preset: string | null;
    isExclusive: boolean;
    teamSize: number;
    currentGame: number;
    turn: number;
    currentTurn: {
      player: TurnPlayer;
      action: TurnAction;
      target: TurnTarget;
      modifier: TurnModifier;
      execution: TurnExecution;
    } | null;
    readyA: boolean;
    readyB: boolean;
    readyANext: boolean;
    readyBNext: boolean;
    readyAReport: boolean;
    readyBReport: boolean;
    scoreA: number;
    scoreB: number;
    selectedMap: string | null;
    seriesMaps: string[];
    mapBans: string[];
    bans: string[];
    picks: E2EPickSnapshot[];
    replayLogLength: number;
    history: {
      gameNumber: number;
      mapId: string | null;
      winner: Team;
    }[];
  } | null;
};

type CleanupResult = {
  ok: boolean;
  error?: string;
};

type CapturedEvent = {
  actor: Actor;
  type: string;
  message: string;
  timestamp: string;
  url?: string;
};

type ActorResources = {
  actor: Exclude<Actor, 'runner'>;
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

type RunSummary = {
  runId: string;
  presetId: string;
  presetLabel: string;
  seed: string;
  status: 'passed' | 'failed';
  lobbyId: string | null;
  reportDir: string;
  failure: string | null;
  cleanup: CleanupResult | null;
  finalState: E2EStateSnapshot | null;
  events: CapturedEvent[];
};

type ReportedIssue = {
  category: 'ui' | 'race' | 'performance' | 'backend' | 'harness';
  title: string;
  situation: string;
  evidence: string;
  solution: string;
};

declare global {
  interface Window {
    __MYTHOS_E2E__?: {
      getState: () => E2EStateSnapshot;
      cleanupLobby: (id?: string) => Promise<CleanupResult>;
    };
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const MATRIX_RUN_ID = process.env.E2E_RUN_ID ?? `matrix-${Date.now()}-${randomUUID().slice(0, 8)}`;
const MATRIX_SEED = process.env.E2E_SEED ?? MATRIX_RUN_ID;
const MATRIX_REPORT_DIR = path.join(process.cwd(), 'test-results', 'draft-bots', MATRIX_RUN_ID);
const INITIAL_SLOT_IDS = {
  A: [1, 4, 5],
  B: [2, 3, 6],
};

const SCENARIOS: PresetScenario[] = [
  {
    id: 'mcl-group-stage',
    label: 'MCL Group Stage',
    expectedPreset: 'MCL',
    expectedGames: 3,
    winners: ['A', 'B', 'A'],
    setup: async (page) => {
      await page.getByTestId('preset-mcl').click();
      await page.getByTestId('mcl-stage-group').click();
      await page.getByTestId('mcl-round-1').click();
    },
  },
  {
    id: 'mcl-playoffs',
    label: 'MCL Playoffs',
    expectedPreset: 'MCL_PLAYOFFS',
    expectedGames: 5,
    winners: ['A', 'B', 'A', 'B', 'A'],
    setup: async (page) => {
      await page.getByTestId('preset-mcl').click();
      await page.getByTestId('mcl-stage-playoffs').click();
      await expect(page.getByText('Official final maps have not yet been approved')).toHaveCount(0);
      await expect(page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="QUARTERFINALS"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="SEMIFINALS"]')).toContainText('Haywire');
      await expect(page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="FINALS"]')).toContainText('Autumn Exchange');
      await expect(page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="GRAND_FINALS"]')).toContainText('Divided Timberlands');
      await page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="QUARTERFINALS"]').click();
      await expect(page.locator('[data-testid="mcl-playoffs-phase"][data-phase-id="QUARTERFINALS"]')).toContainText('Aztlan Oasis');
    },
  },
  {
    id: 'mcl-tiebreaker',
    label: 'MCL Tiebreaker',
    expectedPreset: 'MCL_TIEBREAKER',
    expectedGames: 1,
    winners: ['A'],
    setup: async (page) => {
      await page.getByTestId('preset-mcl').click();
      await page.getByTestId('mcl-stage-tiebreaker').click();
      await expect(page.getByTestId('mcl-tiebreaker-series-bo1')).toBeVisible();
      await page.getByTestId('mcl-tiebreaker-series-bo3').click();
      await page.getByTestId('mcl-tiebreaker-series-bo5').click();
      await page.getByTestId('mcl-tiebreaker-series-bo7').click();
      await page.getByTestId('mcl-tiebreaker-series-bo1').click();
      await page.getByTestId('mcl-tiebreaker-ban-count-1').click();
      await page.getByTestId('mcl-tiebreaker-ban-count-2').click();
      await page.getByTestId('mcl-tiebreaker-ban-count-3').click();
      await page.getByTestId('mcl-tiebreaker-ban-count-0').click();
      await page.getByTestId('mcl-tiebreaker-ban-scope-series').click();
      await page.getByTestId('mcl-tiebreaker-ban-scope-per-map').click();
      await expect(page.locator('[data-testid="mcl-tiebreaker-map-option"][data-map-id="autumn_exchange"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcl-tiebreaker-map-option"][data-map-id="aztlan_oasis"] img')).toHaveAttribute('src', /\/maps\/mcl\/aztlan-oasis\.webp$/);
      await expect(page.locator('[data-testid="mcl-tiebreaker-map-option"][data-map-id="divided_timberlands"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcl-tiebreaker-map-option"][data-map-id="haywire"]')).toBeVisible();
    },
  },
  {
    id: 'forja-group-stage',
    label: 'FORJA Group Stage Non-Official',
    expectedPreset: 'FORJA',
    expectedGames: 3,
    winners: ['A', 'B', 'A'],
    setup: async (page) => {
      await page.getByTestId('preset-forja').click();
      await page.getByTestId('forja-stage-group').click();
    },
  },
  {
    id: 'forja-playoffs',
    label: 'FORJA Playoffs Non-Official',
    expectedPreset: 'FORJA',
    expectedGames: 3,
    winners: ['A', 'B', 'A'],
    setup: async (page) => {
      await page.getByTestId('preset-forja').click();
      await page.getByTestId('forja-stage-playoffs').click();
    },
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function errorText(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pushEvent(events: CapturedEvent[], actor: Actor, type: string, message: string, url?: string): void {
  events.push({ actor, type, message, timestamp: nowIso(), url });
}

function attachTelemetry(page: Page, actor: Exclude<Actor, 'runner'>, events: CapturedEvent[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      pushEvent(events, actor, `console:${message.type()}`, message.text(), page.url());
    }
  });
  page.on('pageerror', (error) => {
    pushEvent(events, actor, 'pageerror', errorText(error), page.url());
  });
  page.on('requestfailed', (request) => {
    pushEvent(events, actor, 'requestfailed', `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim(), request.url());
  });
}

async function getState(page: Page): Promise<E2EStateSnapshot> {
  const state = await page.evaluate(() => window.__MYTHOS_E2E__?.getState() ?? null);
  if (!state) {
    throw new Error('The E2E bridge is missing. Start the app with VITE_E2E=true and without VITE_VIBE_MODE=DEVELOPMENT.');
  }
  return state;
}

async function waitForState(
  page: Page,
  label: string,
  predicate: (state: E2EStateSnapshot) => boolean,
  timeoutMs = 60_000
): Promise<E2EStateSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let lastState: E2EStateSnapshot | null = null;

  while (Date.now() < deadline) {
    lastState = await getState(page);
    if (predicate(lastState)) return lastState;
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${label}. Last state: ${JSON.stringify(lastState?.lobby ?? null)}`);
}

async function waitForBridgeAndAuth(page: Page): Promise<E2EStateSnapshot> {
  await page.waitForFunction(() => typeof window.__MYTHOS_E2E__?.getState === 'function', null, { timeout: 45_000 });
  return waitForState(page, 'anonymous auth', (state) => state.isAuthReady && !!state.guestId, 45_000);
}

async function dismissComboWarning(page: Page): Promise<void> {
  const dismiss = page.getByTestId('combo-warning-dismiss').first();
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

async function clickEnabledControl(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  await expect(locator, `${label} should be enabled`).toBeEnabled();
  await locator.evaluate((element, controlLabel) => {
    if (!(element instanceof HTMLElement)) throw new Error(`${controlLabel} is not an HTML element.`);
    element.click();
  }, label);
}

async function createHostContext(browser: Browser, actor: Exclude<Actor, 'runner'>, reportDir: string): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    recordVideo: {
      dir: path.join(reportDir, 'videos', actor),
    },
  });
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  return context;
}

async function createResources(
  actor: Exclude<Actor, 'runner'>,
  browser: Browser,
  events: CapturedEvent[],
  reportDir: string
): Promise<ActorResources> {
  const context = await createHostContext(browser, actor, reportDir);
  const page = await context.newPage();
  attachTelemetry(page, actor, events);
  return { actor, browser, context, page };
}

async function joinLobby(page: Page, role: Team, teamName: string, players: string[]): Promise<void> {
  const roleButton = page.getByTestId(`join-role-${role.toLowerCase()}`);
  await clickEnabledControl(roleButton, `join role ${role}`);
  await page.getByTestId('join-team-name').fill(teamName);
  const nicknameInput = page.getByTestId('join-nickname');
  if (await nicknameInput.isVisible().catch(() => false)) {
    await nicknameInput.fill(players[0]);
  }

  for (let index = 0; index < players.length; index += 1) {
    const playerField = page.getByTestId(`join-player-${index}`);
    if (await playerField.isVisible().catch(() => false)) {
      await playerField.fill(players[index]).catch(async () => {
        await playerField.selectOption({ index }).catch(() => undefined);
      });
    }
  }

  const confirmButton = page.getByTestId('join-confirm-button');
  await clickEnabledControl(confirmButton, 'join confirm');
}

function readyFlag(state: E2EStateSnapshot, team: Team): boolean {
  const lobby = state.lobby;
  if (!lobby) return false;
  const isGameOneReady = lobby.currentGame === 1 && (lobby.status === 'waiting' || lobby.phase === 'ready' || lobby.phase === 'waiting');
  const useReady = isGameOneReady || lobby.phase === 'ready_picker';
  if (team === 'A') return useReady ? lobby.readyA : lobby.readyANext;
  return useReady ? lobby.readyB : lobby.readyBNext;
}

async function clickReadyIfNeeded(page: Page, team: Team): Promise<void> {
  const state = await getState(page);
  if (readyFlag(state, team)) return;
  await dismissComboWarning(page);
  const button = page.getByTestId('draft-ready-button').first();
  await clickEnabledControl(button, 'draft ready');
}

async function readyBoth(host: Page, guest: Page): Promise<void> {
  const before = await getState(host);
  await clickReadyIfNeeded(host, 'A');
  await clickReadyIfNeeded(guest, 'B');
  await waitForState(host, 'both captains ready transition', (state) => {
    const lobby = state.lobby;
    return !!lobby && (
      lobby.status === 'finished' ||
      lobby.phase !== before.lobby?.phase ||
      lobby.turn !== before.lobby?.turn ||
      lobby.currentGame !== before.lobby?.currentGame
    );
  });
}

async function readyForReportIfNeeded(page: Page, team: Team): Promise<void> {
  const state = await getState(page);
  const lobby = state.lobby;
  if (!lobby) return;
  if (team === 'A' && lobby.readyAReport) return;
  if (team === 'B' && lobby.readyBReport) return;

  await dismissComboWarning(page);
  const button = page.getByTestId('post-draft-ready-report-button').first();
  await clickEnabledControl(button, 'post-draft ready report');
}

async function enterReporting(host: Page, guest: Page): Promise<void> {
  await readyForReportIfNeeded(host, 'A');
  await readyForReportIfNeeded(guest, 'B');
  await waitForState(host, 'reporting phase', (state) => state.lobby?.phase === 'reporting' || state.lobby?.status === 'finished');
}

async function castVote(page: Page, winner: Team): Promise<void> {
  await dismissComboWarning(page);
  await clickEnabledControl(page.getByTestId(`report-winner-${winner.toLowerCase()}`), `report winner ${winner}`);
  await clickEnabledControl(page.getByTestId('report-confirm-button'), 'report confirm');
}

async function reportWinner(host: Page, guest: Page, winner: Team): Promise<void> {
  const before = await getState(host);
  await castVote(host, winner);
  await castVote(guest, winner);
  await waitForState(host, `reported winner ${winner}`, (state) => {
    const lobby = state.lobby;
    return !!lobby && (
      lobby.status === 'finished' ||
      lobby.currentGame !== before.lobby?.currentGame ||
      lobby.history.length > (before.lobby?.history.length ?? 0)
    );
  });
}

async function clickRandomEnabled(page: Page, selector: string, label: string, random: () => number): Promise<string> {
  const locator = page.locator(selector);
  await expect(locator.first()).toBeVisible();
  const count = await locator.count();
  if (count === 0) throw new Error(`No enabled ${label} options found.`);

  const index = Math.floor(random() * count);
  const clicked = await locator.evaluateAll((elements, selectedIndex) => {
    const element = elements[selectedIndex];
    if (!(element instanceof HTMLElement)) return null;
    const id = element.getAttribute('data-map-id')
      ?? element.getAttribute('data-god-id')
      ?? element.getAttribute('data-player-id')
      ?? `option-${selectedIndex}`;
    element.click();
    return id;
  }, index);

  if (!clicked) throw new Error(`Selected ${label} option disappeared before click.`);
  const id = clicked === `option-${index}` ? `${label}-${index}` : clicked;
  return id;
}

async function enabledCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count().catch(() => 0);
}

function eventMessages(summary: RunSummary): string {
  return [summary.failure ?? '', ...summary.events.map((event) => event.message)].join('\n');
}

function deriveIssues(summary: RunSummary): ReportedIssue[] {
  const messages = eventMessages(summary);
  const issues: ReportedIssue[] = [];

  if (messages.includes('requests-from-referer') || messages.includes('status of 403')) {
    issues.push({
      category: 'backend',
      title: 'Firebase Auth referrer rejected local bot origin',
      situation: 'The bot loaded the app before lobby creation and anonymous auth never produced a guest identity.',
      evidence: 'Firebase returned auth/requests-from-referer-http://127.0.0.1:8081-are-blocked with HTTP 403.',
      solution: 'Run E2E through an authorized origin such as localhost, or add the exact test origin to Firebase Auth authorized domains.',
    });
  }

  if (messages.includes('intercepts pointer events') || messages.includes('element is not stable') || messages.includes('performing click action')) {
    issues.push({
      category: 'ui',
      title: 'Visible controls can be hard to click during animated or overlay states',
      situation: 'The bot found visible join/god controls, but Playwright could not complete a real pointer click reliably.',
      evidence: 'Playwright reported unstable elements or pointer interception while clicking modal role buttons or god cards.',
      solution: 'Reduce motion in E2E and prefer stable non-overlapping hit areas; keep the harness fallback as DOM click only for already-visible enabled controls.',
    });
  }

  if (messages.includes('Timed out waiting for')) {
    issues.push({
      category: 'race',
      title: 'Bot detected a stalled state transition',
      situation: 'A UI action completed locally but the shared lobby state did not advance before the timeout.',
      evidence: summary.failure ?? 'Timed wait occurred during a state transition.',
      solution: 'Inspect the last lobby snapshot and paired console warnings to decide whether this is missing UI gating, a failed Firestore transaction, or a draft-engine validation failure.',
    });
  }

  if (messages.includes('join-nickname')) {
    issues.push({
      category: 'ui',
      title: 'FORJA join form does not expose the generic nickname input',
      situation: 'The FORJA join modal uses a different identity flow than standard MCL lobbies.',
      evidence: summary.failure ?? 'The bot waited for join-nickname but the element was not rendered.',
      solution: 'Use FORJA-specific captain/team identity controls in the bot and keep generic nickname handling optional.',
    });
  }

  if (messages.includes('"code":"failed-precondition"')) {
    issues.push({
      category: 'backend',
      title: 'Firestore transaction retries surfaced during real draft turns',
      situation: 'The app attempted to commit a draft-state update while the lobby document had already changed.',
      evidence: 'Firebase logged RestConnection RPC Commit failed with code failed-precondition during map/god/ready actions.',
      solution: 'Keep mutations in transactions, wait for the active browser to observe the latest turn before acting, and investigate repeated failures as true contention rather than hiding them.',
    });
  }

  if (messages.includes('WebSocket') && messages.includes('24678')) {
    issues.push({
      category: 'harness',
      title: 'Vite HMR websocket conflicts with repeated headed E2E runs',
      situation: 'Repeated dev-server launches attempted to bind the same HMR websocket port during bot execution.',
      evidence: 'The run captured Vite WebSocket failures on port 24678.',
      solution: 'Disable HMR for E2E dev-server startup and avoid reusing stale local servers between headed matrix runs.',
    });
  }

  if (messages.includes('ERR_ABORTED') && messages.includes('firestore.googleapis.com')) {
    issues.push({
      category: 'backend',
      title: 'Firestore streaming requests are aborted during test teardown',
      situation: 'The bot closes browser contexts after cleanup while Firestore listen/write channels are still open.',
      evidence: 'Captured requestfailed events for Firestore Listen/Write channels with net::ERR_ABORTED.',
      solution: 'Treat teardown aborts as informational unless paired with missing state updates or failed cleanup.',
    });
  }

  return issues;
}

async function takeDraftTurn(page: Page, state: E2EStateSnapshot, random: () => number): Promise<void> {
  const turn = state.lobby?.currentTurn;
  if (!turn) throw new Error('Cannot act without a current turn.');
  await dismissComboWarning(page);

  if (turn.target === 'MAP') {
    await clickRandomEnabled(page, '[data-testid="map-card"]:not([disabled])', 'map', random);
    await clickEnabledControl(page.getByTestId('confirm-map-pick'), 'confirm map pick');
    return;
  }

  if (turn.action === 'PICK') {
    const playerTargetSelector = '[data-testid="mcl-player-target"]:not([disabled])';
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await clickRandomEnabled(page, '[data-testid="god-card"]:not([disabled])', 'god', random);
      await page.waitForTimeout(300);
      if (await enabledCount(page, playerTargetSelector) > 0) {
        await clickRandomEnabled(page, playerTargetSelector, 'MCL/FORJA player target', random);
        return;
      }
    }
    throw new Error('No enabled MCL/FORJA player target options found after selecting a god.');
  }

  await clickRandomEnabled(page, '[data-testid="god-card"]:not([disabled])', 'god', random);
}

function stateFingerprint(state: E2EStateSnapshot): string {
  const lobby = state.lobby;
  if (!lobby) return 'no-lobby';
  const picks = lobby.picks.map((pick) => `${pick.team}:${pick.playerId}:${pick.playerName ?? ''}:${pick.godId ?? ''}`).join(',');
  return [
    lobby.status,
    lobby.phase,
    lobby.currentGame,
    lobby.turn,
    lobby.scoreA,
    lobby.scoreB,
    lobby.selectedMap ?? '',
    lobby.seriesMaps.join(','),
    lobby.mapBans.join(','),
    lobby.bans.join(','),
    lobby.replayLogLength,
    lobby.history.length,
    picks,
  ].join('|');
}

function assertDraftState(state: E2EStateSnapshot, scenario: PresetScenario): void {
  const lobby = state.lobby;
  expect(lobby, 'lobby should be loaded').not.toBeNull();
  if (!lobby) return;
  expect(lobby.preset).toBe(scenario.expectedPreset);
  expect(lobby.teamSize).toBe(3);

  const teamASlots = lobby.picks.filter((pick) => pick.team === 'A').map((pick) => pick.playerId).sort((left, right) => left - right);
  const teamBSlots = lobby.picks.filter((pick) => pick.team === 'B').map((pick) => pick.playerId).sort((left, right) => left - right);
  expect(teamASlots).toEqual(INITIAL_SLOT_IDS.A);
  expect(teamBSlots).toEqual(INITIAL_SLOT_IDS.B);

  if (lobby.isExclusive) {
    const pickedGods = lobby.picks.map((pick) => pick.godId).filter((godId): godId is string => !!godId);
    expect(new Set(pickedGods).size).toBe(pickedGods.length);
  }
}

function pageForTurn(player: TurnPlayer, host: Page, guest: Page): Page | null {
  if (player === 'A') return host;
  if (player === 'B') return guest;
  if (player === 'BOTH') return host;
  return null;
}

async function driveDraft(host: Page, guest: Page, random: () => number, scenario: PresetScenario): Promise<E2EStateSnapshot> {
  for (let step = 0; step < 420; step += 1) {
    const state = await waitForState(host, 'loaded lobby state', (candidate) => !!candidate.lobby);
    assertDraftState(state, scenario);
    const lobby = state.lobby;
    if (!lobby) throw new Error('Lobby disappeared during draft run.');
    if (lobby.status === 'finished') {
      expect(lobby.history.length).toBe(scenario.expectedGames);
      expect(lobby.history.some((game) => game.gameNumber === scenario.expectedGames)).toBe(true);
      return state;
    }

    if (lobby.phase === 'waiting' || lobby.phase === 'ready' || lobby.phase === 'ready_picker') {
      await readyBoth(host, guest);
      continue;
    }

    if (lobby.phase === 'post_draft') {
      await enterReporting(host, guest);
      continue;
    }

    if (lobby.phase === 'reporting') {
      const winner = scenario.winners[lobby.currentGame - 1] ?? scenario.winners[scenario.winners.length - 1] ?? 'A';
      await reportWinner(host, guest, winner);
      continue;
    }

    const turn = lobby.currentTurn;
    if (!turn) throw new Error(`No current turn in ${lobby.phase}.`);
    const actorPage = pageForTurn(turn.player, host, guest);
    if (!actorPage) {
      const before = stateFingerprint(state);
      await waitForState(host, `ADMIN turn ${lobby.turn}`, (candidate) => stateFingerprint(candidate) !== before, 25_000);
      continue;
    }

    const before = stateFingerprint(state);
    await takeDraftTurn(actorPage, state, random);
    try {
      await waitForState(host, `draft turn ${lobby.turn}`, (candidate) => stateFingerprint(candidate) !== before, 30_000);
    } catch (error) {
      const latest = await getState(host);
      const latestLobby = latest.lobby;
      if (
        latestLobby &&
        latestLobby.currentGame === lobby.currentGame &&
        latestLobby.turn === lobby.turn &&
        latestLobby.phase === lobby.phase &&
        latestLobby.currentTurn?.player === turn.player
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Draft bot exceeded the maximum step count for ${scenario.label}.`);
}

async function writeSummary(summary: RunSummary): Promise<void> {
  await fs.mkdir(summary.reportDir, { recursive: true });
  await fs.writeFile(path.join(summary.reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const lobby = summary.finalState?.lobby;
  const issues = deriveIssues(summary);
  const markdown = [
    `# Draft Bot Run ${summary.runId}`,
    '',
    `- Preset: ${summary.presetLabel} (${summary.presetId})`,
    `- Status: ${summary.status}`,
    `- Seed: ${summary.seed}`,
    `- Lobby: ${summary.lobbyId ?? 'not created'}`,
    `- Final phase: ${lobby?.phase ?? 'n/a'}`,
    `- Final status: ${lobby?.status ?? 'n/a'}`,
    `- Final score: ${lobby ? `${lobby.scoreA}-${lobby.scoreB}` : 'n/a'}`,
    `- History games: ${lobby?.history.length ?? 0}`,
    `- Replay steps: ${lobby?.replayLogLength ?? 0}`,
    `- Cleanup: ${summary.cleanup?.ok ? 'ok' : summary.cleanup?.error ?? 'not run'}`,
    `- Captured events: ${summary.events.length}`,
    '',
    summary.failure ? `## Failure\n\n\`\`\`text\n${summary.failure}\n\`\`\`\n` : '## Failure\n\nNone\n',
    '## Issues Found',
    '',
    ...(issues.length > 0
      ? issues.map((issue) => [
        `### ${issue.category.toUpperCase()}: ${issue.title}`,
        '',
        `- Situation: ${issue.situation}`,
        `- How found: ${issue.evidence}`,
        `- Solution: ${issue.solution}`,
        '',
      ].join('\n'))
      : ['None', '']),
    '## Recent Events',
    '',
    ...summary.events.slice(-30).map((event) => `- ${event.timestamp} [${event.actor}] ${event.type}: ${event.message}`),
    '',
  ].join('\n');

  await fs.writeFile(path.join(summary.reportDir, 'summary.md'), markdown, 'utf8');
}

async function saveFailureArtifacts(resources: ActorResources[], reportDir: string): Promise<void> {
  await fs.mkdir(reportDir, { recursive: true });
  for (const resource of resources) {
    await resource.page.screenshot({
      path: path.join(reportDir, `${resource.actor}-failure.png`),
      fullPage: true,
    }).catch(() => undefined);
  }
}

async function stopTracesWithoutSaving(resources: ActorResources[]): Promise<void> {
  void resources;
}

async function closeResources(resources: ActorResources[]): Promise<void> {
  for (const resource of resources) {
    await resource.context.close().catch(() => undefined);
    await resource.browser.close().catch(() => undefined);
  }
}

async function runScenario(scenario: PresetScenario): Promise<void> {
  if (process.env.VITE_VIBE_MODE === 'DEVELOPMENT') {
    throw new Error('E2E draft bots must not run with VITE_VIBE_MODE=DEVELOPMENT because LocalStorage mock lobbies cannot sync across isolated browsers.');
  }

  const runId = `${MATRIX_RUN_ID}-${scenario.id}`;
  const seed = `${MATRIX_SEED}:${scenario.id}`;
  const reportDir = path.join(MATRIX_REPORT_DIR, scenario.id);
  const events: CapturedEvent[] = [];
  const resources: ActorResources[] = [];
  const random = createSeededRandom(seed);
  let lobbyId: string | null = null;
  let finalState: E2EStateSnapshot | null = null;
  let cleanup: CleanupResult | null = null;
  let failure: string | null = null;

  try {
    await fs.mkdir(reportDir, { recursive: true });
    const hostBrowser = await chromium.launch({ headless: false });
    const guestBrowser = await firefox.launch({ headless: false });
    const host = await createResources('host', hostBrowser, events, reportDir);
    const guest = await createResources('guest', guestBrowser, events, reportDir);
    resources.push(host, guest);

    await host.page.goto(BASE_URL);
    const hostAuth = await waitForBridgeAndAuth(host.page);
    expect(hostAuth.vibeMode).not.toBe('DEVELOPMENT');

    await scenario.setup(host.page);
    await host.page.getByTestId('lobby-visibility-toggle').click();
    await host.page.getByTestId('lobby-name-input').fill(`E2E ${scenario.id} ${MATRIX_RUN_ID.slice(-8)}`);
    await host.page.getByTestId('create-lobby-button').click();
    await expect(host.page.getByTestId('join-lobby-modal')).toBeVisible();
    await joinLobby(host.page, 'A', `E2E Host ${scenario.id}`, ['Host Alpha', 'Host Bravo', 'Host Charlie']);

    const hostJoined = await waitForState(host.page, 'host joined as captain A', (state) => !!state.lobby?.id && state.isCaptain1);
    lobbyId = hostJoined.lobby?.id ?? null;
    expect(lobbyId).not.toBeNull();

    await guest.page.goto(`${BASE_URL}/?lobby=${lobbyId}`);
    const guestAuth = await waitForBridgeAndAuth(guest.page);
    expect(guestAuth.vibeMode).not.toBe('DEVELOPMENT');
    await waitForState(guest.page, 'guest lobby subscription', (state) => state.lobby?.id === lobbyId, 60_000);
    await expect(guest.page.getByTestId('join-lobby-modal')).toBeVisible();
    await joinLobby(guest.page, 'B', `E2E Guest ${scenario.id}`, ['Guest Alpha', 'Guest Bravo', 'Guest Charlie']);
    await waitForState(guest.page, 'guest joined as captain B', (state) => !!state.lobby?.id && state.isCaptain2);
    await waitForState(host.page, 'both captains present', (state) => !!state.lobby && !!state.lobbyId && state.lobby.phase === 'ready');

    finalState = await driveDraft(host.page, guest.page, random, scenario);
    expect(finalState.lobby?.status).toBe('finished');
    expect(finalState.lobby?.history.map((game) => game.winner)).toEqual(scenario.winners);
    cleanup = await host.page.evaluate((id) => window.__MYTHOS_E2E__?.cleanupLobby(id) ?? Promise.resolve({ ok: false, error: 'E2E bridge missing during cleanup.' }), lobbyId ?? undefined);
    expect(cleanup.ok).toBe(true);
  } catch (error) {
    failure = errorText(error);
  } finally {
    if (!cleanup && lobbyId && resources[0]) {
      cleanup = await resources[0].page.evaluate((id) => window.__MYTHOS_E2E__?.cleanupLobby(id) ?? Promise.resolve({ ok: false, error: 'E2E bridge missing during cleanup.' }), lobbyId).catch((error: unknown) => ({
        ok: false,
        error: errorText(error),
      }));
    }

    finalState = finalState ?? (resources[0] ? await getState(resources[0].page).catch(() => null) : null);
    if (failure) {
      await saveFailureArtifacts(resources, reportDir);
    } else {
      await stopTracesWithoutSaving(resources);
    }

    await writeSummary({
      runId,
      presetId: scenario.id,
      presetLabel: scenario.label,
      seed,
      status: failure ? 'failed' : 'passed',
      lobbyId,
      reportDir,
      failure,
      cleanup,
      finalState,
      events,
    });
    await closeResources(resources);

    console.log(`Draft bot run: ${runId}`);
    console.log(`Preset: ${scenario.id}`);
    console.log(`Seed: ${seed}`);
    console.log(`Lobby: ${lobbyId ?? 'not created'}`);
    console.log(`Report: ${path.join(reportDir, 'summary.md')}`);
    console.log(`Exit code: ${failure ? 1 : 0}`);
  }

  if (failure) throw new Error(failure);
}

test.describe('Draft preset browser bot matrix', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.label}: Chromium host and Firefox guest complete the draft`, async () => {
      await runScenario(scenario);
    });
  }
});
