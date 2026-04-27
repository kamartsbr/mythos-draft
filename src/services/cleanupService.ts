import { collection, getDocs, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { Lobby } from '../types';

export const cleanupService = {
  async performCleanup() {
    console.log('[CleanupService] Iniciando limpeza manual/cliente...');
    const now = new Date();
    const lobbiesSnap = await getDocs(collection(db, 'lobbies'));
    
    const deletePromises: Promise<void>[] = [];
    const updateIndexData: Record<string, any> = {};
    
    // Definição de tempos (alinhado com o servidor para não haver conflito)
    const ONE_HOUR = 60 * 60 * 1000;
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    lobbiesSnap.forEach((d) => {
      const lobby = d.data() as Lobby;
      if (!lobby.createdAt) return;

      // Usamos a última atividade ou a data de criação
      const lastActivity = lobby.lastActivityAt || lobby.createdAt;
      const activityDate = new Date(lastActivity);
      const inactivityTime = now.getTime() - activityDate.getTime();
      
      // TRAVA DE SEGURANÇA: Nunca deleta finalizados
      const isFinished = lobby.status === 'finished' || lobby.phase === 'finished';
      if (isFinished) return;

      let shouldDelete = false;

      // Lógica refinada:
      // 1. Se estiver só esperando e ninguém mexeu por 12h
      if (lobby.status === 'waiting' && inactivityTime > TWELVE_HOURS) {
        shouldDelete = true;
      } 
      // 2. Se o draft começou mas parou no meio por mais de 12h
      else if (lobby.status === 'drafting' && inactivityTime > TWELVE_HOURS) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        deletePromises.push(deleteDoc(d.ref));
        // IMPORTANTE: Marca para remover do indexador também
        updateIndexData[d.id] = deleteField();
      }
    });
    
    // Executa as deleções
    await Promise.all(deletePromises);

    // Atualiza o metadata/lobby_index para remover os fantasmas da lista
    if (Object.keys(updateIndexData).length > 0) {
      try {
        const indexRef = doc(db, 'metadata', 'lobby_index');
        await updateDoc(indexRef, updateIndexData);
      } catch (err) {
        console.error('[CleanupService] Erro ao atualizar index:', err);
      }
    }

    console.log(`[CleanupService] Limpeza concluída. Deletados: ${deletePromises.length}`);
  }
};