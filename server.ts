import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteField, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identifica se estamos em ambiente de desenvolvimento (AI Studio / Local)
const isDev = process.env.VITE_VIBE_MODE === 'DEVELOPMENT';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: isDev ? 'development' : 'production' });
  });

  let db: any;
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appFirebase = initializeApp(firebaseConfig);
      db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
      console.log('[Firebase] Initialized successfully with database:', firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn('[Firebase] Config file not found, skipping background tasks');
    }
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }

  async function performCleanup() {
    // 🛡️ TRAVA DE SEGURANÇA: Se for dev ou não houver DB, não faz nada.
    if (!db || isDev) {
      if (isDev) console.log('[Cleanup] Skipped: Development mode active.');
      return;
    }

    console.log('[Cleanup] Starting optimized atomic cleanup...');
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
    
    const batch = writeBatch(db);
    const indexRef = doc(db, 'metadata', 'lobby_index');
    let deleteCount = 0;
    
    try {
      // 🎯 OTIMIZAÇÃO: Filtramos no servidor do Firebase o que deve ser lido.
      // Isso impede que leiamos 1000 documentos para deletar apenas 2.
      const q = query(
        collection(db, 'lobbies'),
        where('isPermanent', '==', false),
        where('createdAt', '<', twelveHoursAgo)
      );

      const lobbiesSnap = await getDocs(q);
      
      lobbiesSnap.forEach((d) => {
        const lobby = d.data();
        const isFinished = lobby.status === 'finished' || lobby.phase === 'finished';

        // Regra de negócio: Mantemos rascunhos finalizados
        if (isFinished) return;

        // Agenda deleção atômica
        batch.delete(d.ref);
        batch.update(indexRef, {
          [d.id]: deleteField()
        });
        deleteCount++;
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[Cleanup] Finished. Atomically deleted: ${deleteCount} lobbies.`);
      } else {
        console.log('[Cleanup] No inactive lobbies to remove.');
      }

    } catch (error) {
      console.error('[Cleanup] Error during atomic cleanup:', error);
    }
  }

  if (db) {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    
    // Agenda a limpeza periódica para instâncias de longa duração
    setInterval(performCleanup, TWELVE_HOURS);
    
    // 🚀 MUDANÇA CRÍTICA: Removido o setTimeout que rodava no boot.
    // Agora o cleanup só roda via intervalo se o servidor ficar online por muito tempo.
    if (isDev) {
      console.log('[Firebase] Mode: DEVELOPMENT. Cleanup is disabled to save reads.');
    }
  }

  // Configuração do Vite / Arquivos Estáticos
  if (process.env.NODE_ENV !== 'production' && !process.env.CLOUD_RUN_JOB) {
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
    console.log(`Server running on port ${PORT} | Mode: ${isDev ? 'DEV' : 'PROD'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});