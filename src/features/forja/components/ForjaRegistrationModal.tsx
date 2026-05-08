/**
 * ForjaRegistrationModal — Formulário Completo
 * Fluxo: Discord Login → Nick → AoMStats (verify + avatar) →
 * Disponibilidade → Regras Accordion → Pitch → Submit
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ForjaDiscordUser, ForjaRegistrationForm, AomProfileData } from '../types';
import { parseAomProfileId, registerForjaPlayer, isPlayerRegistered } from '../services/forjaService';
import { useForjaSettings, useForjaContent } from '../hooks/useForjaContent';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVAILABILITY_OPTIONS = [
  { id: 'weekday-eve',   label: '🌙 Dias de semana — Noite (19h–23h)' },
  { id: 'weekend-aft',   label: '☀️ Finais de semana — Tarde (14h–18h)' },
  { id: 'weekend-eve',   label: '🌃 Finais de semana — Noite (19h–23h)' },
  { id: 'late-night',    label: '🌌 Madrugada (23h+)' },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  discordUser: ForjaDiscordUser | null;
  onLoginRequest: () => void;
  onSuccess: () => void;
}

type Step = 'login' | 'check' | 'form' | 'submitting' | 'done' | 'already' | 'closed';

// ─── Countdown Hook ───────────────────────────────────────────────────────────
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

// ─── Profile Verification Hook (CONECTADO À CLOUD FUNCTION) ───────────────────
function useAomProfileVerify() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [data, setData]         = useState<any | null>(null);

  const verify = useCallback(async (profileId: number) => {
    setLoading(true); setError(null); setData(null);
    try {
      // Chama a Cloud Function que criamos
      const res = await fetch(`https://us-central1-mythos-draft.cloudfunctions.net/fetchAomProfile?id=${profileId}`);
      const json = await res.json();
      
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Perfil não encontrado');
      
      // Mapeia o retorno da API para o formato que o Form espera
      setData({
        profile_id: profileId,
        avatar_url: json.data.avatar_url,
        elo_1v1: json.data.elo_1v1,
        elo_tg: json.data.elo_tg,
        elo_efetivo: json.data.elo_efetivo,
        top_gods: json.data.top_gods
      });
    } catch (e: any) {
      setError(e.message ?? 'Falha ao verificar perfil');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setData(null); setError(null); }, []);
  return { loading, error, data, verify, reset };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function RegistrationClosed({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3rem' }}>🔒</div>
      <h3 className="forja-modal-step__title">Inscrições Encerradas</h3>
      <p className="forja-modal-step__desc">O prazo foi encerrado às 13h59 do sábado. Acompanhe o torneio ao vivo!</p>
      <button className="forja-btn forja-btn--primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>
    </div>
  );
}

function AlreadyRegistered({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h3 className="forja-modal-step__title">Você já está inscrito!</h3>
      <p className="forja-modal-step__desc">Fique de olho no Discord para atualizações sobre o torneio.</p>
      <button className="forja-btn forja-btn--primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>
    </div>
  );
}

function RegistrationDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="forja-modal-step">
      <div style={{ fontSize: '3.5rem' }}>🔥</div>
      <h3 className="forja-modal-step__title">Inscrição Confirmada!</h3>
      <p className="forja-modal-step__desc">
        Você está na Forja de Hefesto. Seu ELO será registrado no sábado às 14h.<br />
        Esteja online às <strong>15h do sábado 09/05</strong> para o Draft!
      </p>
      <button id="forja-reg-done-btn" className="forja-btn forja-btn--primary forja-btn--lg" onClick={onClose} style={{ width: '100%' }}>
        🏛️ Ver meu card
      </button>
    </div>
  );
}

// ─── Rules Accordion ──────────────────────────────────────────────────────────
function RulesAccordion() {
  const [open, setOpen] = useState(false);
  const { data } = useForjaContent('rules');

  const PLACEHOLDER_RULES = [
    { title: '1. Elegibilidade', content: 'Participantes devem ser brasileiros ou portugueses e ter conta ativa no Age of Mythology: Retold.' },
    { title: '2. Fair Play', content: 'Comportamento antidesportivo, hacking ou qualquer forma de trapaça resultará em eliminação imediata.' },
    { title: '3. Presença Obrigatória', content: 'Capitães devem estar online às 15h do sábado 09/05/2026 para participar do Snake Draft.' },
    { title: '4. Composição dos Times', content: 'Cada time terá exatamente 1 jogador de Tier A (capitão) + 1 de Tier B + 1 de Tier C.' },
  ];

  const sections = (data?.sections?.length ? data.sections : PLACEHOLDER_RULES);

  return (
    <div className="forja-rules-accordion">
      <button
        type="button"
        className={`forja-rules-accordion__toggle ${open ? 'forja-rules-accordion__toggle--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        id="forja-reg-rules-toggle"
      >
        <span>📜 Ler Regras do Torneio</span>
        <span className="forja-rules-accordion__arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="forja-rules-accordion__body">
          {sections.map((s, i) => (
            <div key={i} className="forja-rules-accordion__section">
              <strong className="forja-rules-accordion__section-title">{s.title}</strong>
              <p className="forja-rules-accordion__section-content">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile Preview Card (ATUALIZADO PARA MOSTRAR ELOS) ───────────────────────
function ProfilePreview({ data, discordAvatar }: { data: any; discordAvatar: string }) {
  const [imgErr, setImgErr] = useState(false);
  const src = (!imgErr && data.avatar_url) ? data.avatar_url : discordAvatar;

  return (
    <div className="forja-reg-profile-preview">
      <img
        src={src}
        alt="Avatar"
        className="forja-reg-profile-preview__avatar"
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
      />
      <div className="forja-reg-profile-preview__info">
        <span className="forja-reg-profile-preview__alias" style={{ color: '#4ade80' }}>
          ✓ Perfil Localizado
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
          <span className="forja-reg-profile-preview__id" style={{ fontSize: '0.7rem' }}>
            1v1: <strong>{data.elo_1v1 || '—'}</strong>
          </span>
          <span className="forja-reg-profile-preview__id" style={{ fontSize: '0.7rem' }}>
            TG: <strong>{data.elo_tg || '—'}</strong>
          </span>
        </div>
        {data.avatar_url
          ? <span className="forja-reg-profile-preview__badge">📷 Avatar Steam pronto</span>
          : <span className="forja-reg-profile-preview__badge forja-reg-profile-preview__badge--warn">ℹ️ Usando avatar do Discord</span>
        }
      </div>
      <span className="forja-reg-verified" style={{ color: '#4ade80' }}>Verificado</span>
    </div>
  );
}

// ─── Main Registration Form ───────────────────────────────────────────────────
interface FormStepProps {
  discordUser: ForjaDiscordUser;
  onSubmit: (form: ForjaRegistrationForm) => void;
  onClose: () => void;
  submitting: boolean;
  deadlineMs: number;
}

function RegistrationForm({ discordUser, onSubmit, onClose, submitting, deadlineMs }: FormStepProps) {
  // Field state
  const [nick, setNick]                   = useState('');
  const [aomUrl, setAomUrl]               = useState('');
  const [urlError, setUrlError]           = useState('');
  const [availability, setAvailability]   = useState<string[]>([]);
  const [consentRules, setConsentRules]   = useState(false);
  const [consentFormat, setConsentFormat] = useState(false);
  const [isBrazilian, setIsBrazilian]     = useState(false);
  const [pitch, setPitch]                 = useState('');

  // Profile verification
  const { loading: verifying, error: verifyError, data: profileData, verify, reset: resetVerify } = useAomProfileVerify();
  const verifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countdown = useCountdown(deadlineMs);
  const pitchLeft = 50 - pitch.length;

  // Validate & auto-verify on blur
  const validateUrl = useCallback((val: string): number | null => {
    if (!val.trim()) { setUrlError('URL obrigatória'); return null; }
    // Normaliza a URL para garantir que o parse funcione
    const normalized = val.replace('aomstats.io/profile/', 'aomstats.io/profiles/');
    const id = parseAomProfileId(normalized);
    if (!id) {
      setUrlError('URL inválida. Use: https://aomstats.io/profile/SEU_ID');
      return null;
    }
    setUrlError('');
    return id;
  }, []);

  const handleAomUrlChange = (val: string) => {
    setAomUrl(val);
    resetVerify();
    if (verifyTimeout.current) clearTimeout(verifyTimeout.current);
    if (urlError) setUrlError('');
  };

  const handleAomUrlBlur = (val: string) => {
    const id = validateUrl(val);
    if (id) {
      verifyTimeout.current = setTimeout(() => verify(id), 300);
    }
  };

  const handleVerifyClick = () => {
    const id = validateUrl(aomUrl);
    if (id) verify(id);
  };

  const toggleAvailability = (id: string) => {
    setAvailability(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const isValid = (
    nick.trim() &&
    aomUrl.trim() && !urlError &&
    availability.length > 0 &&
    consentRules && consentFormat && isBrazilian &&
    pitch.trim()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = validateUrl(aomUrl);
    if (!id || !isValid) return;
    onSubmit({
      nick: nick.trim(),
      aomstats_url: aomUrl,
      aom_profile_data: profileData, // Aqui passamos os Elos e Avatar puxados pela API
      availability,
      pitch_quote: pitch,
      is_brazilian: isBrazilian,
      consent_rules: consentRules,
      consent_format: consentFormat,
    });
  };

  return (
    <form className="forja-reg-form" onSubmit={handleSubmit} noValidate>

      {/* Deadline warning */}
      {!countdown.expired && countdown.remaining < 3 * 3600 * 1000 && (
        <div className="forja-reg-deadline-warn">
          ⏰ Inscrições encerram em {countdown.h}h {countdown.m}m {countdown.s}s
        </div>
      )}

      {/* Discord banner */}
      <div className="forja-reg-user-banner">
        <img src={discordUser.avatar_url} alt={discordUser.username}
          className="forja-reg-avatar" referrerPolicy="no-referrer" />
        <div>
          <span className="forja-reg-username">{discordUser.username}</span>
          <span className="forja-reg-userid">Discord ID: {discordUser.discord_id}</span>
        </div>
        <span className="forja-reg-verified">✓ Discord</span>
      </div>

      {/* Step indicator */}
      <div className="forja-reg-steps">
        {[
          { label: 'Nick', done: nick.trim().length > 0 },
          { label: 'aomstats', done: profileData !== null && !urlError },
          { label: 'Horário', done: availability.length > 0 },
          { label: 'Regras', done: consentRules && consentFormat },
          { label: 'Pitch', done: pitch.trim().length > 0 },
        ].map((s, i) => (
          <div key={i} className={`forja-reg-step-dot ${s.done ? 'forja-reg-step-dot--done' : ''}`} title={s.label}>
            <div className="forja-reg-step-dot__circle" style={{
              background: s.done ? 'rgba(74, 222, 128, 0.2)' : undefined,
              borderColor: s.done ? '#4ade80' : undefined,
              color: s.done ? '#4ade80' : undefined,
            }}>
              {s.done ? '✓' : i + 1}
            </div>
            <span style={{ color: s.done ? '#4ade80' : 'inherit', fontWeight: s.done ? 600 : 'normal' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── 1. Nick ─────────────────────────────────────────────────── */}
      <div className="forja-reg-field">
        <label htmlFor="forja-reg-nick" className="forja-reg-label">
          1. Nick de Jogo <span style={{ color: '#f87171' }}>*</span>
        </label>
        <input
          id="forja-reg-nick" type="text"
          className="forja-reg-input"
          placeholder="Seu nick no Age of Mythology"
          value={nick}
          onChange={e => setNick(e.target.value.slice(0, 30))}
          required disabled={submitting}
          maxLength={30}
        />
        <span className="forja-reg-hint">Pode ser diferente do seu nome no Discord.</span>
      </div>

      {/* ── 2. AoMStats Profile (COM BUSCA AUTOMÁTICA) ───────────────── */}
      <div className="forja-reg-field">
        <label htmlFor="forja-reg-aomstats" className="forja-reg-label">
          2. Perfil no AoMStats.io <span style={{ color: '#f87171' }}>*</span>
        </label>
        <div className="forja-reg-input-group">
          <input
            id="forja-reg-aomstats" type="text"
            className={`forja-reg-input ${urlError ? 'forja-reg-input--error' : profileData ? 'forja-reg-input--ok' : ''}`}
            placeholder="https://aomstats.io/profile/12345"
            value={aomUrl}
            onChange={e => handleAomUrlChange(e.target.value)}
            onBlur={e => handleAomUrlBlur(e.target.value)}
            required disabled={submitting}
          />
          <button
            type="button"
            className="forja-btn forja-btn--secondary forja-reg-verify-btn"
            onClick={handleVerifyClick}
            disabled={verifying || !aomUrl.trim() || !!profileData}
            id="forja-reg-verify-btn"
          >
            {verifying ? <span className="forja-reg-spinner" /> : profileData ? '✓' : '🔍 Verificar'}
          </button>
        </div>
        {urlError && <span className="forja-reg-field-error">{urlError}</span>}
        {verifyError && <span className="forja-reg-field-error">⚠️ {verifyError}</span>}
        {verifying && <span className="forja-reg-hint" style={{ color: '#f59e0b' }}>⏳ Buscando ELOs e Avatar...</span>}

        {/* Profile preview after verification */}
        {profileData && (
          <ProfilePreview data={profileData} discordAvatar={discordUser.avatar_url} />
        )}

        <span className="forja-reg-hint">
          📌 Como encontrar:{' '}
          <a href="https://aomstats.io/leaderboard/1" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
            aomstats.io/leaderboard
          </a>{' '}→ busque seu nick → clique no perfil → copie a URL.
        </span>
      </div>

      {/* ── 3. Disponibilidade ──────────────────────────────────────── */}
      <div className="forja-reg-field">
        <label className="forja-reg-label">
          3. Disponibilidade de Horário <span style={{ color: '#f87171' }}>*</span>
        </label>
        <div className="forja-reg-availability">
          {AVAILABILITY_OPTIONS.map(opt => {
            const checked = availability.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`forja-reg-avail-option ${checked ? 'forja-reg-avail-option--selected' : ''}`}
                htmlFor={`avail-${opt.id}`}
              >
                <input
                  id={`avail-${opt.id}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAvailability(opt.id)}
                  style={{ display: 'none' }}
                  disabled={submitting}
                />
                {opt.label}
                {checked && <span style={{ marginLeft: 'auto', color: '#4ade80' }}>✓</span>}
              </label>
            );
          })}
        </div>
        {availability.length === 0 && (
          <span className="forja-reg-hint" style={{ color: '#f87171' }}>Selecione ao menos um horário.</span>
        )}
      </div>

      {/* ── 4. Regras ───────────────────────────────────────────────── */}
      <div className="forja-reg-field">
        <label className="forja-reg-label">4. Regras do Torneio <span style={{ color: '#f87171' }}>*</span></label>
        <RulesAccordion />
        <label className="forja-reg-checkbox" style={{ marginTop: '0.75rem' }}>
          <input
            id="consent-rules"
            type="checkbox"
            checked={consentRules}
            onChange={e => setConsentRules(e.target.checked)}
            required disabled={submitting}
          />
          <div className="forja-reg-checkbox__box">{consentRules && '✓'}</div>
          <span className="forja-reg-checkbox__label">
            Li e concordo com as regras do campeonato.
          </span>
        </label>
      </div>

      {/* ── 5. Pitch ────────────────────────────────────────────────── */}
      <div className="forja-reg-field">
        <label htmlFor="forja-reg-pitch" className="forja-reg-label">
          5. Frase de Efeito <span style={{ color: '#f87171' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="forja-reg-pitch" type="text"
            className="forja-reg-input"
            placeholder="Zeus ou morte, não tem meio-termo!"
            value={pitch} maxLength={50}
            onChange={e => setPitch(e.target.value.slice(0, 50))}
            required disabled={submitting}
          />
          <span className="forja-reg-char-count" style={{ color: pitchLeft < 10 ? '#f87171' : '#475569' }}>
            {pitchLeft}
          </span>
        </div>
        <span className="forja-reg-hint">Aparecerá no seu card de jogador.</span>
      </div>

      {/* ── Consentimentos finais ────────────────────────────────────── */}
      <div className="forja-reg-consents">
        {[
          {
            id: 'consent-br',
            checked: isBrazilian,
            setter: setIsBrazilian,
            label: 'Sou Brasileiro 🇧🇷 ou Português 🇵🇹 e resido nesses países.',
          },
          {
            id: 'consent-format',
            checked: consentFormat,
            setter: setConsentFormat,
            label: 'Aceito o formato do campeonato e farei o melhor possível para meu time e eu nos entrosarmos.',
          },
        ].map(({ id, checked, setter, label }) => (
          <label key={id} className="forja-reg-checkbox" style={{ marginBottom: '0.625rem' }}>
            <input id={id} type="checkbox" checked={checked}
              onChange={e => setter(e.target.checked)} required disabled={submitting} />
            <div className="forja-reg-checkbox__box">{checked && '✓'}</div>
            <span className="forja-reg-checkbox__label">{label}</span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="forja-reg-actions">
        <button type="button" className="forja-btn forja-btn--ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </button>
        <button
          id="forja-reg-submit-btn"
          type="submit"
          className="forja-btn forja-btn--primary"
          disabled={submitting || !isValid}
        >
          {submitting
            ? <><span className="forja-reg-spinner" /> Salvando...</>
            : '🔥 Confirmar Inscrição'
          }
        </button>
      </div>
    </form>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ForjaRegistrationModal({ isOpen, onClose, discordUser, onLoginRequest, onSuccess }: Props) {
  const [step, setStep]               = useState<Step>('login');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { registrationOpen, data: settings } = useForjaSettings();

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    if (!registrationOpen) { setStep('closed'); return; }
    if (!discordUser)      { setStep('login');  return; }

    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) { setStep('form'); return; }

    isPlayerRegistered(discordUser.discord_id)
      .then(reg => setStep(reg ? 'already' : 'form'))
      .catch(err => {
        console.error('[Forja] Error checking registration:', err);
        setSubmitError('Erro de conexão. Tente novamente.');
      });
  }, [isOpen, discordUser, registrationOpen]);

  const handleFormSubmit = async (form: ForjaRegistrationForm) => {
    if (!discordUser) return;
    setStep('submitting');
    try {
      // 1. Tenta buscar os dados da API para injetar no cadastro
      let finalData = form.aom_profile_data;
      const profileId = parseAomProfileId(form.aomstats_url);
      
      if (profileId) {
        try {
          // Fallback obrigatório: timeout ou erro na Vercel/Cloud Function ignora silenciosamente
          const res = await fetch(`https://us-central1-mythos-draft.cloudfunctions.net/fetchAomProfile?id=${profileId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              finalData = {
                profile_id: profileId,
                avatar_url: json.data.avatar_url,
                elo_1v1: json.data.elo_1v1,
                elo_tg: json.data.elo_tg,
                elo_efetivo: json.data.elo_efetivo,
                top_gods: json.data.top_gods
              };
            }
          }
        } catch (fetchError) {
          console.warn('[Forja] Erro silencioso ao buscar dados adicionais no cadastro:', fetchError);
        }
      }

      const finalForm = { ...form, aom_profile_data: finalData };

      // 2. Registra no banco
      await registerForjaPlayer(discordUser, finalForm);
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
      <div className="forja-modal forja-modal--wide">
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
              <button onClick={() => setSubmitError(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
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