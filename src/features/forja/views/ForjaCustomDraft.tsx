/**
 * ============================================================
 * ForjaCustomDraft - Criador Rapido de Lobbies do Torneio
 * ============================================================
 * Gera lobbies de draft pre-configurados com as regras oficiais
 * da Forja de Hefesto para grupos e playoffs manuais.
 *
 * Arquitetura:
 * - Nao usa onSnapshot. Apenas cria o lobby do fluxo principal.
 * - Chama lobbyService.createLobby() do sistema principal.
 * - O sorteio do mapa final ocorre no runtime do useDraft (turno ADMIN).
 * ============================================================
 */
import React, { useState, useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { Lobby, LobbyConfig } from '../../../types';
import { hydrateMclPicksWithRosterNames } from '../../../constants';
import { MAJOR_GODS } from '../../../data/gods';
import { auth } from '../../../firebase';
import { signInAnonymously } from 'firebase/auth';

import { ForjaViewProps } from '../types';
import { FORJA_MAP_POOL, FORJA_PLAYOFFS_MAP_POOL } from '../../../data/maps';
import { lobbyService, generateId } from '../../../services/lobbyService';

type DraftPhase = 'grupos' | 'playoffs_bo3' | 'playoffs_bo5';

interface CreateResult {
  lobbyId: string;
  lobbyUrl: string;
}

const PHASE_META: Record<DraftPhase, {
  label: string;
  desc: string;
  icon: string;
  color: string;
  rules: Array<{ icon: string; text: string; highlight?: boolean }>;
}> = {
  grupos: {
    label: 'Fase de Grupos (MD3 / BO3)',
    desc: 'Pool oficial de grupos · sem ban de deus',
    icon: '⚔️',
    color: '#3b82f6',
    rules: [
      { icon: '🗺️', text: 'Mapa 1 - escolha do Host / Time A' },
      { icon: '🗺️', text: 'Mapa 2 - escolha do Guest / Time B' },
      { icon: '🎲', text: 'Mapa 3 - sorteio automatico da pool oficial', highlight: true },
      { icon: '🥇', text: 'Sem ban de deus' },
    ],
  },
  playoffs_bo3: {
    label: 'Playoffs MD3 / BO3',
    desc: 'Pool oficial de playoffs · 1 ban por time apos cada pick',
    icon: '🏆',
    color: '#f59e0b',
    rules: [
      { icon: '🗺️', text: 'Mapa 1 - escolha do Host / Time A' },
      { icon: '🗺️', text: 'Mapa 2 - escolha do Guest / Time B' },
      { icon: '🎲', text: 'Mapa 3 - sorteio automatico da pool de playoffs', highlight: true },
      { icon: '🥇', text: '1 ban de deus por time apos cada map pick' },
    ],
  },
  playoffs_bo5: {
    label: 'Playoffs MD5 / BO5',
    desc: 'Pool oficial de playoffs · 1 ban por time apos cada pick',
    icon: '🏆',
    color: '#ef4444',
    rules: [
      { icon: '🗺️', text: 'Mapa 1 - escolha do Host / Time A' },
      { icon: '🗺️', text: 'Mapa 2 - escolha do Guest / Time B' },
      { icon: '🗺️', text: 'Mapa 3 - perdedor do Jogo 2 escolhe' },
      { icon: '🗺️', text: 'Mapa 4 - perdedor do Jogo 3 escolhe' },
      { icon: '🎲', text: 'Mapa 5 - sorteio automatico da pool de playoffs', highlight: true },
      { icon: '🥇', text: '1 ban de deus por time apos cada map pick' },
    ],
  },
};

function buildForjaConfig(lobbyName: string, phase: DraftPhase): LobbyConfig {
  const isGroups = phase === 'grupos';
  const isPlayoffsBo5 = phase === 'playoffs_bo5';
  const isPlayoffs = !isGroups;
  const customGameCount = isPlayoffsBo5 ? 5 : 3;
  const seriesType = isPlayoffsBo5 ? 'BO5' : 'BO3';
  const tournamentStage = isGroups ? 'GROUP' : (isPlayoffsBo5 ? 'PLAYOFFS_BO5' : 'PLAYOFFS_BO3');
  const allowedMaps = isGroups ? FORJA_MAP_POOL : FORJA_PLAYOFFS_MAP_POOL;

  return {
    name: lobbyName.trim() || 'Forja - Partida Oficial',
    preset: 'FORJA',
    isCustomDraft: true,
    tournamentStage,
    teamSize: 3,
    seriesType,
    customGameCount,
    pickType: 'alternated',
    isExclusive: false,
    hasBans: false,
    banCount: 0,
    mapBanCount: 0,
    mapTurnOrder: [],
    godTurnOrder: [],
    allowedMaps: [...allowedMaps],
    allowedPantheons: MAJOR_GODS.map((god) => god.id),
    firstMapRandom: false,
    loserPicksNextMap: false,
    acePick: false,
    acePickHidden: false,
    isPrivate: false,
    timerDuration: 60,
    hasMap3RandomRoll: true,
    ...(isPlayoffs ? { hasPerMapBans: true } : {}),
  };
}

function buildInitialLobby(id: string, config: LobbyConfig): Lobby {
  const gameCount = config.customGameCount || (config.seriesType === 'BO5' ? 5 : 3);

  return {
    id,
    status: 'waiting',
    phase: 'waiting',
    captain1: null,
    captain2: null,
    captain1Name: '',
    captain2Name: null,
    teamAPlayers: [],
    teamBPlayers: [],
    readyA: false,
    readyB: false,
    readyA_report: false,
    readyB_report: false,
    readyA_nextGame: false,
    readyB_nextGame: false,
    rosterChangedA: false,
    rosterChangedB: false,
    lastSubs: [],
    resetRequest: null,
    config,
    selectedMap: null,
    seriesMaps: Array(gameCount).fill(''),
    mapBans: [],
    turn: 0,
    turnOrder: [],
    bans: [],
    // Skeleton de picks 3v3 (mesmo formato MCL): 6 slots corner/middle × 2 times.
    // Necessário para a DraftUI renderizar os slots de jogadores antes do primeiro mapa.
    picks: hydrateMclPicksWithRosterNames(1, [], []),
    scoreA: 0,
    scoreB: 0,
    reportVoteA: null,
    reportVoteB: null,
    voteConflict: false,
    voteConflictCount: 0,
    currentGame: 1,
    pickerVoteA: null,
    pickerVoteB: null,
    pickerPlayerA: null,
    pickerPlayerB: null,
    history: [],
    replayLog: [],
    lastWinner: null,
    mapPool: [],
    timerStart: serverTimestamp() as any,
    createdAt: serverTimestamp() as any,
    lastActivityAt: serverTimestamp() as any,
    hiddenActions: [],
    spectators: [],
    adminId: auth.currentUser?.uid ?? undefined,
    isPaused: false,
    timerPausedAt: null,
    captain1Active: false,
    captain2Active: false,
    isPermanent: false,
    discordWebhookUrl: null,
    discordMessageId: null,
  };
}

function PhaseBadge({ phase, selected, onClick }: {
  phase: DraftPhase;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = PHASE_META[phase];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '1rem 1.25rem',
        background: selected ? `${meta.color}1f` : 'rgba(15,23,42,0.5)',
        border: `2px solid ${selected ? meta.color : '#1e293b'}`,
        borderRadius: '0.75rem',
        cursor: 'pointer',
        textAlign: 'left',
        flex: 1,
        transition: 'all 0.2s ease',
        outline: 'none',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{meta.icon}</span>
      <span style={{ color: selected ? meta.color : '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>
        {meta.label}
      </span>
      <span style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.4 }}>
        {meta.desc}
      </span>
    </button>
  );
}

function RulesSummary({ phase }: { phase: DraftPhase }) {
  const rules = PHASE_META[phase].rules;

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid #1e293b',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
    }}>
      <p style={{
        color: '#64748b',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: '0 0 0.75rem',
      }}>
        Regras da Partida
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rules.map((rule, index) => (
          <li
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              fontSize: '0.82rem',
              color: rule.highlight ? '#f59e0b' : '#94a3b8',
            }}
          >
            <span style={{ flexShrink: 0 }}>{rule.icon}</span>
            <span>{rule.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ForjaCustomDraft({ discordUser, isAdmin }: ForjaViewProps) {
  const [lobbyName, setLobbyName] = useState('');
  const [phase, setPhase] = useState<DraftPhase>('grupos');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const id = generateId();
      const config = buildForjaConfig(lobbyName, phase);
      const lobby = buildInitialLobby(id, config);

      await lobbyService.createLobby(id, lobby);

      const lobbyUrl = `${window.location.origin}/?lobby=${id}`;
      setResult({ lobbyId: id, lobbyUrl });
    } catch (err: any) {
      console.error('[ForjaCustomDraft] Erro ao criar lobby:', err);
      setError('Erro ao criar o lobby. Verifique sua conexao e tente novamente.');
    } finally {
      setCreating(false);
    }
  }, [lobbyName, phase, creating]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.lobbyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const handleNewDraft = useCallback(() => {
    setResult(null);
    setLobbyName('');
    setPhase('grupos');
    setError(null);
  }, []);

  if (result) {
    return (
      <section className="forja-view" style={{ maxWidth: '540px', margin: '0 auto' }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem 1.5rem',
          background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: '1rem',
          boxShadow: '0 0 40px rgba(74,222,128,0.08)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
          <h2 style={{ margin: '0 0 0.5rem', color: '#4ade80', fontSize: '1.25rem' }}>
            Lobby Criado!
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem' }}>
            Compartilhe o link abaixo com os dois capitaes. Qualquer um pode entrar como Host ou Guest.
          </p>

          <div style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
          }}>
            <code style={{ flex: 1, fontSize: '0.78rem', color: '#f8fafc', wordBreak: 'break-all', textAlign: 'left' }}>
              {result.lobbyUrl}
            </code>
            <button
              onClick={handleCopy}
              style={{
                flexShrink: 0,
                background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(59,130,246,0.15)',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(59,130,246,0.3)'}`,
                color: copied ? '#4ade80' : '#60a5fa',
                borderRadius: '0.4rem',
                padding: '0.4rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>

          <a
            href={result.lobbyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="forja-btn forja-btn--primary"
            style={{ display: 'inline-block', marginBottom: '0.75rem', textDecoration: 'none', padding: '0.65rem 1.5rem' }}
          >
            🎮 Entrar no Lobby Agora
          </a>

          <br />

          <button
            onClick={handleNewDraft}
            className="forja-btn forja-btn--ghost"
            style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}
          >
            + Criar outro Draft
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="forja-view" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="forja-page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 className="forja-page-title">
            <span>⚡</span> Criar Draft Rapido
          </h2>
          <p className="forja-page-subtitle">
            Gera um lobby configurado com as regras oficiais da Forja. Basta compartilhar o link.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label
            htmlFor="forja-draft-name"
            style={{
              display: 'block',
              color: '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}
          >
            Nome da Partida
          </label>
          <input
            id="forja-draft-name"
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder="Ex: Titas do Olimpo vs Filhos de Ares"
            maxLength={60}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(15,23,42,0.7)',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#f8fafc',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
            onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
          />
          <p style={{ color: '#475569', fontSize: '0.72rem', margin: '0.35rem 0 0' }}>
            Opcional · max. 60 chars · {lobbyName.length}/60
          </p>
        </div>

        <div>
          <p style={{
            color: '#94a3b8',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '0 0 0.65rem',
          }}>
            Fase do Torneio
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <PhaseBadge phase="grupos" selected={phase === 'grupos'} onClick={() => setPhase('grupos')} />
            <PhaseBadge phase="playoffs_bo3" selected={phase === 'playoffs_bo3'} onClick={() => setPhase('playoffs_bo3')} />
            <PhaseBadge phase="playoffs_bo5" selected={phase === 'playoffs_bo5'} onClick={() => setPhase('playoffs_bo5')} />
          </div>
        </div>

        <RulesSummary phase={phase} />

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            color: '#fca5a5',
            fontSize: '0.82rem',
          }}>
            ⚠ {error}
          </div>
        )}

        <button
          id="forja-create-draft-btn"
          className="forja-btn forja-btn--primary"
          onClick={handleCreate}
          disabled={creating}
          style={{
            padding: '0.9rem',
            fontSize: '1rem',
            fontWeight: 700,
            width: '100%',
            opacity: creating ? 0.6 : 1,
            cursor: creating ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {creating ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Criando...
            </span>
          ) : '⚡ Criar Sala de Draft'}
        </button>
      </div>
    </section>
  );
}
