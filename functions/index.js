/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Função Auxiliar para Scraping
 * Centraliza a captura de dados para evitar repetição de código
 */
async function scrapeAomData(profileId) {
  const url = `https://aomstats.io/profile/${profileId}`;
  
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 10000 
  });

  const $ = cheerio.load(html);

  // Extração básica
  const alias = $("h1").first().text().trim() || "Usuário Desconhecido";
  const avatar_url = $(".profile-avatar img").attr("src") || $("img[src*='avatars']").attr("src") || "";

  // Extração de ELOs
  let elo_1v1 = 0;
  let elo_tg = 0;
  $(".rating-container").each((i, el) => {
    const label = $(el).find(".rating-label").text().toLowerCase();
    const value = parseInt($(el).find(".rating-value").text().replace(/\D/g, "")) || 0;
    if (label.includes("1v1")) elo_1v1 = value;
    if (label.includes("team")) elo_tg = value;
  });

  // Extração dos Top 5 Deuses
  const top_gods = [];
  $(".god-stats-row").slice(0, 5).each((i, el) => {
    const godName = $(el).find(".god-name").text().trim();
    const godImg = $(el).find(".god-icon img").attr("src");
    if (godName) {
      top_gods.push({
        god: godName.toLowerCase(),
        godName: godName,
        image: godImg
      });
    }
  });

  return { alias, avatar_url, elo_1v1, elo_tg, top_gods };
}

/**
 * Endpoint para o Formulário de Inscrição
 * Usado quando o jogador clica em "VERIFICAR"
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
    const stats = await scrapeAomData(profileId);
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error(`Erro na API fetchAomProfile para ID ${profileId}:`, error.message);
    const status = (error.response && error.response.status === 404) ? 404 : 500;
    res.status(status).json({ success: false, error: "Falha ao ler dados do AoMStats." });
  }
});

/**
 * Função de Snapshot para o Painel Admin
 * Atualiza todos os jogadores já cadastrados no banco de dados
 */
exports.updateEloSnapshot = functions.https.onCall(async (data, context) => {
  // Opcional: Descomente abaixo para restringir a apenas admins autenticados
  // if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário.');

  const db = admin.firestore();
  const snapshot = await db.collection("inscritos_forja").get();

  const updates = snapshot.docs.map(async (doc) => {
    const p = doc.data();
    const profileId = p.aom_profile_id || p.aom_id;
    
    if (!profileId) return;

    try {
      const stats = await scrapeAomData(profileId);
      
      // Atualiza o documento no Firestore com os dados reais capturados
      return doc.ref.update({
        elo_1v1: stats.elo_1v1,
        elo_tg: stats.elo_tg,
        elo_snapshot: stats.elo_1v1, // Define o ranking oficial para o torneio
        top_gods: stats.top_gods,
        avatar_url: stats.avatar_url, // Atualiza para o avatar da Steam
        last_update: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error(`Erro no Snapshot do player ${p.nick}:`, err.message);
    }
  });

  await Promise.all(updates);
  return { success: true, message: "Snapshot finalizado com sucesso!" };
});