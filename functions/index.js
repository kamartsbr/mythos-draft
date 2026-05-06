/* eslint-disable */
const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");

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
    return res.status(400).json({ error: "ID do perfil ausente." });
  }

  try {
    const url = `https://aomstats.io/profile/${profileId}`;
    
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 8000 
    });

    const $ = cheerio.load(html);

    // 1. Dados Básicos
    const alias = $("h1").first().text().trim() || "Usuário Desconhecido";
    const avatar_url = $(".profile-avatar img").attr("src") || $("img[src*='avatars']").attr("src") || "";

    // 2. Extração de ELOs (Buscando nas tabelas de estatísticas)
    let elo_1v1 = 0;
    let elo_tg = 0;

    $(".rating-container").each((i, el) => {
      const label = $(el).find(".rating-label").text().toLowerCase();
      const value = parseInt($(el).find(".rating-value").text().replace(/\D/g, "")) || 0;
      
      if (label.includes("1v1")) elo_1v1 = value;
      if (label.includes("team")) elo_tg = value;
    });

    // 3. Extração dos Top 5 Deuses
    const top_gods = [];
    $(".god-stats-row").slice(0, 5).each((i, el) => {
      const godName = $(el).find(".god-name").text().trim();
      const godImg = $(el).find(".god-icon img").attr("src");
      const winRate = parseInt($(el).find(".win-rate").text().replace(/\D/g, "")) || 0;
      const playRate = parseInt($(el).find(".play-rate").text().replace(/\D/g, "")) || 0;

      if (godName) {
        top_gods.push({
          god: godName.toLowerCase(),
          godName: godName,
          image: godImg,
          winRate: winRate,
          playRate: playRate
        });
      }
    });

    res.json({
      success: true,
      profile_id: parseInt(profileId),
      alias: alias,
      avatar_url: avatar_url,
      elo_1v1: elo_1v1,
      elo_tg: elo_tg, 
      top_gods: top_gods
    });

  } catch (error) {
    console.error(`Erro ao processar perfil ${profileId}:`, error.message);
    
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ success: false, error: "Perfil não encontrado." });
    }

    res.status(500).json({ success: false, error: "Falha na integração com AoMStats." });
  }
});