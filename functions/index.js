/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Função Auxiliar: Busca os dados atualizados em tempo real da API do aom.gg
 */
async function fetchAomDataFromGG(profileId) {
  const url = `https://www.aom.gg/api/profiles/${profileId}/recent`;
  
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    },
    timeout: 12000 
  });

  let elo_1v1 = 0;

  // Pegamos a partida mais recente para extrair o ELO/Rating atualizado
  if (data.matches && data.matches.length > 0) {
    const lastMatch = data.matches[0];
    elo_1v1 = lastMatch.rating || lastMatch.elo || lastMatch.postMatchRating || 0; 
  }

  return { 
    alias: data.alias || `Player #${profileId}`, 
    avatar_url: "", // Mantemos vazio para o front-end acionar o fallback do Discord
    elo_1v1: elo_1v1, 
    elo_tg: 0, 
    top_gods: [] 
  };
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
    const stats = await fetchAomDataFromGG(profileId);
    
    // O seu front-end (forjaService.ts) espera receber o profile_id de volta
    res.json({ 
      success: true, 
      profile_id: parseInt(profileId),
      ...stats 
    });
  } catch (error) {
    console.error(`Erro na API fetchAomProfile para ID ${profileId}:`, error.message);
    const status = (error.response && error.response.status === 404) ? 404 : 500;
    res.status(status).json({ success: false, error: "Falha ao conectar com a API do aom.gg." });
  }
});

/**
 * Função de Snapshot Automático para o Painel Admin
 */
exports.updateEloSnapshot = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  
  // Utilizando a coleção 'forja_players' conforme definido no seu forjaService.ts
  const snapshot = await db.collection("forja_players").get();

  const updates = snapshot.docs.map(async (doc) => {
    const p = doc.data();
    const profileId = p.aom_profile_id || p.aom_id;
    
    if (!profileId) return null;

    try {
      const stats = await fetchAomDataFromGG(profileId);
      
      // Atualiza apenas os campos necessários, cravando o elo_snapshot oficial
      return doc.ref.update({
        elo_1v1: stats.elo_1v1,
        elo_snapshot: stats.elo_1v1, 
        last_update: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error(`Erro no Snapshot do player ${p.nick} (ID: ${profileId}):`, err.message);
      return null;
    }
  });

  await Promise.all(updates);
  return { success: true, message: "Snapshot de ELO finalizado com sucesso!" };
});