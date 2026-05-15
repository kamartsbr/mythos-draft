import { useState, useEffect, useCallback, useRef } from 'react';
import { lobbyService, PUBLIC_LOBBIES_PAGE_SIZE } from '../services/lobbyService';
import { Lobby, LobbyConfig, LobbySummary } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Manages lobby state, presence, authentication-derived identity, admin status, and lobby actions for the UI.
 *
 * Exposes reactive state and action helpers for joining, creating, leaving, and administrating a lobby, plus automatic presence updates, Discord webhook triggers, and public-lobbies fetching.
 *
 * @param initialNickname - Initial display name to use for the current guest
 * @returns An object with current lobby state, identity, status flags, control actions, and utility setters:
 * - `lobby` — current lobby data or `null`
 * - `lobbyId` — active lobby identifier or `null`
 * - `setLobbyId` — setter for `lobbyId`
 * - `guestId` — guest identifier (from localStorage or auth) or `null`
 * - `nickname` — current display name
 * - `setNickname` — setter for `nickname`
 * - `isCaptain1`, `isCaptain2` — booleans indicating captain slots
 * - `isSpectator` — boolean indicating spectator role
 * - `setIsSpectator` — setter for `isSpectator`
 * - `isAdmin` — boolean admin flag
 * - `authenticateAdmin(token)` — grants admin when `token` matches the admin token
 * - `logoutAdmin()` — revokes admin status
 * - `publicLobbies` — list of fetched public lobby summaries
 * - `error`, `setError` — current error message and setter
 * - `loading` — boolean operation-in-progress flag
 * - `join(id, role, preferredPosition, playerNames, newNickname?)` — join a lobby
 * - `soloJoin(id, newNickname?)` — join a lobby as a solo player
 * - `create(id, newLobby)` — create a lobby
 * - `leave()` — leave the current lobby locally (clears URL param)
 * - `leaveSlot()` — leave the occupied captain slot and locally leave
 * - `forceReset()`, `resetCurrentGame()`, `forceFinish()`, `forceUnpause()`, `forceStartDraft()` — admin management actions
 * - `isAuthReady` — whether initial auth state has been resolved
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
          if (!storedId) {
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
  const [lobbyInitialLoading, setLobbyInitialLoading] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [isCaptain1, setIsCaptain1] = useState(false);
  const [isCaptain2, setIsCaptain2] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<LobbySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastStateRef = useRef<string>('');

  // Discord Trigger
  useEffect(() => {
    if (!lobby || !lobby.discordWebhookUrl) return;

    // Only allow Captain A or Admin to trigger webhook updates to prevent multiple calls
    if (!isCaptain1 && !isAdmin) return;

    // Generate a unique fingerprint of the state that matters for Discord
    const fingerprint = `${lobby.phase}-${lobby.turn}-${lobby.status}-${lobby.scoreA}-${lobby.scoreB}-${lobby.selectedMap}-${lobby.currentGame}`;
    
    if (fingerprint !== lastStateRef.current) {
      lastStateRef.current = fingerprint;
      import('../services/discordService').then(({ discordService }) => {
        discordService.updateLobbyWebhook(lobby);
      });
    }
  }, [lobby, isCaptain1, isAdmin]);

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
      const token = url.searchParams.get('admin');
      if (token === 'mythosadmin2026@') {
        sessionStorage.setItem('isAdmin', 'true');
        setIsAdmin(true);
      }
      url.searchParams.delete('admin');
      urlChanged = true;
    }
    
    if (urlChanged) {
      window.history.replaceState({}, '', url.toString());
    }
  }, [isAuthReady, guestId, auth.currentUser?.email]);

  const authenticateAdmin = useCallback((token: string) => {
    if (token === 'mythosadmin2026@') {
      sessionStorage.setItem('isAdmin', 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
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

  // Subscriptions ---
  // Public lobbies fetch (only when no lobbyId)
  useEffect(() => {
    if (lobbyId) return;

    let isMounted = true;
    lobbyService.getPublicLobbiesOnce()
      .then((lobbies) => {
        if (isMounted) {
          setPublicLobbies(Array.isArray(lobbies) ? lobbies.slice(0, PUBLIC_LOBBIES_PAGE_SIZE) : []);
        }
      })
      .catch(err => console.error("Erro ao buscar lobbies públicos:", err));

    return () => { isMounted = false; };
  }, [lobbyId]);

  // Lobby subscription (only when lobbyId exists)
  useEffect(() => {
    if (!lobbyId || !guestId) return;

    setPublicLobbies([]);

    const unsub = lobbyService.subscribeToLobby(
      lobbyId,
      (data) => {
        setLobbyInitialLoading(false);
        setLobby(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });

        const isC1 = data.captain1 === guestId;
        const isC2 = data.captain2 === guestId;

        setIsCaptain1(isC1);
        setIsCaptain2(isC2);

        const slotAvailable = !data.captain1 || !data.captain2;
        const isFull = !!(data.captain1 && data.captain2);
        const isFinished = data.status === 'finished';

        const shouldBeSpectator = !isC1 && !isC2 && !slotAvailable && (isFull || isFinished);

        setIsSpectator(shouldBeSpectator);
      },
      (err) => {
        setLobbyInitialLoading(false);
        setError("Erro no Lobby: " + err.message);
      }
    );

    return unsub;
  }, [lobbyId, guestId]);

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
    try {
      await lobbyService.createLobby(id, newLobby);
      setLobbyId(id);
      window.history.pushState({}, '', `?lobby=${id}`);
    } catch (err: any) {
      setError("Create failed: " + err.message);
    }
    setLoading(false);
  }, []);

  const leave = useCallback(() => {
    setLobbyId(null);
    setLobby(null);
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
    forceUnpause,
    forceStartDraft,
    isAuthReady,
    lobbyInitialLoading
  };
}