import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
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
      const updatePromises: Promise<void>[] = [];
      
      lobbiesSnap.forEach((d) => {
        const lobby = d.data();
        if (!lobby.createdAt) return;
        const updatedAt = lobby.updatedAt ? new Date(lobby.updatedAt) : new Date(lobby.createdAt);
        const inactivityTime = now.getTime() - updatedAt.getTime();
        
        // Never delete finished drafts
        if (lobby.status === 'finished' || lobby.phase === 'finished') {
          return;
        }

        // Unstarted or Incomplete Drafts: Delete after 2 hours of inactivity
        if (inactivityTime > 2 * 60 * 60 * 1000) {
          deletePromises.push(deleteDoc(d.ref));
        }
      });
      
      await Promise.all([...deletePromises, ...updatePromises]);
      console.log(`[Cleanup] Finished. Deleted: ${deletePromises.length}, Updated: ${updatePromises.length}`);
    } catch (error) {
      console.error('[Cleanup] Error during cleanup:', error);
    }
  }

  if (db) {
    // Run cleanup every 15 minutes
    setInterval(performCleanup, 15 * 60 * 1000);
    // Run once on start
    performCleanup();
  }

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
