import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
// Adicionado writeBatch para garantir que ou deleta tudo (doc + index) ou nada
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteField, 
  writeBatch 
} from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  let db: any;
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appFirebase = initializeApp(firebaseConfig);
      // Recomendação: Usar a ID da config para evitar redundância
      db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
      console.log('[Firebase] Initialized successfully with database:', firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn('[Firebase] Config file not found, skipping background tasks');
    }
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }

  async function performCleanup() {
    if (!db) return;
    console.log('[Cleanup] Starting atomic cleanup...');
    const now = new Date();
    const batch = writeBatch(db); // Inicializa o batch atômico
    const indexRef = doc(db, 'metadata', 'lobby_index');
    let deleteCount = 0;
    
    try {
      const lobbiesSnap = await getDocs(collection(db, 'lobbies'));
      
      lobbiesSnap.forEach((d) => {
        const lobby = d.data();
        if (!lobby.createdAt) return;

        const lastActivity = lobby.lastActivityAt || lobby.createdAt;
        if (!lastActivity) return;
        
        const activityDate = (lastActivity.toDate ? lastActivity.toDate() : new Date(lastActivity));
        const inactivityTime = now.getTime() - activityDate.getTime();
        
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        const twelveHours = 12 * 60 * 60 * 1000;
        const isFinished = lobby.status === 'finished' || lobby.phase === 'finished';

        // REGRA: Nunca deletar rascunhos finalizados
        if (isFinished) return;

        let shouldDelete = false;

        if (lobby.isPermanent) {
          if (inactivityTime > fourteenDays) {
            shouldDelete = true;
          }
        } else if (inactivityTime > twelveHours) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          // 1. Agenda a deleção do documento do lobby no batch
          batch.delete(d.ref);
          // 2. Agenda a remoção do campo no indexador no mesmo batch
          batch.update(indexRef, {
            [d.id]: deleteField()
          });
          deleteCount++;
        }
      });
      
      // Executa todas as operações agendadas de uma vez só
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[Cleanup] Finished. Atomically deleted: ${deleteCount} lobbies and updated index.`);
      } else {
        console.log('[Cleanup] No inactive lobbies found.');
      }

    } catch (error) {
      // Agora o erro captura falhas em qualquer parte do processo atômico
      console.error('[Cleanup] Error during atomic cleanup:', error);
    }
  }

  if (db) {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(performCleanup, TWELVE_HOURS);
    
    // Pequeno delay para garantir que o app está pronto
    setTimeout(performCleanup, 5000);
  }

  // Configuração do Vite / Estáticos
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});