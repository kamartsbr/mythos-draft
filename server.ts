import express from 'express'; // Importação padrão corrigida
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

  // ─── Forja de Hefesto: ELO Snapshot ───────────────────────────────────────
  // Sábado 09/05/2026 14:00 BRT = 17:00 UTC
  const ELO_SNAPSHOT_TIME = new Date('2026-05-09T17:00:00Z').getTime();
  const ELO_SNAPSHOT_WINDOW_MS = 5 * 60 * 1000; // 5 min de janela
  let eloSnapshotDone = false;

  async function performEloSnapshot(dbInstance: any) {
    if (eloSnapshotDone) return;
    console.log('[Forja] Iniciando ELO snapshot...');
    try {
      // 1. Buscar lista de dumps disponíveis
      const dumpsRes = await fetch('https://aomstats.io/api/db_dumps', {
        headers: { Accept: 'application/json' },
      });
      if (!dumpsRes.ok) throw new Error(`db_dumps retornou ${dumpsRes.status}`);
      const dumps = await dumpsRes.json() as { filename: string; url: string; type: string }[];

      // 2. Encontrar o leaderboard mais recente
      const lbDump = dumps.find((d: any) => d.type === 'leaderboard' || d.filename?.includes('leaderboard'));
      if (!lbDump?.url) throw new Error('Dump de leaderboard não encontrado na resposta do aomstats');

      // 3. Baixar e descomprimir o CSV
      const { Readable } = await import('stream');
      const zlib = await import('zlib');
      const csvRes = await fetch(lbDump.url);
      if (!csvRes.ok) throw new Error(`Download do CSV falhou: ${csvRes.status}`);
      const buffer = Buffer.from(await csvRes.arrayBuffer());
      const csvRaw = await new Promise<string>((resolve, reject) => {
        zlib.gunzip(buffer, (err, result) => err ? reject(err) : resolve(result.toString('utf8')));
      });

      // 4. Parsear CSV
      // Schema: leaderboard_id,rank,rating,profile_id,alias,wins,losses,...
      const lines = csvRaw.split('\n').slice(1); // skip header
      const ratingByProfileId: Record<number, { rating: number; alias: string }> = {};
      for (const line of lines) {
        const cols = line.split(',');
        if (cols.length < 4) continue;
        const leaderboardId = parseInt(cols[0], 10);
        if (leaderboardId !== 1) continue; // apenas Sup 1v1
        const profileId = parseInt(cols[3], 10);
        const rating    = parseInt(cols[2], 10);
        const alias     = cols[4]?.replace(/"/g, '').trim() ?? '';
        if (!isNaN(profileId) && !isNaN(rating)) {
          ratingByProfileId[profileId] = { rating, alias };
        }
      }

      // 5. Buscar todos os jogadores inscritos
      const { getDocs: _getDocs, collection: _col, updateDoc: _upd, doc: _doc } = await import('firebase/firestore');
      const playersSnap = await _getDocs(_col(dbInstance, 'forja_players'));
      let updated = 0;
      for (const playerDoc of playersSnap.docs) {
        const player = playerDoc.data() as any;
        const profileId: number = player.aom_profile_id;
        if (!profileId) continue;
        const entry = ratingByProfileId[profileId];
        if (!entry) { console.log(`[Forja] profile_id ${profileId} não encontrado no leaderboard`); continue; }
        await _upd(_doc(dbInstance, 'forja_players', playerDoc.id), {
          elo_1v1: entry.rating,
          elo_snapshot: entry.rating,
          nick: entry.alias || player.nick, // atualiza nick se disponível
        });
        updated++;
      }

      eloSnapshotDone = true;
      console.log(`[Forja] ELO snapshot concluído! ${updated} jogadores atualizados.`);
    } catch (err) {
      console.error('[Forja] Erro no ELO snapshot:', err);
    }
  }

  // Cron: verifica a cada minuto se é hora do snapshot
  if (db && !isDev) {
    const cronInterval = setInterval(() => {
      const now = Date.now();
      if (now >= ELO_SNAPSHOT_TIME && now <= ELO_SNAPSHOT_TIME + ELO_SNAPSHOT_WINDOW_MS) {
        performEloSnapshot(db).catch(console.error);
        clearInterval(cronInterval);
      }
    }, 60 * 1000);
  }

  // Endpoint manual protegido (Admin trigger)
  app.post('/api/forja/snapshot-elo', express.json(), async (req: any, res: any) => {
    const secret = req.headers['x-forja-admin-secret'];
    if (!secret || secret !== process.env.FORJA_ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!db) return res.status(503).json({ error: 'Database not initialized' });
    eloSnapshotDone = false; // reset para permitir re-execução manual
    performEloSnapshot(db).catch(console.error);
    res.json({ ok: true, message: 'Snapshot iniciado em background' });
  });

  // ─── Forja: Scraper de Perfil aomstats (/profile/{id}/__data.json) ───────────
  // aomstats.io é SvelteKit — expõe endpoint de dados nativo sem necessidade de
  // parsear HTML. URL correta usa "/profile/" (singular).
  app.get('/api/forja/fetch-aom-profile', async (req: any, res: any) => {
    const rawId = String(req.query.id ?? '');
    const profileId = parseInt(rawId, 10);
    if (!rawId || isNaN(profileId) || profileId <= 0) {
      return res.status(400).json({ error: 'profile_id inválido' });
    }

    const HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': 'https://aomstats.io/',
    };

    try {
      // ── Estratégia 1: endpoint __data.json do SvelteKit (mais confiável) ──────
      const dataUrl = `https://aomstats.io/profile/${profileId}/__data.json`;
      const controller1 = new AbortController();
      const t1 = setTimeout(() => controller1.abort(), 12_000);

      let avatar_url: string | null = null;
      let alias:      string | null = null;
      let elo_1v1:    number | null = null;
      let elo_tg:     number | null = null;
      let top_gods:   Array<{ god: string; godName: string; winRate: number; playRate: number }> = [];
      let dataOk = false;

      try {
        const dataResp = await fetch(dataUrl, { signal: controller1.signal, headers: HEADERS });
        clearTimeout(t1);

        if (dataResp.ok) {
          const raw = await dataResp.json() as any;
          // SvelteKit serializa dados num array flattened — o node de perfil
          // está em nodes[1].data (índice 1 = segundo nó da página).
          const nodes: any[] = raw?.nodes ?? [];
          const profileNode = nodes.find((n: any) => n?.type === 'data' && n?.data?.[0]?.profile != null)
                           ?? nodes[1];
          const flat: any[] = profileNode?.data ?? [];

          // Helper: desreferencia índice no array flat
          const deref = (v: any): any => (typeof v === 'number' && flat[v] !== undefined) ? flat[v] : v;

          // ── Perfil base ────────────────────────────────────────────────────
          const profileIdx = flat[0]?.profile ?? 1;
          const profileObj = flat[profileIdx] ?? {};

          // alias e avatar ficam no objeto de perfil
          alias      = deref(profileObj?.alias)       ?? null;
          avatar_url = deref(profileObj?.avatar_link) ?? null;

          // ── leaderboardData (array de índices) ─────────────────────────────
          const lbDataIdxArr: number[] = Array.isArray(deref(flat[0]?.leaderboardData))
            ? deref(flat[0]?.leaderboardData)
            : [];

          for (const lbIdx of lbDataIdxArr) {
            const lbObj = flat[lbIdx];
            if (!lbObj || typeof lbObj !== 'object') continue;
            const lbId  = deref(lbObj?.leaderboard_id);
            const rating = deref(lbObj?.rating);
            if (typeof rating !== 'number' || rating <= 0) continue;
            if (lbId === 1 && elo_1v1 === null) elo_1v1 = Math.round(rating);
            if (lbId === 2 && elo_tg  === null) elo_tg  = Math.round(rating);
          }

          // Se não encontrou via leaderboardData, tenta via profile diretamente
          if (elo_1v1 === null) {
            // Procura em todos os flat items por leaderboard_id=1
            for (const item of flat) {
              if (!item || typeof item !== 'object') continue;
              const lbId  = deref(item?.leaderboard_id);
              const rating = deref(item?.rating);
              if (typeof rating !== 'number' || rating <= 0) continue;
              if (lbId === 1 && elo_1v1 === null) elo_1v1 = Math.round(rating);
              if (lbId === 2 && elo_tg  === null) elo_tg  = Math.round(rating);
            }
          }

          // ── God stats: nó de stats (nodes[2]) ─────────────────────────────
          const statsNode = nodes.find((n: any) => n?.type === 'data' && n?.data?.[0]?.stats != null)
                         ?? nodes[2];
          const statsFlat: any[] = statsNode?.data ?? [];
          const statsDeref = (v: any): any => (typeof v === 'number' && statsFlat[v] !== undefined) ? statsFlat[v] : v;

          const statsIdxArr: number[] = Array.isArray(statsDeref(statsFlat[0]?.stats))
            ? statsDeref(statsFlat[0]?.stats)
            : [];

          if (statsIdxArr.length > 0) {
            // Pega todos os god stat objects
            const godStatObjs = statsIdxArr
              .map((i: number) => statsFlat[i])
              .filter((o: any) => o && typeof o === 'object' && o.god !== undefined);

            // Calcula total de jogos para play_rate
            const totalGames = godStatObjs.reduce((s: number, g: any) => {
              const ng = typeof statsDeref(g.num_games) === 'number' ? statsDeref(g.num_games) : 0;
              return s + ng;
            }, 0);

            // Ordena por num_games (mais jogados primeiro) e pega top 5
            const sorted = [...godStatObjs]
              .sort((a: any, b: any) => {
                const ga = typeof statsDeref(a.num_games) === 'number' ? statsDeref(a.num_games) : 0;
                const gb = typeof statsDeref(b.num_games) === 'number' ? statsDeref(b.num_games) : 0;
                return gb - ga;
              })
              .slice(0, 5);

            top_gods = sorted.map((g: any) => {
              const godRaw  = statsDeref(g.god);
              const godName = String(typeof godRaw === 'string' ? godRaw : (godRaw?.name ?? godRaw ?? 'Unknown'));
              const wrRaw   = statsDeref(g.win_rate);
              const ngRaw   = statsDeref(g.num_games);
              const winRate  = typeof wrRaw === 'number'
                ? Math.round(wrRaw * 100)
                : typeof wrRaw === 'string' ? Math.round(parseFloat(wrRaw) * 100) : 0;
              const numGames = typeof ngRaw === 'number' ? ngRaw : 0;
              const playRate = totalGames > 0 ? Math.round((numGames / totalGames) * 100) : 0;
              return {
                god:      godName.toLowerCase().replace(/[^a-záàãâéêíóôõúüç]/gi, '').replace(/\s+/g, ''),
                godName:  godName.charAt(0).toUpperCase() + godName.slice(1),
                winRate,
                playRate,
              };
            });
          }
          dataOk = true;
        }
      } catch (e1: any) {
        if (e1?.name !== 'AbortError') console.warn('[Forja] __data.json fetch error:', e1.message);
      }

      // ── Estratégia 2: Se __data.json falhou, tenta HTML da página ────────────
      if (!dataOk) {
        const controller2 = new AbortController();
        const t2 = setTimeout(() => controller2.abort(), 12_000);
        const htmlResp = await fetch(`https://aomstats.io/profile/${profileId}`, {
          signal: controller2.signal, headers: { ...HEADERS, Accept: 'text/html' },
        });
        clearTimeout(t2);
        if (!htmlResp.ok) {
          const code = htmlResp.status;
          return res.status(code === 404 ? 404 : 502).json({
            error: code === 404 ? 'Perfil não encontrado no aomstats.io' : `aomstats.io retornou ${code}`,
          });
        }
        const html = await htmlResp.text();
        // OG image
        const ogImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                   || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
        if (ogImg) avatar_url = ogImg[1];
        if (!avatar_url) {
          const steam = html.match(/https:\/\/avatars\.steamstatic\.com\/[a-f0-9_/]+_full\.\w+/i)
                     || html.match(/https:\/\/avatars\.steamstatic\.com\/[a-f0-9_/]+\.\w+/i);
          if (steam) avatar_url = steam[0];
        }
        const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        if (ogTitle) alias = ogTitle[1].replace(/\s*[-–|]\s*aomstats.*$/i, '').trim();
        if (!alias) {
          const title = html.match(/<title>([^|<–\-]+)/i);
          if (title) alias = title[1].replace(/\s*[-–]\s*aomstats.*$/i, '').trim();
        }
      }

      // ── Validação final ──────────────────────────────────────────────────────
      if (!alias && !avatar_url && !dataOk) {
        return res.status(404).json({ error: 'Perfil não encontrado no aomstats.io' });
      }

      const response = {
        profile_id: profileId,
        avatar_url,
        alias,
        verified:   true,
        elo_1v1,
        elo_tg,
        top_gods,
      };
      console.log(`[Forja] Profile ${profileId}: alias="${alias}", elo_1v1=${elo_1v1}, elo_tg=${elo_tg}, gods=${top_gods.length}, avatar=${!!avatar_url}`);
      res.json(response);

    } catch (err: any) {
      if (err?.name === 'AbortError') return res.status(504).json({ error: 'Timeout ao buscar perfil' });
      console.error('[Forja] fetch-aom-profile error:', err);
      res.status(500).json({ error: 'Erro interno ao buscar perfil' });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // Roteamento de Produção vs Desenvolvimento
  if (isProd) {
    console.log('[Server] Mode: PRODUCTION');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build files not found.');
      }
    });
  } else {
    console.log('[Server] Mode: DEVELOPMENT');
    // Import dinâmico do Vite (Apenas em DEV)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Escutando em 0.0.0.0 para o tráfego externo do Cloud Run
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Mythos Draft v1.0.3 online on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Server failed to start:', err);
  process.exit(1);
});