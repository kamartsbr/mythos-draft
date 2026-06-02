/**
 * ============================================================
 * ForjaCustomDraft — Criador Rápido de Lobbies do Torneio
 * ============================================================
 * Gera lobbies de draft pré-configurados com as regras oficiais
 * da Forja de Hefesto (Fase de Grupos BO3 ou Playoffs com Bans).
 *
 * Arquitetura:
 * - NÃO usa onSnapshot. Apenas leitura fria via getForjaMapPoolOnce().
 * - Chama lobbyService.createLobby() do sistema principal.
 * - O sorteio do Mapa 3 ocorre no runtime do useDraft (useEffect ADMIN).
 * ============================================================
 */
import React, { useState, useCallback } from 'react';
import { ForjaViewProps } from '../types';
import { lobbyService, generateId } from '../../../services/lobbyService';
import { serverTimestamp } from 'firebase/firestore';
import { Lobby, LobbyConfig } from '../../../types';
import { getMCLPicks } from '../../../constants';
import { FORJA_MAP_POOL } from '../../../data/maps';
import { MAJOR_GODS } from '../../../data/gods';
import { auth } from '../../../firebase';
import { signInAnonymously } from 'firebase/auth';

// ─── Tipos Locais ─────────────────────────────────────────────────────────────

type DraftPhase = 'grupos' | 'playoffs';

interface CreateResult {
  lobbyId: string;
  lobbyUrl: string;
}

// ─── Config Base FORJA ────────────────────────────────────────────────────────

/**
 * Build a base LobbyConfig for a FORJA 3v3 BO3 custom draft with official rule defaults.
 *
 * The returned configuration sets series, team size, pick/ban behavior, allowed maps and pantheons,
 * timer and privacy defaults, and phase-dependent flags (for example, per-map bans enabled in playoffs).
 *
 * @param lobbyName - Desired lobby name; an empty or whitespace name will be replaced with a standard default
 * @param phase - Tournament phase that influences stage-specific rules (`'grupos'` or `'playoffs'`)
 * @returns A fully populated LobbyConfig reflecting FORJA rules (3v3 BO3, alternated picks, FORJA map/pantheon constraints, and phase-adjusted settings)
 */
function buildForjaConfig(
  lobbyName: string,
  phase: DraftPhase
): LobbyConfig {
  const isPlayoffs = phase === 'playoffs';

  return {
    // ── Identidade ─────────────────────────────────────────────────────
    name: lobbyName.trim() || 'Forja — Partida Oficial',
    preset: 'FORJA',
    isCustomDraft: true,
    tournamentStage: isPlayoffs ? 'PLAYOFFS' : 'GROUP',

    // ── Tamanho e Série ────────────────────────────────────────────────
    teamSize: 3,
    seriesType: 'BO3',
    customGameCount: 3,

    // ── Picks ──────────────────────────────────────────────────────────
    pickType: 'alternated',
    isExclusive: false,       // Um deus pickado PODE ser pickado pelo oponente (não exclusivo global)

    // ── Bans de Deuses ─────────────────────────────────────────────────
    // hasBans=false + hasPerMapBans controla bans FORJA (1 por time por mapa)
    hasBans: false,
    banCount: 0,

    // ── Mapas ──────────────────────────────────────────────────────────
    // Mapa 1: Host pick | Mapa 2: Guest pick | Mapa 3: ADMIN roll aleatório
    mapBanCount: 0,
    mapTurnOrder: [],
    godTurnOrder: [],
    allowedMaps: [...FORJA_MAP_POOL],
    allowedPantheons: MAJOR_GODS.map(g => g.id),

    // ── Regras de Série ────────────────────────────────────────────────
    firstMapRandom: false,
    loserPicksNextMap: false, // Perdedor do G2 escolhe PRIMEIRO (lado/god), não o mapa
    acePick: false,
    acePickHidden: false,

    // ── Privacidade e Timer ────────────────────────────────────────────
    isPrivate: false,
    timerDuration: 60,

    // ── Flags Exclusivas FORJA ─────────────────────────────────────────
    hasMap3RandomRoll: true,
    hasPerMapBans: false,
  };
}

/**
 * Create the initial Lobby object in a 'waiting' state with default players, draft skeleton, timers, and metadata.
 *
 * The returned lobby is preconfigured for a 3v3 BO3 Forja custom draft: captains and player lists are empty,
 * series slots are three empty map entries, picks are initialized with a 3v3 skeleton for the Draft UI,
 * and timing/audit fields use server timestamps.
 *
 * @param id - The lobby identifier
 * @param config - The LobbyConfig to embed in the created lobby
 * @returns The newly constructed Lobby object ready to be persisted
 */
function buildInitialLobby(id: string, config: LobbyConfig): Lobby {
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
    seriesMaps: ['', '', ''],   // Slots para G1, G2 e G3
    mapBans: [],
    turn: 0,
    turnOrder: [],  // gerado pelo lobbyService.setReady() quando ambos clicarem Ready
    bans: [],
    // Skeleton de picks 3v3 (mesmo formato MCL): 6 slots corner/middle × 2 times.
    // Necessário para a DraftUI renderizar os slots de jogadores antes do primeiro mapa.
    picks: getMCLPicks(1),
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

// ─── Sub-componente: Badge de Fase ────────────────────────────────────────────

function PhaseBadge({ phase, selected, onClick }: {
  phase: DraftPhase;
  selected: boolean;
  onClick: () => void;
}) {
  const isGroups = phase === 'grupos';
  const label    = isGroups ? 'Fase de Grupos (BO3)' : 'Playoffs (BO3 + Bans)';
  const desc     = isGroups
    ? 'Sem bans de deuses · Mapa 3 sorteado'
    : '1 Ban por time por mapa · Mapa 3 sorteado';
  const icon     = isGroups ? '⚔️' : '🏆';
  const color    = isGroups ? '#3b82f6' : '#f59e0b';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '1rem 1.25rem',
        background: selected
          ? `rgba(${isGroups ? '59,130,246' : '245,158,11'}, 0.12)`
          : 'rgba(15,23,42,0.5)',
        border: `2px solid ${selected ? color : '#1e293b'}`,
        borderRadius: '0.75rem',
        cursor: 'pointer',
        textAlign: 'left',
        flex: 1,
        transition: 'all 0.2s ease',
        outline: 'none',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span style={{
        color: selected ? color : '#f8fafc',
        fontWeight: 700,
        fontSize: '0.9rem',
      }}>
        {label}
      </span>
      <span style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.4 }}>
        {desc}
      </span>
    </button>
  );
}

// ─── Sub-componente: Resumo das Regras ────────────────────────────────────────

function RulesSummary({ phase }: { phase: DraftPhase }) {
  const isGroups = phase === 'grupos';
  const rules = [
    { icon: '🗺️', text: 'Mapa 1 — escolha do Host (time A)' },
    { icon: '🗺️', text: 'Mapa 2 — escolha do Guest (time B)' },
    {
      icon: '🎲',
      text: 'Mapa 3 — sorteio automático da pool oficial ao dar Ready',
      highlight: true,
    },
    {
      icon: '🥇',
      text: 'Quem perdeu o Jogo 2 escolhe primeiro (lado/deus) no Jogo 3',
    },
    ...(isGroups
      ? []
      : [
          {
            icon: '🚫',
            text: 'Playoffs: 1 Ban de Deus por time antes dos picks em cada mapa',
            highlight: true,
          },
        ]),
  ];

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid #1e293b',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
    }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
        Regras da Partida
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rules.map((r, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
            fontSize: '0.82rem',
            color: r.highlight ? '#f59e0b' : '#94a3b8',
          }}>
            <span style={{ flexShrink: 0 }}>{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaCustomDraft({ discordUser, isAdmin }: ForjaViewProps) {
  const [lobbyName, setLobbyName] = useState('');
  const [phase, setPhase]         = useState<DraftPhase>('grupos');
  const [creating, setCreating]   = useState(false);
  const [result, setResult]       = useState<CreateResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      // Garante auth anônimo (necessário para criar lobby)
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const id     = generateId();
      const config = buildForjaConfig(lobbyName, phase);
      const lobby  = buildInitialLobby(id, config);

      await lobbyService.createLobby(id, lobby);

      const lobbyUrl = `${window.location.origin}/?lobby=${id}`;
      setResult({ lobbyId: id, lobbyUrl });
    } catch (err: any) {
      console.error('[ForjaCustomDraft] Erro ao criar lobby:', err);
      setError('Erro ao criar o lobby. Verifique sua conexão e tente novamente.');
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

  // ── Tela de Sucesso ─────────────────────────────────────────────────────────
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
            Compartilhe o link abaixo com os dois capitães. Qualquer um pode entrar como Host ou Guest.
          </p>

          {/* Link copiável */}
          <div style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center',
            background: 'rgba(15,23,42,0.9)', border: '1px solid #334155',
            borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.25rem',
          }}>
            <code style={{
              flex: 1, fontSize: '0.78rem', color: '#f8fafc',
              wordBreak: 'break-all', textAlign: 'left',
            }}>
              {result.lobbyUrl}
            </code>
            <button
              onClick={handleCopy}
              style={{
                flexShrink: 0, background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(59,130,246,0.15)',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(59,130,246,0.3)'}`,
                color: copied ? '#4ade80' : '#60a5fa',
                borderRadius: '0.4rem', padding: '0.4rem 0.75rem',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>

          {/* Ação: abrir agora */}
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

  // ── Formulário de Criação ───────────────────────────────────────────────────
  return (
    <section className="forja-view" style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div className="forja-page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 className="forja-page-title">
            <span>⚡</span> Criar Draft Rápido
          </h2>
          <p className="forja-page-subtitle">
            Gera um lobby configurado com as regras oficiais da Forja. Basta compartilhar o link.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Nome do Draft */}
        <div>
          <label htmlFor="forja-draft-name" style={{
            display: 'block', color: '#94a3b8', fontSize: '0.8rem',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: '0.5rem',
          }}>
            Nome da Partida
          </label>
          <input
            id="forja-draft-name"
            type="text"
            value={lobbyName}
            onChange={e => setLobbyName(e.target.value)}
            placeholder="Ex: Titãs do Olimpo vs Filhos de Ares"
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
            onFocus={e => (e.target.style.borderColor = '#3b82f6')}
            onBlur={e => (e.target.style.borderColor = '#334155')}
          />
          <p style={{ color: '#475569', fontSize: '0.72rem', margin: '0.35rem 0 0' }}>
            Opcional · máx. 60 chars · {lobbyName.length}/60
          </p>
        </div>

        {/* Seletor de Fase */}
        <div>
          <p style={{
            color: '#94a3b8', fontSize: '0.8rem',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            margin: '0 0 0.65rem',
          }}>
            Fase do Torneio
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <PhaseBadge phase="grupos"    selected={phase === 'grupos'}   onClick={() => setPhase('grupos')} />
            <PhaseBadge phase="playoffs"  selected={phase === 'playoffs'} onClick={() => setPhase('playoffs')} />
          </div>
        </div>

        {/* Resumo das Regras */}
        <RulesSummary phase={phase} />

        {/* Erro */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.5rem', padding: '0.75rem 1rem',
            color: '#fca5a5', fontSize: '0.82rem',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* CTA */}
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
              <span style={{
                display: 'inline-block', width: '1rem', height: '1rem',
                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              Criando...
            </span>
          ) : (
            '⚡ Criar Sala de Draft'
          )}
        </button>

      </div>
    </section>
  );
}
