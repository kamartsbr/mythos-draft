1. Listeners + Service Worker
src/lib/serverTime.ts: onSnapshot com handler de erro, timeout (~12s), cleanup garantido da subscription e ordem segura (unsub via ref).
src/components/Draft/StreamerHUD.tsx: manualMode lido via useRef para não reabrir o listener do lobby ao alternar modo manual.
vite.config.ts: navigateFallbackDenylist e runtimeCaching NetworkOnly também para firebase.googleapis.com, identitytoolkit.googleapis.com e securetoken.googleapis.com.
src/services/lobbyService.ts: subscribeToMessages com callback de erro (handleFirestoreError).
2. Persistência / roster / substituições
joinLobby: nomes de time com .trim() em playerNames[100] / [200]; removida a lógica que tratava placeholders como “sem nome customizado” e sobrescrevia com nickname.
src/services/draftService.ts: ao avançar de game em _processReportLogic, limpa lastSubs, rosterChangedA e rosterChangedB; updateRoster só atualiza lastSubs se houver subs, define rosterChangedA/B quando há mudança real de nomes ou substituições (dev espelhado).
setReady (Firestore + mock dev): ao entrar em drafting, zera rosterChangedA e rosterChangedB.
src/components/Draft/RosterEditor.tsx: reinicializa editedPicks quando mudam rosterSyncKey (lobby / team / game / phase).
3. Regras da lobby list
PUBLIC_LOBBIES_PAGE_SIZE = 20, isLobbyEligibleForPublicList, filterPublicSummaries, lobbyDocToSummary em lobbyService.ts.
Lista pública só com captain1 e captain2 preenchidos; no máximo 20 itens (índice, fallback, subscribe e dev local).
getLobbiesPaginated: busca em lotes de 50 até obter 20 elegíveis (cursor em _lastLobbyScanDoc).
LobbySummary em types.ts: campos opcionais captain1 / captain2.
useLobby, App: usam PUBLIC_LOBBIES_PAGE_SIZE; join na lista usa só captain1/captain2 do summary (removido spectators inválido no tipo).
useLobby: isFull como !!(...) para TypeScript (evita string | boolean em setIsSpectator).
4. Streamer HUD (UI)
Conteúdo principal z-[55], painéis de subs z-[45], aviso Snake z-[110]; colunas mais estreitas e menos translate-y para não cobrir os picks.
5. Validação / tooling
docs/regression-checklist-stabilization.md: checklist manual (2 clientes, lista, subs, SW).
tsconfig.json: ignoreDeprecations ajustado para "5.0" (valor inválido "6.0" quebrava o tsc).
Nota: npm run build no Windows ainda falha por causa do script rm -rf em package.json (ambiente), não por estas alterações. Após npm install, o tsc ainda acusa outros erros antigos no projeto (allowSyntheticDefaultImports, etc.); só o ponto de isSpectator acima foi corrigido de forma isolada.

Se quiser, no próximo passo podemos trocar o script de build para algo cross-platform (rimraf ou node -e "fs.rmSync(...)").