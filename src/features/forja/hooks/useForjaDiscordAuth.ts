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
  // Implicit grant → response_type=token (sem backend necessário)
  return (
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=token` +
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

/** Lê o access_token do fragment hash (ex: #access_token=xxx&token_type=Bearer) */
function parseHashToken(): string | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

/** Busca os dados do usuário na API do Discord com o access_token */
async function fetchDiscordUser(accessToken: string): Promise<ForjaDiscordUser | null> {
  try {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      discord_id:    data.id,
      username:      data.global_name ?? data.username,
      discriminator: data.discriminator ?? '0',
      avatar_url:    getAvatarUrl(data),
      access_token:  accessToken,
    };
  } catch {
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

      // 1. Verificar se há token no hash (retorno do OAuth)
      const accessToken = parseHashToken();
      if (accessToken) {
        // Limpar o hash da URL sem recarregar
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        const user = await fetchDiscordUser(accessToken);
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

  return { discordUser, isAdmin, isLoading, loginWithDiscord, logout };
}
