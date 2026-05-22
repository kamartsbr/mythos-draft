# Especificação de Refatoração da Engine de Draft (Draft Engine Overhaul)

Este documento estabelece o plano detalhado para a refatoração do motor de draft (Draft Engine) do Mythos Draft, seguindo o fluxo de **Spec-Driven Development**.

---

## 1. Diagnóstico do Estado Atual (Débitos Técnicos)

Atualmente, a lógica de negócio do draft está distribuída e acoplada em três partes principais:
1. **`src/types.ts`**: Utilização excessiva de `any` para tipos complexos ou timestamps do Firestore (ex: `scheduledDate`, `lastActivityAt`, `timerStart`, `createdAt`, `timerPausedAt`, `turnEndsAt`). Isso enfraquece a segurança do TypeScript e pode ocultar bugs de runtime.
2. **`src/services/draftService.ts`**: O serviço gerencia o fluxo transacional do Firestore e, ao mesmo tempo, executa mutações mutáveis complexas nas funções `_processActionLogic` e `_processReportLogic`. Há acoplamento direto com localStorage para ambiente de desenvolvimento (`IS_DEV`), serialização/limpeza de dados e tratamento de erros do Firestore.
3. **`src/hooks/useDraft.ts`**: Além de expor estado ao React, este hook deriva papéis de capitães, mantém estados otimistas, calcula a timeline de turnos com `generateStandardTurnOrder` e coordena ações automáticas acionadas por timers (e.g., auto-picks de ADMIN e expiração de relatórios).

### Riscos Identificados:
- **Ausência de Testes Unitários**: O motor de draft não possui cobertura de testes unitários. Alterações na engine de turnos podem facilmente introduzir regressões nos presets MCL, FORJA, 3G ou séries BOx.
- **Acoplamento de Efeitos Colaterais**: Lógicas puras de transição de estado de jogo (ex: "quem joga a seguir", "como aplicar um Snipe ou Ban") estão misturadas com chamadas assíncronas do Firestore e manipulações de tempo de máquina local.
- **Tipos Fracos**: A falta de tipagem estrita para Timestamps e campos opcionais do Lobby gera a necessidade de casts constantes (`as any`) no código de produção.

---

## 2. Metas de Refatoração e Arquitetura Proposta

O principal objetivo é aplicar a **Separação de Responsabilidades (Decoupling)** e isolar a lógica matemática/cronológica do draft das camadas de infraestrutura (Firestore, React).

```text
┌─────────────────────────────────────────────────────────┐
│                    Componentes UI                       │
│        (PickBanPanel, DraftBoard, StreamerHUD)          │
└────────────────────────────┬────────────────────────────┘
                             │ consome estado derivado
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   Hook: useDraft.ts                     │
│    (Estado React, Efeitos Locais, Timers, Triggers)     │
└────────────────────────────┬────────────────────────────┘
                             │ delega ações assíncronas
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Service: draftService.ts                  │
│       (Orquestração Firestore / Transação ACID)         │
└────────────────────────────┬────────────────────────────┘
                             │ executa transições puras
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Engine: pureDraftEngine.ts                 │
│    (Funções Puras, Validações, Sem Efeitos Colaterais)  │
└────────────────────────────┴────────────────────────────┘
```


### Diretrizes de Design:
1. **Motor de Estado Puro (`src/lib/pureDraftEngine.ts`)**:
   - Uma biblioteca de funções puras que aceitam o estado atual do `Lobby` (ou um subconjunto) e os dados de uma ação, retornando o novo estado ou um erro.
   - Nenhuma dependência de Firebase, LocalStorage ou chamadas ao sistema (`Date.now()`). Toda medição de tempo ou identificadores de banco devem ser passados como parâmetros explícitos.
   - Extracção da função `generateStandardTurnOrder` e da lógica das "cadeiras/slots" imutáveis para esta biblioteca.
2. **Tipagem Estrita (Zero `any`)**:
   - Substituição de todos os tipos `any` em `src/types.ts` por tipos apropriados (ex: importação e uso do `Timestamp` do Firebase ou representação unificada de tempo).
   - Validação estrita para as flags específicas da Forja (`hasMap3RandomRoll`, `hasPerMapBans`, `isOfficialForjaMatch`).
3. **Test Harness Abrangente**:
   - Criação do arquivo de testes `src/lib/__tests__/pureDraftEngine.test.ts` cobrindo todos os fluxos de transição de turnos.
   - Fixação do teste quebrado existente em `src/features/forja/__tests__/forjaUtils.test.ts`.

---

## 3. Plano de Ação Passo a Passo

### Fase 1: Ajuste no Test Harness e Dependências
- [ ] Adicionar o script `"check-types": "tsc --noEmit"` no `package.json` para facilitar a validação.
- [ ] Corrigir o teste unitário quebrado no utilitário da Forja (`forjaUtils.test.ts`) para que o comando `npm run test` passe limpo antes de qualquer alteração na engine.

### Fase 2: Tipagem Estrita e Modelagem
- [ ] Refatorar `src/types.ts` eliminando os tipos `any` relacionados a Timestamps e dados de auditoria do Lobby.
- [ ] Ajustar dependências de tipos em arquivos que importam esses tipos para garantir conformidade total do TypeScript.

### Fase 3: Criação da Pure Draft Engine (`src/lib/pureDraftEngine.ts`)
- [ ] Desenvolver a função pura `calculateNextTurnOrder(config: LobbyConfig, gameNumber: number, lastWinner: 'A' | 'B' | null)` baseada no preset e na estrutura do campeonato.
- [ ] Desenvolver a função pura `processTurnAction(lobby: Lobby, actionId: string, actingTeam: 'A' | 'B', targetPlayerId?: number, playerName?: string, currentTimeMs?: number)` que computa as alterações no `Lobby` transicionalmente.
- [ ] Desenvolver a função pura `processReportAction(lobby: Lobby, winner: 'A' | 'B' | null, actingTeam: 'A' | 'B', currentTimeMs?: number)` que computa os scores, históricos de game, resets de picks/bans e progressões de partida.

### Fase 4: Integração de Serviços e Hooks
- [ ] Substituir as lógicas internas mutáveis de `src/services/draftService.ts` (`_processActionLogic` e `_processReportLogic`) pelas chamadas puras da nova `pureDraftEngine.ts`.
- [ ] Ajustar o hook `useDraft.ts` para que ele use a nova biblioteca de cálculo de ordens de turnos e delegue suas ações ao serviço de forma limpa.

### Fase 5: Criação da Suíte de Testes da Engine
- [ ] Escrever `src/lib/__tests__/pureDraftEngine.test.ts` cobrindo:
  - Geração de turnos MCL e FORJA (Game 1, 2 e 3).
  - Bans e picks alternados em BO3 e BO5.
  - Regra de Snipe e Revelações cegas.
  - Proteção contra auto-picks/timeouts do admin.
  - Resets de placares e salvamento de histórico de mapa.

---

## 4. Test Harness Obrigatório

Qualquer alteração de código só será considerada concluída se passar nas seguintes validações locais, sem exceções:

1. **Validação de Tipos (TypeScript)**:

   ```bash
   npm run check-types
   ```

   *Exigência: 0 erros de compilação.*

2. **Validação da Suíte de Testes (Vitest)**:

   ```bash
   npm run test
   ```

   *Exigência: 100% de cobertura nos testes novos e aprovação de todos os testes anteriores.*
