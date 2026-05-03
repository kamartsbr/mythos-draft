import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Inicializa o App com as configurações do JSON
const app = initializeApp(firebaseConfig);

/**
 * ATENÇÃO JOÃO ALEXANDRE: 
 * Forçamos o ID "mythosdraft-prod" 
 * pois o seu projeto não utiliza o banco de dados "(default)".
 */
export const db = getFirestore(app, "mythosdraft-prod");

export const auth = getAuth(app);

console.log("[Firebase] Initialized with Database ID: mythosdraft-prod");
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
    databaseId: "mythosdraft-prod",
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

// Teste de conexão automático
async function testConnection() {
  try {
    console.log("Testing Firestore connection to database: mythosdraft-prod");
    // Tenta ler um documento de teste para validar o acesso
    const docRef = doc(db, 'test', 'connection');
    await getDocFromServer(docRef);
    console.log("Firestore connection test successful");
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error("App-level connection test fail:", errorDetails);
    
    // Se o erro for de permissão, o índice ou as regras podem estar erradas, mas o 404 deve sumir
    if (errorDetails.includes('Missing or insufficient permissions')) {
      console.warn("Check your Firestore Rules in the Firebase Console.");
    }
  }
}

// Pequeno delay para garantir que o resto do app carregou
setTimeout(() => {
  const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
  if (IS_DEV) {
    console.log("[MOCK] Bypassing firebase.ts connection test in Development Mode");
    return;
  }
  testConnection();
}, 1000);
