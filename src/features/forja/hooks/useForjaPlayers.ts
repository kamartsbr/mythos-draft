/**
 * ============================================================
 * useForjaPlayers — Hook de listagem (Modo Busca Fria)
 * Retorna players rankeados (computedTier + effectiveElo)
 * com busca única ao Firestore e fallback para mock em dev.
 * ============================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { ForjaPlayer } from '../types';
import { RankedPlayer, computeRankedPlayers } from '../forjaUtils';
import { getForjaPlayersOnce, subscribeToForjaPlayers } from '../services/forjaService';
import { useForjaSettings } from './useForjaSettings';

// ─── Mock Data (dev) ──────────────────────────────────────────────────────────

const MOCK_PLAYERS: ForjaPlayer[] = [
  {
    discord_id: '111111111111111111',
    aom_profile_id: 10001, aom_id: 'omoradin', nick: 'Omoradin',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    is_brazilian: true,
    pitch_quote: 'Zeus ou morte, não tem meio-termo!',
    elo_1v1: 2150, elo_tg: 1980,
    esports_elo_enabled: true, esports_elo_value: 2450,
    top_gods: [
      { god: 'zeus',   godName: 'Zeus',   winRate: 68, playRate: 45 },
      { god: 'hades',  godName: 'Hades',  winRate: 61, playRate: 22 },
      { god: 'thor',   godName: 'Thor',   winRate: 55, playRate: 18 },
    ],
    top_gods_admin: ['zeus', 'hades', 'thor'],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekday-eve', 'weekend-eve'],
    role: 'admin',
    catchphrase: 'Forjado em chamas, temperado na vitória.',
  },
  {
    discord_id: '222222222222222222',
    aom_profile_id: 10002, aom_id: 'kamaRTS', nick: 'KamaRTS',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/1.png',
    is_brazilian: true,
    pitch_quote: 'Loki main. Chaos is the plan.',
    elo_1v1: 2080, elo_tg: 2010,
    top_gods: [
      { god: 'loki',   godName: 'Loki',   winRate: 72, playRate: 55 },
      { god: 'odin',   godName: 'Odin',   winRate: 60, playRate: 20 },
      { god: 'set',    godName: 'Set',    winRate: 57, playRate: 12 },
      { god: 'isis',   godName: 'Isis',   winRate: 53, playRate: 8  },
      { god: 'oranos', godName: 'Oranos', winRate: 45, playRate: 5  },
    ],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekend-aft', 'weekend-eve'],
    role: 'player',
  },
  {
    discord_id: '333333333333333333',
    aom_profile_id: 10003, aom_id: 'thunderaxe99', nick: 'ThunderAxe',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png',
    is_brazilian: true,
    pitch_quote: 'Thor TG é science, não opinião.',
    elo_1v1: 1920, elo_tg: 2100,
    top_gods: [
      { god: 'thor',     godName: 'Thor',     winRate: 70, playRate: 60 },
      { god: 'odin',     godName: 'Odin',     winRate: 58, playRate: 20 },
      { god: 'poseidon', godName: 'Poseidon', winRate: 54, playRate: 10 },
    ],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekday-eve'],
    role: 'player',
  },
  {
    discord_id: '444444444444444444',
    aom_profile_id: 10004, aom_id: 'mythkeeper_br', nick: 'MythKeeper',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/3.png',
    is_brazilian: true,
    pitch_quote: 'Isis e fé, sempre. Vai que vai.',
    elo_1v1: 1850, elo_tg: 1900,
    top_gods: [
      { god: 'isis',      godName: 'Isis',      winRate: 65, playRate: 50 },
      { god: 'ra',        godName: 'Ra',        winRate: 59, playRate: 25 },
      { god: 'amaterasu', godName: 'Amaterasu', winRate: 52, playRate: 12 },
    ],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekend-eve', 'late-night'],
    role: 'player',
  },
  {
    discord_id: '555555555555555555',
    aom_profile_id: 10005, aom_id: 'dragonlord_pt', nick: 'DragonLord_PT',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/4.png',
    is_brazilian: false,
    pitch_quote: 'De Portugal para o mundo!',
    elo_1v1: 1780, elo_tg: 1820,
    top_gods: [
      { god: 'kronos', godName: 'Kronos', winRate: 63, playRate: 42 },
      { god: 'oranos', godName: 'Oranos', winRate: 58, playRate: 30 },
    ],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekday-eve', 'weekend-aft'],
    role: 'player',
  },
  {
    discord_id: '666666666666666666',
    aom_profile_id: 10006, aom_id: 'goldenspear7', nick: 'GoldenSpear',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/5.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/5.png',
    is_brazilian: true,
    pitch_quote: 'Cada partida é uma forja da alma.',
    elo_1v1: 1710, elo_tg: 1750,
    top_gods: [
      { god: 'nuwa', godName: 'Nüwa', winRate: 61, playRate: 38 },
      { god: 'fuxi', godName: 'Fuxi', winRate: 55, playRate: 28 },
    ],
    status: 'available', tier: null, team_id: null, seed: null,
    registered_at: null, consent_rules: true, consent_format: true,
    availability: ['weekend-eve', 'late-night'],
    role: 'player',
    is_reserve: true, // Mock: esse jogador está no banco de reservas
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseForjaPlayersResult {
  /** Players rankeados e com computedTier atribuído */
  rankedPlayers: RankedPlayer[];
  /** Players banidos */
  bannedPlayers: ForjaPlayer[];
  /** Players brutos do Firestore (sem modificação) */
  rawPlayers: ForjaPlayer[];
  loading: boolean;
  error: string | null;
  isLive: boolean;
}

/**
 * Provides Forja players state and derived lists, loading either live updates or a one-time snapshot based on the caller's preference.
 *
 * @param wantsLive - When `true`, subscribes to live player updates; when `false` (default), performs a single fetch or uses development mock data.
 * @returns An object with:
 *  - `rankedPlayers` — player list with client-computed tiers and ranks;
 *  - `bannedPlayers` — players whose `status === 'banned'`;
 *  - `rawPlayers` — source player array as received from the data layer (or mock data);
 *  - `loading` — `true` while data is being fetched or subscription is establishing;
 *  - `error` — error message string when a data operation fails, or `null`;
 *  - `isLive` — `true` when the returned data is backed by an active live subscription.
 */
export function useForjaPlayers(wantsLive = false): UseForjaPlayersResult {
  const [rawPlayers, setRawPlayers] = useState<ForjaPlayer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error,  setError]          = useState<string | null>(null);
  const [isLive,  setIsLive]        = useState(false);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';

    if (IS_DEV) {
      const timer = setTimeout(() => {
        setRawPlayers(MOCK_PLAYERS);
        setLoading(false);
        setIsLive(false);
      }, 600);
      return () => clearTimeout(timer);
    }
    if (wantsLive) {
      setLoading(true);
      const unsub = subscribeToForjaPlayers(
        data => {
          setRawPlayers(data);
          setIsLive(true);
          setError(null);
          setLoading(false);
        },
        err => {
          console.error('[useForjaPlayers]', err);
          setError('Erro na subscrição de players.');
          setIsLive(false);
          setLoading(false);
        }
      );
      return () => unsub();
    }

    // Produção: Busca fria única no Firestore
    let isMounted = true;

    async function fetchPlayers() {
      setLoading(true);
      try {
        const data = await getForjaPlayersOnce();
        if (isMounted) {
          setRawPlayers(data);
          setIsLive(true);
          setError(null);
        }
      } catch (err) {
        console.error('[useForjaPlayers]', err);
        if (isMounted) {
          setRawPlayers(MOCK_PLAYERS);
          setError('Não foi possível conectar ao banco de dados. Exibindo dados de demonstração.');
          setIsLive(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchPlayers();

    // Cleanup caso o componente seja desmontado antes de carregar
    return () => { isMounted = false; };
  }, [wantsLive]);

  // Configurações em tempo real (tier_mode, cortes de tier, etc.)
  const { settings } = useForjaSettings();

  // Tier e rank são sempre computados no cliente — nunca lidos do Firestore
  // Passa settings para respeitar tier_mode e tamanhos configurados
  const rankedPlayers = useMemo(
    () => computeRankedPlayers(rawPlayers, settings ?? undefined),
    [rawPlayers, settings]
  );
  const bannedPlayers = useMemo(() => rawPlayers.filter(p => p.status === 'banned'), [rawPlayers]);

  return { rankedPlayers, bannedPlayers, rawPlayers, loading, error, isLive };
}