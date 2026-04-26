import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Standard Firestore initialization
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

console.log("[Firebase] Initialized with Database ID:", firebaseConfig.firestoreDatabaseId || "(default)");
console.log("[Firebase] Project ID:", firebaseConfig.projectId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  databaseId: string;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    databaseId: (db as any)._databaseId?.database || '(default)',
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    const path = 'test/connection';
    console.log("Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId || "(default)");
    // Use getDocFromServer to bypass local cache and force a network round-trip
    const docRef = doc(db, 'test', 'connection');
    await getDocFromServer(docRef);
    console.log("Firestore connection test successful");
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error("App-level connection test fail:", errorDetails);
    
    if (errorDetails.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.GET, 'test/connection');
    }
  }
}

// Small delay to ensure initialization is complete
setTimeout(testConnection, 500);
