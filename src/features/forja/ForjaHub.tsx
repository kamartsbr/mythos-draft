/**
 * ============================================================
 *  FORJA DE HEFESTO — Hub Principal (Revisão Major)
 *  Passo 4: draft-room tab, settings/deadline, seed content
 * ============================================================
 */
import React, { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { ForjaTab, ForjaTabId } from './types';
import { useForjaDiscordAuth } from './hooks/useForjaDiscordAuth';
import { useForjaPlayers } from './hooks/useForjaPlayers';
import { useForjaSettings } from './hooks/useForjaContent';
import { useForjaDraftSession } from './hooks/useForjaDraftSession';
import { seedDefaultContent } from './services/forjaService';
import ForjaRegistrationModal from './components/ForjaRegistrationModal';
import './forja.css';

// ── Sub-abas (Lazy) ───────────────────────────────────────────────────────────
const ForjaInicio      = lazy(() => import('./views/ForjaInicio'));
const ForjaRegras      = lazy(() => import('./views/ForjaRegras'));
const ForjaMapas       = lazy(() => import('./views/ForjaMapas'));
const ForjaFormato     = lazy(() => import('./views/ForjaFormato'));
const ForjaSchedule    = lazy(() => import('./views/ForjaSchedule'));
const ForjaTimes       = lazy(() => import('./views/ForjaTimes'));
const ForjaTabela      = lazy(() => import('./views/ForjaTabela'));
const ForjaAdminDraft  = lazy(() => import('./views/ForjaAdminDraft'));
const ForjaDraftRoom   = lazy(() => import('./views/ForjaDraftRoom'));
const ForjaDraftOBS    = lazy(() => import('./views/ForjaDraftOBS'));
// Fase 3
const ForjaRulesEditor  = lazy(() => import('./components/ForjaRulesEditor'));
const ForjaTimesManager = lazy(() => import('./components/ForjaTimesManager'));

// ── Tabs ──────────────────────────────────────────────────────────────────────
const PUBLIC_TABS: ForjaTab[] = [
  { id: 'inicio' as ForjaTabId,   label: 'Início',   icon: '🏛️' },
  { id: 'regras' as ForjaTabId,   label: 'Regras',   icon: '📜' },
  { id: 'mapas' as ForjaTabId,    label: 'Mapas',    icon: '🗺️' },
  { id: 'formato' as ForjaTabId,  label: 'Formato',  icon: '🐍' },
  { id: 'schedule' as ForjaTabId, label: 'Schedule', icon: '📅' },
  { id: 'times' as ForjaTabId,    label: 'Times',    icon: '🛡️' },
  { id: 'tabela' as ForjaTabId,   label: 'Tabela',   icon: '📊' },
];

const ADMIN_TABS: ForjaTab[] = [
  { id: 'admin-draft' as ForjaTabId, label: 'Draft Admin', icon: '🎯' },
  { id: 'obs' as ForjaTabId,         label: 'OBS Mode',    icon: '📺' },
];

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const i = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(i);
  }, [targetMs]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { remaining, h, m, s, expired: remaining === 0 };
}

function TabFallback() {
  return (
    <div className="forja-tab-loader">
      <div className="forja-loader-spinner" />
      <span>Carregando...</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ForjaHub() {
  const [activeTab, setActiveTab]       = useState<ForjaTabId>('inicio');
  const [showRegModal, setShowRegModal] = useState(false);
  const [seeding, setSeeding]           = useState(false);

  const { discordUser, isAdmin, isLoading: authLoading, loginWithDiscord, logout } = useForjaDiscordAuth();
  const { rankedPlayers, loading: playersLoading, error: playersError, isLive: playersLive } = useForjaPlayers();
  const { registrationOpen, msToDeadline, data: settings } = useForjaSettings();
  const { session } = useForjaDraftSession();

  const countdown = useCountdown(settings?.registration_deadline_ms ?? Date.now() + 999999999);

  // Ler aba da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as ForjaTabId | null;
    const allTabs = [...PUBLIC_TABS, ...ADMIN_TABS, { id: 'draft-room' as ForjaTabId }];
    if (tab && allTabs.find(t => t.id === tab)) setActiveTab(tab);
  }, []);

  const handleTabChange = useCallback((id: ForjaTabId) => {
    setActiveTab(id);
    const url = new URL(window.location.href);
    url.pathname = '/forja';
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const handleSeedContent = async () => {
    setSeeding(true);
    await seedDefaultContent(discordUser?.username ?? 'admin');
    setSeeding(false);
    alert('Conteúdo padrão inicializado! Acesse as abas Regras e Formato para editar.');
  };

  const sharedProps = { discordUser, isAdmin };

  // Capitão logado (tem time no draft)
  // Mostrar draft-room tab se o draft estiver ativo e o usuário for capitão ou admin
  const isDraftActive = !!session && session.status === 'active';
  const showDraftRoomTab = isDraftActive && (isAdmin || !!discordUser);

  // OBS mode: fullscreen sem chrome
  if (activeTab === 'obs') {
    return (
      <>
        <div style={{ background: '#020617', minHeight: '100vh' }}>
          <Suspense fallback={<TabFallback />}>
            <ForjaDraftOBS {...sharedProps} />
          </Suspense>
        </div>
        <button
          style={{ position: 'fixed', top: '0.75rem', right: '0.75rem', zIndex: 100,
            background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(51,65,85,0.5)',
            color: '#64748b', borderRadius: '0.5rem', padding: '0.4rem 0.75rem',
            cursor: 'pointer', fontSize: '0.72rem' }}
          onClick={() => handleTabChange('admin-draft')}
        >
          ← Sair do OBS
        </button>
      </>
    );
  }

  const allVisibleTabs: ForjaTab[] = [
    ...PUBLIC_TABS,
    ...(showDraftRoomTab ? [{ id: 'draft-room' as ForjaTabId, label: 'Sala de Draft', icon: '🎯' }] : []),
    ...(isAdmin ? ADMIN_TABS : []),
  ];

  // Mostrar banner de deadline apenas se < 24h e inscrições ainda abertas
  const showDeadlineBanner = registrationOpen && msToDeadline < 24 * 3600 * 1000 && msToDeadline > 0;

  // Formatar label dinâmica da deadline (ex: "Sáb 10/05 às 13h59 BRT")
  const deadlineLabel = (() => {
    const deadlineMs = settings?.registration_deadline_ms;
    if (!deadlineMs) return '';
    const d = new Date(deadlineMs);
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayName  = weekdays[d.getDay()];
    const day      = String(d.getDate()).padStart(2, '0');
    const month    = String(d.getMonth() + 1).padStart(2, '0');
    const hh       = String(d.getHours()).padStart(2, '0');
    const mm       = String(d.getMinutes()).padStart(2, '0');
    return `${dayName} ${day}/${month} às ${hh}h${mm} BRT`;
  })();

  return (
    <div className="forja-hub">

      {/* ── Deadline Banner ──────────────────────── */}
      {showDeadlineBanner && (
        <div className="forja-deadline-banner">
          <span>⏰</span>
          <span>
            Inscrições encerram em{' '}
            <strong>{countdown.h}h {countdown.m}m {countdown.s}s</strong>
            {deadlineLabel && <>{' '}— {deadlineLabel}</>}
          </span>
          <button
            className="forja-btn forja-btn--primary"
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', marginLeft: 'auto' }}
            onClick={() => setShowRegModal(true)}
          >
            Inscreva-se agora
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────── */}
      <header className="forja-header">
        <div className="forja-header-inner">
          <div className="forja-title-block">
            <span className="forja-badge">TORNEIO 3v3</span>
            <h1 className="forja-title">
              <span className="forja-title-icon">🔥</span>
              Forja de Hefesto
            </h1>
            <p className="forja-subtitle">
              O campo de batalha definitivo do Age of Mythology: Retold — BR/PT
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Admin quick actions */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="forja-btn forja-btn--ghost"
                  style={{ fontSize: '0.68rem', padding: '0.35rem 0.75rem' }}
                  onClick={handleSeedContent}
                  disabled={seeding}
                  title="Inicializar conteúdo padrão no Firestore (Regras, Formato, Premiação)"
                >
                  {seeding ? '⏳' : '🌱'} Seed
                </button>
              </div>
            )}

            {/* Discord Auth */}
            <div className="forja-auth-widget">
              {authLoading ? (
                <div className="forja-auth-loading">
                  <div className="forja-loader-spinner" style={{ width: '1rem', height: '1rem' }} />
                </div>
              ) : discordUser ? (
                <div className="forja-auth-user">
                  <img src={discordUser.avatar_url} alt={discordUser.username}
                    className="forja-auth-avatar" referrerPolicy="no-referrer" />
                  <div className="forja-auth-info">
                    <span className="forja-auth-name">{discordUser.username}</span>
                    {isAdmin && <span className="forja-auth-admin">ADMIN</span>}
                  </div>
                  <button className="forja-auth-logout" onClick={logout} title="Sair" id="forja-auth-logout-btn">✕</button>
                </div>
              ) : (
                <button id="forja-auth-discord-btn"
                  className="forja-btn forja-btn--secondary"
                  style={{ fontSize: '0.72rem', padding: '0.5rem 1rem' }}
                  onClick={loginWithDiscord}
                >
                  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Discord_logo.svg/1920px-Discord_logo.svg.png"
                    alt="Discord" style={{ height: '0.875rem', width: 'auto' }} referrerPolicy="no-referrer" />
                  Login Discord
                </button>
              )}
            </div>

            <a href="/" className="forja-back-link" style={{ marginBottom: 0 }}>← Voltar</a>
          </div>
        </div>
      </header>

      {/* ── Tabs Nav ──────────────────────────── */}
      <nav className="forja-tabs-nav" role="tablist">
        <div className="forja-tabs-inner">
          {allVisibleTabs.map(tab => (
            <button
              key={tab.id}
              id={`forja-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`forja-tab-btn ${activeTab === tab.id ? 'forja-tab-btn--active' : ''} ${ADMIN_TABS.find(t => t.id === tab.id) ? 'forja-tab-btn--admin' : ''} ${tab.id === 'draft-room' ? 'forja-tab-btn--draft-room' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="forja-tab-icon">{tab.icon}</span>
              <span className="forja-tab-label">{tab.label}</span>
              {activeTab === tab.id && <span className="forja-tab-indicator" />}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab Content ───────────────────────── */}
      <main className="forja-tab-content">
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'inicio'      && <ForjaInicio {...sharedProps} onRegisterClick={() => setShowRegModal(true)} />}
          {activeTab === 'regras'      && (isAdmin
            ? <ForjaRulesEditor {...sharedProps} />
            : <ForjaRegras {...sharedProps} />)}
          {activeTab === 'mapas'       && <ForjaMapas {...sharedProps} />}
          {activeTab === 'formato'     && <ForjaFormato {...sharedProps} />}
          {activeTab === 'schedule'    && <ForjaSchedule {...sharedProps} />}
          {activeTab === 'times'       && (isAdmin
            ? <ForjaTimesManager {...sharedProps} />
            : <ForjaTimes {...sharedProps} />)}
          {activeTab === 'tabela'      && <ForjaTabela {...sharedProps} />}
          {activeTab === 'draft-room'  && <ForjaDraftRoom {...sharedProps} />}
          {activeTab === 'admin-draft' && <ForjaAdminDraft {...sharedProps} />}
        </Suspense>
      </main>

      {/* ── Registration Modal ─────────────────── */}
      <ForjaRegistrationModal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        discordUser={discordUser}
        onLoginRequest={loginWithDiscord}
        onSuccess={() => { setShowRegModal(false); handleTabChange('inicio'); }}
      />
    </div>
  );
}
