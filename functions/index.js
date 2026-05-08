/* eslint-disable */
// Build Final Corrigido (Batch + Throttling + Filtros Seguros) - 07/05/2026

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

if (!admin.apps.length) { admin.initializeApp(); }

setGlobalOptions({ region: "us-central1" });

const API_KEY = 'mythosdraftweb_8b73781cc25e8f45b77bb760146a19dad427168c22fa8cad';
const TARGET_ORIGIN = 'https://mythosdraft.com';

// Substituímos os "Lotes" por um delay individual contínuo para evitar bloqueio da API (Rate Limit 429)
const DELAY_BETWEEN_PLAYERS_MS = 200; 

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      statsRes = await axios.get(url, config);
    } catch (error) {
      if (error.response?.status === 404 && nick) {
        url = `https://form-retold.vercel.app/api/stats/${encodeURIComponent(nick)}`;
        statsRes = await axios.get(url, config);
      } else {
        throw error;
      }
    }

    // Busca de Deuses
    const godsRes = await axios.get(`https://form-retold.vercel.app/api/gods/${profileId}`, config).catch(() => ({ data: [] }));

    const data = statsRes.data || {};
    const stats = data.profileStats || [];
    const s1v1 = stats.find(s => s.mode === "Sup 1v1");
    const sTG = stats.find(s => s.mode === "Sup Team" || s.mode === "Team" || s.mode === "Sup TG");

    // FILTRO SEGURO 1: Previne NaN caso a API envie um ELO corrompido/nulo
    const calc_elo_1v1 = s1v1 ? (parseInt(s1v1.elo, 10) || 0) : 0;
    const calc_elo_tg = sTG ? (parseInt(sTG.elo, 10) || 0) : 0;
    const calc_elo_efetivo = Math.round((calc_elo_1v1 + calc_elo_tg) / 2);

    // FILTRO SEGURO 2: Bloqueia strings vazias e 'undefined' no array de deuses
    const top_gods_safe = (Array.isArray(godsRes.data) && godsRes.data.length > 0)
      ? godsRes.data
          .map(g => g && g.god)
          .filter(g => typeof g === 'string' && g.trim() !== '') // Remove qualquer sujeira
          .slice(0, 5)
      : null;

    return {
      isError: false,
      avatar_url: data.playerAvatarUrl || null, 
      elo_1v1: calc_elo_1v1,
      elo_tg: calc_elo_tg,
      elo_efetivo: calc_elo_efetivo,
      top_gods: top_gods_safe 
    };
  } catch (e) { 
    return { isError: true, message: e.message, status: e.response?.status }; 
  }
}

// --- FUNÇÃO 1: Snapshot (Uso do Admin) ---
exports.updateEloSnapshot = onCall({ timeoutSeconds: 300, memory: "256MiB" }, async (request) => {
  const db = getFirestore("mythosdraft-prod");
  const snapshot = await db.collection("forja_players").get();
  
  const players = snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data(), nick: doc.data().nick }))
    .filter(p => p.data.aom_profile_id || p.data.aom_id);

  let updatedCount = 0;
  let operationCount = 0;
  
  // Usando BATCH em vez de UPDATE solto para economizar quotas e evitar crash concorrente
  let batch = db.batch();

  if (players.length > 0) {
    for (const player of players) {
      // THROTTLING: Pausa respiratória entre jogadores para não afogar a API do Scooby
      await delay(DELAY_BETWEEN_PLAYERS_MS);

      const stats = await fetchVercelData(player.data.aom_profile_id || player.data.aom_id, player.nick);
      
      if (stats && !stats.isError) {
        const updateObj = {
          elo_1v1: stats.elo_1v1,
          elo_tg: stats.elo_tg,
          elo_efetivo: stats.elo_efetivo,
          elo_snapshot: stats.elo_1v1,
          last_update: admin.firestore.FieldValue.serverTimestamp()
        };

        if (stats.avatar_url) {
          updateObj.avatar_url = stats.avatar_url;
        }

        if (stats.top_gods && stats.top_gods.length > 0) {
          updateObj.top_gods = stats.top_gods;
        }

        // SET com MERGE: Seguro contra alterações simultâneas no banco (substitui o .update)
        batch.set(player.ref, updateObj, { merge: true });
        updatedCount++;
        operationCount++;

        // O Firestore limita a 500 operações por batch. Se passar de 400, comita e abre outro.
        if (operationCount >= 400) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }
    }
    
    // Comita os jogadores restantes
    if (operationCount > 0) {
      await batch.commit();
    }
  }

  return { success: true, updated: updatedCount };
});

// --- FUNÇÃO 2: Busca Individual ---
exports.fetchAomProfile = onRequest({ cors: true }, async (req, res) => {
  const profileId = req.query.id;
  if (!profileId) return res.status(400).send("ID ausente");
  const result = await fetchVercelData(profileId);
  if (result && result.isError) return res.status(result.status || 500).json({ success: false, error: result.message });
  res.json({ success: !!result, data: result });
});