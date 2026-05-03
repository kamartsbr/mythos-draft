// src/lib/serverTime.ts
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

let syncPromise: Promise<number> | null = null;

const SYNC_TIMEOUT_MS = 12_000;

/**
 * Obtém o offset (diferença) entre o relógio local e o do servidor.
 * Usa um Singleton para evitar múltiplas chamadas simultâneas.
 */
export async function getServerTimeOffset(): Promise<number> {
  const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
  if (IS_DEV) return 0;
  
  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        const userId = "time_sync_user"; // Pode ser um ID fixo ou do usuário atual
        const testDoc = doc(db, 'system', `sync_${userId}`);
        
        // Dispara o timestamp do servidor
        await setDoc(testDoc, { timestamp: serverTimestamp() }, { merge: true });
        
        return await new Promise<number>((resolve) => {
          let settled = false;
          let unsub: (() => void) | null = null;

          const finish = (offset: number) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            try {
              unsub?.();
            } catch {
              /* noop */
            }
            resolve(offset);
          };

          const timeoutId = setTimeout(() => {
            console.warn("[serverTime] Timeout aguardando timestamp do Firestore; usando offset 0.");
            finish(0);
          }, SYNC_TIMEOUT_MS);

          unsub = onSnapshot(
            testDoc,
            (snapshot) => {
              const data = snapshot.data();
              if (data?.timestamp && typeof data.timestamp.toMillis === "function") {
                const serverMs = data.timestamp.toMillis();
                const localMs = Date.now();
                finish(serverMs - localMs);
              }
            },
            (err) => {
              console.error("Erro no listener de sincronização de tempo:", err);
              finish(0);
            }
          );
        });
      } catch (error) {
        console.error("Erro ao sincronizar tempo:", error);
        syncPromise = null;
        return 0; // Fallback para tempo local se falhar
      }
    })();
  }
  return syncPromise;
}

/**
 * Retorna o tempo atualizado baseado no servidor.
 */
export async function getServerTime(): Promise<number> {
  const offset = await getServerTimeOffset();
  return Date.now() + offset;
}