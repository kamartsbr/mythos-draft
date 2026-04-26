import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

let offset = 0;

export async function syncServerTime() {
  const path = 'system/time_sync';
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
        handleFirestoreError(error, OperationType.GET, path);
        unsub();
        resolve(); // Resolve anyway to avoid blocking the app
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getServerTime() {
  return Date.now() + offset;
}
