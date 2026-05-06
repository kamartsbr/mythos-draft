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
 * Centraliza a captura de dados com seletores mais robustos
 */
async function scrapeAomData(profileId) {
  const url = `https://us-central1-boxwood-plating-368522.cloudfunctions.net/fetchAomProfile?id=${id}`;
  
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 12000 
  });

  const $ = cheerio.load(html);

  // 1. Nick e Avatar
  const alias = $("h1").first().text().trim() || "Usuário Desconhecido";
  let avatar_url = $(".profile-avatar img").attr("src") || $("img[src*='avatars']").attr("src") || "";
  
  // Garante URL absoluta para o avatar
  if (avatar_url && avatar_url.startsWith('/')) {
    avatar_url = `https://aomstats.io${avatar_url}`;
  }

  // 2. Extração de ELOs (Busca por containers e labels flexíveis)
  let elo_1v1 = 0;
  let elo_tg = 0;

  $(".rating-container, .rating-card, .p-4.rounded-lg.bg-gray-800").each((i, el) => {
    const text = $(el).text().toLowerCase();
    const valueText = $(el).find(".rating-value, .text-2xl, .font-bold").first().text();
    const value = parseInt(valueText.replace(/\D/g, "")) || 0;
    
    if (text.includes("1v1")) {
      elo_1v1 = value;
    } else if (text.includes("team") || text.includes("tg")) {
      elo_tg = value;
    }
  });

  // 3. Extração dos Top 5 Deuses
  const top_gods = [];
  $(".god-stats-row, tr:has(.god-name)").slice(0, 5).each((i, el) => {
    const godName = $(el).find(".god-name, td:first-child").first().text().trim();
    let godImg = $(el).find("img[src*='gods'], .god-icon img").attr("src");

    if (godName && godName.toLowerCase() !== "god") { // Evita pegar o cabeçalho da tabela
      if (godImg && godImg.startsWith('/')) {
        godImg = `https://aomstats.io${godImg}`;
      }

      top_gods.push({
        god: godName.toLowerCase(),
        godName: godName,
        image: godImg || ""
      });
    }
  });

  return { alias, avatar_url, elo_1v1, elo_tg, top_gods };
}

/**
 * Endpoint para o Formulário de Inscrição
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
 */
exports.updateEloSnapshot = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  // Busca apenas inscritos que tenham ID do AoMStats
  const snapshot = await db.collection("inscritos_forja").get();

  const updates = snapshot.docs.map(async (doc) => {
    const p = doc.data();
    const profileId = p.aom_profile_id || p.aom_id;
    
    if (!profileId) return null;

    try {
      const stats = await scrapeAomData(profileId);
      
      return doc.ref.update({
        elo_1v1: stats.elo_1v1,
        elo_tg: stats.elo_tg,
        elo_snapshot: stats.elo_1v1, 
        top_gods: stats.top_gods,
        avatar_url: stats.avatar_url || p.avatar_url, // Mantém o antigo se o novo falhar
        last_update: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error(`Erro no Snapshot do player ${p.nick} (ID: ${profileId}):`, err.message);
      return null;
    }
  });

  await Promise.all(updates);
  return { success: true, message: "Snapshot finalizado!" };
});gi