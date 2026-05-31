import { useState, useEffect, useCallback, useRef } from 'react';
import { lobbyService, PUBLIC_LOBBIES_PAGE_SIZE } from '../services/lobbyService';
import { Lobby, LobbyConfig, LobbySummary } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Manage UI-facing lobby state, guest identity, presence, admin status, and lobby actions.
 *
 * Exposes reactive state (current lobby, lobbyId, guestId, nickname, role flags, public lobbies, error/loading, auth readiness, and lobbyInitialLoading), admin helpers, presence handling, Discord webhook updates, and action helpers for joining, creating, leaving, and administrating a lobby.
 *
 * @param initialNickname - Initial display name to use for the current guest
 * @returns An object containing the current lobby/identity state, role and admin flags, public lobby list, error/loading state, readiness flags, and action helpers for join/soloJoin/create/leave/leaveSlot and admin operations (forceReset, resetCurrentGame, forceFinish, forceUnpause, forceStartDraft), plus utility setters (setLobbyId, setNickname, setIsSpectator, setError)
 */
export function useLobby(initialNickname: string) {
  const [guestId, setGuestId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mythos_guest_id');
    } catch (e) {
      return null;
    }
  });
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        try {
          const storedId = localStorage.getItem('mythos_guest_id');
          // Always update guestId to the current Firebase user UID.
          // This fixes the stale anonymous UID problem when a Forja player
          // signs in via signInWithCustomToken (Discord OAuth).
          if (!storedId || storedId !== user.uid) {
            setGuestId(user.uid);
            localStorage.setItem('mythos_guest_id', user.uid);
          } else {
            setGuestId(storedId);
          }
        } catch (e) {
          setGuestId(user.uid);
        }
      }
      setIsAuthReady(true);
    });
  }, []);

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [lobbyInitialLoading, setLobbyInitialLoading] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let id = params.get('lobby');
      if (!id && window.location.pathname.startsWith('/lobby/')) {
        id = window.location.pathname.split('/')[2];
      }
      return !!id;
    } catch (e) {
      return false;
    }
  });
  const [hasAttemptedLobbyLoad, setHasAttemptedLobbyLoad] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [isCaptain1, setIsCaptain1] = useState(false);
  const [isCaptain2, setIsCaptain2] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<LobbySummary[]>([]);
  const [lobbyListLoading, setLobbyListLoading] = useState(false);
  const [lobbyListFetched, setLobbyListFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastStateRef = useRef<string>('');

  // Admin check
  useEffect(() => {
    if (!isAuthReady) return;
    
    // Check sessionStorage first
    const storedAdminObj = sessionStorage.getItem('isAdmin');
    const isStoredAdmin = storedAdminObj === 'true';

    // Support standard ?admin=, hash #admin=, and even malformed &admin=
    // only to auto-login old links if needed, but the prompt is to remove reliance on URL
    // Actually the prompt says "não exiba o token na URL" implying we just don't have to keep it in the URL,
    // but reading it if it's there temporarily is fine. Let's strictly rely on sessionStorage and email.
    const isGlobalAdmin = isStoredAdmin || 
                          auth.currentUser?.email === 'goldpentakill@gmail.com';
    setIsAdmin(isGlobalAdmin);

    // If there is an admin token in the URL, remove it so it's not displayed
    const url = new URL(window.location.href);
    let urlChanged = false;
    
    // Clean up ?admin=
    if (url.searchParams.has('admin')) {
      url.searchParams.delete('admin');
      urlChanged = true;
    }
    
    if (urlChanged) {
      window.history.replaceState({}, '', url.toString());
    }
  }, [isAuthReady, guestId, auth.currentUser?.email]);

  const authenticateAdmin = useCallback(async (password: string) => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const authAdminPass = httpsCallable<{ password: string }, { success: boolean }>(functions, 'authenticateadminpass');
      await authAdminPass({ password });
      
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      
      sessionStorage.setItem('isAdmin', 'true');
      setIsAdmin(true);
      return true;
    } catch (e) {
      console.error('Admin auth failed:', e);
      return false;
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    sessionStorage.removeItem('isAdmin');
    setIsAdmin(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('lobby');
    
    // Support path-based ID: /lobby/hk4ltxt
    if (!id && window.location.pathname.startsWith('/lobby/')) {
      id = window.location.pathname.split('/')[2];
    }
    
    if (id) {
      setLobbyId(id);
      setLobbyInitialLoading(true);
    }
  }, []);

  // Presence update
  const isCaptain1Ref = useRef(isCaptain1);
  const isCaptain2Ref = useRef(isCaptain2);
  
  useEffect(() => {
    isCaptain1Ref.current = isCaptain1;
    isCaptain2Ref.current = isCaptain2;
  }, [isCaptain1, isCaptain2]);

  const updatePresence = useCallback((active: boolean) => {
    if (!lobbyId || !guestId) return;
    if (isCaptain1Ref.current) lobbyService.updatePresence(lobbyId, 'A', active);
    if (isCaptain2Ref.current) lobbyService.updatePresence(lobbyId, 'B', active);
  }, [lobbyId, guestId]);

  useEffect(() => {
    if (!lobbyId || !guestId) return;
    
    // Only call once on mount or when guestId/lobbyId changes
    updatePresence(true);
    
    const handleUnload = () => updatePresence(false);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence(false);
    };
  }, [lobbyId, guestId, updatePresence]);

  // On-demand public lobbies fetch
  const fetchPublicLobbies = useCallback(async () => {
    if (lobbyId) return;
    setLobbyListLoading(true);
    try {
      const lobbies = await lobbyService.getPublicLobbiesOnce();
      setPublicLobbies(Array.isArray(lobbies) ? lobbies.slice(0, PUBLIC_LOBBIES_PAGE_SIZE) : []);
      setLobbyListFetched(true);
    } catch (err) {
      console.error("Erro ao buscar lobbies públicos:", err);
    } finally {
      setLobbyListLoading(false);
    }
  }, [lobbyId]);

  // Lobby subscription (only when lobbyId exists)
  useEffect(() => {
    if (!lobbyId) {
      setLobbyInitialLoading(false);
      setHasAttemptedLobbyLoad(false);
      return;
    }
    if (!isAuthReady || !guestId) {
      setLobbyInitialLoading(true);
      setHasAttemptedLobbyLoad(false);
      return;
    }

    setPublicLobbies([]);
    setLobbyInitialLoading(true);
    setHasAttemptedLobbyLoad(false);

    let active = true;

    const unsub = lobbyService.subscribeToLobby(
      lobbyId,
      (data) => {
        if (!active) return;
        setLobby(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
        setHasAttemptedLobbyLoad(true);
        setLobbyInitialLoading(false);

        if (data) {
          const isC1 = data.captain1 === guestId;
          const isC2 = data.captain2 === guestId;

          setIsCaptain1(isC1);
          setIsCaptain2(isC2);

          const slotAvailable = !data.captain1 || !data.captain2;
          const isFull = !!(data.captain1 && data.captain2);
          const isFinished = data.status === 'finished';

          const isExplicitlySpectator = (Array.isArray(data.spectators) ? data.spectators : Object.values(data.spectators || {})).some((s: any) => s.id === guestId);

          const shouldBeSpectator = isExplicitlySpectator || (!isC1 && !isC2 && !slotAvailable && (isFull || isFinished));

          setIsSpectator(shouldBeSpectator);
        }
      },
      (err) => {
        if (!active) return;
        setLobby(null);
        setHasAttemptedLobbyLoad(true);
        setLobbyInitialLoading(false);
        setError("Erro no Lobby: " + err.message);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [lobbyId, guestId, isAuthReady]);

  const join = useCallback(async (id: string, role: 'A' | 'B' | 'SPECTATOR', preferredPosition: number, playerNames: Record<number, string>, newNickname?: string) => {
    const finalNickname = newNickname || nickname;
    if (newNickname) {
      setNickname(newNickname);
      localStorage.setItem('mythos_nickname', newNickname);
    }
    setLoading(true);
    const result = await lobbyService.joinLobby(id, guestId!, finalNickname, role, preferredPosition as any, playerNames);
    if (!result.success) {
      setError(result.error || "Join failed");
    } else {
      setLobbyId(id);
      window.history.pushState({}, '', `?lobby=${id}`);
    }
    setLoading(false);
  }, [guestId, nickname]);

  const soloJoin = useCallback(async (id: string, newNickname?: string) => {
    const finalNickname = newNickname || nickname;
    if (newNickname) {
      setNickname(newNickname);
      localStorage.setItem('mythos_nickname', newNickname);
    }
    setLoading(true);
    const result = await lobbyService.soloJoin(id, guestId!, finalNickname);
    if (!result.success) {
      setError(result.error || "Solo join failed");
    } else {
      setLobbyId(id);
      window.history.pushState({}, '', `?lobby=${id}`);
    }
    setLoading(false);
  }, [guestId, nickname]);

  const create = useCallback(async (id: string, newLobby: Lobby) => {
    setLoading(true);
    setLobbyInitialLoading(true);
    setHasAttemptedLobbyLoad(false);
    setLobby(newLobby);
    try {
      await lobbyService.createLobby(id, newLobby);
      setLobbyId(id);
      window.history.pushState({}, '', `?lobby=${id}`);
    } catch (err: any) {
      setError("Create failed: " + err.message);
      setLobbyInitialLoading(false);
      setLobby(null);
    }
    setLoading(false);
  }, []);

  const leave = useCallback(() => {
    setLobbyId(null);
    setLobby(null);
    setLobbyInitialLoading(false);
    setHasAttemptedLobbyLoad(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('lobby');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  const forceReset = useCallback(async () => {
    if (!lobbyId) return;
    await lobbyService.forceReset(lobbyId);
  }, [lobbyId]);

  const resetCurrentGame = useCallback(async () => {
    if (!lobbyId) return;
    await lobbyService.resetCurrentGame(lobbyId);
  }, [lobbyId]);

  const forceFinish = useCallback(async () => {
    if (!lobbyId) return;
    await lobbyService.forceFinish(lobbyId);
  }, [lobbyId]);

  const forceWO = useCallback(async (winner: 'A' | 'B', fillMaxScore: boolean = false) => {
    if (!lobbyId) return;
    await lobbyService.forceWO(lobbyId, winner, fillMaxScore);
  }, [lobbyId]);

  const forceUnpause = useCallback(async () => {
    if (!lobbyId) return;
    await lobbyService.forceUnpause(lobbyId);
  }, [lobbyId]);

  const forceStartDraft = useCallback(async () => {
    if (!lobbyId) return;
    await lobbyService.forceStartDraft(lobbyId);
  }, [lobbyId]);

  const leaveSlot = useCallback(async () => {
    if (!lobbyId) return;
    const team = isCaptain1 ? 'A' : 'B';
    await lobbyService.leaveSlot(lobbyId, team);
    leave(); // Also leave locally
  }, [lobbyId, isCaptain1, leave]);

  return {
    lobby,
    lobbyId,
    setLobbyId,
    guestId,
    nickname,
    setNickname,
    isCaptain1,
    isCaptain2,
    isSpectator,
    setIsSpectator,
    isAdmin,
    authenticateAdmin,
    logoutAdmin,
    publicLobbies,
    fetchPublicLobbies,
    lobbyListLoading,
    lobbyListFetched,
    error,
    setError,
    loading,
    join,
    soloJoin,
    create,
    leave,
    leaveSlot,
    forceReset,
    resetCurrentGame,
    forceFinish,
    forceWO,
    forceUnpause,
    forceStartDraft,
    isAuthReady,
    lobbyInitialLoading,
    hasAttemptedLobbyLoad
  };
}