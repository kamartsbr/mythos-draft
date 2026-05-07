/* eslint-disable */ // Build corrigido para a API do Vercel - 07/05/2026

/**
 * ============================================================
 * MYTHOS DRAFT — Cloud Functions (Vercel API)
 *
 * Arquitetura Atualizada:
 * - Utiliza a API pública do form-retold.vercel.app para buscar
 * dados oficiais (Avatar, ELO 1v1, ELO TG, Top Gods).
 * ============================================================
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── Configurações ────────────────────────────────────────────────────────────

const CHUNK_SIZE = 6;
const DELAY_BETWEEN_CHUNKS_MS = 1200;
const HTTP_TIMEOUT_MS = 10000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── fetchVercelData ─────────────────────────────────────────────────────────

async function fetchVercelData(profileId) {
  try {
    const [statsRes, godsRes] = await Promise.allSettled([
      axios.get(`https://form-retold.vercel.app/api/stats-by-id/${profileId}`, { timeout: HTTP_TIMEOUT_MS }),
      axios.get(`https://form-retold.vercel.app/api/gods/${profileId}`, { timeout: HTTP_TIMEOUT_MS })
    ]);

    if (statsRes.status === "rejected") {
      console.error(`[Vercel] Falha na API de Stats para ${profileId}:`, statsRes.reason?.message);
      return null;
    }

    let alias = `Player #${profileId}`;
    let avatar_url = "";
    let elo_1v1 = 0;
    let elo_tg = 0;
    let top_gods = [];

    if (statsRes.value.data) {
      const data = statsRes.value.data;
      alias = data.profileName || alias;
      avatar_url = data.playerAvatarUrl || "";
      
      const stats = data.profileStats || [];
      const sup1v1 = stats.find(s => s.mode === "Sup 1v1");
      const supTeam = stats.find(s => s.mode === "Sup Team" || s.mode === "Team");
      
      if (sup1v1) elo_1v1 = parseInt(sup1v1.elo, 10) || 0;
      if (supTeam) elo_tg = parseInt(supTeam.elo, 10) || 0;
    }

    if (godsRes.status === "fulfilled" && Array.isArray(godsRes.value.data)) {
      top_gods = godsRes.value.data.slice(0, 5).map(g => g.god);
    }

    return { alias, avatar_url, elo_1v1, elo_tg, top_gods };
  } catch (error) {
    console.error(`Erro ao buscar dados do Vercel para ${profileId}:`, error.message);
    return null;
  }
}

// ─── fetchAomProfile ──────────────────────────────────────────────────────────

exports.fetchAomProfile = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  const profileId = req.query.id;
  if (!profileId) {
    return res.status(400).json({ error: "Parâmetro 'id' ausente." });
  }
  if (!/^\d{1,12}$/.test(String(profileId))) {
    return res.status(400).json({ error: "ID inválido." });
  }

  try {
    const stats = await fetchVercelData(profileId);
    
    if (!stats) {
      return res.status(500).json({ success: false, error: "Falha ao buscar dados na API Vercel." });
    }

    return res.json({
      success: true,
      profile_id: parseInt(profileId, 10),
      data: stats,
    });
  } catch (error) {
    console.error(`[fetchAomProfile] Erro inesperado para ${profileId}:`, error.message);
    return res.status(500).json({ success: false, error: "Falha ao buscar dados." });
  }
});

// ─── updateEloSnapshot ────────────────────────────────────────────────────────

/**
 * Callable do painel Admin para atualizar ELO de todos os inscritos.
 * Sintaxe Universal para evitar problemas de versão e CORS.
 */
exports.updateEloSnapshot = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  const snapshot = await db.collection("forja_players").get();

  const players = snapshot.docs
    .map((doc) => ({ ref: doc.ref, data: doc.data(), id: doc.id }))
    .filter((p) => p.data.aom_profile_id || p.data.aom_id); 

  const lotes = chunk(players, CHUNK_SIZE);
  const report = { updated: 0, skipped: 0, failed: 0, errors: [] };

  console.log(`[Snapshot] Iniciando: ${players.length} jogadores em ${lotes.length} lotes de ${CHUNK_SIZE}.`);

  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i];
    console.log(`[Snapshot] Lote ${i + 1}/${lotes.length} — ${lote.length} players`);

    const results = await Promise.allSettled(
      lote.map(async ({ ref, data: p }) => {
        const profileId = p.aom_profile_id || p.aom_id;
        const stats = await fetchVercelData(profileId);

        if (!stats) {
          console.warn(`[Snapshot] Pulando ${p.nick} — API falhou.`);
          throw new Error(`ELO API falhou para ${p.nick}`);
        }

        const updates = {
          elo_1v1: stats.elo_1v1,
          elo_tg: stats.elo_tg,
          top_gods: stats.top_gods,
          elo_snapshot: stats.elo_1v1,
          last_update: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (stats.avatar_url) {
          updates.avatar_url = stats.avatar_url;
        }

        await ref.update(updates);
        console.log(`[Snapshot] ✅ ${p.nick} → 1v1:${stats.elo_1v1} TG:${stats.elo_tg} Deuses:${stats.top_gods.length}`);
      })
    );

    results.forEach((r) => {
      if (r.status === "fulfilled") {
        report.updated++;
      } else {
        const msg = r.reason?.message || "Erro desconhecido";
        if (msg.includes("ELO API falhou")) {
          report.skipped++;
        } else {
          report.failed++;
          report.errors.push(msg);
          console.error(`[Snapshot] ❌ Falha no lote: ${msg}`);
        }
      }
    });

    if (i < lotes.length - 1) {
      await delay(DELAY_BETWEEN_CHUNKS_MS);
    }
  }

  console.log(`[Snapshot] Concluído: ${JSON.stringify(report)}`);

  return {
    success: true,
    message: `Snapshot concluído: ${report.updated} atualizados, ${report.skipped} ignorados (API falhou), ${report.failed} com erro.`,
    report,
  };
});