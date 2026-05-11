# Mythos Draft — AI Project Context

> **Para IAs:** Este documento é a fonte da verdade sobre o projeto. Leia-o inteiro antes de qualquer implementação. Ele contém armadilhas conhecidas, padrões obrigatórios e decisões de arquitetura críticas.

---

## 1. O QUE É O PROJETO

**Mythos Draft** é uma plataforma web de draft competitivo para Age of Mythology: Retold (AoM). Usuários criam lobbies, se autenticam e fazem o draft de deuses e mapas em tempo real via Firestore.

**Forja de Hefesto** é um sub-módulo dentro do mesmo repositório — um hub para um torneio brasileiro semanal recorrente. Ela tem sistema de inscrições, perfis de jogadores, draft de times, tabelas de grupo e integração com dados do aomstats.io.

---

## 2. STACK TECNOLÓGICA

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 |
| Estilo | TailwindCSS 4 (`@tailwindcss/vite`) + CSS próprio |
| Banco de dados | Firebase Firestore (banco nomeado: `mythosdraft-prod`) |
| Auth | Firebase Auth (anônimo para o Draft; Discord OAuth2 para a Forja) |
| Backend | Firebase Cloud Functions v2 (Node.js, arquivo: `functions/index.js`) |
| Deploy | Firebase Hosting + Express server (`server.ts`) |
| Animações | Motion (Framer Motion v12) |
| Drag & Drop | @hello-pangea/dnd |

---

## 3. ESTRUTURA DE DIRETÓRIOS

```
mythos-draft-2/
├── src/
│   ├── App.tsx              # Roteamento principal + toda a lógica do Draft principal
│   ├── types.ts             # Tipos do DRAFT (Lobby, God, Map, DraftTurn…)
│   ├── constants.ts         # Re-exporta tudo de src/data/
│   ├── firebase.ts          # Inicialização Firebase + handleFirestoreError()
│   ├── data/                # gods.ts, maps.ts, draft.ts, translations.ts
│   ├── services/
│   │   ├── lobbyService.ts  # CRUD de lobbies no Firestore (~58KB, arquivo maior)
│   │   ├── draftService.ts  # Lógica de estado do draft (~28KB)
│   │   ├── discordService.ts# Webhook do Discord
│   │   └── soundService.ts  # Áudio
│   ├── hooks/               # Custom hooks React
│   ├── components/          # Componentes do Draft principal
│   └── features/
│       └── forja/           # MÓDULO FORJA (isolado)
│           ├── types.ts     # Tipos da Forja (ForjaPlayer, ForjaTeam…)
│           ├── ForjaHub.tsx # Shell da Forja (tabs, auth Discord)
│           ├── forja.css    # CSS exclusivo da Forja (~63KB)
│           ├── forjaUtils.ts# Helpers (effectiveElo, tier, etc.)
│           ├── services/forjaService.ts  # CRUD Firestore da Forja (~31KB)
│           ├── views/       # Páginas da Forja (ForjaInicio, ForjaTabela…)
│           └── components/  # Modais da Forja (AdminPlayerModal, etc.)
├── functions/
│   └── index.js             # Cloud Functions (updateEloSnapshot, fetchaomprofile)
├── firestore.rules          # Regras de segurança do Firestore
├── security_spec.md         # Especificação de segurança (Dirty Dozen)
├── firebase-applet-config.json # Config do Firebase (NÃO commitada com secrets)
└── .env                     # Variáveis de ambiente (VITE_VIBE_MODE, etc.)
```

---

## 4. AUTENTICAÇÃO

### Draft Principal
- Usa **Firebase Auth Anônimo** (`signInAnonymously`).
- O `uid` anônimo identifica o capitão no lobby.
- `captain1`, `captain2`, `adminId` no documento do lobby armazenam UIDs.

### Forja de Hefesto
- Usa **Discord OAuth2** implementado **client-side** via popup.
- O fluxo redireciona para `https://discord.com/oauth2/authorize`.
- O resultado é guardado em `localStorage` como `forja_discord_user` (JSON).
- **Estrutura do objeto:**
  ```ts
  ForjaDiscordUser {
    discord_id: string;   // ID numérico do Discord
    username: string;
    discriminator: string;
    avatar_url: string;   // URL do CDN do Discord
    access_token?: string;
  }
  ```
- A verificação de admin é feita **no Firestore**: `forja_players/{discord_id}.role === 'admin'`.
- **⚠️ LIMITAÇÃO DE SEGURANÇA CONHECIDA:** A auth Discord é client-side e não usa Firebase Auth real. Portanto, o `request.auth.uid` nas regras do Firestore é o UID anônimo, não o `discord_id`. As regras de `forja_players` usam `playerId` (que é o `discord_id`), mas o sistema confia na integridade do cliente para não alterar campos protegidos.

---

## 5. COLEÇÕES DO FIRESTORE

### Banco: `mythosdraft-prod`

| Coleção | Descrição | Chave do documento |
|---|---|---|
| `lobbies` | Sessões de draft | ID aleatório (gerado pelo app) |
| `lobbies/{id}/messages` | Chat do lobby | ID aleatório |
| `metadata` | Índice de lobbies ativos | `lobbyIndex` |
| `presets` | Presets de draft | ID do preset |
| `test/connection` | Ping de conectividade | fixo |
| `forja_players` | Jogadores inscritos na Forja | `discord_id` |
| `forja_teams` | Times formados no draft da Forja | ID do time |
| `forja_content` | CMS (regras, formato, premiação) | `rules`, `format`, `prize`, `tournament` |
| `forja_schedule` | Agenda de partidas | ID aleatório |
| `forja_meta` | Sessão de draft da Forja | `draft` |
| `forja_status` | Status de operações longas | `snapshot` |
| `forja_bans` | Lista de banimentos | `discord_id` |

---

## 6. CLOUD FUNCTIONS (`functions/index.js`)

### `updateEloSnapshot` (onCall)
- Chamada por Admin via UI.
- Itera todos `forja_players` com `aom_profile_id` ou `aom_id`.
- Busca stats em `form-retold.vercel.app` (scraper intermediário).
- Atualiza: `elo_1v1`, `elo_tg`, `elo_efetivo`, `elo_snapshot`, e condicionalmente `avatar_url` e `top_gods`.
- Usa merge (`set(..., { merge: true })`) para não apagar campos existentes.
- Escreve progresso em `forja_status/snapshot`.

### `fetchaomprofile` (onRequest — HTTP GET)
- **Nome da function é `fetchaomprofile` em letras MINÚSCULAS.**
- **⚠️ ARMADILHA CRÍTICA:** O nome da export no código é `fetchaomprofile` (lowercase). A URL do endpoint gerada pelo Firebase segue esse nome exatamente. Qualquer chamada a `FetchAomProfile` ou variações camelCase vai retornar 404. **Sempre verifique o nome exato no `functions/index.js`.**
- URL do endpoint: `https://us-central1-[PROJECT_ID].cloudfunctions.net/fetchaomprofile`
- Parâmetro: `?id=<aom_profile_id>`
- CORS liberado para: `https://mythosdraft.com`, `http://localhost:5173`, `http://localhost:3000`

---

## 7. TIPOS CRÍTICOS

### `ForjaPlayer` (src/features/forja/types.ts)
- `discord_id`: chave primária — é o ID do Discord e o document ID no Firestore.
- `aom_profile_id`: ID numérico do aomstats.io (número inteiro).
- `aom_id`: slug/alias para URLs do aomstats.
- `elo_efetivo`: calculado como `Math.round((elo_1v1 + elo_tg) / 2)`.
- `esports_elo_enabled` + `esports_elo_value`: quando `enabled === true`, o ELO efetivo exibido é `esports_elo_value` (usado para ex-profissionais).
- `top_gods_admin`: array de god IDs definido pelo Admin, sobrepõe o `top_gods` scrapeado.
- `status`: `'available' | 'drafted' | 'reserve' | 'rejected' | 'pending' | 'banned'`
- `role`: `'player' | 'admin'` — **nunca deixe o cliente escrever este campo sem validação server-side.**

### `Lobby` (src/types.ts)
- `adminId`: UID do criador do lobby (Firebase Auth anônimo).
- `config.forjaMatchId`, `config.forjaTeamA`, `config.forjaTeamB`: integração com a Forja.
- `timerStart`, `createdAt`, `lastActivityAt`: sempre use `serverTimestamp()` do Firestore, nunca `new Date()` do cliente.

---

## 8. PADRÕES DE CÓDIGO OBRIGATÓRIOS

### 8.1 Timestamps
```ts
// ✅ CORRETO
import { serverTimestamp } from 'firebase/firestore';
await updateDoc(ref, { lastActivityAt: serverTimestamp() });

// ❌ ERRADO — corrompe a ordenação no Firestore
await updateDoc(ref, { lastActivityAt: new Date() });
await updateDoc(ref, { lastActivityAt: Date.now() });
```

### 8.2 Merge em updates da Forja
```ts
// ✅ CORRETO — não apaga campos existentes
await setDoc(playerRef, updateData, { merge: true });

// ❌ ERRADO — pode zerar campos como esports_elo_enabled, top_gods_admin
await setDoc(playerRef, updateData);
```

### 8.3 Leitura de forja_players
```ts
// ✅ CORRETO — use snapshot listener para updates em tempo real
onSnapshot(collection(db, 'forja_players'), (snap) => {
  const players = snap.docs.map(d => ({ ...d.data(), discord_id: d.id } as ForjaPlayer));
});

// Ou para leitura única:
const snap = await getDocs(collection(db, 'forja_players'));
```

### 8.4 effectiveElo (forjaUtils.ts)
```ts
// Sempre use getEffectiveElo() de forjaUtils.ts — nunca recalcule inline
import { getEffectiveElo } from '../forjaUtils';
const elo = getEffectiveElo(player); // respeita esports_elo_enabled
```

### 8.5 Verificação de Admin
```ts
// No frontend (Forja):
const isAdmin = discordUser?.discord_id && player?.role === 'admin';

// No Firestore Rules:
function isAdmin() {
  return isSignedIn()
    && exists(/databases/$(database)/documents/forja_players/$(request.auth.uid))
    && get(...).data.role == 'admin';
}
// ⚠️ NOTA: como auth é anônima, request.auth.uid ≠ discord_id. As regras de admin
// via Firestore funcionam se o UID anônimo for também o document ID (não é o caso atual).
// Por isso, algumas operações admin são feitas via Cloud Functions com admin SDK.
```

### 8.6 Arquitetura de Leituras (Cold Fetch vs Real-Time)
**NUNCA utilize `onSnapshot` por padrão para dados CMS ou estáticos** (Regras, Map Pool, Settings, Cronograma). O uso indiscriminado de tempo real causa picos massivos de custo (Zombie Listeners / Multiplicação de Reads em navegação).
- **Dados CMS / Estáticos:** Utilize **Busca Fria (`get...Once()`) atrelada a Cache em Memória (Singleton)** no módulo de serviço (`forjaService.ts`).
- **Mutação de Cache:** Operações de escrita pelo Admin devem mutar o Cache local IMEDIATAMENTE após sucesso no Firestore, para atualização seamless sem F5.
- **Eventos Ao Vivo (Draft):** Para dados como `forja_teams`, utilize `useForjaTeams(true)` (flag `isLive`) apenas nas views de Draft/Admin para habilitar o Web Socket, mantendo as demais rotas públicas com fetch frio.

---

## 9. BUGS CONHECIDOS E ARMADILHAS

### 9.1 ⚠️ CASE-SENSITIVITY NA CLOUD FUNCTION
**O bug mais recente (maio/2026):** A Cloud Function exportada como `exports.fetchaomprofile` (tudo minúsculo) gerava URL `fetchaomprofile`. Chamadas de código usando `FetchAomProfile` ou `fetchAomProfile` falhavam com 404 silencioso.
**Regra:** Sempre confirme o nome exato da export em `functions/index.js` antes de chamar via HTTP.

### 9.2 ⚠️ Timestamp Serialization
Ao sanitizar dados de lobby para Firestore, nunca converta `Timestamp` do Firestore para `number` ou `string`. Isso quebra a ordenação e gera lobbies fora de ordem.

### 9.3 ⚠️ PWA / Service Worker conflitando com Firestore
O Vite PWA pode interceptar requests do Firestore offline e devolver dados stale. Se o Firestore parar de receber updates, verificar se o SW não está bloqueando a rota.

### 9.4 ⚠️ Lobby só aparece na lista pública quando ambos capitães entraram
`captain1Name` e `captain2Name` devem estar preenchidos. O índice de lobbies só lista sessões com os dois presentes.

### 9.5 ⚠️ Atualização condicional de avatar_url
Na Cloud Function, `avatar_url` só é atualizado se a API retornar um valor não-nulo. Isso preserva avatars do Discord configurados manualmente pelo Admin.

---

## 10. SEGURANÇA — ESTADO ATUAL E GAPS

### O que está protegido (Firestore Rules)
- Lobbies: apenas participantes (captain1, captain2, adminId) podem atualizar.
- Lobbies finalizados (`status === 'finished'`) não podem ser atualizados.
- `forja_teams`, `forja_content`, `forja_schedule`, `forja_meta`, `forja_status`, `forja_bans`: apenas admin pode escrever.
- `forja_players`: admin pode tudo; jogador só pode alterar `profile_link`, `availability`, `catchphrase`.

### Gaps de Segurança Conhecidos (PRIORIDADE ALTA)
1. **Autenticação da Forja é client-side:** O `discord_id` não é verificado server-side. Um atacante pode criar um documento `forja_players` com o `discord_id` de outra pessoa.
2. **`role: 'admin'` pode ser injetado na criação:** A regra `allow create: if isSignedIn()` não valida que `role !== 'admin'`. Qualquer usuário autenticado pode criar um documento com `role: 'admin'` se ainda não existir.
3. **API Key hardcoded em `functions/index.js`:** A `API_KEY = 'mythosdraftweb_8b73...'` está no código-fonte. Deveria estar em `process.env` / Firebase Secrets.
4. **`metadata` write aberto a qualquer autenticado:** Qualquer usuário pode corromper o índice de lobbies.
5. **`presets` create aberto a qualquer autenticado:** Deveria ser restrito a admins.

### Recomendações imediatas
```
// firestore.rules — adicionar no create de forja_players:
allow create: if isSignedIn()
              && !exists(...)
              && !('role' in request.resource.data)  // ← ADICIONAR ISSO
              && request.resource.data.get('role', 'player') == 'player';
```

---

## 11. VARIÁVEIS DE AMBIENTE

```env
# .env
VITE_VIBE_MODE=DEVELOPMENT   # ou 'PRODUCTION'
VITE_DISCORD_CLIENT_ID=...   # Client ID do app Discord
```

```json
// firebase-applet-config.json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "mythosdraft-prod"
}
```

---

## 12. FLUXO DA FORJA DE HEFESTO (Torneio Semanal)

```
Sábado:
  13:59 BRT → Inscrições fecham (registration_deadline_ms)
  14:00 BRT → Snapshot de ELO (Admin dispara updateEloSnapshot)
  14:00 BRT → Admin define seeds por ELO efetivo
  15:00 BRT → Draft de times começa (ForjaAdminDraft.tsx)
    └── Times escolhem jogadores em ordem snake
    └── Resultado salvo em forja_teams + forja_meta
  Após draft → Partidas acontecem, resultados em forja_schedule
```

### Draft de Times (ForjaDraftSession)
- Rounds: `B` (cobra invertida) e `C` (ordem direta).
- `pick_order_sequence`: array de `team_id` definindo a ordem snake.
- `current_pick_index`: posição atual no sequence.
- Capitães interagem via `ForjaDraftRoom.tsx` (viewers) e `ForjaAdminDraft.tsx` (controle).

---

## 13. INTEGRAÇÃO AOM.GG / AOMSTATS

- **API intermediária:** `form-retold.vercel.app` (scraper Node.js, não é nossa)
- **Endpoints usados:**
  - `GET /api/stats-by-id/{profileId}` → stats por ID numérico
  - `GET /api/stats/{nick}` → stats por nickname (fallback se 404)
  - `GET /api/gods/{profileId}` → top deuses
- **Autenticação:** Header `X-API-Key` + `Origin: https://mythosdraft.com`
- **Rate limiting:** 200ms entre requests na função de snapshot, retry 3x em 429.

---

## 14. COMANDOS ÚTEIS

```powershell
# Rodar em dev
npm run dev

# Build de produção
npm run build

# Verificar tipos TypeScript
npm run lint

# Deploy Cloud Functions
cd functions && firebase deploy --only functions

# Deploy Firestore Rules
firebase deploy --only firestore:rules

# Deploy completo
firebase deploy
```

---

## 15. CHECKLIST PRE-IMPLEMENTAÇÃO (para IAs)

Antes de implementar qualquer coisa, confirme:
- [ ] Estou usando `serverTimestamp()` e não `new Date()`?
- [ ] Estou usando `setDoc(..., { merge: true })` em updates de forja_players?
- [ ] O nome da Cloud Function que estou chamando bate exatamente com a export em `functions/index.js`?
- [ ] Campos protegidos (`role`, `esports_elo_enabled`, `esports_elo_value`, `top_gods_admin`, `seed`, `status`, `team_id`) estão sendo editados apenas via admin?
- [ ] Estou usando `getEffectiveElo()` de `forjaUtils.ts` para calcular ELO exibido?
- [ ] Timestamps do Firestore não estão sendo serializados para JSON sem tratamento especial?
- [ ] Novo campo adicionado a `ForjaPlayer` ou `Lobby` está nas Firestore Rules se necessário?
