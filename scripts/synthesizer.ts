import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set. Please set it in your environment.');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LOG_PATH = resolve('TECH_DEBT_LOG.md');

/**
 * Extracts the most recent merge diff, synthesizes updates to the technical-debt Markdown log using Gemini, and writes the updated log to disk.
 *
 * Reads the Git diff between HEAD and its parent (falls back to `git diff --root HEAD` for shallow or single-commit repos). If no changes are detected, the function returns without modifying the log. Otherwise it loads or initializes the TECH_DEBT_LOG.md contents, sends the current log and the diff to the configured Gemini model with a strict system instruction to update the Markdown, and writes the model's response back to TECH_DEBT_LOG.md. On unrecoverable Git or synthesis errors the process exits with code 1.
 */
async function synthesizeTechDebt() {
    console.log('🔍 Extraindo o diff do último merge...');
    // Pega as diferenças entre o commit atual (HEAD) e o anterior (HEAD~1)
    let diff = '';
    try {
        // Check if parent commit exists
        execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
        diff = execSync('git diff HEAD~1 HEAD').toString();
    } catch (error) {
        // Fallback for shallow clones or single-commit repos
        console.log('⚠️  No parent commit found (shallow clone or first commit). Using --root diff...');
        try {
            diff = execSync('git diff --root HEAD').toString();
        } catch (rootError) {
            console.error('❌ Failed to extract diff:', rootError);
            process.exit(1);
        }
    }

    if (!diff) {
        console.log('Nenhuma mudança detectada no código.');
        return;
    }

    // Lê o log atual se ele existir, ou cria um vazio
    let currentLog = '';
    if (existsSync(LOG_PATH)) {
        currentLog = readFileSync(LOG_PATH, 'utf-8');
    } else {
        currentLog = '# Registro de Débitos Técnicos\n\nNenhum débito mapeado ainda.';
    }

    const systemInstruction = `Você é um Arquiteto de Software Sênior mantendo a documentação de débitos técnicos de um projeto.
Sua função não é criticar o código agora, mas sim registrar o que ficou para trás e precisará de atenção no futuro.

Você receberá o registro atual de débitos e o DIFF do último código mesclado.
Sua tarefa é analisar o diff e atualizar o registro atual em formato Markdown.

Preste atenção especial ao ecossistema da stack:
1. Otimizações pendentes no React (ex: contextos que podem causar re-renders globais).
2. Furos ou bypasses no TypeScript que foram deixados com 'any' ou '// @ts-ignore'.
3. Gargalos na arquitetura (ex: chamadas redundantes em Cloud Functions, regras de segurança do Firestore permissivas demais para prototipação, ou queries que precisarão de paginação no futuro).

REGRAS:
- Remova itens do registro antigo se o diff mostrar que eles foram resolvidos.
- Adicione novos itens se o diff introduzir soluções provisórias (workarounds) ou código subótimo.
- Retorne APENAS o documento Markdown atualizado. Nenhuma introdução ou conclusão.`;

    console.log('🤖 Solicitando síntese ao Gemini...');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro',
            contents: `--- LOG ATUAL ---\n${currentLog}\n\n--- DIFF DO ÚLTIMO MERGE ---\n${diff}`,
            config: {
                systemInstruction,
                temperature: 0.2, // Mantém a resposta analítica e direta
            }
        });

        const updatedLog = response.text || currentLog;
        writeFileSync(LOG_PATH, updatedLog);
        console.log('✅ TECH_DEBT_LOG.md atualizado com sucesso!');

    } catch (error) {
        console.error('❌ Falha ao sintetizar o débito técnico:', error);
        process.exit(1);
    }
}

synthesizeTechDebt();