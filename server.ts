import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
// Adicionado doc, updateDoc e deleteField para limpar o index
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
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
    console.log('[Cleanup] Starting automatic cleanup...');
    const now = new Date();
    
    try {
      const lobbiesSnap = await getDocs(collection(db, 'lobbies'));
      const deletePromises: Promise<void>[] = [];
      const updateIndexData: Record<string, any> = {};
      
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
          // Deleta o documento do lobby
          deletePromises.push(deleteDoc(d.ref));
          // Prepara a remoção do ID no metadata/lobby_index
          updateIndexData[d.id] = deleteField();
        }
      });
      
      // 1. Executa as deleções dos documentos
      await Promise.all(deletePromises);

      // 2. Atualiza o indexador apenas se houver o que remover
      if (Object.keys(updateIndexData).length > 0) {
        const indexRef = doc(db, 'metadata', 'lobby_index');
        await updateDoc(indexRef, updateIndexData);
      }

      console.log(`[Cleanup] Finished. Deleted: ${deletePromises.length} lobbies and updated index.`);
    } catch (error) {
      console.error('[Cleanup] Error during cleanup (Permissions or undefined data):', error);
    }
  }

  if (db) {
    // Configurado para rodar a cada 12 horas (12h * 60min * 60s * 1000ms)
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(performCleanup, TWELVE_HOURS);
    
    // Executa uma vez ao iniciar
    performCleanup();
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