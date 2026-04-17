import { db } from '../firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

let offset = 0;

export async function syncServerTime() {
  try {
    const testDoc = doc(db, 'system', 'time_sync');
    
    // Set a document with server timestamp to calculate offset
    await setDoc(testDoc, { timestamp: serverTimestamp() }, { merge: true });
    
    return new Promise<void>((resolve) => {
      const unsub = onSnapshot(testDoc, (snapshot) => {
        const data = snapshot.data();
        if (data?.timestamp) {
          const serverTime = data.timestamp.toMillis();
          const localTime = Date.now();
          offset = serverTime - localTime;
          unsub();
          resolve();
        }
      }, (error) => {
        console.error("Server time sync snapshot failed:", error);
        unsub();
        resolve(); // Resolve anyway to avoid blocking the app
      });
    });
  } catch (error) {
    console.error("Server time sync failed:", error);
  }
}

export function getServerTime() {
  return Date.now() + offset;
}
