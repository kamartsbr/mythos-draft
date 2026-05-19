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

/** Lê o CODE do OAuth do fragment hash ou query string */
function parseAuthCode(): string | null {
  // O Discord redireciona com ?code=xxx
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../../firebase';

/** 
 * Chama a Cloud Function para validar o code e obter o Custom Token do Firebase.
 * O fluxo agora é centralizado no Firebase Auth.
 */
async function authenticateDiscordWithFirebase(code: string): Promise<ForjaDiscordUser | null> {
  try {
    const functions = getFunctions();
    const verifyFn = httpsCallable<{ code: string; redirectUri: string }, { customToken: string; discordUser: any }>(
      functions, 
      'verifydiscordtoken'
    );
    
    const result = await verifyFn({ code, redirectUri: getRedirectUri() });
    const { customToken, discordUser } = result.data;

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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDiscordUser(null);
  }, []);

  const isAdmin =
    // 1. Role do Firestore (fonte de verdade principal)
    firestoreRole === 'admin' ||
    // 2. Fallback: IDs hardcoded e .env (funcionam mesmo sem registro)
    (discordUser ? isForjaAdmin(discordUser.discord_id) : false);

  // ─── BYPASS LOCAL (MOCK) ──────────────────────────────────────────────────
  // ⚠️ TODO: COMENTAR/REMOVER ANTES DO DEPLOY PARA PRODUÇÃO
  const MOCK_AUTH = {
    discordUser: {
      discord_id: "123456789", // Alterar aqui para testar o lock do capitão (ex: ID salvo no config do lobby)
      username: "Admin Local",
      discriminator: "0000",
      avatar_url: "",
      access_token: "mock_token"
    },
    isAdmin: true, // Alterar para false quando for testar a visão de jogador/capitão
    isLoading: false,
    loginWithDiscord: () => console.log("Login mockado"),
    logout: () => console.log("Logout mockado"),
  };

  return MOCK_AUTH;

  // Código Original (Comentado para Reversão Fácil):
  /*
  return { discordUser, isAdmin, isLoading, loginWithDiscord, logout };
  */
}
