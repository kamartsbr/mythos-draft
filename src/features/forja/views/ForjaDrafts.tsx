/**
 * Forja de Hefesto — Aba: Drafts
 * Link/atalho para a ferramenta de vetos principal do site.
 */

import React from 'react';
import { ForjaViewProps } from '../types';

// ─── Feature Cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '⚔️',
    title: 'Draft de Deuses',
    desc: 'Crie lobbies de veto de deuses para treinos, torneios ou partidas amistosas. Suporte a múltiplas configurações e presets.',
    color: '#f59e0b',
  },
  {
    icon: '🗺️',
    title: 'Draft de Mapas',
    desc: 'Sistema de ban/pick de mapas integrado ao draft de deuses. Configure a ordem manualmente ou use os presets do torneio.',
    color: '#60a5fa',
  },
  {
    icon: '📺',
    title: 'Modo OBS / Streamer HUD',
    desc: 'Interface visual limpa para transmissão ao vivo. Exibe picks e bans em tempo real sem controles de moderação visíveis.',
    color: '#a78bfa',
  },
  {
    icon: '🏆',
    title: 'Preset MCL',
    desc: 'Configuração pré-definida para o formato da MCL. Selecione a rodada e o sistema configura a ordem de mapas automaticamente.',
    color: '#34d399',
  },
];

// ─── Lobby Quick Links ────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Novo Lobby de Draft', href: '/', icon: '＋', primary: true },
  { label: 'Ver Lobbies Ativos', href: '/', icon: '📋', primary: false },
  { label: 'Preset MCL', href: '/?preset=MCL', icon: '🏆', primary: false },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaDrafts({ discordUser, isAdmin }: ForjaViewProps) {
  return (
    <section className="forja-view forja-view--drafts">
      {/* Page Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title">
            <span>⚔️</span> Ferramenta de Draft
          </h2>
          <p className="forja-page-subtitle">
            Acesse o sistema de vetos de deuses e mapas do Mythos Draft
          </p>
        </div>
      </div>

      {/* Hero CTA */}
      <div className="forja-drafts-hero">
        <div className="forja-drafts-hero__glow" />
        <div className="forja-drafts-hero__content">
          <img
            src="https://static.wikia.nocookie.net/ageofempires/images/e/e0/Logo_AoMR.png/revision/latest"
            alt="AoMR"
            style={{ height: '4rem', width: 'auto', objectFit: 'contain', opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.4))' }}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <h3 className="forja-drafts-hero__title">Mythos Draft Tool</h3>
          <p className="forja-drafts-hero__desc">
            A plataforma de draft de deuses e mapas criada especialmente para a comunidade
            brasileira e portuguesa de Age of Mythology: Retold.
          </p>
          <div className="forja-drafts-hero__actions">
            {QUICK_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                id={`forja-draft-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`forja-btn ${link.primary ? 'forja-btn--primary forja-btn--glow' : 'forja-btn--secondary'}`}
              >
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <h3 className="forja-section-title" style={{ marginTop: '2.5rem' }}>
        <span>✨</span> Recursos da Ferramenta
      </h3>
      <div className="forja-drafts-features">
        {FEATURES.map(f => (
          <div key={f.title} className="forja-drafts-feature-card" style={{ borderColor: f.color + '30' }}>
            <div className="forja-drafts-feature-card__icon" style={{ color: f.color, background: f.color + '15' }}>
              {f.icon}
            </div>
            <div>
              <strong style={{ color: '#f1f5f9', display: 'block', marginBottom: '0.35rem' }}>{f.title}</strong>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tournament Draft Note */}
      <div className="forja-drafts-note">
        <span>ℹ️</span>
        <div>
          <strong>Drafts do Torneio</strong>
          <p>
            As sessões de draft da Forja de Hefesto serão criadas pela organização e os links
            compartilhados no Discord antes de cada partida. Capitães podem preparar estratégias
            criando lobbies de treino privados a qualquer momento.
          </p>
        </div>
      </div>
    </section>
  );
}
