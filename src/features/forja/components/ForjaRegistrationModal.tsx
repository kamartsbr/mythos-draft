/**
 * ForjaRegistrationModal — Revisado (Passo 4 Major)
 * Fluxo: Login Discord → profile_id aomstats → pitch + consentimentos → Firestore
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ForjaDiscordUser, ForjaRegistrationForm } from '../types';
import { parseAomProfileId, registerForjaPlayer, isPlayerRegistered } from '../services/forjaService';
import { useForjaSettings } from '../hooks/useForjaContent';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  discordUser: ForjaDiscordUser | null;
  onLoginRequest: () => void;
  onSuccess: () => void;
}

type Step = 'login' | 'check' | 'form' | 'submitting' | 'done' | 'already' | 'closed';

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, targetMs - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { remaining, h, m, s, expired: remaining === 0 };
}

// ─── Step: Login Gate ─────────────────────────────────────────────────────────
function LoginGate({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3rem' }}>🔑</div>
      <h3 className="forja-modal-step__title">Login com Discord</h3>
      <p className="forja-modal-step__desc">
        Para se inscrever, faça login com sua conta Discord. Solicitamos apenas seu ID e avatar — nenhuma permissão de escrita.
      </p>
      <button id="forja-reg-discord-login-btn" className="forja-btn forja-btn--primary forja-btn--lg" onClick={onLogin} style={{ width: '100%' }}>
        Entrar com Discord
      </button>
      <button className="forja-btn forja-btn--ghost" onClick={onClose} style={{ width: '100%' }}>Cancelar</button>
    </div>
  );
}

// ─── Step: Closed / Deadline Passed ──────────────────────────────────────────
function RegistrationClosed({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3rem' }}>🔒</div>
      <h3 className="forja-modal-step__title">Inscrições Encerradas</h3>
      <p className="forja-modal-step__desc">
        O prazo de inscrição foi encerrado às 13h59 do sábado. Acompanhe o torneio ao vivo!
      </p>
      <button className="forja-btn forja-btn--primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>
    </div>
  );
}

// ─── Step: Already Registered ─────────────────────────────────────────────────
function AlreadyRegistered({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h3 className="forja-modal-step__title">Você já está inscrito!</h3>
      <p className="forja-modal-step__desc">
        Sua inscrição foi confirmada. Fique de olho no Discord para atualizações sobre o torneio.
      </p>
      <button className="forja-btn forja-btn--primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>
    </div>
  );
}

// ─── Step: Done ───────────────────────────────────────────────────────────────
function RegistrationDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3.5rem' }}>🔥</div>
      <h3 className="forja-modal-step__title">Inscrição Confirmada!</h3>
      <p className="forja-modal-step__desc">
        Você está na Forja de Hefesto. Seu ELO será registrado no sábado às 14h.
        Esteja online às <strong>15h do sábado 09/05</strong> para o Draft!
      </p>
      <button id="forja-reg-done-btn" className="forja-btn forja-btn--primary forja-btn--lg" onClick={onClose} style={{ width: '100%' }}>
        🏛️ Ver meu card
      </button>
    </div>
  );
}

// ─── Step: Form ───────────────────────────────────────────────────────────────
interface FormStepProps {
  discordUser: ForjaDiscordUser;
  onSubmit: (form: ForjaRegistrationForm) => void;
  onClose: () => void;
  submitting: boolean;
  deadlineMs: number;
}

function RegistrationForm({ discordUser, onSubmit, onClose, submitting, deadlineMs }: FormStepProps) {
  const [aomUrl, setAomUrl]           = useState('');
  const [pitch, setPitch]             = useState('');
  const [isBrazilian, setIsBrazilian] = useState(false);
  const [consentRules, setConsentRules]   = useState(false);
  const [consentFormat, setConsentFormat] = useState(false);
  const [urlError, setUrlError]       = useState('');

  const countdown = useCountdown(deadlineMs);
  const pitchLeft = 50 - pitch.length;

  const validateUrl = useCallback((val: string) => {
    if (!val.trim()) { setUrlError('URL obrigatória'); return false; }
    const id = parseAomProfileId(val);
    if (!id) {
      setUrlError('URL inválida. Use: https://aomstats.io/profiles/SEU_ID');
      return false;
    }
    setUrlError('');
    return true;
  }, []);

  const isValid = aomUrl.trim() && !urlError && pitch.trim() && isBrazilian && consentRules && consentFormat;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(aomUrl) || !isValid) return;
    onSubmit({ aomstats_url: aomUrl, pitch_quote: pitch, is_brazilian: isBrazilian, consent_rules: consentRules, consent_format: consentFormat });
  };

  return (
    <form className="forja-reg-form" onSubmit={handleSubmit}>
      {/* Deadline warning */}
      {!countdown.expired && countdown.remaining < 3 * 3600 * 1000 && (
        <div className="forja-reg-deadline-warn">
          ⏰ Inscrições encerram em {countdown.h}h {countdown.m}m {countdown.s}s
        </div>
      )}

      {/* User banner */}
      <div className="forja-reg-user-banner">
        <img src={discordUser.avatar_url} alt={discordUser.username} className="forja-reg-avatar" referrerPolicy="no-referrer" />
        <div>
          <span className="forja-reg-username">{discordUser.username}</span>
          <span className="forja-reg-userid">ID: {discordUser.discord_id}</span>
        </div>
        <span className="forja-reg-verified">✓ Discord</span>
      </div>

      {/* AoMStats URL */}
      <div className="forja-reg-field">
        <label htmlFor="forja-reg-aomstats" className="forja-reg-label">
          Perfil no AoMStats.io <span style={{ color: '#f87171' }}>*</span>
        </label>
        <input
          id="forja-reg-aomstats" type="url"
          className={`forja-reg-input ${urlError ? 'forja-reg-input--error' : ''}`}
          placeholder="https://aomstats.io/profiles/12345"
          value={aomUrl}
          onChange={e => { setAomUrl(e.target.value); if (urlError) validateUrl(e.target.value); }}
          onBlur={e => validateUrl(e.target.value)}
          required disabled={submitting}
        />
        {urlError && <span className="forja-reg-field-error">{urlError}</span>}
        <span className="forja-reg-hint">
          📌 Como encontrar: <a href="https://aomstats.io/leaderboard/1" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>aomstats.io/leaderboard/1</a> → busque seu nick → clique no perfil → copie a URL
        </span>
      </div>

      {/* Pitch */}
      <div className="forja-reg-field">
        <label htmlFor="forja-reg-pitch" className="forja-reg-label">
          Frase de efeito <span style={{ color: '#f87171' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input id="forja-reg-pitch" type="text" className="forja-reg-input"
            placeholder="Zeus ou morte, não tem meio-termo!"
            value={pitch} maxLength={50} onChange={e => setPitch(e.target.value.slice(0, 50))}
            required disabled={submitting} />
          <span className="forja-reg-char-count" style={{ color: pitchLeft < 10 ? '#f87171' : '#475569' }}>
            {pitchLeft}
          </span>
        </div>
      </div>

      {/* Consentimentos */}
      <div className="forja-reg-consents">
        <p className="forja-reg-label" style={{ marginBottom: '0.75rem' }}>Consentimentos <span style={{ color: '#f87171' }}>*</span></p>

        {[
          { id: 'consent-br', checked: isBrazilian, setter: setIsBrazilian, label: 'Sou Brasileiro 🇧🇷 ou Português 🇵🇹 e resido nesses países.' },
          { id: 'consent-rules', checked: consentRules, setter: setConsentRules, label: (<>Li e aceito as <a href="/forja?tab=regras" target="_blank" rel="noreferrer" style={{ color: '#f59e0b' }}>Regras do Torneio</a> e estou ciente das consequências de violá-las.</>)},
          { id: 'consent-format', checked: consentFormat, setter: setConsentFormat, label: (<>Entendi o <a href="/forja?tab=formato" target="_blank" rel="noreferrer" style={{ color: '#f59e0b' }}>Formato do Torneio</a> (Snake Draft 1 Tier A + 1 Tier B + 1 Tier C) e comprometo-me a estar online às 15h de sábado 09/05/2026.</>)},
        ].map(({ id, checked, setter, label }) => (
          <label key={id} className="forja-reg-checkbox" style={{ marginBottom: '0.625rem' }}>
            <input id={id} type="checkbox" checked={checked}
              onChange={e => setter(e.target.checked)} required disabled={submitting} />
            <div className="forja-reg-checkbox__box">{checked && '✓'}</div>
            <span className="forja-reg-checkbox__label">{label}</span>
          </label>
        ))}
      </div>

      <div className="forja-reg-actions">
        <button type="button" className="forja-btn forja-btn--ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button id="forja-reg-submit-btn" type="submit"
          className="forja-btn forja-btn--primary"
          disabled={submitting || !isValid}
        >
          {submitting ? <><span className="forja-reg-spinner" /> Salvando...</> : '🔥 Confirmar Inscrição'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ForjaRegistrationModal({ isOpen, onClose, discordUser, onLoginRequest, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('login');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { registrationOpen, data: settings } = useForjaSettings();

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);

    if (!registrationOpen) { setStep('closed'); return; }
    if (!discordUser) { setStep('login'); return; }

    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) { setStep('form'); return; }

    isPlayerRegistered(discordUser.discord_id).then(reg => setStep(reg ? 'already' : 'form'));
  }, [isOpen, discordUser, registrationOpen]);

  const handleFormSubmit = async (form: ForjaRegistrationForm) => {
    if (!discordUser) return;
    setStep('submitting');
    try {
      await registerForjaPlayer(discordUser, form);
      setStep('done');
      onSuccess();
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Erro ao salvar. Tente novamente.');
      setStep('form');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="forja-modal-overlay" role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="forja-modal">
        <div className="forja-modal-header">
          <div className="forja-modal-header__title">
            <span className="forja-modal-header__icon">🔥</span>
            Inscrição — Forja de Hefesto
          </div>
          <button className="forja-modal-close" onClick={onClose} id="forja-modal-close-btn">✕</button>
        </div>
        <div className="forja-modal-body">
          {submitError && (
            <div className="forja-modal-error">
              ⚠️ {submitError}
              <button onClick={() => setSubmitError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
            </div>
          )}
          {step === 'login'      && <LoginGate onLogin={onLoginRequest} onClose={onClose} />}
          {step === 'closed'     && <RegistrationClosed onClose={onClose} />}
          {step === 'already'    && <AlreadyRegistered onClose={onClose} />}
          {step === 'done'       && <RegistrationDone onClose={onClose} />}
          {step === 'form'       && discordUser && (
            <RegistrationForm
              discordUser={discordUser}
              onSubmit={handleFormSubmit}
              onClose={onClose}
              submitting={false}
              deadlineMs={settings?.registration_deadline_ms ?? new Date('2026-05-09T16:59:00Z').getTime()}
            />
          )}
          {step === 'submitting' && (
            <div className="forja-modal-step">
              <div className="forja-reg-spinner forja-reg-spinner--lg" />
              <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Salvando inscrição...</p>
            </div>
          )}
          {step === 'check' && (
            <div className="forja-modal-step">
              <div className="forja-reg-spinner forja-reg-spinner--lg" />
              <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Verificando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
