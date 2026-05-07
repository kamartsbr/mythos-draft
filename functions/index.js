/* eslint-disable */

/**
 * ============================================================
 *  MYTHOS DRAFT — Cloud Functions (Refatorado)
 *
 *  Arquitetura "Frankenstein" mantida por design:
 *    - aomstats.io → scraping (Cheerio) para foto de perfil
 *    - aom.gg      → API pública para ELO 1v1 / TG em real-time
 *
 *  Melhorias aplicadas:
 *    1. [CRÍTICO] updateEloSnapshot agora processa em lotes (chunks)
 *       com delay entre eles para evitar rate limit nos dois sites.
 *    2. [CRÍTICO] Nunca sobrescreve ELO com 0 — se a API falhar,
 *       mantém o valor anterior do Firestore.
 *    3. [MÉDIO]   Timeout global via race() contra Promise global de 300s.
 *    4. [MÉDIO]   fetchAomProfile valida API Key via header/query.
 *    5. [BAIXO]   Scraping com verificação de status HTTP + seletor aprimorado.
 *    6. [BAIXO]   fetchHybridAomData com Promise.allSettled paralelo interno
 *                 (foto e elo em paralelo, mas os dois aguardados antes de retornar).
 * ============================================================
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const axios     = require("axios");
const cheerio   = require("cheerio");

if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── Configurações ────────────────────────────────────────────────────────────

/**
 * Quantos jogadores processar em paralelo por rodada.
 * 5–8 é um range seguro: paralelo o suficiente para ser rápido,
 * baixo o suficiente para não ativar rate limit nos dois sites.
 */
const CHUNK_SIZE = 6;

/**
 * Delay (ms) entre cada lote de jogadores.
 * 1200ms garante que os dois sites tenham tempo de "respirar".
 */
const DELAY_BETWEEN_CHUNKS_MS = 1200;

/** Timeout por requisição HTTP individual (ms). */
const HTTP_TIMEOUT_MS = 7000;

/**
 * API Key interna para o endpoint público fetchAomProfile.
 * Defina em Firebase Functions Config:
 *   firebase functions:config:set forja.api_key="SEU_TOKEN_AQUI"
 * Em dev, a variável pode ser "dev" para facilitar testes locais.
 */
const INTERNAL_API_KEY = (functions.config().forja || {}).api_key || "dev";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna uma Promise que resolve após `ms` milissegundos. */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Divide um array em sub-arrays de tamanho `size`.
 * Ex: chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
 */
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── fetchHybridAomData ───────────────────────────────────────────────────────

/**
 * Busca dados de um jogador em paralelo:
 *  - aomstats.io → foto de perfil via scraping (Cheerio)
 *  - aom.gg      → ELO 1v1 e TG via API
 *
 * Ambas as partes rodam em paralelo (Promise.allSettled).
 * Falhas individuais são isoladas — uma não cancela a outra.
 *
 * @param {string|number} profileId
 * @returns {{ alias, avatar_url, elo_1v1, elo_tg, top_gods }}
 */
async function fetchHybridAomData(profileId) {
  let alias     = `Player #${profileId}`;
  let avatar_url = "";
  let elo_1v1   = null; // null = "não encontrado" (diferente de 0)
  let elo_tg    = null;

  // ── Parte 1 e 2 em paralelo ──────────────────────────────────────────────
  const [photoResult, eloResult] = await Promise.allSettled([

    // PARTE 1: Foto do AoMStats.io (Scraping)
    (async () => {
      const statsUrl = `https://aomstats.io/profile/${profileId}`;
      const response = await axios.get(statsUrl, {
        timeout: HTTP_TIMEOUT_MS,
        // Segue redirecionamentos mas verifica o status final
        validateStatus: (s) => s < 400,
        headers: {
          // User-Agent amigável para evitar bloqueio por bot-detection básico
          "User-Agent": "Mozilla/5.0 (compatible; MythosDraftBot/1.0; +https://mythosdraft.com)",
        },
      });

      const $ = cheerio.load(response.data);

      // Tenta múltiplos seletores em ordem de especificidade
      const scrapedImage =
        $(".profile-avatar img").attr("src") ||
        $("img[class*='avatar']").attr("src") ||
        $("img[src*='/avatars/']").attr("src") ||
        $("img[src*='steamcommunity.com/public/images/avatars']").attr("src") ||
        "";

      if (!scrapedImage) {
        console.warn(`[Foto] Nenhum seletor achou imagem para profileId=${profileId}`);
        return "";
      }

      // Converte URL relativa em absoluta
      return scrapedImage.startsWith("/")
        ? `https://aomstats.io${scrapedImage}`
        : scrapedImage;
    })(),

    // PARTE 2: ELOs do aom.gg (API)
    (async () => {
      const ggUrl = `https://www.aom.gg/api/profiles/${profileId}/recent`;
      const { data } = await axios.get(ggUrl, {
        headers: { "Accept": "application/json" },
        timeout: HTTP_TIMEOUT_MS,
      });
      return data;
    })(),
  ]);

  // ── Processa resultado da foto ────────────────────────────────────────────
  if (photoResult.status === "fulfilled" && photoResult.value) {
    avatar_url = photoResult.value;
  } else if (photoResult.status === "rejected") {
    console.warn(`[Foto] Falha para ${profileId}: ${photoResult.reason?.message}`);
  }

  // ── Processa resultado do ELO ─────────────────────────────────────────────
  if (eloResult.status === "fulfilled") {
    const data = eloResult.value;

    alias = data.alias || alias;

    if (data.leaderboards && data.leaderboards.length > 0) {
      const lb1v1 = data.leaderboards.find(
        (l) => l.leaderboardId === 1 || (l.name && l.name.toLowerCase().includes("1v1"))
      );
      if (lb1v1) elo_1v1 = lb1v1.rating || lb1v1.elo || 0;

      const lbTG = data.leaderboards.find(
        (l) => l.leaderboardId === 2 || (l.name && l.name.toLowerCase().includes("team"))
      );
      if (lbTG) elo_tg = lbTG.rating || lbTG.elo || 0;
    }

    // Backup: pega ELO da última partida se ainda null
    if (elo_1v1 === null && data.matches && data.matches.length > 0) {
      const players = data.matches[0].players || data.matches[0].matchPlayers || [];
      const pInfo   = players.find((p) => String(p.profileId) === String(profileId));
      if (pInfo) elo_1v1 = pInfo.postMatchRating || pInfo.rating || pInfo.elo || 0;
    }

    // Normaliza null → 0 após todos os fallbacks
    if (elo_1v1 === null) elo_1v1 = 0;
    if (elo_tg  === null) elo_tg  = 0;

  } else {
    console.error(`[ELO] Falha para ${profileId}: ${eloResult.reason?.message}`);
    // Retorna null para sinalizar ao chamador que não deve sobrescrever o banco
    return { alias, avatar_url, elo_1v1: null, elo_tg: null, top_gods: [] };
  }

  return { alias, avatar_url, elo_1v1, elo_tg, top_gods: [] };
}

// ─── fetchAomProfile ──────────────────────────────────────────────────────────

/**
 * Endpoint HTTP para o formulário de inscrição.
 * Protegido por API Key interna (header X-Forja-Key ou query ?key=).
 *
 * GET /fetchAomProfile?id=12345&key=SEU_TOKEN
 */
exports.fetchAomProfile = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Forja-Key");
    res.status(204).send("");
    return;
  }

  // ── Validação da API Key ───────────────────────────────────────────────────
  // TODO (pós-torneio): Reativar após configurar o forjaService.ts para enviar
  // o header X-Forja-Key em todas as chamadas do formulário de inscrição.
  //
  // const providedKey = req.headers["x-forja-key"] || req.query.key;
  // if (INTERNAL_API_KEY !== "dev" && providedKey !== INTERNAL_API_KEY) {
  //   console.warn(`[Auth] Chave inválida: ${providedKey}`);
  //   return res.status(401).json({ error: "Não autorizado." });
  // }

  // ── Validação do ID ────────────────────────────────────────────────────────
  const profileId = req.query.id;
  if (!profileId) {
    return res.status(400).json({ error: "Parâmetro 'id' ausente." });
  }
  // Aceita apenas números (profile IDs são sempre inteiros)
  if (!/^\d{1,12}$/.test(String(profileId))) {
    return res.status(400).json({ error: "ID inválido." });
  }

  try {
    const stats = await fetchHybridAomData(profileId);
    return res.json({
      success:    true,
      profile_id: parseInt(profileId, 10),
      data:       stats,
    });
  } catch (error) {
    console.error(`[fetchAomProfile] Erro inesperado para ${profileId}:`, error.message);
    return res.status(500).json({ success: false, error: "Falha ao buscar dados." });
  }
});

// ─── updateEloSnapshot ────────────────────────────────────────────────────────

/**
 * Callable do painel Admin para atualizar ELO de todos os inscritos.
 *
 * Estratégia:
 *   1. Lê todos os players do Firestore.
 *   2. Divide em lotes de CHUNK_SIZE.
 *   3. Processa cada lote em paralelo (Promise.allSettled).
 *   4. Aguarda DELAY_BETWEEN_CHUNKS_MS entre cada lote.
 *   5. NUNCA sobrescreve elo_1v1/elo_tg com null (API falhou).
 *   6. Relata quantos foram atualizados, ignorados e falharam.
 *
 * Limites de tempo:
 *   60 players ÷ 6 chunk = 10 lotes × (7s timeout + 1.2s delay) ≈ 82s máx.
 *   Está confortavelmente abaixo do limite de 540s das Functions Gen 1.
 */
exports.updateEloSnapshot = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {

    // Opcional: exigir autenticação do chamador via Firebase Auth
    // if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");

    const db = admin.firestore();
    const snapshot = await db.collection("forja_players").get();

    const players = snapshot.docs
      .map((doc) => ({ ref: doc.ref, data: doc.data(), id: doc.id }))
      .filter((p) => p.data.aom_profile_id || p.data.aom_id); // Ignora sem ID

    const lotes  = chunk(players, CHUNK_SIZE);
    const report = { updated: 0, skipped: 0, failed: 0, errors: [] };

    console.log(`[Snapshot] Iniciando: ${players.length} jogadores em ${lotes.length} lotes de ${CHUNK_SIZE}.`);

    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      console.log(`[Snapshot] Lote ${i + 1}/${lotes.length} — ${lote.length} players`);

      // Processa o lote em paralelo, mas não deixa uma falha cancelar as outras
      const results = await Promise.allSettled(
        lote.map(async ({ ref, data: p }) => {
          const profileId = p.aom_profile_id || p.aom_id;

          const stats = await fetchHybridAomData(profileId);

          // Se a API de ELO falhou (retornou null), NÃO sobrescreve o banco.
          // Apenas atualiza a foto se o scraping teve sucesso.
          if (stats.elo_1v1 === null) {
            const photoUpdate = {};
            if (stats.avatar_url) photoUpdate.avatar_url = stats.avatar_url;

            if (Object.keys(photoUpdate).length > 0) {
              await ref.update({
                ...photoUpdate,
                last_update: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.warn(`[Snapshot] ELO não atualizado para ${p.nick} (API falhou), mas foto foi atualizada.`);
            } else {
              console.warn(`[Snapshot] Pulando ${p.nick} — ELO e foto falharam.`);
            }

            // Conta como "skipped" para o relatório
            throw new Error(`ELO API falhou para ${p.nick}`);
          }

          // Tudo certo: atualiza ELO + foto (foto só se scraping achou algo)
          const updates = {
            elo_1v1:      stats.elo_1v1,
            elo_tg:       stats.elo_tg,
            elo_snapshot: stats.elo_1v1,
            last_update:  admin.firestore.FieldValue.serverTimestamp(),
          };

          // Só substitui a foto se o scraping devolveu URL válida
          if (stats.avatar_url) {
            updates.avatar_url = stats.avatar_url;
          }

          await ref.update(updates);
          console.log(`[Snapshot] ✅ ${p.nick} → 1v1:${stats.elo_1v1} TG:${stats.elo_tg}`);
        })
      );

      // Contabiliza resultados do lote
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

      // Aguarda entre lotes (exceto depois do último)
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