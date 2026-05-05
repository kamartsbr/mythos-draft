/**
 * ============================================================
 *  FORJA DE HEFESTO — Hub Principal
 *  Rota: /forja
 *  Passo 4: admin draft tab + OBS mode
 * ============================================================
 */

import React, { useState, lazy, Suspense, useEffect } from 'react';
import { ForjaTab, ForjaTabId } from './types';
import { useForjaDiscordAuth } from './hooks/useForjaDiscordAuth';
import ForjaRegistrationModal from './components/ForjaRegistrationModal';
import './forja.css';

// ── Sub-abas (Lazy) ───────────────────────────────────────────────────────────
const ForjaInicio      = lazy(() => import('./views/ForjaInicio'));
const ForjaRegras      = lazy(() => import('./views/ForjaRegras'));
const ForjaFormato     = lazy(() => import('./views/ForjaFormato'));
const ForjaSchedule    = lazy(() => import('./views/ForjaSchedule'));
const ForjaTimes       = lazy(() => import('./views/ForjaTimes'));
const ForjaDrafts      = lazy(() => import('./views/ForjaDrafts'));
const ForjaAdminDraft  = lazy(() => import('./views/ForjaAdminDraft'));
const ForjaDraftOBS    = lazy(() => import('./views/ForjaDraftOBS'));

// ── Tabs ──────────────────────────────────────────────────────────────────────
const PUBLIC_TABS: ForjaTab[] = [
  { id: 'inicio',   label: 'Início',   icon: '🏛️' },
  { id: 'regras',   label: 'Regras',   icon: '📜' },
  { id: 'formato',  label: 'Formato',  icon: '🐍' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'times',    label: 'Times',    icon: '🛡️' },
  { id: 'drafts',   label: 'Drafts',   icon: '⚔️' },
];

const ADMIN_TABS: ForjaTab[] = [
  { id: 'admin-draft', label: 'Draft Admin', icon: '🎯' },
  { id: 'obs',         label: 'OBS Mode',    icon: '📺' },
];

// ── Tab Fallback ──────────────────────────────────────────────────────────────
function TabFallback() {
  return (
    <div className="forja-tab-loader">
      <div className="forja-loader-spinner" />
      <span>Carregando...</span>
    </div>
  );
}

// ── OBS Mode (full-page, sem chrome) ─────────────────────────────────────────
function OBSShell({ discordUser, isAdmin }: { discordUser: any; isAdmin: boolean }) {
  return (
    <div style={{ background: '#020617', minHeight: '100vh' }}>
      <Suspense fallback={<TabFallback />}>
        <ForjaDraftOBS discordUser={discordUser} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ForjaHub() {
  const [activeTab, setActiveTab]       = useState<ForjaTabId>('inicio');
  const [showRegModal, setShowRegModal] = useState(false);

  const { discordUser, isAdmin, isLoading: authLoading, loginWithDiscord, logout } = useForjaDiscordAuth();

  // Ler aba da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as ForjaTabId | null;
    const allTabs = [...PUBLIC_TABS, ...ADMIN_TABS];
    if (tab && allTabs.find(t => t.id === tab)) setActiveTab(tab);
  }, []);

  const handleTabChange = (id: ForjaTabId) => {
    setActiveTab(id);
    const url = new URL(window.location.href);
    url.pathname = '/forja';
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url.toString());
  };

  const sharedProps = { discordUser, isAdmin };

  // OBS mode: renderização fullscreen sem chrome
  if (activeTab === 'obs') {
    return (
      <>
        <OBSShell {...sharedProps} />
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

  const allVisibleTabs = isAdmin ? [...PUBLIC_TABS, ...ADMIN_TABS] : PUBLIC_TABS;

  return (
    <div className="forja-hub">

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

            <div className="forja-header-logo">
              <img src="https://static.wikia.nocookie.net/ageofempires/images/e/e0/Logo_AoMR.png/revision/latest"
                alt="Age of Mythology: Retold" className="forja-aomr-logo"
                referrerPolicy="no-referrer" loading="lazy" />
            </div>
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
              aria-controls={`forja-panel-${tab.id}`}
              className={`forja-tab-btn ${activeTab === tab.id ? 'forja-tab-btn--active' : ''} ${ADMIN_TABS.find(t => t.id === tab.id) ? 'forja-tab-btn--admin' : ''}`}
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
      <main
        className="forja-tab-content"
        id={`forja-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`forja-tab-${activeTab}`}
      >
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'inicio'      && <ForjaInicio {...sharedProps} onRegisterClick={() => setShowRegModal(true)} />}
          {activeTab === 'regras'      && <ForjaRegras {...sharedProps} />}
          {activeTab === 'formato'     && <ForjaFormato {...sharedProps} />}
          {activeTab === 'schedule'    && <ForjaSchedule {...sharedProps} />}
          {activeTab === 'times'       && <ForjaTimes {...sharedProps} />}
          {activeTab === 'drafts'      && <ForjaDrafts {...sharedProps} />}
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
