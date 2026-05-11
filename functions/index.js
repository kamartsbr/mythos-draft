/* eslint-disable */
// Build Final Corrigido (Preservação de Dados + Elo Efetivo) - 07/05/2026
// 🔥 CORREÇÃO DE CUSTOS: Remoção do loop de gravação de status e uso de Batch

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

if (!admin.apps.length) { admin.initializeApp(); }

setGlobalOptions({ region: "us-central1" });

const API_KEY = 'mythosdraftweb_8b73781cc25e8f45b77bb760146a19dad427168c22fa8cad';
const TARGET_ORIGIN = 'https://mythosdraft.com';

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
        'X-API-Key': API_KEY,
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
      avatar_url: data.playerAvatarUrl || null,
      elo_1v1: calc_elo_1v1,
      elo_tg: calc_elo_tg,
      elo_efetivo: calc_elo_efetivo,
      top_gods: (Array.isArray(godsRes.data) && godsRes.data.length > 0) 
        ? godsRes.data
            .map(g => g && g.god)
            .filter(g => typeof g === 'string' && g.trim() !== '')
            .slice(0, 5) 
        : null
    };
  } catch (e) { 
    return { isError: true, message: e.message, status: e.response?.status }; 
  }
}

// --- FUNÇÃO 1: Snapshot (Uso do Admin) ---
exports.updateEloSnapshot = onCall({ timeoutSeconds: 540, memory: "256MiB" }, async (request) => {
  const db = getFirestore("mythosdraft-prod");
  const snapshot = await db.collection("forja_players").get();
  
  const players = snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data(), nick: doc.data().nick }))
    .filter(p => p.data.aom_profile_id || p.data.aom_id);

  let updatedCount = 0;
  const total = players.length;
  const statusRef = db.doc("forja_status/snapshot");

  // Inicia o tracking de progresso (Grava 1 ÚNICA VEZ no início)
  await statusRef.set({
    status: 'running',
    total_players: total,
    processed_count: 0,
    updated_count: 0,
    current_player: 'Atualizando...',
    start_time: admin.firestore.FieldValue.serverTimestamp(),
    end_time: null
  });

  if (total > 0) {
    let batch = db.batch();
    let batchOperations = 0;

    for (let i = 0; i < total; i++) {
      const player = players[i];
      
      try {
        const stats = await fetchVercelData(player.data.aom_profile_id || player.data.aom_id, player.nick);
        
        if (stats && !stats.isError) {
          const updateObj = {
            elo_1v1: stats.elo_1v1,
            elo_tg: stats.elo_tg,
            elo_efetivo: stats.elo_efetivo,
            elo_snapshot: stats.elo_1v1,
            last_update: admin.firestore.FieldValue.serverTimestamp()
          };

          if (stats.avatar_url) updateObj.avatar_url = stats.avatar_url;
          if (stats.top_gods && stats.top_gods.length > 0) updateObj.top_gods = stats.top_gods;

          // Adiciona a gravação no pacote (batch) em vez de gravar direto no banco
          batch.set(player.ref, updateObj, { merge: true });
          updatedCount++;
          batchOperations++;
        }
      } catch (e) {
        console.error(`Erro ao processar ${player.nick}:`, e);
      }

      // Previne erro do Firestore (limite de 500 ops por batch)
      if (batchOperations >= 400) {
        await batch.commit();
        batch = db.batch();
        batchOperations = 0;
      }

      if (i < total - 1) {
        await delay(200); // Fila Indiana 200ms para não engasgar a Vercel
      }
    }

    // Grava o restante que ficou no pacote
    if (batchOperations > 0) {
      await batch.commit();
    }
  }

  // Finaliza o tracking de progresso (Grava 1 ÚNICA VEZ no final)
  await statusRef.update({
    status: 'completed',
    processed_count: total,
    updated_count: updatedCount,
    current_player: 'Concluído',
    end_time: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, updated: updatedCount };
});

// --- FUNÇÃO 2: Busca Individual ---
exports.fetchaomprofile = onRequest({ cors: ["https://mythosdraft.com", "http://localhost:5173", "http://localhost:3000"] }, async (req, res) => {
  const profileId = req.query.id;
  if (!profileId) return res.status(400).send("ID ausente");
  const result = await fetchVercelData(profileId);
  if (result && result.isError) return res.status(result.status || 500).json({ success: false, error: result.message });
  res.json({ success: !!result, data: result });
});