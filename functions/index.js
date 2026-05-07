/* eslint-disable */
// Build Final Corrigido (Endpoint /api/stats/ + Origin + Elo Efetivo) - 07/05/2026

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

if (!admin.apps.length) { admin.initializeApp(); }

setGlobalOptions({ region: "us-central1" });

const API_KEY = 'mythosdraftweb_8b73781cc25e8f45b77bb760146a19dad427168c22fa8cad';
const TARGET_ORIGIN = 'https://mythosdraft.com'; // O crachá do Vercel
const CHUNK_SIZE = 6;
const DELAY_BETWEEN_CHUNKS_MS = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchVercelData(profileId, nick = null) {
  try {
    const config = { 
      timeout: 10000, 
      headers: { 
        'X-API-Key': API_KEY,
        'Origin': TARGET_ORIGIN // Adicionado para burlar o CORS do Scooby
      } 
    };

    // Alterado para /api/stats/ conforme instrução do Scooby (evita erro 403)
    let url = `https://form-retold.vercel.app/api/stats/${profileId}`;
    
    let statsRes;
    try {
      statsRes = await axios.get(url, config);
    } catch (error) {
      // Se der 404 por ID e tivermos o Nick, tenta pelo Nick como fallback
      if (error.response?.status === 404 && nick) {
        url = `https://form-retold.vercel.app/api/stats/${encodeURIComponent(nick)}`;
        statsRes = await axios.get(url, config);
      } else {
        throw error;
      }
    }

    // Busca de Deuses (opcional, não trava se falhar)
    const godsRes = await axios.get(`https://form-retold.vercel.app/api/gods/${profileId}`, config).catch(() => ({ data: [] }));

    const data = statsRes.data || {};
    const stats = data.profileStats || [];
    const s1v1 = stats.find(s => s.mode === "Sup 1v1");
    const sTG = stats.find(s => s.mode === "Sup Team" || s.mode === "Team" || s.mode === "Sup TG");

    // Calculando Elos separados para tirar a média
    const calc_elo_1v1 = s1v1 ? parseInt(s1v1.elo, 10) : 0;
    const calc_elo_tg = sTG ? parseInt(sTG.elo, 10) : 0;
    const calc_elo_efetivo = Math.round((calc_elo_1v1 + calc_elo_tg) / 2);

    return {
      isError: false,
      avatar_url: data.playerAvatarUrl || "",
      elo_1v1: calc_elo_1v1,
      elo_tg: calc_elo_tg,
      elo_efetivo: calc_elo_efetivo, // Retornando a média
      top_gods: (Array.isArray(godsRes.data)) ? godsRes.data.slice(0, 5).map(g => g.god) : []
    };
  } catch (e) { 
    return { 
      isError: true, 
      message: e.message, 
      status: e.response?.status,
      url: e.config?.url
    }; 
  }
}

// --- FUNÇÃO 1: Snapshot (Uso do Admin) ---
exports.updateEloSnapshot = onCall({ timeoutSeconds: 300, memory: "256MiB" }, async (request) => {
  const db = getFirestore("mythosdraft-prod");
  const snapshot = await db.collection("forja_players").get();
  
  const debugInfo = { apiErrors: [], sampleResult: null };

  const players = snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data(), nick: doc.data().nick }))
    .filter(p => p.data.aom_profile_id || p.data.aom_id);

  let updatedCount = 0;

  if (players.length > 0) {
    // Teste inicial com o primeiro player para o debug do console
    const p = players[0];
    const res = await fetchVercelData(p.data.aom_profile_id || p.data.aom_id, p.nick);
    debugInfo.sampleResult = { nick: p.nick, res };
    
    if (res && !res.isError) {
      // Se o teste passou, processa todos em lotes
      const lotes = [];
      for (let i = 0; i < players.length; i += CHUNK_SIZE) {
        lotes.push(players.slice(i, i + CHUNK_SIZE));
      }

      for (let i = 0; i < lotes.length; i++) {
        await Promise.allSettled(lotes[i].map(async (player) => {
          const stats = await fetchVercelData(player.data.aom_profile_id || player.data.aom_id, player.nick);
          if (stats && !stats.isError) {
            await player.ref.update({
              elo_1v1: stats.elo_1v1,
              elo_tg: stats.elo_tg,
              elo_efetivo: stats.elo_efetivo, // Gravando a média no banco
              top_gods: stats.top_gods,
              elo_snapshot: stats.elo_1v1,
              avatar_url: stats.avatar_url || player.data.avatar_url || "",
              last_update: admin.firestore.FieldValue.serverTimestamp()
            });
            updatedCount++;
          }
        }));
        if (i < lotes.length - 1) await delay(DELAY_BETWEEN_CHUNKS_MS);
      }
    }
  }

  return { success: true, updated: updatedCount, debug: debugInfo };
});

// --- FUNÇÃO 2: Busca Individual (Uso do Site/Inscrição) ---
exports.fetchAomProfile = onRequest({ cors: true }, async (req, res) => {
  const profileId = req.query.id;
  if (!profileId) return res.status(400).send("ID ausente");
  
  const result = await fetchVercelData(profileId);
  
  if (result && result.isError) {
      return res.status(result.status || 500).json({ success: false, error: result.message });
  }

  res.json({ success: !!result, data: result });
});