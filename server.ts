import express from 'express'; 
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  Firestore,
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
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

function corsApiHeaders(res: express.Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function serializeFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeFirestoreValue);
  if (typeof val === 'object' && val !== null) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      o[k] = serializeFirestoreValue(v);
    }
    return o;
  }
  return val;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSharePage(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.image);
  const safeUrl = escapeHtml(meta.url);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${safeUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function injectShareMeta(html: string, meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const replacements: Array<[RegExp, string]> = [
    [/<title>.*?<\/title>/s, `<title>${escapeHtml(meta.title)}</title>`],
    [/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`],
    [/<meta property="og:description" content=".*?" \/>/s, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`],
    [/<meta property="og:image" content=".*?" \/>/s, `<meta property="og:image" content="${escapeHtml(meta.image)}" />`],
    [/<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${escapeHtml(meta.url)}" />`],
    [/<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`],
    [/<meta name="twitter:description" content=".*?" \/>/s, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`],
    [/<meta name="twitter:image" content=".*?" \/>/s, `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`],
  ];

  return replacements.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), html);
}

async function startServer() {
  const app = express();
  
  // Porta 8080 obrigatória para Google Cloud Run
  const PORT = process.env.PORT || 8080;

  // Health check simples sem tipos nomeados para evitar erro de import
  app.get('/api/health', (req, res) => {
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
    }
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }

  /**
   * Public JSON snapshot of a lobby (HUD / external tools). Does not require auth.
   * This is used by HudAoM import: GET /api/lobby/:id
   */
  app.options('/api/lobby/:lobbyId', (req, res) => {
    corsApiHeaders(res);
    res.status(204).end();
  });

  app.get('/api/lobby/:lobbyId', async (req, res) => {
    corsApiHeaders(res);
    const lobbyId = String(req.params.lobbyId ?? '');
    if (!lobbyId || !/^[a-z0-9_-]{4,64}$/i.test(lobbyId)) {
      return res.status(400).json({ ok: false, message: 'Invalid lobby id' });
    }
    if (!db) {
      return res.status(503).json({ ok: false, message: 'Database not initialized' });
    }
    try {
      const ref = doc(db, 'lobbies', lobbyId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return res.status(404).json({ ok: false, message: 'Lobby not found' });
      }
      const raw = snap.data();
      const lobby = serializeFirestoreValue(raw) as Record<string, unknown>;
      return res.json({ ok: true, lobby: { id: snap.id, ...lobby } });
    } catch (e) {
      console.error('[api/lobby] Error:', e);
      return res.status(500).json({ ok: false, message: 'Internal error' });
    }
  });

  const publicOrigin = 'https://mythosdraft.com';
  app.get(/^\/forja(?:\/.*)?$/, (_req, res, next) => {
    const meta = {
      title: 'Forja de Hefesto - Mythos Draft',
      description: 'O maior torneio 3v3 de Age of Mythology: Retold da comunidade BR/PT. Inscreva-se e forje seu legado!',
      image: `${publicOrigin}/forja-banner.jpg`,
      url: `${publicOrigin}/forja`,
    };

    if (isProd) {
      const distPath = path.resolve(process.cwd(), 'dist');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        return res.type('html').send(injectShareMeta(html, meta));
      }
    }

    if (isDev) {
      return next();
    }

    res.type('html').send(renderSharePage(meta));
  });

  // Lógica de Limpeza Periódica
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

  // ─── Função de Fetch com Exponential Backoff ───────────
  const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (response.ok) return await response.json();
      
      if (response.status === 404) {
        const err: any = new Error('Not Found');
        err.status = 404;
        throw err;
      }
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, delay * (i + 1))); // Aguarda e tenta de novo
        continue;
      }
      if (i === retries - 1) {
        const err: any = new Error(`Status ${response.status}`);
        err.status = response.status;
        throw err;
      }
    }
  };

  // ─── Forja: Consulta de Perfil na Vercel API (Cadastro) ───────────
  app.get('/api/forja/fetch-aom-profile', async (req: any, res: any) => {
    const rawId = String(req.query.id ?? '').trim();
    const profileId = parseInt(rawId, 10);

    if (!rawId) {
      return res.status(400).json({ error: 'profile_id ou nick é obrigatório' });
    }

    try {
      let statsData = null;
      let actualProfileId = profileId;
      let alias = rawId;

      // 1. Tenta buscar STATS pelo ID primeiro
      if (!isNaN(profileId) && profileId > 0) {
        try {
          const json = await fetchWithRetry(`https://form-retold.vercel.app/api/stats-by-id/${profileId}`);
          statsData = json.data || json;
          if(statsData.name) alias = statsData.name;
        } catch (err: any) {
          if (err.status !== 404) throw err;
        }
      }

      // 2. FALLBACK: Se o ID deu 404 ou se era texto, tenta pelo Nick
      if (!statsData) {
        console.log(`[Forja] Fallback ativado: Tentando buscar pelo nick: ${rawId}`);
        try {
          const json = await fetchWithRetry(`https://form-retold.vercel.app/api/stats/${encodeURIComponent(rawId)}`);
          statsData = json.data || json;
          if(statsData.profile_id) actualProfileId = parseInt(statsData.profile_id, 10);
          if(statsData.name) alias = statsData.name;
        } catch (err: any) {
          return res.status(err.status === 404 ? 404 : 502).json({
            error: err.status === 404 ? 'Perfil não encontrado na Vercel API' : `Erro na Vercel API (${err.status})`,
          });
        }
      }

      // 3. Extrair os Elos
      const stats = statsData.profileStats || [];
      const s1v1 = stats.find((s: any) => s.mode === "Sup 1v1");
      const sTG = stats.find((s: any) => s.mode === "Sup Team" || s.mode === "Team" || s.mode === "Sup TG");

      const elo_1v1 = s1v1 ? (parseInt(s1v1.elo, 10) || 0) : 0;
      const elo_tg = sTG ? (parseInt(sTG.elo, 10) || 0) : 0;

      // 4. Buscar os Deuses separados
      let top_gods = [];
      if (!isNaN(actualProfileId) && actualProfileId > 0) {
        try {
          const godsJson = await fetchWithRetry(`https://form-retold.vercel.app/api/gods/${actualProfileId}`);
          top_gods = godsJson.data || godsJson || [];
        } catch (err) {
          console.warn(`[Forja] Falha ao buscar deuses para o ID ${actualProfileId}.`);
        }
      }

      // 5. Monta a resposta final
      const response = {
        profile_id: actualProfileId,
        avatar_url: statsData.avatar_url ?? null,
        alias: alias,
        verified: true,
        elo_1v1: elo_1v1,
        elo_tg: elo_tg,
        top_gods: Array.isArray(top_gods) ? top_gods : [],
      };

      console.log(`[Forja] Cadastro Sucesso (${response.alias}): 1v1=${response.elo_1v1}, TG=${response.elo_tg}, Deuses=${response.top_gods.length}`);
      return res.json(response);

    } catch (err: any) {
      console.error('[Forja] fetch-aom-profile erro interno:', err);
      return res.status(500).json({ error: 'Erro interno ao consultar API da Vercel' });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // Roteamento de Produção vs Desenvolvimento
  if (isProd) {
    console.log('[Server] Mode: PRODUCTION');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ ok: false, message: 'Not found' });
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build files not found.');
      }
    });
  } else {
    console.log('[Server] Mode: DEVELOPMENT');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Mythos Draft online on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Server failed to start:', err);
  process.exit(1);
});
