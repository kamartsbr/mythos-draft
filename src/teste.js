const axios = require("axios");

async function testarID() {
  const config = { 
    headers: { 
      'X-API-Key': 'mythosdraftweb_8b73781cc25e8f45b77bb760146a19dad427168c22fa8cad',
      'Origin': 'https://mythosdraft.com' 
    } 
  };

  const id = '1076415633';

  try {
    // 1. Busca Stats
    const statsRes = await axios.get(`https://form-retold.vercel.app/api/stats-by-id/${id}`, config);
    console.log("📊 STATS E ELO:\n", statsRes.data);

    // 2. Busca Deuses
    const godsRes = await axios.get(`https://form-retold.vercel.app/api/gods/${id}`, config);
    console.log("\n⚡ TOP GODS:\n", godsRes.data);

  } catch (err) {
    console.error("ERRO:", err.message, err.response?.data);
  }
}

testarID();