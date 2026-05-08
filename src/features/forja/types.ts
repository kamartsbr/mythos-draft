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
export type ForjaRole = 'player' | 'admin';

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
  /** Avatar principal: Steam/aomstats (scraped) ou Discord como fallback */
  avatar_url: string;
  /** Avatar do Discord (sempre disponível) */
  discord_avatar_url: string;
  is_brazilian: boolean;
  pitch_quote: string;
  elo_1v1: number;
  elo_tg: number;
  /** ELO 1v1 no momento do snapshot (sábado 14h) */
  elo_snapshot?: number;
  /** ELO automático legado (mantido para compatibilidade com registros antigos) */
  esports_elo?: number;
  /**
   * [Schema v2] Toggle Admin: habilita override de ELO via esports_elo_value.
   * Quando true, effectiveElo = esports_elo_value (ex-profissionais).
   */
  esports_elo_enabled?: boolean;
  /**
   * [Schema v2] Valor manual do Esports ELO definido pelo Admin.
   * Só é usado como effectiveElo quando esports_elo_enabled === true.
   */
  esports_elo_value?: number | null;
  /**
   * [Schema v2] Top Deuses definidos pelo Admin (array flexível de god IDs, 1–5).
   * Sobrepõe top_gods_auto (scraped) quando presente.
   */
  top_gods_admin?: string[];
  /** Top deuses scraped automaticamente pelo backend */
  top_gods: ForjaGodStat[];
  status: ForjaPlayerStatus;
  /**
   * Tier calculado dinamicamente no frontend por posição no rank.
   * Não deve ser escrito pelo Admin — é computado.
   * Mantido no type por compatibilidade com dados legados.
   */
  tier: ForjaTier;
  team_id: string | null;
  /** true = está no Banco de Reservas (não participa do draft principal) */
  is_reserve?: boolean;
  seed?: number | null;
  registered_at: FirestoreTimestamp;
  /** Consentimento com as Regras */
  consent_rules: boolean;
  /** Consentimento com o Formato */
  consent_format: boolean;
  /** Horários de disponibilidade do jogador */
  availability: string[];
  /** [Schema v2] Permissão granular do usuário */
  role?: ForjaRole;
  /** [Schema v2] Self-service: link do perfil (ex: AoMStats) */
  profile_link?: string;
  /** [Schema v2] Self-service: frase de efeito */
  catchphrase?: string;
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

/**
 * [Schema v2] Bloco de regra reordenável (drag & drop).
 * Salvo em forja_content/rules como array `blocks`.
 */
export interface ForjaRulesBlock {
  id: string;          // UUID gerado no cliente
  title: string;
  content: string;     // texto simples ou markdown básico
  order: number;       // índice de ordenação (0, 1, 2…)
}

/**
 * [Schema v2] Configuração do torneio — documento único forja_content/tournament.
 */
export interface ForjaTournamentConfig {
  groupCount: number;  // 2, 3 ou 4
  groups: Array<{
    id: string;        // 'group_a', 'group_b', …
    name: string;      // 'Grupo A', 'Grupo B', …
    teamIds: string[]; // FKs → forja_teams
  }>;
  updated_at?: FirestoreTimestamp;
  updated_by?: string;
}

/** Pool dinâmica de mapas gerida pelo Admin no Firestore */
export interface ForjaMapPool {
  /** IDs dos mapas na pool ativa (subset de MAPS[]) */
  active_map_ids: string[];
  /** Tamanho máximo da pool (8–15) */
  pool_size: number;
  updated_at?: FirestoreTimestamp;
  updated_by?: string;
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
export interface AomProfileData {
  profile_id: number;
  avatar_url: string | null;
  alias: string | null;
  verified: boolean;
  /** ELO do ranking Supremacy 1v1 extraído do perfil */
  elo_1v1: number | null;
  /** ELO do ranking Supremacy Team Game extraído do perfil */
  elo_tg: number | null;
  elo_efetivo?: number | null;
  /** Top 5 deuses com win rate e play rate calculados do perfil */
  top_gods: ForjaGodStat[];
}

export interface ForjaRegistrationForm {
  /** Nick de jogo (preenchido pelo usuário) */
  nick: string;
  /** URL completa do perfil no aomstats.io/profiles/XXXXX */
  aomstats_url: string;
  /** Dados do perfil retornados pelo scraper server-side */
  aom_profile_data: AomProfileData | null;
  /** Horários de disponibilidade selecionados */
  availability: string[];
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
  | 'mapas'
  | 'formato'
  | 'schedule'
  | 'times'
  | 'tabela'
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
