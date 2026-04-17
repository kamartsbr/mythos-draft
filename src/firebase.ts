import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Aqui ele vai tentar pegar a chave do GitHub, se não achar, usa um plano B vazio
const firebaseConfig = process.env.VITE_FIREBASE_CONFIG 
  ? JSON.parse(process.env.VITE_FIREBASE_CONFIG) 
  : {
      apiKey: "FALTA_CHAVE",
      authDomain: "boxwood-plating-368522.firebaseapp.com",
      projectId: "boxwood-plating-368522",
      storageBucket: "boxwood-plating-368522.firebasestorage.app",
      messagingSenderId: "587425164802",
      appId: "1:587425164802:web:7f6d89556855909095698b"
    };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
