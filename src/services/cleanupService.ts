import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Lobby } from '../types';

export const cleanupService = {
  async performCleanup() {
    const now = new Date();
    const lobbiesSnap = await getDocs(collection(db, 'lobbies'));
    
    const deletePromises: Promise<void>[] = [];
    
    lobbiesSnap.forEach((d) => {
      const lobby = d.data() as Lobby;
      const createdAt = new Date(lobby.createdAt);
      const inactivityTime = now.getTime() - createdAt.getTime();
      
      if (lobby.status === 'waiting' && inactivityTime > 60 * 60 * 1000) {
        deletePromises.push(deleteDoc(d.ref));
      } else if (lobby.status === 'drafting' && lobby.currentGame > 1 && inactivityTime > 2 * 60 * 60 * 1000) {
        deletePromises.push(deleteDoc(d.ref));
      }
    });
    
    await Promise.all(deletePromises);
  }
};
