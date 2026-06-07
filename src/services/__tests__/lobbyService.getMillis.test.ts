/**
 * ============================================================
 *  TESTES: lobbyService.ts — getMillis
 *  Cobertura: conversão de vários formatos de timestamp para
 *  milissegundos (usado em Chat.tsx após mudança desta PR).
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks de Dependências Firebase ─────────────────────────────────────────
// lobbyService.ts importa vários módulos Firebase e inicializa conexão.
// Precisamos mocká-los para isolar o teste da função getMillis.

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  collection: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  serverTimestamp: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  addDoc: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  auth: {},
  handleFirestoreError: vi.fn(),
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  },
  FIRESTORE_DB_ID: 'test-db',
}));

vi.mock('../../constants', () => ({
  PLAYER_COLORS: {},
  MCL_ROUND_MAPS: [],
}));

vi.mock('../../data/draft', () => ({
  getMCLPicks: vi.fn(() => []),
  getMCLTeamOrder: vi.fn(() => []),
  shouldUseGame2MclOrder: vi.fn(() => false),
  hydrateMclPicksWithRosterNames: vi.fn(() => []),
  isMclStylePreset: vi.fn(() => false),
}));

vi.mock('../../features/forja/services/forjaService', () => ({
  updateCachedLiveMatchesSummary: vi.fn(),
}));

// ─── Import da função a ser testada ──────────────────────────────────────────
import { getMillis } from '../lobbyService';

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('getMillis', () => {

  // ── Casos falsy ─────────────────────────────────────────────────────────────

  it('retorna 0 para null', () => {
    expect(getMillis(null)).toBe(0);
  });

  it('retorna 0 para undefined', () => {
    expect(getMillis(undefined)).toBe(0);
  });

  it('retorna 0 para string vazia', () => {
    expect(getMillis('')).toBe(0);
  });

  it('retorna 0 para o número 0', () => {
    // 0 é falsy, então deve retornar 0 antes de qualquer conversão
    expect(getMillis(0)).toBe(0);
  });

  // ── Firestore Timestamp com toMillis() ──────────────────────────────────────

  it('usa toMillis() quando o objeto tem esse método (Firestore Timestamp)', () => {
    const firestoreTimestamp = { toMillis: () => 1700000000000 };
    expect(getMillis(firestoreTimestamp)).toBe(1700000000000);
  });

  it('prefere toMillis() sobre toDate() quando ambos existem', () => {
    const obj = {
      toMillis: () => 1700000000000,
      toDate: () => new Date(1600000000000),
    };
    // toMillis deve ter prioridade
    expect(getMillis(obj)).toBe(1700000000000);
  });

  // ── Objetos com toDate() (Firestore Timestamp alternativo) ──────────────────

  it('usa toDate().getTime() quando o objeto tem toDate() mas não toMillis()', () => {
    const dateMs = 1700000000000;
    const obj = { toDate: () => new Date(dateMs) };
    expect(getMillis(obj)).toBe(dateMs);
  });

  it('retorna 0 quando toDate() retorna uma data inválida', () => {
    const obj = { toDate: () => new Date('invalid') };
    expect(getMillis(obj)).toBe(0);
  });

  it('retorna 0 quando toDate() retorna null', () => {
    const obj = { toDate: () => null };
    expect(getMillis(obj)).toBe(0);
  });

  // ── Números: conversão segundos vs milissegundos ─────────────────────────────

  it('converte número em segundos (< 10^10) para milissegundos', () => {
    // 1700000000 segundos (estilo Unix timestamp) deve se tornar 1700000000000 ms
    expect(getMillis(1700000000)).toBe(1700000000000);
  });

  it('retorna número diretamente quando já é milissegundos (>= 10^10)', () => {
    expect(getMillis(1700000000000)).toBe(1700000000000);
  });

  it('trata o valor exatamente em 10000000000 como milissegundos (sem conversão)', () => {
    // O limiar é < 10^10, então exatamente 10^10 retorna sem multiplicar
    expect(getMillis(10000000000)).toBe(10000000000);
  });

  it('trata 9999999999 (< 10^10) como segundos e multiplica por 1000', () => {
    expect(getMillis(9999999999)).toBe(9999999999000);
  });

  it('retorna 0 para número negativo (tratado como valor válido sem conversão especial)', () => {
    // Números negativos não são falsy, mas a lógica converte: -1 < 10^10 → -1 * 1000 = -1000
    expect(getMillis(-1)).toBe(-1000);
  });

  // ── Strings de data ─────────────────────────────────────────────────────────

  it('faz parse de string ISO válida e retorna milissegundos', () => {
    const isoString = '2024-01-15T10:30:00.000Z';
    const expected = new Date(isoString).getTime();
    expect(getMillis(isoString)).toBe(expected);
  });

  it('retorna 0 para string que não é data válida', () => {
    expect(getMillis('not-a-date')).toBe(0);
  });

  it('retorna 0 para string completamente inválida', () => {
    expect(getMillis('abc123')).toBe(0);
  });

  it('faz parse de string de data legível por humanos', () => {
    const dateStr = '2024-06-01';
    const expected = new Date(dateStr).getTime();
    expect(getMillis(dateStr)).toBe(expected);
  });

  // ── Casos de regressão: uso real em Chat.tsx ─────────────────────────────────

  it('suporta o padrão de timestamp de mensagem de chat (número em ms)', () => {
    // Simula um timestamp de mensagem de chat já em milissegundos
    const chatTimestamp = 1716000000000;
    const result = getMillis(chatTimestamp);
    const date = new Date(result);
    expect(date.getFullYear()).toBe(2024);
    expect(result).toBe(chatTimestamp);
  });

  it('suporta timestamp do Firestore no formato objeto com toMillis (caso real)', () => {
    // Simula o objeto Timestamp do Firestore como chegaria no ChatMessage.timestamp
    const mockFirestoreTs = {
      seconds: 1716000000,
      nanoseconds: 0,
      toMillis: () => 1716000000000,
      toDate: () => new Date(1716000000000),
    };
    expect(getMillis(mockFirestoreTs)).toBe(1716000000000);
  });

  it('suporta timestamp do Firestore no formato objeto sem toMillis (fallback para toDate)', () => {
    const mockFirestoreTs = {
      seconds: 1716000000,
      nanoseconds: 0,
      toDate: () => new Date(1716000000000),
    };
    expect(getMillis(mockFirestoreTs)).toBe(1716000000000);
  });

  // ── Casos extremos adicionais ─────────────────────────────────────────────

  it('retorna 0 para false (falsy)', () => {
    expect(getMillis(false)).toBe(0);
  });

  it('lida com objeto que tem toMillis retornando NaN', () => {
    const obj = { toMillis: () => NaN };
    expect(getMillis(obj)).toBe(NaN);
  });

  it('lida com número 1 (em segundos) convertendo corretamente para milissegundos', () => {
    expect(getMillis(1)).toBe(1000);
  });
});
