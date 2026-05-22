/**
 * Forja de Hefesto — Aba: Formato
 * Passo 4 Major: conteúdo editável via CMS (Firestore) + visualizador snake draft estático.
 */
import React, { useState } from 'react';
import { ForjaViewProps } from '../types';
import { useForjaContent } from '../hooks/useForjaContent';
import { useForjaSettings } from '../hooks/useForjaSettings';
import ForjaContentEditor from '../components/ForjaContentEditor';// ─── Snake Draft Visualizer (estático — é explicativo) ───────────────────────
const SNAKE_EXAMPLE = [
  {
    round: 'B', label: 'Rodada 1 (Escolha da Pool Livre)', subtitle: 'Último capitão escolhe primeiro (Snake reverso)',
    picks: [
      { slot: 1, team: 'Seed 16', tier: 'Pool Livre', dir: '←' },
      { slot: 2, team: 'Seed 15', tier: 'Pool Livre', dir: '←' },
      { slot: 3, team: 'Seed 14', tier: 'Pool Livre', dir: '←' },
      { slot: 8, team: '...', tier: 'Pool Livre', dir: '←' },
      { slot: 15, team: 'Seed 2', tier: 'Pool Livre', dir: '←' },
      { slot: 16, team: 'Seed 1', tier: 'Pool Livre', dir: '←' },
    ],
  },
  {
    round: 'C', label: 'Rodada 2 (Escolha da Pool Livre)', subtitle: 'Primeiro capitão escolhe primeiro (ordem direta)',
    picks: [
      { slot: 17, team: 'Seed 1', tier: 'Pool Livre', dir: '→' },
      { slot: 18, team: 'Seed 2', tier: 'Pool Livre', dir: '→' },
      { slot: 19, team: 'Seed 3', tier: 'Pool Livre', dir: '→' },
      { slot: 24, team: '...', tier: 'Pool Livre', dir: '→' },
      { slot: 31, team: 'Seed 15', tier: 'Pool Livre', dir: '→' },
      { slot: 32, team: 'Seed 16', tier: 'Pool Livre', dir: '→' },
    ],
  },
];

const TIER_COLOR: Record<string, string> = { A: '#facc15', 'Pool Livre': '#60a5fa' };

/**
 * Renders a read-only visual example of a 16-team snake draft.
 *
 * @returns A JSX element representing the illustrative draft visualizer for the 16-team example.
 */
function SnakeVisualizer() {
  return (
    <div className="forja-snake-visualizer" style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '1rem', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '1.25rem' }}>
      <h3 className="forja-snake-visualizer__title" style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>🐍 Ordem do Draft — Exemplo com 16 Times</h3>

      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Total: <strong style={{ color: '#f8fafc' }}>16 capitães (Tier A)</strong> +{' '}
        <strong style={{ color: '#60a5fa' }}>32 jogadores da Pool Livre</strong> ={' '}
        <strong style={{ color: '#f59e0b' }}>48 jogadores / 16 times de 3</strong>
      </p>

      <div className="forja-snake-rounds" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Capitães — automático por ELO */}
        <div className="forja-snake-round forja-snake-round--captains" style={{ background: 'rgba(2, 6, 23, 0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div className="forja-snake-round__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
            <span className="forja-snake-round__label" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#facc15' }}>Capitães (Tier A)</span>
            <span className="forja-snake-round__sub" style={{ fontSize: '0.7rem', color: '#64748b' }}>Definidos automaticamente pelo ELO snapshot (18h)</span>
          </div>
          <div className="forja-snake-picks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
            {[
              { slot: 1, label: 'Seed 1 (Maior ELO)' },
              { slot: 2, label: 'Seed 2' },
              { slot: 3, label: 'Seed 3' },
              { slot: 8, label: '...' },
              { slot: 15, label: 'Seed 15' },
              { slot: 16, label: 'Seed 16 (Menor ELO)' },
            ].map(({ slot, label }) => (
              <div key={slot} className="forja-snake-pick forja-snake-pick--captain" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}>
                <span className="forja-snake-pick__slot" style={{ color: '#64748b', fontWeight: 600 }}>#{slot}</span>
                <span className="forja-snake-pick__team" style={{ color: '#facc15', flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                <span className="forja-snake-pick__tier" style={{ color: '#facc15', fontSize: '0.62rem', fontWeight: 800 }}>Capitão</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rounds B e C */}
        {SNAKE_EXAMPLE.map((round) => (
          <div key={round.round} className={`forja-snake-round forja-snake-round--${round.round.toLowerCase()}`} style={{ background: 'rgba(2, 6, 23, 0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
            <div className="forja-snake-round__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
              <span className="forja-snake-round__label" style={{ fontSize: '0.8rem', fontWeight: 800, color: TIER_COLOR[round.round] || '#60a5fa' }}>
                {round.label}
              </span>
              <span className="forja-snake-round__sub" style={{ fontSize: '0.7rem', color: '#64748b' }}>{round.subtitle}</span>
            </div>
            <div className="forja-snake-picks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {round.picks.map((pick, i) => (
                <div key={i} className={`forja-snake-pick${pick.team === '...' ? ' forja-snake-pick--ellipsis' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}>
                  <span className="forja-snake-pick__slot" style={{ color: '#64748b', fontWeight: 600 }}>#{pick.slot}</span>
                  <span className="forja-snake-pick__dir" style={{ color: '#475569', fontSize: '0.75rem' }}>{pick.dir}</span>
                  <span className="forja-snake-pick__team" style={{ color: '#f1f5f9', flex: 1, fontWeight: 600 }}>{pick.team}</span>
                  <span className="forja-snake-pick__tier" style={{ color: TIER_COLOR[pick.tier] || '#60a5fa', fontSize: '0.62rem', fontWeight: 800 }}>
                    {pick.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resultado final */}
      <div className="forja-snake-result" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(51,65,85,.3)' }}>
        <h4 className="forja-snake-result__title" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.75rem 0' }}>Composição Final de Cada Time</h4>
        <div className="forja-snake-result__teams" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {[
            {
              seed: 1,
              b: 'Última escolha da Rodada 1 (pick #16)',
              c: 'Primeira escolha da Rodada 2 (pick #17)',
              note: '← Seed 1 escolhe por último na Rodada 1, mas é o primeiro a escolher na Rodada 2',
            },
            {
              seed: 8,
              b: 'Escolha mediana da Rodada 1 (pick #9)',
              c: 'Escolha mediana da Rodada 2 (pick #24)',
              note: '',
            },
            {
              seed: 16,
              b: 'Primeira escolha da Rodada 1 (pick #1)',
              c: 'Última escolha da Rodada 2 (pick #32)',
              note: '← Seed 16 escolhe primeiro na Rodada 1, mas é o último a escolher na Rodada 2',
            },
          ].map(t => (
            <div key={t.seed} className="forja-snake-result__team" style={{ background: 'rgba(2,6,23,.4)', borderRadius: '0.625rem', padding: '0.65rem 0.85rem' }}>
              <div className="forja-snake-result__seed" style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.25rem' }}>Time Seed {t.seed}</div>
              <div className="forja-snake-result__members" style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                <span style={{ color: '#facc15' }}>Capitão (Tier A)</span> +{' '}
                <span style={{ color: '#60a5fa' }}>{t.b} (Pool Livre)</span> +{' '}
                <span style={{ color: '#94a3b8' }}>{t.c} (Pool Livre)</span>
              </div>
              {t.note && <p className="forja-snake-result__note" style={{ fontSize: '0.65rem', color: '#475569', margin: '0.2rem 0 0 0', fontStyle: 'italic' }}>{t.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a responsive visual flow diagram showing the tournament phases and their current status.
 *
 * The component computes the number of teams as floor(maxParticipants / 3) and displays five fixed phases
 * (Inscrições, Snake Draft, Fase de Grupos, Playoffs, Grande Final). Each phase shows an icon, title,
 * short description, and contextual micro-data. The active phase is highlighted based on `currentPhase`;
 * the Playoffs micro-data adapts to `playoffFormat`.
 *
 * @param currentPhase - Identifier of the current tournament phase (e.g., 'pre_tournament', 'group_stage', 'playoffs', 'finished')
 * @param playoffFormat - Playoff format identifier that affects the playoffs label (e.g., 'single_elim' for single elimination)
 * @param maxParticipants - Maximum number of players; used to derive team and group counts (assumes 3 players per team)
 * @returns A JSX element rendering the tournament phase flow diagram with responsive connectors and active-phase styling
 */
function TournamentFlowDiagram({ currentPhase, playoffFormat, maxParticipants }: { currentPhase: string; playoffFormat: string; maxParticipants: number }) {
  const numTeams = Math.floor(maxParticipants / 3);

  const phases = [
    {
      id: 'pre_tournament_reg',
      title: '1. Inscrições',
      icon: '📝',
      desc: 'Jogadores se inscrevem no portal e vinculam seu perfil do AoMStats.',
      microData: `${maxParticipants} jogadores cadastrados max (${numTeams} times)`,
      isActive: currentPhase === 'pre_tournament',
      color: 'from-amber-500/20 to-orange-500/5 border-amber-500/40 text-amber-400'
    },
    {
      id: 'pre_tournament_draft',
      title: '2. Snake Draft',
      icon: '🐍',
      desc: 'Os capitães montam seus trios escolhendo jogadores da Pool Livre.',
      microData: 'Ordem Snake 1-2-2-1 dinâmico',
      isActive: currentPhase === 'pre_tournament',
      color: 'from-yellow-500/20 to-amber-500/5 border-yellow-500/40 text-yellow-400'
    },
    {
      id: 'group_stage',
      title: '3. Fase de Grupos',
      icon: '🏟️',
      desc: 'Confrontos de grupos para definir os classificados para o mata-mata.',
      microData: `${Math.ceil(numTeams / 4)} grupos · Jogos MD3`,
      isActive: currentPhase === 'group_stage',
      color: 'from-blue-500/20 to-indigo-500/5 border-blue-500/40 text-blue-400'
    },
    {
      id: 'playoffs',
      title: '4. Playoffs',
      icon: '🏆',
      desc: 'Fase eliminatória direta entre os melhores times da competição.',
      microData: `${playoffFormat === 'single_elim' ? 'Mata-mata simples' : 'Eliminação dupla'} · MD3`,
      isActive: currentPhase === 'playoffs',
      color: 'from-purple-500/20 to-pink-500/5 border-purple-500/40 text-purple-400'
    },
    {
      id: 'finished',
      title: '5. Grande Final',
      icon: '👑',
      desc: 'Decisão 100% online dos campeões da Forja de Hefesto.',
      microData: 'Grande Final em MD5',
      isActive: currentPhase === 'finished',
      color: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/40 text-emerald-400'
    }
  ];

  return (
    <div className="w-full mt-6 mb-10 p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden" style={{ boxSizing: 'border-box' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2" style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center' }}>
        <span>📊</span> Fluxo Estrutural do Torneio
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 relative" style={{ display: 'grid', gap: '1.5rem' }}>
        {phases.map((phase, idx) => {
          const isCurrent = phase.isActive && (
            (phase.id === 'pre_tournament_reg' && currentPhase === 'pre_tournament') ||
            (phase.id === 'pre_tournament_draft' && currentPhase === 'pre_tournament') ||
            (phase.id === currentPhase)
          );

          return (
            <div key={phase.id} className="flex flex-col items-center relative group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {/* Connector line for large screens */}
              {idx < phases.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-slate-700 to-slate-800 z-0" style={{ position: 'absolute', height: '2px', background: '#334155', zIndex: 0 }} />
              )}
              {/* Card */}
              <div className={`w-full z-10 flex flex-col p-5 rounded-xl border bg-gradient-to-b transition-all duration-300 ${
                isCurrent
                  ? `${phase.color} shadow-lg shadow-amber-500/5 scale-[1.03] ring-1 ring-amber-500/20`
                  : 'from-slate-800/80 to-slate-900/80 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:scale-[1.01]'
              }`} style={{
                boxSizing: 'border-box',
                borderRadius: '0.75rem',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isCurrent ? undefined : 'rgba(51, 65, 85, 0.5)',
                background: isCurrent ? undefined : 'linear-gradient(to bottom, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8))',
                padding: '1.25rem',
                flexDirection: 'column',
                display: 'flex',
                width: '100%',
                position: 'relative',
                zIndex: 10
              }}>
                <div className="flex items-center justify-between mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="text-2xl" style={{ fontSize: '1.5rem' }}>{phase.icon}</span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 text-[0.65rem] font-bold tracking-wider uppercase bg-amber-500 text-slate-950 rounded-full animate-pulse" style={{
                      padding: '0.125rem 0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      background: '#f59e0b',
                      color: '#0f172a',
                      borderRadius: '9999px',
                      textTransform: 'uppercase'
                    }}>
                      Ativo
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm mb-1" style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', fontSize: '0.875rem', color: isCurrent ? '#f8fafc' : '#cbd5e1' }}>
                  {phase.title}
                </h4>
                <p className="text-[0.78rem] leading-relaxed mb-4 text-slate-400" style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', lineHeight: '1.4', color: '#94a3b8' }}>
                  {phase.desc}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-800/60" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(30, 41, 59, 0.6)' }}>
                  <span className="text-[0.7rem] font-semibold text-slate-500 font-mono" style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                    {phase.microData}
                  </span>
                </div>
              </div>

              {/* Arrow for small screens */}
              {idx < phases.length - 1 && (
                <div className="lg:hidden my-3 text-slate-600 text-xl font-bold animate-bounce" style={{ margin: '0.75rem 0', fontSize: '1.25rem', color: '#475569', fontWeight: 'bold' }}>
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render the "Formato do Torneio" page that presents the tournament flow, a static snake-draft visualizer, and an editable content area.
 *
 * Reads editable content with `useForjaContent('format')` and settings with `useForjaSettings()`, deriving `currentPhase`, `playoffFormat`, and `maxParticipants` with sensible defaults.
 *
 * @param discordUser - Optional Discord user object used to attribute edits in the content editor (falls back to `"admin"`).
 * @param isAdmin - If `true`, renders the in-place content editor; otherwise renders read-only content for all visitors.
 * @returns The React element for the tournament format view, including flow diagram, snake visualizer, and either a loader, content editor, or public content sections.
 */
export default function ForjaFormato({ discordUser, isAdmin }: ForjaViewProps) {
  const { data, loading } = useForjaContent('format');
  const { settings } = useForjaSettings();

  const currentPhase = settings?.current_phase ?? 'pre_tournament';
  const playoffFormat = settings?.playoff_format ?? 'single_elim';
  const maxParticipants = settings?.max_participants ?? 48;

  return (
    <section className="forja-view forja-view--formato">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🐍</span> Formato do Torneio</h2>
          <p className="forja-page-subtitle">Snake Draft 3v3 — Capitão Tier A + Pool Livre por time</p>
        </div>
      </div>

      {/* Diagrama Visual de Fluxo Dinâmico */}
      <TournamentFlowDiagram
        currentPhase={currentPhase}
        playoffFormat={playoffFormat}
        maxParticipants={maxParticipants}
      />

      {/* Visualizador estático do Snake Draft */}
      <SnakeVisualizer />

      {/* Conteúdo editável */}
      <div style={{ marginTop: '2rem' }}>
        {loading ? (
          <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
        ) : isAdmin ? (
          <ForjaContentEditor
            docId="format"
            data={data}
            updatedBy={discordUser?.username ?? 'admin'}
          />
        ) : (
          <div className="forja-content-sections">
            {(data?.sections ?? []).map((s, i) => (
              <div key={i} className="forja-content-section">
                <h3 className="forja-content-section__title">{s.title}</h3>
                <div className="forja-content-section__body">
                  {s.content.split('\n').map((line, j) => <p key={j}>{line}</p>)}
                </div>
              </div>
            ))}
            {(!data || data.sections.length === 0) && (
              <div className="forja-empty">
                <span>📋</span>
                <p>Detalhes do formato em breve.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
