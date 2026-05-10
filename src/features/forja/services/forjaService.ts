/**
 * ============================================================
 * FORJA DE HEFESTO — Firestore Service (Revisão Major)
 * ============================================================
 */

import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Unsubscribe,
  getDoc, getDocs, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  ForjaPlayer, ForjaRegistrationForm, ForjaDiscordUser,
  ForjaScheduleEntry, ForjaTeam, ForjaDraftSession, ForjaDraftPick,
  ForjaTier, ForjaContentDoc, ForjaPrizeConfig, ForjaSettings,
  ForjaRole, ForjaTournamentConfig, ForjaRulesBlock, ForjaMapPool,
} from '../types';
import { FORJA_MAP_POOL } from '../../../data/maps';

const PLAYERS_COL  = 'forja_players';
const TEAMS_COL    = 'forja_teams';
const SCHEDULE_COL = 'forja_schedule';
const DRAFT_COL    = 'forja_meta';
const DRAFT_DOC    = 'forja_draft_session';
const CONTENT_COL  = 'forja_content';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrai o profile_id numérico de uma URL do aomstats.io
 * Aceita:
 * https://aomstats.io/profiles/12345
 * https://aomstats.io/leaderboard/1?search=nick  (fallback)
 * "12345" (número direto)
 */
export function parseAomProfileId(input: string): number | null {
  const trimmed = input.trim();
  // Número direto
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split('/').filter(Boolean);
    // /profiles/12345
    const profilesIdx = parts.indexOf('profiles');
    if (profilesIdx !== -1 && parts[profilesIdx + 1]) {
      const id = parseInt(parts[profilesIdx + 1], 10);
      if (!isNaN(id)) return id;
    }
    // qualquer segmento numérico no path
    for (const p of [...parts].reverse()) {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch { /* url inválida */ }
  return null;
}

/** Mantido para compatibilidade com cadastros antigos */
export function parseAomStatsUrl(url: string): string | null {
  const id = parseAomProfileId(url);
  return id ? String(id) : null;
}

// ─── Players ──────────────────────────────────────────────────────────────────

export function subscribeToForjaPlayers(
  onData: (players: ForjaPlayer[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Removido orderBy para evitar que documentos sem o campo registered_at sumam da lista
  const q = query(collection(db, PLAYERS_COL));
  return onSnapshot(q,
    snap => {
      const players = snap.docs
        .map(d => ({ ...(d.data() as ForjaPlayer), discord_id: d.id }));
      onData(players);
    },
    err  => { console.error('[Forja] players:', err); onError?.(err); }
  );
}

export async function isPlayerRegistered(discordId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, PLAYERS_COL, discordId));
    if (!snap.exists()) return false;
    return snap.data().status !== 'banned';
  } catch (err) {
    console.warn('[Forja] Could not read player registration (possibly permission denied):', err);
    return false;
  }
}

export const ESPORTS_ELO_OVERRIDES: Record<string, number> = {
  'mosca':     1307,
  'tunison':   1287,
  'ericbr':    1157,
  'kama':      1124,
  'player':    1094,
  'superafim': 1047,
  'zapata_br': 1027,
  'shaolim':   1019,
};

export async function registerForjaPlayer(
  discordUser: ForjaDiscordUser,
  form: ForjaRegistrationForm,
): Promise<void> {
  const profileId = parseAomProfileId(form.aomstats_url);
  if (!profileId) throw new Error('URL do aomstats inválida — não foi possível extrair o profile_id.');

  const pd = form.aom_profile_data;

  // Avatar: scraped do aomstats (Steam) > Discord
  const avatar_url = pd?.avatar_url ?? discordUser.avatar_url;

  // ELO e top_gods: use os valores do scraper se disponíveis (valores iniciais
  // antes do snapshot oficial de sábado)
  const initial_elo_1v1 = pd?.elo_1v1  ?? 0;
  const initial_elo_tg  = pd?.elo_tg   ?? 0;
  const initial_gods    = pd?.top_gods  ?? [];
  
  const normalizedNick = form.nick.trim().toLowerCase();
  const esportsElo = ESPORTS_ELO_OVERRIDES[normalizedNick] ?? ESPORTS_ELO_OVERRIDES[String(profileId)] ?? undefined;

  const player: Omit<ForjaPlayer, 'discord_id'> = {
    aom_profile_id:     profileId,
    aom_id:             String(profileId),
    nick:               form.nick.trim() || discordUser.username,
    avatar_url,
    discord_avatar_url: discordUser.avatar_url,
    is_brazilian:       form.is_brazilian,
    pitch_quote:        form.pitch_quote.slice(0, 50),
    availability:       form.availability,
    elo_1v1:            initial_elo_1v1,
    elo_tg:             initial_elo_tg,
    top_gods:           initial_gods,
    elo_snapshot:       initial_elo_1v1,
    ...(esportsElo !== undefined && { esports_elo: esportsElo }),
    status:             'available',
    tier:               null,
    team_id:            null,
    seed:               null,
    registered_at:      serverTimestamp() as any,
    consent_rules:      form.consent_rules,
    consent_format:     form.consent_format,
  };


  await setDoc(doc(db, PLAYERS_COL, discordUser.discord_id), player);
}


export async function removeForjaPlayer(discordId: string): Promise<void> {
  await deleteDoc(doc(db, PLAYERS_COL, discordId));
}

export async function banForjaPlayer(discordId: string, nick: string): Promise<void> {
  await setDoc(doc(db, 'forja_bans', discordId), {
    discord_id: discordId,
    nick,
    banned_at: serverTimestamp(),
  });
  // Soft delete: set status to banned instead of removing the document
  await updateDoc(doc(db, PLAYERS_COL, discordId), { status: 'banned' });
}

export async function unbanForjaPlayer(discordId: string): Promise<void> {
  await deleteDoc(doc(db, 'forja_bans', discordId));
  await updateDoc(doc(db, PLAYERS_COL, discordId), { status: 'available' });
}

export async function isPlayerBanned(discordId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'forja_bans', discordId));
    return snap.exists();
  } catch (err) {
    console.warn('[Forja] Could not check ban status (rules not deployed?), assuming false:', err);
    return false;
  }
}

export async function setPlayerTier(discordId: string, tier: ForjaTier, seed?: number): Promise<void> {
  await updateDoc(doc(db, PLAYERS_COL, discordId), {
    tier,
    ...(seed !== undefined ? { seed } : {}),
  });
}

export async function updatePlayerStatsSnapshot(discordId: string, updates: Partial<ForjaPlayer>): Promise<void> {
  await updateDoc(doc(db, PLAYERS_COL, discordId), updates);
}

// ─── Admin Player Management (Schema v2) ──────────────────────────────────────

/**
 * Atualiza todas as informações de um jogador manualmente através do Modo Deus.
 */
export async function updatePlayerProfile(discordId: string, data: Partial<ForjaPlayer>): Promise<void> {
  try {
    const docRef = doc(db, PLAYERS_COL, discordId);
    await updateDoc(docRef, {
      ...data,
      last_update: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil do jogador:", error);
    throw new Error("Falha ao salvar edição manual.");
  }
}

/**
 * Campos que o Admin pode alterar via modal.
 * NÃO inclui elo_1v1, elo_tg, avatar_url (esses são do backend).
 */
export interface AdminPlayerFields {
  top_gods_admin?: string[];          // Array flexível de god IDs (1–5)
  esports_elo_enabled?: boolean;      // Toggle Esports ELO
  esports_elo_value?: number | null;  // Valor manual (só usado quando enabled)
  elo_1v1?: number | null;            // Manual ELO 1v1 overwrite
  elo_tg?: number | null;             // Manual ELO TG overwrite
  is_reserve?: boolean;               // Banco de Reservas
}

/** Atualiza os campos de gestão Admin de um jogador específico. */
export async function updatePlayerAdminFields(
  discordId: string,
  fields: AdminPlayerFields
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.top_gods_admin !== undefined) {
    // Filtra undefineds do array, Firebase odeia undefined em arrays
    payload['top_gods_admin'] = fields.top_gods_admin.filter(g => g !== undefined && g !== null);
  }
  if (fields.esports_elo_enabled !== undefined) payload['esports_elo_enabled'] = fields.esports_elo_enabled;
  if (fields.esports_elo_value   !== undefined) payload['esports_elo_value']   = fields.esports_elo_value;
  if (fields.elo_1v1             !== undefined) payload['elo_1v1']             = fields.elo_1v1;
  if (fields.elo_tg              !== undefined) payload['elo_tg']              = fields.elo_tg;
  if (fields.is_reserve          !== undefined) payload['is_reserve']          = fields.is_reserve;

  // Garantia absoluta para não enviar undefined ao Firestore
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, PLAYERS_COL, discordId), payload);
}

/**
 * Resultado da consulta à API do AoM para um jogador.
 */
export interface AomApiResult {
  elo_1v1: number;
  elo_tg: number;
  top_gods: Array<{ god: string; winRate: number; playRate: number }>;
  alias: string;
  avatar_url: string | null;
}

/**
 * Consulta a API do AoM (/api/forja/fetch-aom-profile) para um jogador
 * e retorna os dados sem salvar. O Admin decide o que aplicar.
 */
export async function fetchAomProfileForPlayer(profileId: number): Promise<AomApiResult> {
  const url = `https://us-central1-boxwood-plating-368522.cloudfunctions.net/fetchaomprofile?id=${profileId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status} ao consultar API`);
  }
  
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Erro inesperado no retorno da API');
  }
  
  return {
    elo_1v1: json.data.elo_1v1,
    elo_tg: json.data.elo_tg,
    top_gods: json.data.top_gods,
    alias: json.data.alias || String(profileId),
    avatar_url: json.data.avatar_url,
  };
}

/**
 * Aplica dados frescos da API do AoM ao perfil de um jogador no Firestore.
 * O Admin controla quais campos atualizar.
 */
export async function refreshPlayerFromApi(
  discordId: string,
  profileId: number,
  opts: { elo: boolean; gods: boolean }
): Promise<AomApiResult> {
  const data = await fetchAomProfileForPlayer(profileId);

  const payload: Record<string, unknown> = {};
  if (opts.elo) {
    payload['elo_1v1'] = data.elo_1v1;
    payload['elo_tg']  = data.elo_tg;
  }
  if (opts.gods) {
    payload['top_gods'] = data.top_gods;
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(doc(db, PLAYERS_COL, discordId), payload);
  }

  return data;
}

/**
 * Campos que o próprio jogador pode alterar (self-service).
 * Não inclui ELOs, avatar, deuses ou time.
 */
export interface SelfServiceFields {
  profile_link?: string;   // Link AoMStats ou outro
  availability?: string[]; // Horários
  catchphrase?: string;    // Frase de efeito (até 80 chars)
}

/** Jogador atualiza seu próprio perfil (restrito). */
export async function updatePlayerSelfService(
  discordId: string,
  fields: SelfServiceFields
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.profile_link !== undefined)  payload['profile_link']  = fields.profile_link;
  if (fields.availability !== undefined)  payload['availability']  = fields.availability;
  if (fields.catchphrase  !== undefined)  payload['catchphrase']   = fields.catchphrase.slice(0, 80);
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, PLAYERS_COL, discordId), payload);
}

/**
 * Promove um jogador para Admin ou rebaixa para player.
 * Apenas um Admin pode chamar isso (enforced via Firestore Rules).
 */
export async function setPlayerRole(discordId: string, role: ForjaRole): Promise<void> {
  await updateDoc(doc(db, PLAYERS_COL, discordId), { role });
}

/** Subscrição em tempo real a um único jogador (ex: painel self-service). */
export function subscribeToForjaPlayer(
  discordId: string,
  onData: (player: ForjaPlayer | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, PLAYERS_COL, discordId),
    snap => onData(snap.exists() ? ({ ...(snap.data() as ForjaPlayer), discord_id: snap.id }) : null),
    err  => { console.error('[Forja] player doc:', err); onError?.(err); }
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export function subscribeToForjaSchedule(
  onData: (entries: ForjaScheduleEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, SCHEDULE_COL), orderBy('date', 'asc'));
  return onSnapshot(q,
    snap => onData(snap.docs.map(d => ({ ...(d.data() as ForjaScheduleEntry), id: d.id }))),
    err  => { console.error('[Forja] schedule:', err); onError?.(err); }
  );
}

export async function addScheduleEntry(entry: Omit<ForjaScheduleEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, SCHEDULE_COL), { ...entry, date: entry.date ?? null });
  return ref.id;
}

export async function updateScheduleEntry(id: string, data: Partial<Omit<ForjaScheduleEntry, 'id'>>): Promise<void> {
  await updateDoc(doc(db, SCHEDULE_COL, id), data as any);
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, SCHEDULE_COL, id));
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export function subscribeToForjaTeams(
  onData: (teams: ForjaTeam[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, TEAMS_COL), orderBy('pick_order', 'asc'));
  return onSnapshot(q,
    snap => onData(snap.docs.map(d => ({ ...(d.data() as ForjaTeam), id: d.id }))),
    err  => { console.error('[Forja] teams:', err); onError?.(err); }
  );
}

export async function updateTeamName(teamId: string, name?: string, captainId?: string): Promise<void> {
  const updates: Record<string, string> = {};
  if (name !== undefined && name.trim()) updates.team_name = name.trim();
  if (captainId !== undefined) updates.captain_id = captainId;
  if (Object.keys(updates).length === 0) return;
  await updateDoc(doc(db, TEAMS_COL, teamId), updates);
}

// ─── Draft Session ────────────────────────────────────────────────────────────

const draftDocRef = () => doc(db, DRAFT_COL, DRAFT_DOC);

export function subscribeToForjaDraftSession(
  onData: (session: ForjaDraftSession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(draftDocRef(),
    snap => onData(snap.exists() ? (snap.data() as ForjaDraftSession) : null),
    err  => { console.error('[Forja] draft session:', err); onError?.(err); }
  );
}

/**
 * Inicia o Snake Draft.
 *
 * Regra de composição: 1 Tier A (capitão) + 1 Tier B + 1 Tier C por time.
 *
 * Ordem de picks:
 * Round B: seed N → N-1 → ... → 1  (último capitão escolhe primeiro)
 * Round C: seed 1 → 2  → ... → N   (primeiro capitão retoma)
 *
 * @param captainIds — discord_ids dos capitães, ordenados seed 1..N (melhor ELO primeiro)
 */
export async function startForjaDraft(captainIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  const N = captainIds.length;

  // 1. Criar times
  const teamIds: string[] = [];
  captainIds.forEach((captainId, i) => {
    const teamRef = doc(collection(db, TEAMS_COL));
    teamIds.push(teamRef.id);
    batch.set(teamRef, {
      team_name: `Time ${i + 1}`,
      captain_id: captainId,
      members: [captainId],
      pick_order: i + 1, // seed 1-based
    });
    batch.update(doc(db, PLAYERS_COL, captainId), { status: 'drafted', team_id: teamRef.id });
  });

  // 2. Calcular sequência snake
  // Round B: reverse  → teamIds[N-1], teamIds[N-2], ..., teamIds[0]
  // Round C: forward  → teamIds[0], teamIds[1], ..., teamIds[N-1]
  const roundB = [...teamIds].reverse();
  const roundC = [...teamIds];
  const pickSequence = [...roundB, ...roundC];

  // 3. Criar sessão
  batch.set(draftDocRef(), {
    status: 'active',
    current_pick_index: 0,
    current_team_id: pickSequence[0] ?? null,
    current_round: 'B',
    pick_order_sequence: pickSequence,
    picks: [],
    started_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    captain_presences: {},
  });

  await batch.commit();
}

/**
 * Confirma o pick de um jogador.
 * Valida automaticamente o tier exigido pela rodada atual.
 */
export async function makeDraftPick(
  session: ForjaDraftSession,
  player: ForjaPlayer & { computedTier?: ForjaTier | null },
  forcedByAdmin = false
): Promise<void> {
  const N = session.pick_order_sequence.length / 2; // metade = num times

  // Fetch settings dynamically to support tier_mode = 'AB' (Pool Livre)
  const { getDoc } = await import('firebase/firestore');
  const settingsSnap = await getDoc(doc(db, CONTENT_COL, 'settings'));
  const tierMode = (settingsSnap.data()?.tier_mode as ForjaTierMode) ?? 'ABC';

  // Valida tier: prioridade para computedTier (calculado pelo forjaUtils,
  // que respeita overflow e tier_mode) sobre player.tier (campo Firestore).
  // Isso garante que jogadores de overflow (37º-44º quando max=36) não
  // possam ser selecionados mesmo que Firestore ainda tenha tier: null.
  const effectiveTier: ForjaTier = (player.computedTier !== undefined ? player.computedTier : player.tier);
  const expectedTier: 'B' | 'C' = session.current_round;

  if (effectiveTier !== expectedTier) {
    const isPoolLivreException = tierMode === 'AB' && expectedTier === 'C' && effectiveTier === 'B';
    if (!isPoolLivreException) {
      throw new Error(
        `Este jogador é Tier ${effectiveTier ?? '?'}, mas a rodada atual exige Tier ${expectedTier}.`
      );
    }
  }

  const batch        = writeBatch(db);
  const pickIndex    = session.current_pick_index;
  const teamId       = session.current_team_id!;
  const nextIndex    = pickIndex + 1;
  const nextTeamId   = session.pick_order_sequence[nextIndex] ?? null;
  const isCompleted  = nextIndex >= session.pick_order_sequence.length;
  const nextRound    = nextIndex < N ? 'B' : 'C';

  const pick: ForjaDraftPick = {
    round: session.current_round,
    team_id: teamId,
    player_id: player.discord_id,
    pick_index: pickIndex,
    picked_at: null,
    forced_by_admin: forcedByAdmin,
  };

  batch.update(doc(db, PLAYERS_COL, player.discord_id), { status: 'drafted', team_id: teamId });
  batch.update(doc(db, TEAMS_COL, teamId), { members: arrayUnion(player.discord_id) });
  batch.update(draftDocRef(), {
    picks: arrayUnion(pick),
    current_pick_index: nextIndex,
    current_team_id:    nextTeamId,
    current_round:      nextRound,
    status:             isCompleted ? 'completed' : 'active',
    updated_at:         serverTimestamp(),
  });

  await batch.commit();
}

/** Desfaz o último pick (apenas Admin) */
export async function undoLastDraftPick(session: ForjaDraftSession): Promise<void> {
  if (!session.picks || session.picks.length === 0) {
    throw new Error('Nenhum pick para desfazer.');
  }

  const lastPick = session.picks[session.picks.length - 1];
  const batch = writeBatch(db);

  // 1. Restaurar o jogador
  batch.update(doc(db, PLAYERS_COL, lastPick.player_id), { status: 'available', team_id: null });

  // 2. Remover do time (pode usar arrayRemove do Firebase)
  batch.update(doc(db, TEAMS_COL, lastPick.team_id), { members: arrayRemove(lastPick.player_id) });

  // 3. Atualizar a sessão
  const newPicks = session.picks.slice(0, -1);
  const prevIndex = session.current_pick_index - 1;
  const prevTeamId = session.pick_order_sequence[prevIndex];
  const N = session.pick_order_sequence.length / 2;
  const prevRound = prevIndex < N ? 'B' : 'C';

  batch.update(draftDocRef(), {
    picks: newPicks,
    current_pick_index: prevIndex,
    current_team_id: prevTeamId,
    current_round: prevRound,
    status: 'active', // Volta pra ativo se tava completed
    updated_at: serverTimestamp(),
  });

  await batch.commit();
}

/** Permite que o Capitão mude o nome do seu time */
export async function renameForjaTeam(teamId: string, newName: string): Promise<void> {
  if (!newName.trim() || newName.length > 25) throw new Error('Nome inválido (1-25 chars).');
  await updateDoc(doc(db, TEAMS_COL, teamId), { team_name: newName.trim() });
}

/** Atualiza o heartbeat de presença de um capitão */
export async function updateCaptainPresence(discordId: string): Promise<void> {
  try {
    await updateDoc(draftDocRef(), {
      [`captain_presences.${discordId}`]: Date.now(),
    });
  } catch { /* sessão pode não existir ainda */ }
}

export async function resetForjaDraft(): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(draftDocRef());
  const teamsSnap   = await getDocs(collection(db, TEAMS_COL));
  const playersSnap = await getDocs(collection(db, PLAYERS_COL));
  teamsSnap.docs.forEach(d => batch.delete(d.ref));
  playersSnap.docs.forEach(d => {
    if (d.data().status !== 'banned') {
      batch.update(d.ref, { status: 'available', team_id: null });
    }
  });
  await batch.commit();
}

// ─── CMS — Conteúdo Editável ──────────────────────────────────────────────────

/** IDs dos documentos de conteúdo */
export type ForjaContentId = 'rules' | 'format' | 'prizes' | 'settings';

export function subscribeToForjaContent<T = ForjaContentDoc>(
  docId: ForjaContentId,
  onData: (data: T | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, CONTENT_COL, docId),
    snap => onData(snap.exists() ? (snap.data() as T) : null),
    err  => { console.error(`[Forja] content/${docId}:`, err); onError?.(err); }
  );
}

// ─── Settings do Torneio ──────────────────────────────────────────────────────

/** Subscrição em tempo real às configurações gerais do torneio. */
export function subscribeToForjaSettings(
  onData: (settings: ForjaSettings | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, CONTENT_COL, 'settings'),
    snap => onData(snap.exists() ? (snap.data() as ForjaSettings) : null),
    err  => { console.error('[Forja] settings:', err); onError?.(err); }
  );
}

/**
 * Salva as configurações gerais do torneio (apenas Admin via Firestore Rules).
 * Usa merge: true para não apagar campos não incluídos no update.
 */
export async function saveForjaSettings(
  settings: Partial<Omit<ForjaSettings, 'updated_at'>>,
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, CONTENT_COL, 'settings'), {
    ...settings,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  }, { merge: true });
}

// ─── Adição Manual de Jogador (Admin) ────────────────────────────────────────

/**
 * Adiciona um jogador manualmente pelo Discord ID (apenas Admin).
 * Usado quando o Admin conhece o jogador e quer inscrevê-lo sem OAuth Discord.
 * O avatar usa o CDN do Discord como placeholder; o snapshot de ELO oficial atualiza depois.
 */
export async function adminRegisterPlayer(params: {
  discordId: string;
  nick: string;
  aomProfileId: number;
  elo1v1?: number;
  eloTg?: number;
  topGods?: any[];
  avatarUrl?: string;
  /** Frase de efeito do jogador (admin pode preencher pelo jogador) */
  pitchQuote?: string;
  /** Disponibilidade selecionada pelo admin */
  availability?: string[];
  /** Nacionalidade (default: brasileiro) */
  isBrazilian?: boolean;
  addedBy: string;
}): Promise<void> {
  const {
    discordId, nick, aomProfileId, elo1v1 = 0, eloTg = 0,
    topGods = [], avatarUrl, pitchQuote, availability = [],
    isBrazilian = true, addedBy,
  } = params;

  // Verifica se já existe
  const existing = await getDoc(doc(db, PLAYERS_COL, discordId));
  if (existing.exists()) {
    throw new Error(`Jogador com Discord ID ${discordId} já está inscrito.`);
  }

  // Avatar placeholder do CDN do Discord
  const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId.slice(-1)) % 6}.png`;

  const player: Omit<import('../types').ForjaPlayer, 'discord_id'> = {
    aom_profile_id:     aomProfileId,
    aom_id:             String(aomProfileId),
    nick:               nick.trim(),
    avatar_url:         avatarUrl || defaultAvatar,
    discord_avatar_url: avatarUrl || defaultAvatar,
    is_brazilian:       isBrazilian,
    pitch_quote:        pitchQuote?.trim() || `Adicionado manualmente por ${addedBy}`,
    availability,
    elo_1v1:            elo1v1,
    elo_tg:             eloTg,
    top_gods:           topGods,
    elo_snapshot:       elo1v1,
    status:             'available',
    tier:               null,
    team_id:            null,
    seed:               null,
    registered_at:      serverTimestamp() as any,
    consent_rules:      true,   // Admin assume responsabilidade
    consent_format:     true,
    role:               'player',
  };

  await setDoc(doc(db, PLAYERS_COL, discordId), player);
}

export async function updateForjaContent(
  docId: ForjaContentId,
  data: object,
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, CONTENT_COL, docId), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  }, { merge: true });
}

/** Seeds os defaults de conteúdo caso o documento não exista */
export async function seedDefaultContent(updatedBy: string): Promise<void> {
  const defaults: Record<string, object> = {
    rules: {
      sections: [
        { title: '1. Elegibilidade', content: 'Participantes devem ser brasileiros ou portugueses e ter conta ativa no Age of Mythology: Retold.' },
        { title: '2. Fair Play', content: 'Comportamento antidesportivo, hacking ou qualquer forma de trapaça resultará em eliminação imediata.' },
        { title: '3. Presença', content: 'Capitães devem estar presentes (logados no site) às 15h do sábado para o Draft.' },
      ],
    },
    format: {
      sections: [
        { title: 'Formato 3v3', content: 'Cada time é composto por 3 jogadores: 1 Capitão (Tier A) + 1 Tier B + 1 Tier C.' },
        { title: 'Snake Draft', content: 'Os capitães são classificados por ELO 1v1 (snapshot às 14h). O último capitão escolhe primeiro no Tier B, depois o primeiro capitão escolhe primeiro no Tier C.' },
        { title: 'Partidas', content: 'Formato Bo3 (melhor de 3). Times se enfrentam em rodadas eliminatórias.' },
      ],
    },
    prizes: {
      total_prize: 0,
      currency: 'BRL',
      distribution: [
        { place: 1, label: '🥇 1º Lugar', percent: 50 },
        { place: 2, label: '🥈 2º Lugar', percent: 25 },
        { place: 3, label: '🥉 3º/4º Lugar', percent: 12.5 },
        { place: 4, label: '🏅 3º/4º Lugar', percent: 12.5 },
      ],
      notes: '',
    },
    settings: {
      registration_open: true,
      registration_deadline_ms: new Date('2026-05-09T16:59:00Z').getTime(),
      elo_snapshot_ms: new Date('2026-05-09T17:00:00Z').getTime(),
      draft_start_ms: new Date('2026-05-09T18:00:00Z').getTime(),
    },
  };

  for (const [id, data] of Object.entries(defaults)) {
    const ref = doc(db, CONTENT_COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...data, updated_at: serverTimestamp(), updated_by: updatedBy });
    }
  }
}

// ─── Fase 3: Regras Reordenáveis (blocks) ────────────────────────────────────

const RULES_DOC_ID = 'rules_v2';

export function subscribeToForjaRulesBlocks(
  onData: (blocks: ForjaRulesBlock[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, CONTENT_COL, RULES_DOC_ID),
    snap => {
      if (snap.exists()) {
        const raw = snap.data();
        const blocks: ForjaRulesBlock[] = (raw.blocks ?? []);
        onData([...blocks].sort((a, b) => a.order - b.order));
      } else {
        onData([]);
      }
    },
    err => { console.error('[Forja] rules_v2:', err); onError?.(err); }
  );
}

/** Salva o array completo de blocos (após reordenação drag&drop). */
export async function saveRulesBlocks(
  blocks: ForjaRulesBlock[],
  updatedBy: string
): Promise<void> {
  const normalized = blocks.map((b, i) => ({ ...b, order: i }));
  await setDoc(doc(db, CONTENT_COL, RULES_DOC_ID), {
    blocks: normalized,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  }, { merge: false });
}

/** Adiciona um novo bloco vazio. */
export async function addRulesBlock(updatedBy: string): Promise<void> {
  const snap = await getDoc(doc(db, CONTENT_COL, RULES_DOC_ID));
  const existing: ForjaRulesBlock[] = snap.exists() ? (snap.data().blocks ?? []) : [];
  const newBlock: ForjaRulesBlock = {
    id: `block_${Date.now()}`,
    title: 'Novo Bloco',
    content: 'Escreva o conteúdo aqui...',
    order: existing.length,
  };
  await setDoc(doc(db, CONTENT_COL, RULES_DOC_ID), {
    blocks: [...existing, newBlock],
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  }, { merge: false });
}

/** Remove um bloco por id e reordena. */
export async function deleteRulesBlock(blockId: string, updatedBy: string): Promise<void> {
  const snap = await getDoc(doc(db, CONTENT_COL, RULES_DOC_ID));
  if (!snap.exists()) return;
  const filtered = (snap.data().blocks as ForjaRulesBlock[])
    .filter(b => b.id !== blockId)
    .map((b, i) => ({ ...b, order: i }));
  await setDoc(doc(db, CONTENT_COL, RULES_DOC_ID), {
    blocks: filtered,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  }, { merge: false });
}

// ─── Fase 3: Configuração do Torneio (grupos) ────────────────────────────────

const TOURNAMENT_DOC_ID = 'tournament';

export function subscribeToTournamentConfig(
  onData: (config: ForjaTournamentConfig | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, CONTENT_COL, TOURNAMENT_DOC_ID),
    snap => onData(snap.exists() ? (snap.data() as ForjaTournamentConfig) : null),
    err => { console.error('[Forja] tournament:', err); onError?.(err); }
  );
}

export async function saveTournamentConfig(
  config: Omit<ForjaTournamentConfig, 'updated_at' | 'updated_by'>,
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, CONTENT_COL, TOURNAMENT_DOC_ID), {
    ...config,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  });
}

// ─── Fase 3: Gestão de Times v2 (drag & drop) ────────────────────────────────

/** Cria um time vazio manualmente (sem draft automático). */
export async function createForjaTeam(name: string): Promise<string> {
  if (!name.trim()) throw new Error('Nome do time obrigatório.');
  const ref = await addDoc(collection(db, TEAMS_COL), {
    team_name: name.trim(),
    captain_id: '',
    members: [],
    pick_order: 0,
  });
  return ref.id;
}

/** Remove um time e libera todos os seus jogadores. */
export async function deleteForjaTeam(teamId: string): Promise<void> {
  const batch = writeBatch(db);
  // Libera jogadores
  const playersSnap = await getDocs(collection(db, PLAYERS_COL));
  playersSnap.docs.forEach(d => {
    if (d.data().team_id === teamId) {
      if (d.data().status !== 'banned') {
        batch.update(d.ref, { team_id: null, status: 'available' });
      } else {
        batch.update(d.ref, { team_id: null });
      }
    }
  });
  batch.delete(doc(db, TEAMS_COL, teamId));
  await batch.commit();
}

/**
 * Move um jogador para um time (drag & drop).
 * Remove do time anterior (se houver) e adiciona ao novo.
 */
export async function movePlayerToTeam(
  playerId: string,
  targetTeamId: string,
  previousTeamId: string | null
): Promise<void> {
  const batch = writeBatch(db);

  if (previousTeamId && previousTeamId !== targetTeamId) {
    batch.update(doc(db, TEAMS_COL, previousTeamId), {
      members: arrayRemove(playerId),
    });
  }
  batch.update(doc(db, TEAMS_COL, targetTeamId), {
    members: arrayUnion(playerId),
  });
  batch.update(doc(db, PLAYERS_COL, playerId), {
    team_id: targetTeamId,
    is_reserve: false,
    status: 'drafted',
  });
  await batch.commit();
}

/**
 * Move um jogador para o Banco de Reservas.
 * Remove do time se estava em algum.
 */
export async function movePlayerToReserve(
  playerId: string,
  previousTeamId: string | null
): Promise<void> {
  const batch = writeBatch(db);
  if (previousTeamId) {
    batch.update(doc(db, TEAMS_COL, previousTeamId), {
      members: arrayRemove(playerId),
    });
  }
  batch.update(doc(db, PLAYERS_COL, playerId), {
    team_id: null,
    is_reserve: true,
    status: 'available',
  });
  await batch.commit();
}

/**
 * Remove um jogador de qualquer time e volta ao pool principal.
 */
export async function movePlayerToPool(
  playerId: string,
  previousTeamId: string | null
): Promise<void> {
  const batch = writeBatch(db);
  if (previousTeamId) {
    batch.update(doc(db, TEAMS_COL, previousTeamId), {
      members: arrayRemove(playerId),
    });
  }
  batch.update(doc(db, PLAYERS_COL, playerId), {
    team_id: null,
    is_reserve: false,
    status: 'available',
  });
  await batch.commit();
}

// ─── Fase 3+: Pool de Mapas Dinâmica ─────────────────────────────────────────

const MAP_POOL_DOC_ID = 'map_pool';
const MIN_POOL_SIZE   = 8;
const MAX_POOL_SIZE   = 15;

/**
 * Subscription em tempo real ao documento da pool ativa de mapas.
 * Fallback: se não existir no Firestore, retorna null e o
 * cliente pode usar FORJA_MAP_POOL local como padrão.
 */
export function subscribeToForjaMapPool(
  onData: (pool: ForjaMapPool | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, CONTENT_COL, MAP_POOL_DOC_ID),
    snap => onData(snap.exists() ? (snap.data() as ForjaMapPool) : null),
    err  => { console.error('[Forja] map_pool:', err); onError?.(err); }
  );
}

/**
 * Salva a pool ativa completa.
 * Valida tamanho antes de persistir.
 */
export async function saveForjaMapPool(
  activeMapIds: string[],
  poolSize: number,
  updatedBy: string
): Promise<void> {
  if (poolSize < MIN_POOL_SIZE || poolSize > MAX_POOL_SIZE) {
    throw new Error(`Tamanho da pool deve ser entre ${MIN_POOL_SIZE} e ${MAX_POOL_SIZE}.`);
  }
  if (activeMapIds.length > poolSize) {
    throw new Error(`A pool tem ${activeMapIds.length} mapas, mas o limite é ${poolSize}.`);
  }

  const payload: ForjaMapPool = {
    active_map_ids: activeMapIds,
    pool_size: poolSize,
    updated_by: updatedBy,
  };

  await setDoc(doc(db, CONTENT_COL, MAP_POOL_DOC_ID), {
    ...payload,
    updated_at: serverTimestamp(),
  });
}

/**
 * Inicializa a pool no Firestore com os valores do FORJA_MAP_POOL local
 * (sem sobrescrever se já existir).
 */
export async function seedDefaultMapPool(updatedBy: string): Promise<void> {
  const ref  = doc(db, CONTENT_COL, MAP_POOL_DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // Já configurado, não sobrescreve

  await setDoc(ref, {
    active_map_ids: FORJA_MAP_POOL,
    pool_size: FORJA_MAP_POOL.length,
    updated_at: serverTimestamp(),
    updated_by: updatedBy,
  });
}
