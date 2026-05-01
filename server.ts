import express, { Request, Response } from 'express';
// REMOVIDO: import { createServer as createViteServer } from 'vite'; <--- Isso causava o erro
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  Firestore,
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

// Identifica produção ou Cloud Run
const isProd = process.env.NODE_ENV === 'production' || !!process.env.CLOUD_RUN_JOB;
const isDev = !isProd;

async function startServer() {
  const app = express();
  
  // Porta 8080 é obrigatória para o Cloud Run
  const PORT = process.env.PORT || 8080;

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', mode: isProd ? 'production' : 'development' });
  });

  let db: Firestore | null = null;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appFirebase = initializeApp(firebaseConfig);
      db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
      console.log('[Firebase] Initialized with database:', firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn('[Firebase] Config file not found at:', configPath);
    }
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }

  // Lógica de Limpeza (Mantida conforme seu código original)
  async function performCleanup() {
    if (!db || isDev) return;
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
    const batch = writeBatch(db);
    const indexRef = doc(db, 'metadata', 'lobby_index');
    let deleteCount = 0;
    
    try {
      const q = query(
        collection(db, 'lobbies'),
        where('isPermanent', '==', false),
        where('createdAt', '<', twelveHoursAgo)
      );
      const lobbiesSnap = await getDocs(q);
      lobbiesSnap.forEach((d) => {
        const lobby = d.data();
        if (lobby.status === 'finished' || lobby.phase === 'finished') return;
        batch.delete(d.ref);
        batch.update(indexRef, { [d.id]: deleteField() });
        deleteCount++;
      });
      if (deleteCount > 0) await batch.commit();
    } catch (error) {
      console.error('[Cleanup] Error:', error);
    }
  }

  if (db && !isDev) {
    setInterval(performCleanup, 12 * 60 * 60 * 1000);
  }

  // Roteamento Inteligente
  if (isProd) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build files not found. Run npm run build first.');
      }
    });
  } else {
    // IMPORT DINÂMICO: O Node só vai tentar ler o 'vite' se for modo dev
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Mythos Draft v1.0.3 online on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Server failed to start:', err);
  process.exit(1);
});