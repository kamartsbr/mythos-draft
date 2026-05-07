/* eslint-disable */
// Build corrigido para a API do Vercel - 07/05/2026

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

// Configura a região global para evitar erros de localidade
setGlobalOptions({ region: "us-central1" });

// ─── Configurações ────────────────────────────────────────────────────────────
const CHUNK_SIZE = 6;
const DELAY_BETWEEN_CHUNKS_MS = 1200;
const HTTP_TIMEOUT_MS = 10000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─── Lógica de Busca no Vercel ───────────────────────────────────────────────
async function fetchVercelData(profileId) {
  try {
    const [statsRes, godsRes] = await Promise.allSettled([
      axios.get(`https://form-retold.vercel.app/api/stats-by-id/${profileId}`, { timeout: HTTP_TIMEOUT_MS }),
      axios.get(`https://form-retold.vercel.app/api/gods/${profileId}`, { timeout: HTTP_TIMEOUT_MS })
    ]);

    if (statsRes.status === "rejected") {
      console.error(`[Vercel] Falha ID ${profileId}:`, statsRes.reason?.message);
      return null;
    }

    const data = statsRes.value.data || {};
    const stats = data.profileStats || [];
    const s1v1 = stats.find(s => s.mode === "Sup 1v1");
    const sTG = stats.find(s => s.mode === "Sup Team" || s.mode === "Team" || s.mode === "Sup TG");

    return {
      avatar_url: data.playerAvatarUrl || "",
      elo_1v1: s1v1 ? parseInt(s1v1.elo, 10) : 0,
      elo_tg: sTG ? parseInt(sTG.elo, 10) : 0,
      top_gods: (godsRes.status === "fulfilled" && Array.isArray(godsRes.value.data)) 
                 ? godsRes.value.data.slice(0, 5).map(g => g.god) 
                 : []
    };
  } catch (error) {
    return null;
  }
}

// ─── updateEloSnapshot (O Coração do Admin) ──────────────────────────────────
exports.updateEloSnapshot = onCall({ timeoutSeconds: 300, memory: "256MiB" }, async (request) => {
  // ACESSANDO O BANCO PROD DIRETAMENTE
  const db = admin.firestore("mythosdraft-prod");
  
  const snapshot = await db.collection("forja_players").get();
  const players = snapshot.docs
    .map(doc => ({ ref: doc.ref, data: doc.data() }))
    .filter(p => p.data.aom_profile_id || p.data.aom_id);

  const lotes = chunk(players, CHUNK_SIZE);
  let updatedCount = 0;

  for (let i = 0; i < lotes.length; i++) {
    await Promise.allSettled(lotes[i].map(async (player) => {
      const stats = await fetchVercelData(player.data.aom_profile_id || player.data.aom_id);
      if (stats) {
        await player.ref.update({
          elo_1v1: stats.elo_1v1,
          elo_tg: stats.elo_tg,
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

  return { success: true, updated: updatedCount };
});

// ─── fetchAomProfile (Para Inscrições) ────────────────────────────────────────
exports.fetchAomProfile = onRequest({ cors: true }, async (req, res) => {
  const profileId = req.query.id;
  if (!profileId) return res.status(400).send("ID ausente");
  const stats = await fetchVercelData(profileId);
  res.json({ success: !!stats, data: stats });
});