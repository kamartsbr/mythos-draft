/**
 * ForjaTournamentSettingsModal — Modal de Admin para configurar o torneio.
 * Permite alterar: deadline, snapshot ELO, início do draft,
 * limite de participantes e tamanhos individuais de cada Tier (Opção B).
 */

import React, { useState, useEffect } from 'react';
import { ForjaSettings, ForjaTierMode } from '../types';
import { saveForjaSettings } from '../services/forjaService';
import { getTierCutoffs } from '../forjaUtils';

interface Props {
  discordUserId: string;
  currentSettings: ForjaSettings | null;
  onClose: () => void;
}

function msToDatetimeLocal(ms: number | undefined | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToMs(val: string): number | null {
  if (!val) return null;
  return new Date(val).getTime();
}

export default function ForjaTournamentSettingsModal({ discordUserId, currentSettings, onClose }: Props) {
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [registrationOpen, setRegistrationOpen] = useState(currentSettings?.registration_open ?? true);
  const [deadlineLocal,    setDeadlineLocal]    = useState(msToDatetimeLocal(currentSettings?.registration_deadline_ms));
  const [snapshotLocal,    setSnapshotLocal]    = useState(msToDatetimeLocal(currentSettings?.elo_snapshot_ms));
  const [draftStartLocal,  setDraftStartLocal]  = useState(msToDatetimeLocal(currentSettings?.draft_start_ms));
  const [maxParticipants,  setMaxParticipants]  = useState(String(currentSettings?.max_participants ?? 48));
  const [tierASize,        setTierASize]        = useState(String(currentSettings?.tier_a_size ?? 16));
  const [tierBSize,        setTierBSize]        = useState(String(currentSettings?.tier_b_size ?? 16));
  const [tierMode,         setTierMode]         = useState<ForjaTierMode>(currentSettings?.tier_mode ?? 'ABC');
  const [reservesOpen,     setReservesOpen]     = useState(currentSettings?.reserves_open ?? false);
  const [currentPhase,     setCurrentPhase]     = useState<'pre_tournament' | 'group_stage' | 'playoffs' | 'finished'>(currentSettings?.current_phase ?? 'pre_tournament');
  const [playoffFormat,    setPlayoffFormat]    = useState<'single_elim' | 'double_elim'>(currentSettings?.playoff_format ?? 'single_elim');

  useEffect(() => {
    if (!currentSettings) return;
    setRegistrationOpen(currentSettings.registration_open ?? true);
    setDeadlineLocal(msToDatetimeLocal(currentSettings.registration_deadline_ms));
    setSnapshotLocal(msToDatetimeLocal(currentSettings.elo_snapshot_ms));
    setDraftStartLocal(msToDatetimeLocal(currentSettings.draft_start_ms));
    setMaxParticipants(String(currentSettings.max_participants ?? 48));
    const { tierASize: a, tierBSize: b } = getTierCutoffs(currentSettings);
    setTierASize(String(a));
    setTierBSize(String(b));
    setTierMode(currentSettings.tier_mode ?? 'ABC');
    setReservesOpen(currentSettings.reserves_open ?? false);
    setCurrentPhase(currentSettings.current_phase ?? 'pre_tournament');
    setPlayoffFormat(currentSettings.playoff_format ?? 'single_elim');
  }, [currentSettings]);

  // Preview em tempo real dos tamanhos de tier
  const maxP  = parseInt(maxParticipants, 10) || 48;
  const tierA = parseInt(tierASize, 10) || 0;
  const tierB = tierMode === 'AB' ? maxP - tierA : (parseInt(tierBSize, 10) || 0);
  const tierC = tierMode === 'AB' ? 0 : Math.max(0, maxP - tierA - tierB);
  const tierTotal = tierA + tierB + tierC;

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (isNaN(maxP) || maxP < 6 || maxP > 200)
      return setError('Limite de participantes: entre 6 e 200.');
    if (isNaN(tierA) || tierA < 2)
      return setError('Tier A precisa de pelo menos 2 jogadores.');
    if (tierMode === 'ABC') {
      if (isNaN(tierB) || tierB < 2)
        return setError('Tier B precisa de pelo menos 2 jogadores.');
      if (tierA + tierB >= maxP)
        return setError('Tier A + Tier B não pode ser maior ou igual ao total. Precisa sobrar pelo menos 1 para Tier C.');
    } else {
      // Modo AB: Tier A precisa deixar espaço para pelo menos 1 jogador no pool
      if (tierA >= maxP)
        return setError('Tier A não pode ser igual ou maior que o total de participantes.');
    }

    setSaving(true);
    try {
      await saveForjaSettings({
        registration_open:         registrationOpen,
        ...(datetimeLocalToMs(deadlineLocal)   !== null && { registration_deadline_ms: datetimeLocalToMs(deadlineLocal)! }),
        ...(datetimeLocalToMs(snapshotLocal)   !== null && { elo_snapshot_ms: datetimeLocalToMs(snapshotLocal)! }),
        ...(datetimeLocalToMs(draftStartLocal) !== null && { draft_start_ms: datetimeLocalToMs(draftStartLocal)! }),
        max_participants: maxP,
        tier_mode:        tierMode,
        tier_a_size:      tierA,
        ...(tierMode === 'ABC' && { tier_b_size: tierB }),
        reserves_open:    reservesOpen,
        current_phase:    currentPhase,
        playoff_format:   playoffFormat,
      }, discordUserId);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '0.5rem', color: '#f8fafc', padding: '0.6rem 0.875rem',
    fontSize: '0.9rem', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600,
    display: 'block', marginBottom: '0.35rem', letterSpacing: '0.04em',
  };
  const sectionTitle: React.CSSProperties = {
    color: '#475569', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: '0.75rem', marginTop: '1.25rem',
  };

  return (
    <div
      id="forja-settings-modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        overflowY: 'auto',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(245,158,11,0.3)', borderRadius: '1.25rem', padding: '2rem',
        width: '100%', maxWidth: '540px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#f59e0b', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
            ⚙️ Configurações do Torneio
          </h2>
          <button id="forja-settings-close-btn" onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Toggle inscrições */}
        <p style={sectionTitle}>Controle de Inscrições</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(30,41,59,0.7)', borderRadius: '0.75rem', border: '1px solid #1e293b', marginBottom: '0.5rem' }}>
          <label htmlFor="forja-reg-open-toggle" style={{ color: '#f8fafc', fontWeight: 600, flex: 1, cursor: 'pointer', margin: 0 }}>
            Inscrições Abertas
            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
              Desativado → botão de inscrição some para todos
            </span>
          </label>
          <button id="forja-reg-open-toggle" onClick={() => setRegistrationOpen(v => !v)}
            style={{ width: '3rem', height: '1.5rem', borderRadius: '1rem', background: registrationOpen ? '#10b981' : '#475569', border: 'none', cursor: 'pointer', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: '0.175rem', left: registrationOpen ? '1.4rem' : '0.175rem', width: '1.15rem', height: '1.15rem', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(30,41,59,0.7)', borderRadius: '0.75rem', border: '1px solid #1e293b', marginBottom: '1rem' }}>
          <label htmlFor="forja-reserves-open-toggle" style={{ color: '#f8fafc', fontWeight: 600, flex: 1, cursor: 'pointer', margin: 0 }}>
            Inscrições para Reservas
            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
              Ativado → permite inscrição como reserva mesmo após fechamento principal
            </span>
          </label>
          <button id="forja-reserves-open-toggle" onClick={() => setReservesOpen(v => !v)}
            style={{ width: '3rem', height: '1.5rem', borderRadius: '1rem', background: reservesOpen ? '#10b981' : '#475569', border: 'none', cursor: 'pointer', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: '0.175rem', left: reservesOpen ? '1.4rem' : '0.175rem', width: '1.15rem', height: '1.15rem', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
          </button>
        </div>

        {/* Datas */}
        <p style={sectionTitle}>Cronograma</p>
        {[
          { id: 'forja-deadline-input',    label: 'Fim das Inscrições', hint: 'Sáb 13:59 BRT', val: deadlineLocal,   set: setDeadlineLocal },
          { id: 'forja-snapshot-input',    label: 'Snapshot de ELO',    hint: 'Sáb 14:00 BRT', val: snapshotLocal,   set: setSnapshotLocal },
          { id: 'forja-draft-start-input', label: 'Início do Draft',    hint: 'Sáb 15:00 BRT', val: draftStartLocal, set: setDraftStartLocal },
        ].map(({ id, label, hint, val, set }) => (
          <div key={id} style={{ marginBottom: '0.85rem' }}>
            <label htmlFor={id} style={labelStyle}>
              {label} <span style={{ color: '#475569', fontWeight: 400 }}>({hint})</span>
            </label>
            <input id={id} type="datetime-local" value={val} onChange={(e) => set(e.target.value)} style={inputStyle} />
          </div>
        ))}

        {/* Modo de Tiers */}
        <p style={sectionTitle}>Modo de Tiers</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
          {([
            { value: 'ABC' as ForjaTierMode, icon: '🏛️', label: 'A + B + C', desc: 'Três tiers distintos (padrão)' },
            { value: 'AB'  as ForjaTierMode, icon: '🎯', label: 'A + Pool Livre', desc: 'Capitães + pool de jogadores (sem Tier C)' },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              id={`forja-tier-mode-${opt.value.toLowerCase()}`}
              onClick={() => setTierMode(opt.value)}
              style={{
                background: tierMode === opt.value ? 'rgba(245,158,11,0.12)' : 'rgba(30,41,59,0.5)',
                border: `2px solid ${tierMode === opt.value ? 'rgba(245,158,11,0.6)' : '#1e293b'}`,
                borderRadius: '0.75rem', padding: '0.75rem',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{opt.icon}</div>
              <div style={{ color: tierMode === opt.value ? '#f59e0b' : '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>{opt.label}</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '0.2rem', lineHeight: 1.4 }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Limites e Tiers */}
        <p style={sectionTitle}>Participantes e Tiers</p>
        <div style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="forja-max-participants-input" style={labelStyle}>
            Total de Participantes
            <span style={{ color: '#475569', fontWeight: 400 }}> (inscritos acima do limite → reserva automática)</span>
          </label>
          <input id="forja-max-participants-input" type="number" value={maxParticipants} min={6} max={200}
            onChange={(e) => setMaxParticipants(e.target.value)} style={{ ...inputStyle, maxWidth: '120px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: tierMode === 'AB' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {[
            { id: 'forja-tier-a-input', label: 'Tier A (Capitães)', hint: 'ex: 16', val: tierASize, set: setTierASize, color: '#facc15' },
            ...(tierMode === 'ABC' ? [{ id: 'forja-tier-b-input', label: 'Tier B', hint: 'ex: 16', val: tierBSize, set: setTierBSize, color: '#60a5fa' }] : []),
            { id: 'forja-tier-c-preview', label: tierMode === 'AB' ? 'Tier B (Pool Livre, auto)' : 'Tier C (auto)', hint: 'calculado', val: null as null, set: null as null, color: tierMode === 'AB' ? '#60a5fa' : '#94a3b8' },
          ].map(({ id, label, hint, val, set, color }) => (
            <div key={id}>
              <label htmlFor={id} style={{ ...labelStyle, color }}>
                {label}
                <span style={{ display: 'block', color: '#475569', fontWeight: 400 }}>{hint}</span>
              </label>
              {set ? (
                <input id={id} type="number" value={val ?? ''} min={2} max={200}
                  onChange={(e) => set(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 700, color }} />
              ) : (
                <div id={id} style={{ ...inputStyle, display: 'flex', alignItems: 'center', color, fontWeight: 700, opacity: 0.7 }}>
                  {tierMode === 'AB' ? tierB : tierC} jogadores
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Preview visual de tiers */}
        <div style={{ background: 'rgba(15,23,42,0.8)', borderRadius: '0.5rem', padding: '0.65rem 0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem' }}>
          <span style={{ color: '#64748b' }}>Total calculado:</span>
          <span style={{ color: '#facc15' }}>A:{tierA}</span>
          <span style={{ color: '#475569' }}>+</span>
          <span style={{ color: '#60a5fa' }}>B:{tierB}</span>
          {tierMode === 'ABC' && <>
            <span style={{ color: '#475569' }}>+</span>
            <span style={{ color: '#94a3b8' }}>C:{tierC}</span>
          </>}
          <span style={{ color: '#475569' }}>=</span>
          <span style={{ color: tierTotal === maxP ? '#10b981' : '#ef4444', fontWeight: 700 }}>
            {tierTotal}/{maxP} {tierTotal !== maxP && '⚠️'}
          </span>
          {tierMode === 'AB' && (
            <span style={{ marginLeft: 'auto', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 600 }}>🎯 Pool Livre</span>
          )}
        </div>

        {/* Fase do Torneio + Formato dos Playoffs */}
        <p style={sectionTitle}>Estado do Torneio</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label htmlFor="forja-current-phase-select" style={labelStyle}>Fase Atual</label>
            <select
              id="forja-current-phase-select"
              value={currentPhase}
              onChange={e => setCurrentPhase(e.target.value as 'pre_tournament' | 'group_stage' | 'playoffs' | 'finished')}
              style={{ ...inputStyle }}
            >
              <option value="pre_tournament">⏳ Pré-Torneio</option>
              <option value="group_stage">🏟️ Fase de Grupos</option>
              <option value="playoffs">🏆 Playoffs</option>
              <option value="finished">✅ Encerrado</option>
            </select>
          </div>
          <div>
            <label htmlFor="forja-playoff-format-select" style={labelStyle}>Formato dos Playoffs</label>
            <select
              id="forja-playoff-format-select"
              value={playoffFormat}
              onChange={e => setPlayoffFormat(e.target.value as 'single_elim' | 'double_elim')}
              style={{ ...inputStyle }}
            >
              <option value="single_elim">Eliminação Simples</option>
              <option value="double_elim" disabled>Eliminação Dupla (Em breve)</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.65rem 0.875rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.5rem', padding: '0.65rem 0.875rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ✅ Configurações salvas!
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button id="forja-settings-cancel-btn" onClick={onClose}
            style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '0.6rem', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button id="forja-settings-save-btn" onClick={handleSave} disabled={saving}
            style={{ background: saving ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#0f172a', borderRadius: '0.6rem', padding: '0.6rem 1.5rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>
            {saving ? '💾 Salvando…' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
