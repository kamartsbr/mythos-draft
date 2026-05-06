/**
 * ============================================================
 *  FORJA DE HEFESTO — Firestore Service (Revisão Major)
 * ============================================================
 */

import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Unsubscribe,
  getDoc, getDocs, writeBatch, arrayUnion,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  ForjaPlayer, ForjaRegistrationForm, ForjaDiscordUser,
  ForjaScheduleEntry, ForjaTeam, ForjaDraftSession, ForjaDraftPick,
  ForjaTier, ForjaContentDoc, ForjaPrizeConfig, ForjaSettings,
} from '../types';

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
 *   https://aomstats.io/profiles/12345
 *   https://aomstats.io/leaderboard/1?search=nick  (fallback)
 *   "12345" (número direto)
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
  const q = query(collection(db, PLAYERS_COL), orderBy('registered_at', 'asc'));
  return onSnapshot(q,
    snap => onData(snap.docs.map(d => ({ ...(d.data() as ForjaPlayer), discord_id: d.id }))),
    err  => { console.error('[Forja] players:', err); onError?.(err); }
  );
}

export async function isPlayerRegistered(discordId: string): Promise<boolean> {
  return (await getDoc(doc(db, PLAYERS_COL, discordId))).exists();
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

export async function setPlayerTier(discordId: string, tier: ForjaTier, seed?: number): Promise<void> {
  await updateDoc(doc(db, PLAYERS_COL, discordId), {
    tier,
    ...(seed !== undefined ? { seed } : {}),
  });
}

export async function updatePlayerStatsSnapshot(discordId: string, updates: Partial<ForjaPlayer>): Promise<void> {
  await updateDoc(doc(db, PLAYERS_COL, discordId), updates);
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

export async function updateTeamName(teamId: string, name: string): Promise<void> {
  await updateDoc(doc(db, TEAMS_COL, teamId), { team_name: name });
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
 *   Round B: seed N → N-1 → ... → 1  (último capitão escolhe primeiro)
 *   Round C: seed 1 → 2  → ... → N   (primeiro capitão retoma)
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
  player: ForjaPlayer,
  forcedByAdmin = false
): Promise<void> {
  const N = session.pick_order_sequence.length / 2; // metade = num times

  // Validação de tier
  const expectedTier: 'B' | 'C' = session.current_round;
  if (player.tier !== expectedTier) {
    throw new Error(
      `Este jogador é Tier ${player.tier ?? '?'}, mas a rodada atual exige Tier ${expectedTier}.`
    );
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
  playersSnap.docs.forEach(d => batch.update(d.ref, { status: 'available', team_id: null }));
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
      // Sábado 09/05/2026 13:59 BRT = 16:59 UTC
      registration_deadline_ms: new Date('2026-05-09T16:59:00Z').getTime(),
      // Sábado 09/05/2026 14:00 BRT = 17:00 UTC
      elo_snapshot_ms: new Date('2026-05-09T17:00:00Z').getTime(),
      // Sábado 09/05/2026 15:00 BRT = 18:00 UTC
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
