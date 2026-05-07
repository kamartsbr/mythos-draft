/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

// Configurações para não derrubar a API do Vercel (Rate Limit)
const CHUNK_SIZE = 5;
const DELAY_MS = 1000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

/**
 * Função Auxiliar: Busca os dados na nova API Vercel (form-retold)
 */
async function fetchVercelData(profileId) {
  try {
    // Busca estatísticas e deuses em paralelo
    const [statsRes, godsRes] = await Promise.allSettled([
      axios.get(`https://form-retold.vercel.app/api/stats-by-id/${profileId}`, { timeout: 10000 }),
      axios.get(`https://form-retold.vercel.app/api/gods/${profileId}`, { timeout: 10000 })
    ]);

    let elo_1v1 = 0;
    let elo_tg = 0;
    let avatar_url = "";
    let top_gods = [];
    let alias = `Player #${profileId}`;

    // 1. Extrai ELO e Foto da Steam
    if (statsRes.status === "fulfilled" && statsRes.value.data) {
      const data = statsRes.value.data;
      alias = data.profileName || alias;
      avatar_url = data.playerAvatarUrl || "";
      
      const stats = data.profileStats || [];
      const sup1v1 = stats.find(s => s.mode === "Sup 1v1");
      const supTeam = stats.find(s => s.mode === "Sup Team" || s.mode === "Team"); // Fallback caso mudem o nome
      
      if (sup1v1) elo_1v1 = parseInt(sup1v1.elo, 10) || 0;
      if (supTeam) elo_tg = parseInt(supTeam.elo, 10) || 0;
    }

    // 2. Extrai Top Deuses (Pegando até os 5 mais jogados)
    if (godsRes.status === "fulfilled" && Array.isArray(godsRes.value.data)) {
      // O slice(0, 5) garante que vai pegar no máximo 5. 
      // Se o array tiver menos que 5, ele pega o que tiver sem dar erro.
      top_gods = godsRes.value.data.slice(0, 5).map(g => g.god);
    }

    return { alias, avatar_url, elo_1v1, elo_tg, top_gods };
  } catch (error) {
    console.error(`Erro ao buscar dados do Vercel para ${profileId}:`, error.message);
    return null;
  }
}

/**
 * Endpoint HTTP para o Formulário de Inscrição
 */
exports.fetchAomProfile = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  const profileId = req.query.id;
  if (!profileId) return res.status(400).json({ error: "ID do perfil ausente." });

  try {
    const stats = await fetchVercelData(profileId);
    
    if (!stats) {
       return res.status(500).json({ success: false, error: "Falha ao conectar com a API." });
    }

    // O seu front-end (forjaService.ts) espera receber o profile_id de volta
    res.json({ 
      success: true, 
      profile_id: parseInt(profileId),
      ...stats 
    });
  } catch (error) {
    console.error(`Erro na API fetchAomProfile para ID ${profileId}:`, error.message);
    res.status(500).json({ success: false, error: "Falha ao processar a requisição." });
  }
});

/**
 * Função de Snapshot Automático para o Painel Admin
 */
exports.updateEloSnapshot = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const db = admin.firestore();
    
    // Utilizando a coleção 'forja_players' conforme definido no seu forjaService.ts
    const snapshot = await db.collection("forja_players").get();

    const players = snapshot.docs
      .map((doc) => ({ ref: doc.ref, data: doc.data(), id: doc.id }))
      .filter((p) => p.data.aom_profile_id || p.data.aom_id);

    const lotes = chunk(players, CHUNK_SIZE);
    let updated = 0;

    for (let i = 0; i < lotes.length; i++) {
      await Promise.allSettled(
        lotes[i].map(async ({ ref, data: p }) => {
          const profileId = p.aom_profile_id || p.aom_id;
          
          const stats = await fetchVercelData(profileId);
          
          if (stats) {
            // Atualiza os campos puxando tudo de novo (ELO, TG, Deuses)
            const updates = {
              elo_1v1: stats.elo_1v1,
              elo_tg: stats.elo_tg,
              top_gods: stats.top_gods,
              elo_snapshot: stats.elo_1v1, // Crava o ELO Snapshot oficial
              last_update: admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Só salva avatar novo se a API achar algum
            if (stats.avatar_url) updates.avatar_url = stats.avatar_url;

            await ref.update(updates);
            updated++;
          }
        })
      );
      
      // Delay entre os lotes para não sobrecarregar a API
      if (i < lotes.length - 1) await delay(DELAY_MS);
    }

    return { success: true, message: `Snapshot de ELO finalizado com sucesso! ${updated} jogadores atualizados.` };
  });