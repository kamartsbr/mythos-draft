/**
 * ============================================================
 *  useForjaDiscordAuth — Hook de autenticação via Discord
 *
 *  Implementa OAuth 2.0 Implicit Grant (client-side only).
 *  Fluxo:
 *    1. Usuário clica em "Login com Discord"
 *    2. Redireciona para Discord OAuth com scope=identify
 *    3. Discord redireciona de volta para /forja com access_token no hash
 *    4. Hook lê o hash, busca /api/users/@me, salva em localStorage
 *
 *  Configuração necessária em .env:
 *    VITE_DISCORD_CLIENT_ID=seu_client_id
 *  E no Discord Developer Portal:
 *    Redirect URI: https://seu-dominio.com/forja
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { ForjaDiscordUser } from '../types';
import { subscribeToForjaPlayer } from '../services/forjaService';

const STORAGE_KEY = 'forja_discord_user';
const ADMIN_DISCORD_IDS_KEY = 'VITE_FORJA_ADMIN_IDS'; // ex: "123,456"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detecta o redirect URI correto (localhost em dev, domínio real em prod) */
function getRedirectUri(): string {
  const origin = window.location.origin;
  // Em dev local sempre aponta para localhost
  return `${origin}/forja`;
}

/**
 * Constructs the Discord OAuth2 authorization URL used to start the Authorization Code flow.
 *
 * @returns The full Discord authorization URL (includes client ID, encoded redirect URI, `response_type=code`, and `scope=identify`)
 */
function buildDiscordOAuthUrl(): string {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID ?? '';
  const redirectUri = encodeURIComponent(getRedirectUri());
  const scopes = encodeURIComponent('identify');
  // Authorization Code Grant → response_type=code (mais seguro, requer backend)
  return (
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scopes}`
  );
}

function getAvatarUrl(user: { id: string; avatar: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  const defaultIdx = (parseInt(user.id) % 6).toString();
  return `https://cdn.discordapp.com/embed/avatars/${defaultIdx}.png`;
}

// IDs hardcoded como fallback de segurança (independem do .env)
const HARDCODED_ADMIN_IDS = [
  '272372054526001152', // omoradin — owner
];

/**
 * Determines whether the given Discord user ID has Forja admin privileges.
 *
 * @param discordId - The Discord user ID to check
 * @returns `true` if the ID is recognized as an admin via the hardcoded list, the `VITE_FORJA_ADMIN_IDS` environment variable, or the `mythos_admin` session flag; `false` otherwise
 */
function isForjaAdmin(discordId: string): boolean {
  // 1. Hardcoded permanente (owner sempre tem acesso)
  if (HARDCODED_ADMIN_IDS.includes(discordId)) return true;
  // 2. Admins configurados via .env
  const raw = import.meta.env.VITE_FORJA_ADMIN_IDS ?? '';
  const ids = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
  if (ids.includes(discordId)) return true;
  // 3. Admin do sistema principal (flag de sessão)
  return sessionStorage.getItem('mythos_admin') === 'true';
}

/**
 * Extracts the OAuth authorization code from the current page's URL query string.
 *
 * @returns The value of the `code` query parameter if present, `null` otherwise.
 */
function parseAuthCode(): string | null {
  // O Discord redireciona com ?code=xxx
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

import { getApp } from 'firebase/app';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../../firebase';
import firebaseConfig from '../../../../firebase-applet-config.json';

/**
 * Exchange a Discord OAuth authorization code for a Firebase Custom Token, sign in to Firebase, and return a normalized ForjaDiscordUser.
 *
 * @param code - The authorization code received from Discord after user consent.
 * @returns `ForjaDiscordUser` with `discord_id`, `username`, `discriminator`, and `avatar_url` when authentication succeeds, `null` otherwise.
 */
async function authenticateDiscordWithFirebase(code: string): Promise<ForjaDiscordUser | null> {
  try {
    const projectId = firebaseConfig.projectId || getApp().options.projectId; 
    const FUNCTIONS_URL = `https://us-central1-${projectId}.cloudfunctions.net/verifydiscordtoken`;
    
    const response = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: getRedirectUri() })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Falha na autenticação');
    }
    
    const { customToken, discordUser } = await response.json();

    // 1. Autenticar no Firebase com o Custom Token
    await signInWithCustomToken(auth, customToken);

    // 2. Retornar dados para o hook
    return {
      discord_id:    discordUser.id,
      username:      discordUser.username,
      discriminator: '0', // Discord migrou para Pomelo (sem discriminator)
      avatar_url:    getAvatarUrl(discordUser),
    };
  } catch (error) {
    console.error("Erro na autenticação Discord -> Firebase:", error);
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseForjaDiscordAuthResult {
  discordUser: ForjaDiscordUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  loginWithDiscord: () => void;
  logout: () => void;
}

/**
 * Exposes Discord authentication state and actions wired to Firebase and Firestore.
 *
 * Restores a cached session or processes an OAuth callback code to authenticate via a Firebase
 * custom token, persists the resulting Discord identity in localStorage, and subscribes to the
 * player's Firestore document to determine the authoritative role.
 *
 * @returns An object containing:
 *  - `discordUser` — the cached Discord identity (`ForjaDiscordUser`) or `null` when unauthenticated;
 *  - `isAdmin` — `true` when the user has an admin role (Firestore) or is included in configured admin lists, `false` otherwise;
 *  - `isLoading` — `true` while initialization/auth state is being resolved, `false` afterwards;
 *  - `loginWithDiscord` — function that initiates the Discord OAuth redirect;
 *  - `logout` — function that signs out from Firebase, clears the cached user, and resets state.
 */
export function useForjaDiscordAuth(): UseForjaDiscordAuthResult {
  const [discordUser, setDiscordUser] = useState<ForjaDiscordUser | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  // Role lida do Firestore (forja_players/{uid}.role)
  const [firestoreRole, setFirestoreRole] = useState<'player' | 'admin' | null>(null);

  // Ao montar: tenta restaurar sessão ou processar callback OAuth
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);

      // 1. Verificar se há CODE na URL (retorno do OAuth)
      const code = parseAuthCode();
      if (code) {
        // Limpar a URL sem recarregar
        window.history.replaceState(null, '', window.location.pathname);

        const user = await authenticateDiscordWithFirebase(code);
        if (user) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
          setDiscordUser(user);
          setIsLoading(false);
          return;
        }
      }

      // 2. Tentar restaurar sessão do localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed: ForjaDiscordUser = JSON.parse(stored);
          // O usuário já foi autenticado anteriormente.
          // Não faremos fetchDiscordUser(parsed.access_token) em todo load 
          // para evitar Rate Limit de 429 na API do Discord ("Service resources are being rate limited").
          // Como só precisamos da identidade (ID, avatar, username) para o Firestore, vamos confiar no cache.
          setDiscordUser(parsed);
          setIsLoading(false);
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Subscrição em tempo real ao documento do jogador para ler o role
  useEffect(() => {
    if (!discordUser) { setFirestoreRole(null); return; }
    const unsub = subscribeToForjaPlayer(
      discordUser.discord_id,
      (player) => setFirestoreRole(player?.role ?? null),
      () => setFirestoreRole(null)
    );
    return () => unsub();
  }, [discordUser?.discord_id]);

  const loginWithDiscord = useCallback(() => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    
    // Checa se está vazio, indefinido ou se ainda está com o texto placeholder padrão
    if (!clientId || clientId === 'SEU_CLIENT_ID_AQUI') {
      console.error("Erro de Autenticação: Client ID do Discord ausente ou inválido no ambiente.");
      
      // Se você não tiver um sistema de Toast configurado, 
      // pode deixar um alert genérico para o usuário não clicar no vazio.
      alert("Serviço de login temporariamente indisponível."); 
      return;
    }

    // Se a chave existir e for válida, executa o redirecionamento
    window.location.href = buildDiscordOAuthUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out from Firebase:', err);
    }
    localStorage.removeItem(STORAGE_KEY);
    setDiscordUser(null);
  }, []);

  const isAdmin =
    // 1. Role do Firestore (fonte de verdade principal)
    firestoreRole === 'admin' ||
    // 2. Fallback: IDs hardcoded e .env (funcionam mesmo sem registro)
    (discordUser ? isForjaAdmin(discordUser.discord_id) : false);

  return { discordUser, isAdmin, isLoading, loginWithDiscord, logout };
}
