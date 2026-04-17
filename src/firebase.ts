
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // Adicionamos isso

const firebaseConfig = process.env.VITE_FIREBASE_CONFIG 
  ? JSON.parse(process.env.VITE_FIREBASE_CONFIG) 
  : {
      apiKey: "SUA_API_KEY_AQUI", // O GitHub Actions usará o segredo que salvamos
      authDomain: "boxwood-plating-368522.firebaseapp.com",
      projectId: "boxwood-plating-368522",
      storageBucket: "boxwood-plating-368522.firebasestorage.app",
      messagingSenderId: "587425164802",
      appId: "1:587425164802:web:7f6d89556855909095698b"
    };

const app = initializeApp(firebaseConfig);

// Exportamos o db e o auth para os outros arquivos usarem
export const db = getFirestore(app);
export const auth = getAuth(app); 
