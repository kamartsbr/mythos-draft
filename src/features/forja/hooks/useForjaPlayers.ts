/**
 * ============================================================
 *  useForjaPlayers — Hook de listagem em tempo real
 *  Subscrição ao Firestore com fallback para dados mockados
 *  durante desenvolvimento (VITE_VIBE_MODE === 'DEVELOPMENT').
 * ============================================================
 */

import { useState, useEffect } from 'react';
import { ForjaPlayer } from '../types';
import { subscribeToForjaPlayers } from '../services/forjaService';

// Dados mockados de fallback (dev / sem Firestore)
const MOCK_PLAYERS: ForjaPlayer[] = [
  {
    discord_id: '111111111111111111',
    aom_profile_id: 10001,
    aom_id: 'omoradin',
    nick: 'Omoradin',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    is_brazilian: true,
    pitch_quote: 'Zeus ou morte, não tem meio-termo!',
    elo_1v1: 2150, elo_tg: 1980,
    top_gods: [
      { god: 'zeus',   godName: 'Zeus',   winRate: 68, playRate: 45 },
      { god: 'hades',  godName: 'Hades',  winRate: 61, playRate: 22 },
      { god: 'thor',   godName: 'Thor',   winRate: 55, playRate: 18 },
      { god: 'ra',     godName: 'Ra',     winRate: 50, playRate: 10 },
      { god: 'kronos', godName: 'Kronos', winRate: 48, playRate: 5  },
    ],
    status: 'available', tier: 'A', team_id: null, seed: 1, registered_at: null,
    consent_rules: true, consent_format: true,
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    availability: ['weekday-eve', 'weekend-eve'],
  },
  {
    discord_id: '222222222222222222',
    aom_profile_id: 10002,
    aom_id: 'kamaRTS',
    nick: 'KamaRTS',
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
    status: 'available', tier: 'A', team_id: null, seed: 2, registered_at: null,
    consent_rules: true, consent_format: true,
    availability: ['weekend-aft', 'weekend-eve'],
  },
  {
    discord_id: '333333333333333333',
    aom_profile_id: 10003,
    aom_id: 'thunderaxe99',
    nick: 'ThunderAxe',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png',
    discord_avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png',
    is_brazilian: true,
    pitch_quote: 'Thor TG é science, não opinião.',
    elo_1v1: 1920, elo_tg: 2100,
    top_gods: [
      { god: 'thor',     godName: 'Thor',     winRate: 70, playRate: 60 },
      { god: 'odin',     godName: 'Odin',     winRate: 58, playRate: 20 },
      { god: 'poseidon', godName: 'Poseidon', winRate: 54, playRate: 10 },
      { god: 'ra',       godName: 'Ra',       winRate: 50, playRate: 7  },
      { god: 'gaia',     godName: 'Gaia',     winRate: 44, playRate: 3  },
    ],
    status: 'available', tier: 'B', team_id: null, seed: 3, registered_at: null,
    consent_rules: true, consent_format: true,
    availability: ['weekday-eve'],
  },
];

interface UseForjaPlayersResult {
  players: ForjaPlayer[];
  loading: boolean;
  error: string | null;
  isLive: boolean; // true = dados do Firestore, false = mock
}

export function useForjaPlayers(): UseForjaPlayersResult {
  const [players, setPlayers] = useState<ForjaPlayer[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState<string | null>(null);
  const [isLive,  setIsLive]   = useState(false);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';

    if (IS_DEV) {
      // Simula um delay de rede em dev
      const timer = setTimeout(() => {
        setPlayers(MOCK_PLAYERS);
        setLoading(false);
        setIsLive(false);
      }, 600);
      return () => clearTimeout(timer);
    }

    // Produção: subscrição Firestore em tempo real
    const unsub = subscribeToForjaPlayers(
      (data) => {
        setPlayers(data);
        setLoading(false);
        setIsLive(true);
        setError(null);
      },
      (err) => {
        console.error('[useForjaPlayers]', err);
        // Fallback gracioso para mock em caso de erro de permissão
        setPlayers(MOCK_PLAYERS);
        setError('Não foi possível conectar ao banco de dados. Exibindo dados de demonstração.');
        setLoading(false);
        setIsLive(false);
      }
    );

    return () => unsub();
  }, []);

  return { players, loading, error, isLive };
}
