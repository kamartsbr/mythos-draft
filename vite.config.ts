import express, { Request, Response } from 'express';
// Removi o import estático do Vite do topo
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

// Identifica se estamos em ambiente de produção no Google
const isProd = process.env.NODE_ENV === 'production' || !!process.env.CLOUD_RUN_JOB;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', production: isProd });
  });

  // --- Trecho do Firebase (mantido) ---
  let db: Firestore | null = null;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const appFirebase = initializeApp(firebaseConfig);
      db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
      console.log('[Firebase] Initialized with database:', firebaseConfig.firestoreDatabaseId);
    }
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }

  // --- Lógica de Produção vs Desenvolvimento ---
  if (isProd) {
    console.log('[Server] Running in PRODUCTION mode');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Running in DEVELOPMENT mode');
    // Importação dinâmica: O Node só vai procurar o 'vite' se entrar aqui
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