import { useState, useEffect, useCallback, useRef } from 'react';
import { lobbyService } from '../services/lobbyService';
import { Lobby } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
  const [nickname, setNickname] = useState(initialNickname);
  const [isCaptain1, setIsCaptain1] = useState(false);
  const [isCaptain2, setIsCaptain2] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<Lobby[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin check
  useEffect(() => {
    if (!isAuthReady) return;
    const params = new URLSearchParams(window.location.search);
    const adminKey = params.get('admin');
    const isGlobalAdmin = adminKey === 'MYTHOS_ADMIN_2026' || 
                          auth.currentUser?.email === 'goldpentakill@gmail.com';
    setIsAdmin(isGlobalAdmin);
  }, [isAuthReady, guestId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('lobby');
    if (id) setLobbyId(id);
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
    
    updatePresence(true);
    
    const handleUnload = () => updatePresence(false);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence(false);
    };
  }, [lobbyId, guestId, updatePresence]);

  // --- SEÇÃO OTIMIZADA PARA ECONOMIA DE LEITURAS ---
  useEffect(() => {
    // Se não houver lobby selecionado, ouve a lista pública (limitada)
    if (!lobbyId) {
      const unsub = lobbyService.subscribeToPublicLobbies((lobbies) => {
        // Reduzido de 500 para 10 para evitar cobranças massivas
        setPublicLobbies(lobbies.slice(0, 10));
      });
      return unsub;
    }

    // Se estiver em um lobby, ouve APENAS esse lobby
    const unsub = lobbyService.subscribeToLobby(
      lobbyId, 
      (data) => {
        if (!data) return; // Segurança caso o lobby seja deletado
        setLobby(data);
        
        const isC1 = data.captain1 === guestId;
        const isC2 = data.captain2 === guestId;
        const isFull = !!(data.captain1 && data.captain2);
        const isFinished = data.status === 'finished';
        const isInProgress = data.status !== 'waiting' && data.status !== 'INCOMPLETE';
        
        const lastActivity = data.lastActivityAt?.toMillis?.() || data.createdAt?.toMillis?.() || Date.now();
        const isActive = (Date.now() - lastActivity) < 7200000;

        const shouldBeSpectator = !isC1 && !isC2 && (isFull || isFinished || (isInProgress && isActive));

        setIsCaptain1(isC1);
        setIsCaptain2(isC2);
        setIsSpectator(shouldBeSpectator || !!data.spectators?.some(s => s.id === guestId));
      },
      (err) => setError("Lobby error: " + err.message)
    );

    return unsub;
  }, [lobbyId, guestId]); 
  // ------------------------------------------------

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
    window.history.pushState({}, '', '/');
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

  const leaveSlot = useCallback(async () => {
    if (!lobbyId) return;
    const team = isCaptain1 ? 'A' : 'B';
    await lobbyService.leaveSlot(lobbyId, team);
    leave();
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
    isAuthReady
  };
}
