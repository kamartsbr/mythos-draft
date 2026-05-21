/**
 * ============================================================
 *  TESTES: scripts/synthesizer.ts
 *  Cobertura: synthesizeTechDebt (comportamento via side effects)
 *  — extração de diff Git
 *  — fallback para shallow clones (sem HEAD~1)
 *  — ausência de mudanças (diff vazio)
 *  — leitura/criação do log de débitos técnicos
 *  — chamada ao modelo Gemini com parâmetros corretos
 *  — escrita do log atualizado
 *  — tratamento de erros do Gemini
 *  — saída com process.exit(1) em falhas irrecuperáveis
 * ============================================================
 *
 * Estratégia: como synthesizeTechDebt não é exportada e o
 * módulo possui efeitos colaterais no nível raiz (verificação
 * de GEMINI_API_KEY e chamada da função), usamos:
 *   1. vi.mock() para interceptar todas as dependências.
 *   2. importação dinâmica (import()) por teste para forçar
 *      nova avaliação do módulo após vi.resetModules().
 *   3. vi.waitFor() para aguardar a promise assíncrona interna.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Constantes de paths ──────────────────────────────────────────────────────
const FAKE_LOG_PATH = '/fake/TECH_DEBT_LOG.md';
const SAMPLE_DIFF = 'diff --git a/file.ts b/file.ts\n+added line\n-removed line\n';
const SAMPLE_LOG = '# Registro de Débitos Técnicos\n\n## Item 1\n- algo pendente';
const UPDATED_LOG = '# Registro de Débitos Técnicos\n\n## Item 1\n- algo pendente\n\n## Novo Item\n- adicionado';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mocks nomeados para controle dinâmico por teste
const mockExecSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockGenerateContent = vi.fn();
const mockResolve = vi.fn((...args: string[]) => args[args.length - 1]);

vi.mock('child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}));

vi.mock('path', () => ({
  resolve: (...args: any[]) => mockResolve(...args),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => mockGenerateContent(...args),
    },
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Importa o módulo synthesizer de forma isolada após resetar o cache.
 * Aguarda a conclusão da função assíncrona observando os mocks.
 */
async function importSynthesizer() {
  vi.resetModules();
  await import('../synthesizer');
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

const originalExit = process.exit.bind(process);
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();

  // Garante que a chave API existe por padrão (evita saída imediata)
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  // Configura mock de path.resolve para retornar caminho fake
  mockResolve.mockReturnValue(FAKE_LOG_PATH);

  // Mock padrão do process.exit (evita encerrar o processo de testes)
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
    return undefined as never;
  });
});

afterEach(() => {
  // Restaura variáveis de ambiente originais
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('synthesizer.ts > synthesizeTechDebt', () => {

  // ── Fluxo principal ────────────────────────────────────────────────────────

  it('lê o diff entre HEAD~1 e HEAD com sucesso', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)          // git rev-parse --verify HEAD~1 (sucesso)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF }); // git diff HEAD~1 HEAD
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(SAMPLE_LOG);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockWriteFileSync).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
    expect(mockExecSync).toHaveBeenCalledWith('git diff HEAD~1 HEAD');
  });

  it('escreve o log atualizado quando Gemini retorna texto', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(SAMPLE_LOG);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockWriteFileSync).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockWriteFileSync).toHaveBeenCalledWith(FAKE_LOG_PATH, UPDATED_LOG);
  });

  it('mantém o log original quando Gemini retorna text nulo/falsy', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(SAMPLE_LOG);
    // Gemini retorna text vazio — deve usar currentLog como fallback
    mockGenerateContent.mockResolvedValue({ text: '' });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockWriteFileSync).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockWriteFileSync).toHaveBeenCalledWith(FAKE_LOG_PATH, SAMPLE_LOG);
  });

  it('lê o arquivo de log existente antes de chamar o Gemini', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(SAMPLE_LOG);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockReadFileSync).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockReadFileSync).toHaveBeenCalledWith(FAKE_LOG_PATH, 'utf-8');
  });

  it('usa log inicial padrão quando o arquivo de log não existe', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(false); // arquivo não existe
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalled(), { timeout: 3000 });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('Nenhum débito mapeado ainda');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('chama Gemini com model correto (gemini-3.1-pro)', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(false);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalled(), { timeout: 3000 });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-3.1-pro');
  });

  it('inclui o diff no conteúdo enviado ao Gemini', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(false);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalled(), { timeout: 3000 });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain(SAMPLE_DIFF);
    expect(callArgs.contents).toContain('DIFF DO ÚLTIMO MERGE');
  });

  it('inclui systemInstruction na config da chamada ao Gemini', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(false);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalled(), { timeout: 3000 });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config).toBeDefined();
    expect(callArgs.config.systemInstruction).toContain('Arquiteto de Software Sênior');
    expect(callArgs.config.temperature).toBe(0.2);
  });

  // ── Fluxo sem mudanças ────────────────────────────────────────────────────

  it('retorna sem chamar Gemini quando o diff está vazio', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => '' }); // diff vazio
    mockExistsSync.mockReturnValue(false);

    await importSynthesizer();
    // Aguarda até que ambas as chamadas execSync sejam concluídas
    await vi.waitFor(() => expect(mockExecSync).toHaveBeenCalledTimes(2), { timeout: 3000 });

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  // ── Fallback para shallow clones ──────────────────────────────────────────

  it('usa git diff --root HEAD quando HEAD~1 não existe (shallow clone)', async () => {
    mockExecSync
      .mockImplementationOnce(() => { throw new Error('unknown revision HEAD~1'); }) // rev-parse falha
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF }); // git diff --root HEAD
    mockExistsSync.mockReturnValue(false);
    mockGenerateContent.mockResolvedValue({ text: UPDATED_LOG });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockExecSync).toHaveBeenCalledWith('git diff --root HEAD');
  });

  it('chama process.exit(1) quando git diff --root também falha', async () => {
    mockExecSync
      .mockImplementationOnce(() => { throw new Error('no HEAD~1'); })
      .mockImplementationOnce(() => { throw new Error('git failure'); }); // --root falha também

    await importSynthesizer();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1), { timeout: 3000 });
  });

  // ── Tratamento de erros do Gemini ─────────────────────────────────────────

  it('chama process.exit(1) quando Gemini lança exceção', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(false);
    mockGenerateContent.mockRejectedValue(new Error('API Error: quota exceeded'));

    await importSynthesizer();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1), { timeout: 3000 });

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  // ── Verificação de GEMINI_API_KEY ─────────────────────────────────────────

  it('chama process.exit(1) imediatamente quando GEMINI_API_KEY não está definida', async () => {
    delete process.env.GEMINI_API_KEY;

    await importSynthesizer();

    // process.exit(1) deve ser chamado antes de qualquer operação git
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  // ── Caso de regressão: Gemini retorna objeto sem text ────────────────────

  it('usa currentLog como fallback quando response.text é undefined', async () => {
    mockExecSync
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ toString: () => SAMPLE_DIFF });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(SAMPLE_LOG);
    mockGenerateContent.mockResolvedValue({ text: undefined });

    await importSynthesizer();
    await vi.waitFor(() => expect(mockWriteFileSync).toHaveBeenCalled(), { timeout: 3000 });

    expect(mockWriteFileSync).toHaveBeenCalledWith(FAKE_LOG_PATH, SAMPLE_LOG);
  });
});