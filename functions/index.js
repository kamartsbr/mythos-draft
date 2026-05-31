/* eslint-disable */
// Build Final Corrigido (Preservação de Dados + Elo Efetivo) - 07/05/2026
// 🔥 CORREÇÃO DE CUSTOS: Remoção do loop de gravação de status e uso de Batch

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");

// Secret gerenciado pelo Firebase — nunca exposto no código-fonte
const VERCEL_API_KEY = defineSecret('VERCEL_API_KEY');

if (!admin.apps.length) { admin.initializeApp(); }

setGlobalOptions({ region: "us-central1" });

// API_KEY removida daqui — use VERCEL_API_KEY.value() dentro das funções
const TARGET_ORIGIN = 'https://mythosdraft.com';

const DISCORD_CLIENT_SECRET = defineSecret('DISCORD_CLIENT_SECRET');
const DISCORD_CLIENT_ID = defineSecret('DISCORD_CLIENT_ID');
const FORJA_ADMIN_IDS = defineString('FORJA_ADMIN_IDS', { default: '' });

// Owner IDs are emergency callable admins only. Firestore rules still require
// forja_players/{uid}.role == 'admin' for direct client-side Firestore writes.
const OWNER_DISCORD_IDS = new Set([
  '272372054526001152',
]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getConfiguredForjaAdminIds() {
  return new Set(
    FORJA_ADMIN_IDS.value()
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

async function assertForjaAdmin(request, db) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (OWNER_DISCORD_IDS.has(uid) || getConfiguredForjaAdminIds().has(uid)) return;

  const playerSnap = await db.doc(`forja_players/${uid}`).get();
  if (!playerSnap.exists || playerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Forja admin permission required');
  }
}

/**
 * Perform an HTTP GET and retry on HTTP 429 (Too Many Requests) using incremental backoff.
 *
 * @param {string} url - The request URL.
 * @param {object} config - Axios request configuration (headers, timeout, etc.).
 * @param {number} [retries=3] - Maximum number of attempts before giving up.
 * @param {number} [backoff=1000] - Base delay in milliseconds used between retries (multiplied by attempt index).
 * @returns {Promise<import('axios').AxiosResponse>} The Axios response object from a successful request.
 * @throws {Error} The last encountered error when a non-429 response is received or all retries are exhausted.
 */
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
exports.updateEloSnapshot = onCall({ timeoutSeconds: 540, memory: "256MiB", secrets: [VERCEL_API_KEY] }, async (request) => {
  const db = getFirestore("mythosdraft-prod");
  await assertForjaAdmin(request, db);

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
exports.fetchaomprofile = onCall({ secrets: [VERCEL_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const profileId = request.data.id;
  if (!profileId) {
    throw new HttpsError('invalid-argument', 'ID ausente');
  }

  const result = await fetchVercelData(profileId);
  if (result && result.isError) {
    throw new HttpsError('internal', result.message);
  }
  return result;
});

/**
 * Verifica o token do Discord e retorna um custom token do Firebase.
 * Isso garante que o UID do Firebase seja o próprio Discord ID do usuário.
 */
exports.verifydiscordtoken = onRequest({ cors: true, secrets: [DISCORD_CLIENT_SECRET, DISCORD_CLIENT_ID] }, async (req, res) => {
    // Validate request structure and method
    if (!req || typeof req.body !== 'object' || req.body === null) {
      res.status(400).json({ error: "Invalid request structure" });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { code, redirectUri } = req.body;

    // Validate code is a non-empty string
    if (!code || typeof code !== 'string' || code.trim() === '') {
      res.status(400).json({ error: "Code ausente" });
      return;
    }

    // Validate redirectUri against allowlist
    const allowedRedirectUris = [
      'https://mythosdraft.com/forja',
      'http://localhost:8080/forja',
      'http://localhost:5173/forja',
      'http://localhost:4173/forja'
    ];

    if (!redirectUri || typeof redirectUri !== 'string' || !allowedRedirectUris.includes(redirectUri)) {
      res.status(400).json({ error: "Invalid redirect URI" });
      return;
    }

    try {
      // 1. Trocar o CODE pelo ACCESS TOKEN (Server-side para segurança)
      const params = new URLSearchParams();
      params.append('client_id', DISCORD_CLIENT_ID.value());
      params.append('client_secret', DISCORD_CLIENT_SECRET.value());
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);

      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });

      const accessToken = tokenRes.data.access_token;

      // 2. Buscar o usuário no Discord
      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });

      const discordUser = userRes.data;

      // 3. Criar Custom Token no Firebase usando o Discord ID como UID
      // O serviceAccountId configurado no initializeApp() garante que a
      // App Engine SA (com permissão de signBlob) seja usada para assinar o JWT.
      const customToken = await admin.auth().createCustomToken(discordUser.id, {
        discord_id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar
      });

      res.json({
        customToken,
        discordUser: {
          id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar
        }
      });
    } catch (error) {
      console.error("Erro na verificação do Discord:", error.response?.data || error.message);
      // Retorna detalhes do erro para facilitar o debug no cliente (sem expor secrets)
      const errorMessage = error.response?.data?.error || "Falha na autenticação com Discord";
      res.status(500).json({ error: errorMessage });
    }
});
