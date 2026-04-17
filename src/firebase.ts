import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Use EXATAMENTE essa linha abaixo, sem aspas ao redor do import
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: "boxwood-plating-368522.firebaseapp.com",
  projectId: "boxwood-plating-368522",
  storageBucket: "boxwood-plating-368522.firebasestorage.app",
  messagingSenderId: "275978163951",
  appId: "1:275978163951:web:3a8370b4ddd6f47c292d1a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
