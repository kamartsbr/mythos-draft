import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

console.log("[Firebase] Initialized with Database ID:", firebaseConfig.firestoreDatabaseId);
console.log("[Firebase] Project ID:", firebaseConfig.projectId);

// Test connection
async function testConnection() {
  try {
    console.log("Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId);
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful");
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error("Firestore connection test failed:", errorDetails);
    
    // Provide more specific feedback for "Missing or insufficient permissions"
    if (errorDetails.includes('Missing or insufficient permissions')) {
      console.error("DEBUG: Requesting doc 'test/connection' was denied by security rules.");
      console.warn("Please verify that firestore.rules has 'match /test/{docId} { allow read: if true; }'");
    }

    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
