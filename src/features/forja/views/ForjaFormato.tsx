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
    round: 'B', label: 'Round B — Tier B', subtitle: 'Último capitão escolhe primeiro',
    picks: [
      { slot: 1, team: 'Seed 12', tier: 'B', dir: '←' },
      { slot: 2, team: 'Seed 11', tier: 'B', dir: '←' },
      { slot: 11, team: '...', tier: 'B', dir: '←' },
      { slot: 12, team: 'Seed 1', tier: 'B', dir: '←' },
    ]
  },
  {
    round: 'C', label: 'Round C — Tier C', subtitle: 'Primeiro capitão escolhe primeiro',
    picks: [
      { slot: 13, team: 'Seed 1', tier: 'C', dir: '→' },
      { slot: 14, team: 'Seed 2', tier: 'C', dir: '→' },
      { slot: 23, team: '...', tier: 'C', dir: '→' },
      { slot: 24, team: 'Seed 12', tier: 'C', dir: '→' },
    ]
  },
];

const TIER_COLOR: Record<string, string> = { A: '#facc15', B: '#60a5fa', C: '#94a3b8' };

function SnakeVisualizer() {
  return (
    <div className="forja-snake-visualizer">
      <h3 className="forja-snake-visualizer__title">🐍 Ordem do Draft — Exemplo com 12 Times</h3>
      <div className="forja-snake-rounds">
        {/* Capitães — automático por ELO */}
        <div className="forja-snake-round forja-snake-round--captains">
          <div className="forja-snake-round__header">
            <span className="forja-snake-round__label">Capitães (Tier A)</span>
            <span className="forja-snake-round__sub">Definidos automaticamente pelo ELO snapshot (14h)</span>
          </div>
          <div className="forja-snake-picks">
            {['Seed 1 ← Maior ELO', '...', 'Seed 12 ← Menor ELO'].map((label, i) => (
              <div key={i} className="forja-snake-pick forja-snake-pick--captain">
                <span className="forja-snake-pick__slot">#{i === 2 ? 12 : i + 1}</span>
                <span className="forja-snake-pick__team" style={{ color: '#facc15' }}>{label}</span>
                <span className="forja-snake-pick__tier" style={{ color: '#facc15' }}>Tier A</span>
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
                <div key={i} className="forja-snake-pick">
                  <span className="forja-snake-pick__slot">#{pick.slot}</span>
                  <span className="forja-snake-pick__dir">{pick.dir}</span>
                  <span className="forja-snake-pick__team">{pick.team}</span>
                  <span className="forja-snake-pick__tier" style={{ color: TIER_COLOR[pick.tier] }}>
                    Tier {pick.tier}
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
            { seed: 1, b: 'Pior restante do B', c: 'Melhor escolha do C', note: '← seed 1 pega sobra do B, mas escolhe primeiro no C' },
            { seed: 6, b: 'Escolha Média do B', c: 'Escolha Média do C', note: '' },
            { seed: 12, b: 'Melhor do Tier B',   c: 'Última escolha do C', note: '← seed 12 escolhe primeiro no B, mas último no C' },
          ].map(t => (
            <div key={t.seed} className="forja-snake-result__team">
              <div className="forja-snake-result__seed" style={{ color: '#f59e0b' }}>Time Seed {t.seed}</div>
              <div className="forja-snake-result__members">
                <span style={{ color: '#facc15' }}>Tier A</span> +{' '}
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
