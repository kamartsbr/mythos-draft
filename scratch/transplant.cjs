const fs = require('fs');

const inicioPath = 'src/features/forja/views/ForjaInicio.tsx';
const homePath = 'src/features/forja/views/ForjaHome.tsx';

let inicio = fs.readFileSync(inicioPath, 'utf8');
let home = fs.readFileSync(homePath, 'utf8');

// 1. In ForjaHub.tsx, we need to make sure activeTab === 'inicio' has 95vw.
const hubPath = 'src/features/forja/ForjaHub.tsx';
let hub = fs.readFileSync(hubPath, 'utf8');
hub = hub.replace(
  /activeTab === 'times' \|\| activeTab === 'inscritos'/g,
  "activeTab === 'times' || activeTab === 'inscritos' || activeTab === 'inicio'"
);
fs.writeFileSync(hubPath, hub, 'utf8');

// 2. Extract MatchConfrontationCard from ForjaInicio.tsx
const cardMatch = inicio.match(/\/\/ ─── MatchConfrontationCard ───[\s\S]*?(?=\/\/ ─── Props ───)/);
let matchCardCode = '';
if (cardMatch) {
  matchCardCode = cardMatch[0];
  inicio = inicio.replace(cardMatch[0], '');
}

// 3. Extract the Admin Accordion, Standings, and Match Center JSX from ForjaInicio.tsx
// It's inside the return of ForjaInicio.
const adminAccordionRegex = /\{\/\* ── Admin Accordion ── \*\/\}[\s\S]*?(?=\{\/\* ── Error Banner ── \*\/\}|\{error && \()/;
// Wait, the Admin Accordion in the diff is around line 1250, starting with `{isAdmin && (` and having `showCreateForm`.
// Instead of complex regex, let's just use string boundaries.
const adminAccordionStart = `{isAdmin && (\n        <div style={{ marginBottom: '2rem' }}>\n          <button \n            onClick={() => setShowCreateForm(!showCreateForm)}`;
const adminAccordionEnd = `🚀 Inicializar Partida Oficial\n                </button>\n              </div>\n            </div>\n          )}\n        </div>\n      )}`;

let adminAccordionCode = '';
let sIdx = inicio.indexOf(adminAccordionStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(adminAccordionEnd, sIdx);
  if (eIdx !== -1) {
    eIdx += adminAccordionEnd.length;
    adminAccordionCode = inicio.substring(sIdx, eIdx);
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}

const standingsStart = `{/* ── Classificação - Fase de Grupos ── */}`;
const matchCenterEnd = `</section>\n  );\n}`;
let matchCenterCode = '';
sIdx = inicio.indexOf(standingsStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(matchCenterEnd, sIdx);
  if (eIdx !== -1) {
    matchCenterCode = inicio.substring(sIdx, eIdx);
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}

// 4. Extract hooks and states
const hooksStart = `// ─── Match Center Merged States ───`;
const hooksEnd = `const handleDeleteMatch = async (lobbyId: string) => {\n    if (!confirm('Tem certeza que deseja remover esta partida? Esta ação é irreversível.')) return;\n    try {\n      await deleteForjaLobby(lobbyId);\n    } catch (err: any) {\n      alert(\`Erro ao remover: \${err.message}\`);\n    }\n  };\n`;
let hooksCode = '';
sIdx = inicio.indexOf(hooksStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(hooksEnd, sIdx);
  if (eIdx !== -1) {
    eIdx += hooksEnd.length;
    hooksCode = inicio.substring(sIdx, eIdx);
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}

// 5. Inject into ForjaHome.tsx
if (matchCardCode) {
  home = home.replace(/\/\/ ─── Props ───/, matchCardCode + '\n// ─── Props ───');
}

if (hooksCode) {
  home = home.replace(/const currentUserId = discordUser\?\.discord_id \?\? null;/, `const currentUserId = discordUser?.discord_id ?? null;\n\n  ${hooksCode}`);
}

// In ForjaHome.tsx, we replace the old standings with the new standings + match center + admin accordion
const homeOldStandingsStart = `{/* ── Tabela de Grupos Compacta ── */}`;
const homeEnd = `</section>\n  );\n}`;
sIdx = home.indexOf(homeOldStandingsStart);
if (sIdx !== -1) {
  let eIdx = home.indexOf(homeEnd, sIdx);
  if (eIdx !== -1) {
    home = home.substring(0, sIdx) + adminAccordionCode + '\n\n' + matchCenterCode + '\n' + home.substring(eIdx);
  }
}

fs.writeFileSync(inicioPath, inicio, 'utf8');
fs.writeFileSync(homePath, home, 'utf8');

console.log("Transplant complete!");
