/* eslint-disable */
const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");

exports.fetchAomProfile = functions.https.onRequest(async (req, res) => {
  // Libera o acesso para o seu site (CORS)
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  const profileId = req.query.id;
  if (!profileId) {
    return res.status(400).json({ error: "ID do perfil ausente." });
  }

  try {
    const url = `https://aomstats.io/profiles/${profileId}`;
    
    // Faz o download do HTML da página do AoMStats disfarçado de navegador
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(html);

    // Lógica de Scraping: Pegando os dados do HTML
    const alias = $("h1").first().text().trim() || "Usuário Desconhecido";
    const avatar_url = $("img[src*='avatars']").attr("src") || "";
    const elo_1v1 = parseInt($(".rating-value").first().text().replace(/\D/g, "")) || 0;

    res.json({
      profile_id: parseInt(profileId),
      alias: alias,
      avatar_url: avatar_url,
      elo_1v1: elo_1v1,
      elo_tg: 0, 
      top_gods: []
    });

  } catch (error) {
    console.error("Erro no Scraping:", error.message);
    res.status(500).json({ error: "Não foi possível ler os dados do AoMStats." });
  }
});