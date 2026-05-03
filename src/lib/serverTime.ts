// src/lib/serverTime.ts
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

let syncPromise: Promise<number> | null = null;

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
        
        return new Promise<number>((resolve) => {
          let isResolved = false;
          
          const timeout = setTimeout(() => {
            if (!isResolved) {
              console.warn("Timeout ao sincronizar tempo, caindo para tempo local");
              isResolved = true;
              unsub();
              resolve(0);
            }
          }, 12000);

          const unsub = onSnapshot(testDoc, (snapshot) => {
            const data = snapshot.data();
            if (data?.timestamp && !isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              unsub(); // Limpa o listener após obter o tempo
              const serverMs = data.timestamp.toMillis();
              const localMs = Date.now();
              resolve(serverMs - localMs);
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