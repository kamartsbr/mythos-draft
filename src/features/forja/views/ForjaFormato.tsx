/**
 * Forja de Hefesto — Aba: Formato
 * Passo 4 Major: conteúdo editável via CMS (Firestore) + visualizador snake draft estático.
 */
import React from 'react';
import { ForjaViewProps } from '../types';
import { useForjaContent } from '../hooks/useForjaContent';
import ForjaContentEditor from '../components/ForjaContentEditor';

// ─── Snake Draft Visualizer (estático — é explicativo) ───────────────────────
const SNAKE_EXAMPLE = [
  {
    round: 'B', label: 'Round B — Tier B', subtitle: 'Último capitão escolhe primeiro (Snake reverso)',
    picks: [
      { slot: 1, team: 'Seed 16', tier: 'B', dir: '←' },
      { slot: 2, team: 'Seed 15', tier: 'B', dir: '←' },
      { slot: 3, team: 'Seed 14', tier: 'B', dir: '←' },
      { slot: 8, team: '...', tier: 'B', dir: '←' },
      { slot: 15, team: 'Seed 2', tier: 'B', dir: '←' },
      { slot: 16, team: 'Seed 1', tier: 'B', dir: '←' },
    ],
  },
  {
    round: 'C', label: 'Round C — Tier C', subtitle: 'Primeiro capitão escolhe primeiro (ordem direta)',
    picks: [
      { slot: 17, team: 'Seed 1', tier: 'C', dir: '→' },
      { slot: 18, team: 'Seed 2', tier: 'C', dir: '→' },
      { slot: 19, team: 'Seed 3', tier: 'C', dir: '→' },
      { slot: 24, team: '...', tier: 'C', dir: '→' },
      { slot: 31, team: 'Seed 15', tier: 'C', dir: '→' },
      { slot: 32, team: 'Seed 16', tier: 'C', dir: '→' },
    ],
  },
];

const TIER_COLOR: Record<string, string> = { A: '#facc15', B: '#60a5fa', C: '#94a3b8' };

function SnakeVisualizer() {
  return (
    <div className="forja-snake-visualizer">
      <h3 className="forja-snake-visualizer__title">🐍 Ordem do Draft — Exemplo com 16 Times</h3>

      <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
        Total: <strong style={{ color: '#f8fafc' }}>16 capitães (Tier A)</strong> ×{' '}
        <strong style={{ color: '#60a5fa' }}>16 Tier B</strong> +{' '}
        <strong style={{ color: '#94a3b8' }}>16 Tier C</strong> ={' '}
        <strong style={{ color: '#f59e0b' }}>48 jogadores / 16 times de 3</strong>
      </p>

      <div className="forja-snake-rounds">
        {/* Capitães — automático por ELO */}
        <div className="forja-snake-round forja-snake-round--captains">
          <div className="forja-snake-round__header">
            <span className="forja-snake-round__label">Capitães (Tier A)</span>
            <span className="forja-snake-round__sub">Definidos automaticamente pelo ELO snapshot (18h)</span>
          </div>
          <div className="forja-snake-picks">
            {[
              { slot: 1, label: 'Seed 1 ← Maior ELO' },
              { slot: 2, label: 'Seed 2' },
              { slot: 3, label: 'Seed 3' },
              { slot: 8, label: '...' },
              { slot: 15, label: 'Seed 15' },
              { slot: 16, label: 'Seed 16 ← Menor ELO' },
            ].map(({ slot, label }) => (
              <div key={slot} className="forja-snake-pick forja-snake-pick--captain">
                <span className="forja-snake-pick__slot">#{slot}</span>
                <span className="forja-snake-pick__team" style={{ color: '#facc15' }}>{label}</span>
                <span className="forja-snake-pick__tier" style={{ color: '#facc15' }}>TIER A</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rounds B e C */}
        {SNAKE_EXAMPLE.map((round) => (
          <div key={round.round} className={`forja-snake-round forja-snake-round--${round.round.toLowerCase()}`}>
            <div className="forja-snake-round__header">
              <span className="forja-snake-round__label" style={{ color: TIER_COLOR[round.round] }}>
                {round.label}
              </span>
              <span className="forja-snake-round__sub">{round.subtitle}</span>
            </div>
            <div className="forja-snake-picks">
              {round.picks.map((pick, i) => (
                <div key={i} className={`forja-snake-pick${pick.team === '...' ? ' forja-snake-pick--ellipsis' : ''}`}>
                  <span className="forja-snake-pick__slot">#{pick.slot}</span>
                  <span className="forja-snake-pick__dir">{pick.dir}</span>
                  <span className="forja-snake-pick__team">{pick.team}</span>
                  <span className="forja-snake-pick__tier" style={{ color: TIER_COLOR[pick.tier] }}>
                    TIER {pick.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resultado final */}
      <div className="forja-snake-result">
        <h4 className="forja-snake-result__title">Composição Final de Cada Time</h4>
        <div className="forja-snake-result__teams">
          {[
            {
              seed: 1,
              b: 'Pior restante do Tier B (pick #16)',
              c: 'Melhor escolha do Tier C (pick #17)',
              note: '← Seed 1 chega último no B, mas é o primeiro no C',
            },
            {
              seed: 8,
              b: 'Escolha mediana do Tier B (pick #9)',
              c: 'Escolha mediana do Tier C (pick #24)',
              note: '',
            },
            {
              seed: 16,
              b: 'Melhor do Tier B (pick #1)',
              c: 'Última escolha do Tier C (pick #32)',
              note: '← Seed 16 escolhe primeiro no B, mas último no C',
            },
          ].map(t => (
            <div key={t.seed} className="forja-snake-result__team">
              <div className="forja-snake-result__seed" style={{ color: '#f59e0b' }}>Time Seed {t.seed}</div>
              <div className="forja-snake-result__members">
                <span style={{ color: '#facc15' }}>Tier A (cap.)</span> +{' '}
                <span style={{ color: '#60a5fa' }}>{t.b}</span> +{' '}
                <span style={{ color: '#94a3b8' }}>{t.c}</span>
              </div>
              {t.note && <p className="forja-snake-result__note">{t.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaFormato({ discordUser, isAdmin }: ForjaViewProps) {
  const { data, loading } = useForjaContent('format');

  return (
    <section className="forja-view forja-view--formato">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🐍</span> Formato do Torneio</h2>
          <p className="forja-page-subtitle">Snake Draft 3v3 — 1 Tier A + 1 Tier B + 1 Tier C por time</p>
        </div>
      </div>

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
