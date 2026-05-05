/**
 * ============================================================
 *  FORJA DE HEFESTO — Type Definitions (Revisão Major)
 * ============================================================
 */

// ─── Utilitários Firestore ───────────────────────────────────────────────────
export type FirestoreTimestamp = { seconds: number; nanoseconds: number } | number | null;

// ─── Jogador ─────────────────────────────────────────────────────────────────
export type ForjaPlayerStatus = 'available' | 'drafted' | 'reserve' | 'rejected' | 'pending';
export type ForjaTier = 'A' | 'B' | 'C' | null;

export interface ForjaGodStat {
  god: string;
  godName?: string;
  winRate: number;
  playRate: number;
}

export interface ForjaPlayer {
  discord_id: string;
  /** ID numérico do perfil no aomstats.io */
  aom_profile_id: number;
  /** Slug/alias exibido nas URLs do aomstats */
  aom_id: string;
  nick: string;
  avatar_url: string;
  is_brazilian: boolean;
  pitch_quote: string;
  elo_1v1: number;
  elo_tg: number;
  /** ELO 1v1 no momento do snapshot (sábado 14h) */
  elo_snapshot?: number;
  top_gods: ForjaGodStat[];
  status: ForjaPlayerStatus;
  tier: ForjaTier;
  team_id: string | null;
  seed?: number;
  registered_at: FirestoreTimestamp;
  /** Consentimento com as Regras */
  consent_rules: boolean;
  /** Consentimento com o Formato */
  consent_format: boolean;
}

// ─── Time ────────────────────────────────────────────────────────────────────
export interface ForjaTeam {
  id: string;
  team_name: string;
  captain_id: string;
  members: string[];
  pick_order: number;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
export interface ForjaScheduleEntry {
  id: string;
  date: FirestoreTimestamp;
  matchup: string;
  streamer_link: string;
  streamer_name: string;
}

// ─── Draft Session ────────────────────────────────────────────────────────────
export type ForjaDraftStatus = 'pending' | 'active' | 'paused' | 'completed';
export type ForjaDraftRound = 'B' | 'C';

export interface ForjaDraftPick {
  round: ForjaDraftRound;
  team_id: string;
  player_id: string;
  pick_index: number;
  picked_at: FirestoreTimestamp;
  forced_by_admin: boolean;
}

export interface ForjaDraftSession {
  status: ForjaDraftStatus;
  current_pick_index: number;
  current_team_id: string | null;
  current_round: ForjaDraftRound;
  /** Sequência snake: Round B invertido + Round C direto */
  pick_order_sequence: string[];   // array de team_ids
  picks: ForjaDraftPick[];
  started_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
  /** Presença dos capitães: discord_id → timestamp last_seen (ms) */
  captain_presences: Record<string, number>;
}

// ─── CMS — Conteúdo Editável ──────────────────────────────────────────────────
export interface ForjaContentSection {
  title: string;
  /** Corpo em texto simples / markdown básico */
  content: string;
}

/** Documento genérico de conteúdo editável (regras, formato) */
export interface ForjaContentDoc {
  sections: ForjaContentSection[];
  updated_at: FirestoreTimestamp;
  updated_by: string;
}

/** Configuração de premiação */
export interface ForjaPrizeDistribution {
  place: number;
  label: string;   // ex: '1º Lugar'
  percent: number; // 0-100
}

export interface ForjaPrizeConfig {
  total_prize: number;
  currency: 'BRL' | 'USD';
  distribution: ForjaPrizeDistribution[];
  notes: string;
  updated_at: FirestoreTimestamp;
  updated_by: string;
}

/** Configurações gerais do torneio */
export interface ForjaSettings {
  registration_open: boolean;
  /** Unix ms da deadline de inscrições (Sáb 13:59 BRT) */
  registration_deadline_ms: number;
  /** Unix ms do snapshot de ELO (Sáb 14:00 BRT) */
  elo_snapshot_ms: number;
  /** Unix ms do início do draft (Sáb 15:00 BRT) */
  draft_start_ms: number;
  updated_at: FirestoreTimestamp;
}

// ─── Formulário de Inscrição ──────────────────────────────────────────────────
export interface ForjaRegistrationForm {
  /** URL completa do perfil no aomstats.io/profiles/XXXXX */
  aomstats_url: string;
  pitch_quote: string;
  is_brazilian: boolean;
  consent_rules: boolean;
  consent_format: boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface ForjaDiscordUser {
  discord_id: string;
  username: string;
  discriminator: string;
  avatar_url: string;
  access_token?: string;
}

// ─── Navegação ────────────────────────────────────────────────────────────────
export type ForjaTabId =
  | 'inicio'
  | 'regras'
  | 'formato'
  | 'schedule'
  | 'times'
  | 'drafts'
  | 'admin-draft'
  | 'draft-room'
  | 'obs';

export interface ForjaTab {
  id: ForjaTabId;
  label: string;
  icon?: string;
}

// ─── Props compartilhadas ────────────────────────────────────────────────────
export interface ForjaViewProps {
  discordUser: ForjaDiscordUser | null;
  isAdmin: boolean;
}
