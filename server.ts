import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
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

const isDev = process.env.VITE_VIBE_MODE === 'DEVELOPMENT';

async function startServer() {
  const app = express();
  
  // 1. AJUSTE DE PORTA: Cloud Run exige escutar na porta definida pelo sistema (geralmente 8080)
  const PORT = process.env.PORT || 8080;

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', mode: isDev ? 'development' : 'production' });
  });

  let db: Firestore | null = null;
  try {
    // 2. CAMINHO ROBUSTO: Procura o JSON na raiz do projeto independente de onde o script rode
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

  // 3. PRIORIDADE DE ROTEAMENTO: Garante que o Express encontre a pasta dist
  if (process.env.NODE_ENV === 'production' || process.env.CLOUD_RUN_JOB) {
    const distPath = path.resolve(process.cwd(), 'dist');
    
    // Serve arquivos estáticos (JS, CSS, Imagens)
    app.use(express.static(distPath));

    // Qualquer outra rota entrega o index.html (SPA mode)
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build files not found. Run npm run build first.');
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // O Cloud Run precisa que o '0.0.0.0' esteja explícito
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Mythos Draft v1.0.3 online on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Server failed to start:', err);
  process.exit(1); // Força o container a encerrar para o Cloud Run tentar reiniciar
});