// src/lib/serverTime.ts
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

let syncPromise: Promise<number> | null = null;

const SYNC_TIMEOUT_MS = 12_000;
const SERVER_TIME_CACHE_KEY = 'mythos_server_time_offset';
const SERVER_TIME_CACHE_TTL_MS = 5 * 60 * 1000;

type ServerTimeCachePayload = {
  expiresAt: number;
  offset: number;
};

function readCachedOffset(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SERVER_TIME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServerTimeCachePayload;
    if (typeof parsed.offset !== 'number' || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SERVER_TIME_CACHE_KEY);
      return null;
    }
    return parsed.offset;
  } catch {
    return null;
  }
}

function writeCachedOffset(offset: number): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ServerTimeCachePayload = {
      expiresAt: Date.now() + SERVER_TIME_CACHE_TTL_MS,
      offset,
    };
    window.sessionStorage.setItem(SERVER_TIME_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache failures
  }
}

/**
 * Obtém o offset (diferença) entre o relógio local e o do servidor.
 * Usa um Singleton para evitar múltiplas chamadas simultâneas.
 */
export async function getServerTimeOffset(): Promise<number> {
  const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
  if (IS_DEV) return 0;

  const cachedOffset = readCachedOffset();
  if (cachedOffset !== null) return cachedOffset;

  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        const userId = "time_sync_user"; // Pode ser um ID fixo ou do usuário atual
        const testDoc = doc(db, 'system', `sync_${userId}`);

        // Dispara o timestamp do servidor
        await setDoc(testDoc, { timestamp: serverTimestamp() }, { merge: true });

        return new Promise<number>((resolve) => {
          let isResolved = false;

          const timeout = setTimeout(() => {
            if (!isResolved) {
              console.warn("Timeout ao sincronizar tempo, caindo para tempo local");
              isResolved = true;
              unsub();
              resolve(0);
            }
          }, SYNC_TIMEOUT_MS);

          const unsub = onSnapshot(testDoc, (snapshot) => {
            const data = snapshot.data();
            if (data?.timestamp && !isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              unsub(); // Limpa o listener após obter o tempo
              const serverMs = data.timestamp.toMillis();
              const localMs = Date.now();
              const offset = serverMs - localMs;
              writeCachedOffset(offset);
              resolve(offset);
            }
          }, (error) => {
            if (!isResolved) {
              console.error("Erro no onSnapshot do tempo:", error);
              isResolved = true;
              clearTimeout(timeout);
              unsub();
              resolve(0);
            }
          });
        });
      } catch (error) {
        console.error("Erro ao sincronizar tempo:", error);
        syncPromise = null;
        return 0; // Fallback para tempo local se falhar
      }
    })();
  }
  const offset = await syncPromise;
  syncPromise = null;
  return offset;
}

/**
 * Retorna o tempo atualizado baseado no servidor.
 */
export async function getServerTime(): Promise<number> {
  const offset = await getServerTimeOffset();
  return Date.now() + offset;
}
