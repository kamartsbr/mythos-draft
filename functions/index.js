/* eslint-disable */
// Build Final Corrigido (Preservação de Dados + Elo Efetivo) - 07/05/2026
// SECURITY: API_KEY movida para Firebase Secret (VERCEL_API_KEY)
// Para configurar: firebase functions:secrets:set VERCEL_API_KEY

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

// Secret gerenciado pelo Firebase — nunca exposto no código-fonte
const VERCEL_API_KEY = defineSecret('VERCEL_API_KEY');

if (!admin.apps.length) { admin.initializeApp(); }

setGlobalOptions({ region: "us-central1" });

// API_KEY removida daqui — use VERCEL_API_KEY.value() dentro das funções
const TARGET_ORIGIN = 'https://mythosdraft.com';
const CHUNK_SIZE = 6;
const DELAY_BETWEEN_CHUNKS_MS = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, config, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, config);
    } catch (err) {
      if (err.response && err.response.status === 429 && i < retries - 1) {
        await delay(backoff * (i + 1));
        continue;
      }
      throw err;
    }
  }
}

async function fetchVercelData(profileId, nick = null) {
  try {
    const config = { 
      timeout: 10000, 
      headers: { 
        'X-API-Key': VERCEL_API_KEY.value(),
        'Origin': TARGET_ORIGIN 
      } 
    };

    let url = `https://form-retold.vercel.app/api/stats-by-id/${profileId}`;
    let statsRes;
    try {
      statsRes = await fetchWithRetry(url, config);
    } catch (error) {
      if (error.response?.status === 404 && nick) {
        url = `https://form-retold.vercel.app/api/stats/${encodeURIComponent(nick)}`;
        statsRes = await fetchWithRetry(url, config);
      } else {
        throw error;
      }
    }

    // Busca de Deuses
    const godsRes = await fetchWithRetry(`https://form-retold.vercel.app/api/gods/${profileId}`, config).catch(() => ({ data: [] }));

    const data = statsRes.data || {};
    const stats = data.profileStats || [];
    const s1v1 = stats.find(s => s.mode === "Sup 1v1");
    const sTG = stats.find(s => s.mode === "Sup Team" || s.mode === "Team" || s.mode === "Sup TG");

    const calc_elo_1v1 = s1v1 ? (parseInt(s1v1.elo, 10) || 0) : 0;
    const calc_elo_tg = sTG ? (parseInt(sTG.elo, 10) || 0) : 0;
    const calc_elo_efetivo = Math.round((calc_elo_1v1 + calc_elo_tg) / 2) || 0;

    return {
      isError: false,
      avatar_url: data.playerAvatarUrl || null, // Mudado para null se vazio
      elo_1v1: calc_elo_1v1,
      elo_tg: calc_elo_tg,
      elo_efetivo: calc_elo_efetivo,
      top_gods: (Array.isArray(godsRes.data) && godsRes.data.length > 0) 
        ? godsRes.data
            .map(g => g && g.god)
            .filter(g => typeof g === 'string' && g.trim() !== '')
            .slice(0, 5) 
        : null // Retorna null se não houver deuses
    };
  } catch (e) { 
    return { isError: true, message: e.message, status: e.response?.status }; 
  }
}

// --- FUNÇÃO 1: Snapshot (Uso do Admin) ---
exports.updateEloSnapshot = onCall({ timeoutSeconds: 540, memory: "256MiB", secrets: [VERCEL_API_KEY] }, async (request) => {
  const db = getFirestore("mythosdraft-prod");
  const snapshot = await db.collection("forja_players").get();
  
  const players = snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data(), nick: doc.data().nick }))
    .filter(p => p.data.aom_profile_id || p.data.aom_id);

  let updatedCount = 0;
  const total = players.length;
  const statusRef = db.doc("forja_status/snapshot");

  // Inicia o tracking de progresso
  await statusRef.set({
    status: 'running',
    total_players: total,
    processed_count: 0,
    updated_count: 0,
    current_player: '',
    start_time: admin.firestore.FieldValue.serverTimestamp(),
    end_time: null
  });

  if (total > 0) {
    for (let i = 0; i < total; i++) {
      const player = players[i];
      
      try {
        const stats = await fetchVercelData(player.data.aom_profile_id || player.data.aom_id, player.nick);
        
        if (stats && !stats.isError) {
          // MONTAGEM DINÂMICA DO UPDATE (O segredo para não apagar nada)
          const updateObj = {
            elo_1v1: stats.elo_1v1,
            elo_tg: stats.elo_tg,
            elo_efetivo: stats.elo_efetivo,
            elo_snapshot: stats.elo_1v1,
            last_update: admin.firestore.FieldValue.serverTimestamp()
          };

          // SÓ ATUALIZA O AVATAR SE A API TROUXER UM NOVO
          if (stats.avatar_url) {
            updateObj.avatar_url = stats.avatar_url;
          }

          // SÓ ATUALIZA OS DEUSES SE A API TROUXER ALGO
          if (stats.top_gods && stats.top_gods.length > 0) {
            updateObj.top_gods = stats.top_gods;
          }

          await player.ref.set(updateObj, { merge: true });
          updatedCount++;
        }
      } catch (e) {
        console.error(`Erro ao processar ${player.nick}:`, e);
      }

      await statusRef.update({
        processed_count: i + 1,
        updated_count: updatedCount,
        current_player: player.nick || ''
      });

      if (i < total - 1) {
        await delay(200); // Fila Indiana 200ms
      }
    }
  }

  await statusRef.update({
    status: 'completed',
    end_time: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, updated: updatedCount };
});

// --- FUNÇÃO 2: Busca Individual ---
exports.fetchaomprofile = onRequest({ cors: true, secrets: [VERCEL_API_KEY] }, async (req, res) => {
  const profileId = req.query.id;
  if (!profileId) return res.status(400).send("ID ausente");
  const result = await fetchVercelData(profileId);
  if (result && result.isError) return res.status(result.status || 500).json({ success: false, error: result.message });
  res.json({ success: !!result, data: result });
});
