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
  }
}

// Validate all extractions before file writes
const validations = [];
if (!matchCardCode) validations.push('MatchConfrontationCard extraction failed');
if (!adminAccordionCode) validations.push('Admin Accordion extraction failed');
if (!matchCenterCode) validations.push('Match Center extraction failed');
if (!hooksCode) validations.push('Hooks extraction failed');

if (validations.length > 0) {
  console.error('Extraction validation failed:');
  validations.forEach(v => console.error(`  - ${v}`));
  process.exit(1);
}

// Validate replacement points in home
const homeOldStandingsStart = `{/* ── Tabela de Grupos Compacta ── */}`;
const homeEnd = `</section>\n  );\n}`;
const propsMarker = /\/\/ ─── Props ───/;
const currentUserMarker = /const currentUserId = discordUser\?\.discord_id \?\? null;/;

if (!home.match(propsMarker)) {
  console.error('Props marker not found in ForjaHome.tsx');
  process.exit(1);
}
if (!home.match(currentUserMarker)) {
  console.error('currentUserId marker not found in ForjaHome.tsx');
  process.exit(1);
}
if (home.indexOf(homeOldStandingsStart) === -1) {
  console.error('Old standings marker not found in ForjaHome.tsx');
  process.exit(1);
}

// 5. Apply mutations to inicio
if (cardMatch) {
  inicio = inicio.replace(cardMatch[0], '');
}
sIdx = inicio.indexOf(adminAccordionStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(adminAccordionEnd, sIdx);
  if (eIdx !== -1) {
    eIdx += adminAccordionEnd.length;
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}
sIdx = inicio.indexOf(standingsStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(matchCenterEnd, sIdx);
  if (eIdx !== -1) {
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}
sIdx = inicio.indexOf(hooksStart);
if (sIdx !== -1) {
  let eIdx = inicio.indexOf(hooksEnd, sIdx);
  if (eIdx !== -1) {
    eIdx += hooksEnd.length;
    inicio = inicio.substring(0, sIdx) + inicio.substring(eIdx);
  }
}

// 6. Inject into ForjaHome.tsx
home = home.replace(propsMarker, matchCardCode + '\n// ─── Props ───');
home = home.replace(currentUserMarker, `const currentUserId = discordUser?.discord_id ?? null;\n\n  ${hooksCode}`);

// In ForjaHome.tsx, we replace the old standings with the new standings + match center + admin accordion
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
