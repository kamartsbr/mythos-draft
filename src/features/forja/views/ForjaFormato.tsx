/**
 * Forja de Hefesto — Aba: Formato
 * Explicação do Snake Draft e Tiers A, B e C.
 */

import React from 'react';
import { ForjaViewProps } from '../types';

// ─── Snake Draft Visualizer ───────────────────────────────────────────────────

/**
 * Exemplo visual para 3 times (A, B, C) com 3 rodadas Snake Draft.
 * Snake = Rodada 1: A→B→C, Rodada 2: C→B→A, Rodada 3: A→B→C...
 */
const SNAKE_EXAMPLE = [
  {
    round: 1, picks: [
      { slot: 1, team: 'A', tier: 'A', label: 'Capitão A', dir: 'right' },
      { slot: 2, team: 'B', tier: 'A', label: 'Capitão B', dir: 'right' },
      { slot: 3, team: 'C', tier: 'A', label: 'Capitão C', dir: 'right' },
    ]
  },
  {
    round: 2, picks: [
      { slot: 4, team: 'C', tier: 'B', label: 'Membro C', dir: 'left' },
      { slot: 5, team: 'B', tier: 'B', label: 'Membro B', dir: 'left' },
      { slot: 6, team: 'A', tier: 'B', label: 'Membro A', dir: 'left' },
    ]
  },
  {
    round: 3, picks: [
      { slot: 7, team: 'A', tier: 'B', label: 'Membro A₂', dir: 'right' },
      { slot: 8, team: 'B', tier: 'C', label: 'Membro B₂', dir: 'right' },
      { slot: 9, team: 'C', tier: 'C', label: 'Membro C₂', dir: 'right' },
    ]
  },
];

const TEAM_COLORS: Record<string, string> = {
  A: '#f59e0b',
  B: '#60a5fa',
  C: '#a78bfa',
};

const TIER_LABELS: Record<string, { color: string; bg: string; desc: string; criteria: string[] }> = {
  A: {
    color: '#facc15',
    bg: 'rgba(234,179,8,0.1)',
    desc: 'Elite do torneio. Os Capitães e os melhores jogadores. Alto ELO, consistência em torneios e capacidade de liderança.',
    criteria: [
      'ELO 1v1 ≥ 1900 ou ELO TG ≥ 2000',
      'Histórico em torneios competitivos',
      'Experiência como liderança de time',
      'Indicação ou validação da organização',
    ],
  },
  B: {
    color: '#60a5fa',
    bg: 'rgba(59,130,246,0.1)',
    desc: 'Jogadores sólidos e versáteis. Boa base mecânica e estratégica, mas sem o nível de consistência do Tier A.',
    criteria: [
      'ELO 1v1 entre 1650–1899 ou ELO TG entre 1750–1999',
      'Participação em torneios amadores',
      'Conhecimento de múltiplas civilizações',
      'Comunicação e adaptabilidade',
    ],
  },
  C: {
    color: '#94a3b8',
    bg: 'rgba(100,116,139,0.1)',
    desc: 'Jogadores emergentes com potencial. Podem surpreender com o suporte correto dos Capitães.',
    criteria: [
      'ELO 1v1 < 1650 ou ELO TG < 1750',
      'Jogadores motivados e comprometidos',
      'Disposição para aprender e se adaptar',
      'Pontualidade e fair play comprovados',
    ],
  },
};

// ─── Snake Visualizer Component ───────────────────────────────────────────────

function SnakeVisualizer() {
  return (
    <div className="forja-snake-viz">
      {SNAKE_EXAMPLE.map(row => (
        <div key={row.round} className="forja-snake-row">
          <div className="forja-snake-round-label">
            Rodada {row.round}
            <span className="forja-snake-arrow">
              {row.picks[0].dir === 'right' ? '→' : '←'}
            </span>
          </div>
          <div className={`forja-snake-picks ${row.picks[0].dir === 'left' ? 'forja-snake-picks--reversed' : ''}`}>
            {row.picks.map(pick => (
              <div
                key={pick.slot}
                className="forja-snake-pick"
                style={{ borderColor: TEAM_COLORS[pick.team] + '80' }}
              >
                <div
                  className="forja-snake-pick__num"
                  style={{ background: TEAM_COLORS[pick.team] + '20', color: TEAM_COLORS[pick.team] }}
                >
                  #{pick.slot}
                </div>
                <div
                  className="forja-snake-pick__team"
                  style={{ color: TEAM_COLORS[pick.team] }}
                >
                  Time {pick.team}
                </div>
                <div className="forja-snake-pick__label">{pick.label}</div>
                <div
                  className="forja-snake-pick__tier"
                  style={{
                    background: TIER_LABELS[pick.tier].bg,
                    color: TIER_LABELS[pick.tier].color,
                    border: `1px solid ${TIER_LABELS[pick.tier].color}40`,
                  }}
                >
                  Tier {pick.tier}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="forja-snake-legend">
        {Object.entries(TEAM_COLORS).map(([team, color]) => (
          <div key={team} className="forja-snake-legend__item">
            <span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: color, display: 'inline-block' }} />
            Time {team}
          </div>
        ))}
        <div className="forja-snake-legend__item" style={{ marginLeft: 'auto' }}>
          * Exemplo com 3 times e 3 jogadores cada
        </div>
      </div>
    </div>
  );
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({ tier, info }: { tier: string; info: typeof TIER_LABELS['A'] }) {
  return (
    <div className="forja-tier-card" style={{ borderColor: info.color + '40', background: info.bg }}>
      <div className="forja-tier-card__badge" style={{ color: info.color, border: `2px solid ${info.color}60` }}>
        {tier}
      </div>
      <div className="forja-tier-card__content">
        <p className="forja-tier-card__desc">{info.desc}</p>
        <ul className="forja-tier-card__criteria">
          {info.criteria.map((c, i) => (
            <li key={i}>
              <span style={{ color: info.color }}>✓</span>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaFormato({ discordUser, isAdmin }: ForjaViewProps) {
  return (
    <section className="forja-view forja-view--formato">
      {/* Page Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title">
            <span>🐍</span> Formato do Torneio
          </h2>
          <p className="forja-page-subtitle">
            Sistema Snake Draft e classificação por Tiers
          </p>
        </div>
      </div>

      {/* What is Snake Draft */}
      <div className="forja-formato-block">
        <h3 className="forja-section-title">
          <span>🐍</span> O que é o Snake Draft?
        </h3>
        <div className="forja-formato-explainer">
          <div className="forja-formato-explainer__text">
            <p>
              O <strong>Snake Draft</strong> é o sistema de formação de times utilizado no torneio.
              Em vez de um time escolher todos os seus jogadores antes do próximo, a ordem de seleção
              "serpenteia" a cada rodada, garantindo <strong>equilíbrio competitivo</strong>.
            </p>
            <p>
              Na <strong>Rodada 1</strong>, os Capitães escolhem na ordem 1, 2, 3.
              Na <strong>Rodada 2</strong>, a ordem se inverte: 3, 2, 1.
              Na <strong>Rodada 3</strong>, volta ao normal: 1, 2, 3... e assim por diante.
            </p>
            <p>
              Isso significa que o Capitão que escolhe <em>primeiro</em> na primeira rodada
              escolhe <em>por último</em> na segunda rodada — compensando a vantagem inicial.
            </p>
          </div>
          <div className="forja-formato-explainer__rules">
            <div className="forja-formato-rule">
              <span className="forja-formato-rule__num">1</span>
              <div>
                <strong>Ordem Serpentina</strong>
                <p>A ordem de pick inverte a cada rodada, garantindo equidade entre os Capitães.</p>
              </div>
            </div>
            <div className="forja-formato-rule">
              <span className="forja-formato-rule__num">2</span>
              <div>
                <strong>Capitões no Tier A</strong>
                <p>Os próprios Capitães são os picks da Rodada 1. A ordem do draft é sorteada ao vivo.</p>
              </div>
            </div>
            <div className="forja-formato-rule">
              <span className="forja-formato-rule__num">3</span>
              <div>
                <strong>Respeito aos Tiers</strong>
                <p>Não há obrigatoriedade de tier por rodada, mas o balanceamento é orientado pela organização.</p>
              </div>
            </div>
            <div className="forja-formato-rule">
              <span className="forja-formato-rule__num">4</span>
              <div>
                <strong>Tempo de Pick</strong>
                <p>Cada Capitão tem um tempo limite por pick. O Admin pode forçar uma escolha se necessário.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Snake Visualizer */}
      <div className="forja-formato-block">
        <h3 className="forja-section-title">
          <span>📊</span> Visualização do Draft
        </h3>
        <p className="forja-formato-viz-note">
          Exemplo ilustrativo com 3 times · 3 membros cada · 9 picks totais
        </p>
        <SnakeVisualizer />
      </div>

      {/* Tier System */}
      <div className="forja-formato-block">
        <h3 className="forja-section-title">
          <span>🎖️</span> Sistema de Tiers
        </h3>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.7' }}>
          Os jogadores inscritos são classificados pela organização em três Tiers antes do draft.
          A classificação leva em conta ELO atual no AoMStats, histórico competitivo e avaliação técnica.
        </p>
        <div className="forja-tier-grid">
          {Object.entries(TIER_LABELS).map(([tier, info]) => (
            <TierCard key={tier} tier={tier} info={info} />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="forja-formato-block">
        <h3 className="forja-section-title">
          <span>🗓️</span> Cronograma do Draft
        </h3>
        <div className="forja-timeline">
          {[
            { step: '01', color: '#f59e0b', label: 'Inscrições Abertas', desc: 'Jogadores se inscrevem pela aba Início' },
            { step: '02', color: '#60a5fa', label: 'Triagem e Tiers', desc: 'Admin classifica os jogadores em Tiers A, B e C' },
            { step: '03', color: '#a78bfa', label: 'Sorteio da Ordem', desc: 'A ordem dos picks do draft é sorteada ao vivo no Discord' },
            { step: '04', color: '#f97316', label: 'Snake Draft ao Vivo', desc: 'Capitães fazem seus picks em sessão transmitida' },
            { step: '05', color: '#4ade80', label: 'Times Formados', desc: 'Times publicados na aba "Times" do Hub' },
            { step: '06', color: '#facc15', label: 'Competição Inicia', desc: 'Partidas conforme cronograma na aba Schedule' },
          ].map((item, i, arr) => (
            <div key={item.step} className="forja-timeline-item">
              <div className="forja-timeline-dot" style={{ borderColor: item.color, background: item.color + '20' }}>
                <span style={{ color: item.color, fontWeight: 900, fontSize: '0.7rem' }}>{item.step}</span>
              </div>
              {i < arr.length - 1 && <div className="forja-timeline-line" />}
              <div className="forja-timeline-content">
                <strong style={{ color: item.color }}>{item.label}</strong>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
