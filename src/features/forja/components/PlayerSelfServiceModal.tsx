/**
 * ============================================================
 *  PlayerSelfServiceModal — Fase 2
 *  Modal de autoatendimento para o jogador editar seu próprio perfil.
 *  Campos permitidos (restrito via Firestore Rules):
 *   • profile_link  (link AoMStats ou outro)
 *   • availability  (checkboxes de horário)
 *   • catchphrase   (frase de efeito, máx 80 chars)
 *
 *  NÃO permite editar: ELO, avatar, deuses, time.
 * ============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { RankedPlayer, AVAILABILITY_LABELS } from '../forjaUtils';
import { updatePlayerSelfService } from '../services/forjaService';

// ─── Availability options (mesma ordem da UI principal) ───────────────────────

const AVAILABILITY_OPTIONS = [
  { id: 'weekday-eve', ...AVAILABILITY_LABELS['weekday-eve'] },
  { id: 'weekend-aft', ...AVAILABILITY_LABELS['weekend-aft'] },
  { id: 'weekend-eve', ...AVAILABILITY_LABELS['weekend-eve'] },
  { id: 'late-night',  ...AVAILABILITY_LABELS['late-night'] },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlayerSelfServiceModalProps {
  player: RankedPlayer | null;
  onClose: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerSelfServiceModal({ player, onClose }: PlayerSelfServiceModalProps) {
  const [profileLink,   setProfileLink]   = useState('');
  const [availability,  setAvailability]  = useState<string[]>([]);
  const [catchphrase,   setCatchphrase]   = useState('');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player) return;
    setProfileLink(player.profile_link ?? '');
    setAvailability(player.availability ?? []);
    setCatchphrase(player.catchphrase ?? player.pitch_quote ?? '');
    setError(null);
    setSuccess(false);
  }, [player?.discord_id]);

  if (!player) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleAvailability = (id: string) => {
    setAvailability(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!profileLink.trim() && availability.length === 0 && !catchphrase.trim()) {
      setError('Preencha pelo menos um campo antes de salvar.');
      return;
    }
    setSaving(true); setError(null); setSuccess(false);
    try {
      await updatePlayerSelfService(player.discord_id, {
        profile_link:  profileLink.trim() || undefined,
        availability,
        catchphrase:   catchphrase.trim().slice(0, 80) || undefined,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao salvar. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const charCount = catchphrase.length;
  const charOver  = charCount > 80;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: '1.25rem', width: '100%', maxWidth: '520px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(96,165,250,0.06)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', flexShrink: 0,
        }}>
          <img src={player.avatar_url} alt={player.nick}
            style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.6rem', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
            onError={e => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
              ✏️ Editar Perfil
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              {player.nick} · Apenas seus dados pessoais
            </p>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#475569', cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Nota informativa */}
          <div style={{
            background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
            borderRadius: '0.6rem', padding: '0.75rem 1rem',
            fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5,
          }}>
            ℹ️ Seu <strong style={{ color: '#e2e8f0' }}>ELO, avatar e deuses</strong> são atualizados
            automaticamente pelo sistema. Aqui você pode personalizar apenas os campos abaixo.
          </div>

          {/* Link do Perfil */}
          <div>
            <label style={{
              fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: '0.5rem',
            }}>
              🔗 Link do Perfil
            </label>
            <input
              type="url"
              placeholder="https://aomstats.io/profile/..."
              value={profileLink}
              onChange={e => setProfileLink(e.target.value)}
              id="self-service-profile-link"
              style={{
                width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid #334155',
                color: '#f8fafc', fontSize: '0.82rem', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#60a5fa')}
              onBlur={e  => (e.target.style.borderColor = '#334155')}
            />
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.68rem', color: '#475569' }}>
              Ex: seu perfil no AoMStats.io, aom.gg ou similar
            </p>
          </div>

          {/* Disponibilidade */}
          <div>
            <label style={{
              fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: '0.5rem',
            }}>
              🕐 Disponibilidade
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AVAILABILITY_OPTIONS.map(opt => {
                const selected = availability.includes(opt.id);
                return (
                  <button
                    key={opt.id} type="button"
                    onClick={() => toggleAvailability(opt.id)}
                    id={`self-avail-${opt.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.5rem 0.85rem', borderRadius: '2rem',
                      border: selected ? '1px solid #60a5fa' : '1px solid #334155',
                      background: selected ? 'rgba(96,165,250,0.12)' : 'transparent',
                      color: selected ? '#60a5fa' : '#64748b',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: selected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frase de Efeito */}
          <div>
            <label style={{
              fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: '0.5rem',
            }}>
              💬 Frase de Efeito
            </label>
            <textarea
              placeholder="Sua frase épica para o torneio..."
              value={catchphrase}
              onChange={e => setCatchphrase(e.target.value.slice(0, 80))}
              rows={2}
              id="self-service-catchphrase"
              style={{
                width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${charOver ? '#ef4444' : '#334155'}`,
                color: '#f8fafc', fontSize: '0.82rem', outline: 'none',
                resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                transition: 'border-color 0.15s', fontFamily: 'inherit',
              }}
              onFocus={e => { if (!charOver) e.target.style.borderColor = '#60a5fa'; }}
              onBlur={e  => { e.target.style.borderColor = charOver ? '#ef4444' : '#334155'; }}
            />
            <p style={{
              margin: '0.3rem 0 0', fontSize: '0.68rem', textAlign: 'right',
              color: charOver ? '#ef4444' : charCount > 64 ? '#f59e0b' : '#475569',
            }}>
              {charCount}/80 caracteres
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #1e293b',
          display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0,
        }}>
          {error   && <span style={{ fontSize: '0.75rem', color: '#f87171', flex: 1 }}>⚠️ {error}</span>}
          {success && <span style={{ fontSize: '0.75rem', color: '#4ade80', flex: 1 }}>✓ Perfil atualizado!</span>}
          {!error && !success && <span style={{ flex: 1 }} />}

          <button type="button" onClick={onClose} disabled={saving}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '0.6rem',
              background: 'transparent', border: '1px solid #334155',
              color: '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
            Cancelar
          </button>

          <button
            type="button" onClick={handleSave}
            disabled={saving || charOver}
            id="self-service-save-btn"
            style={{
              padding: '0.6rem 1.5rem', borderRadius: '0.6rem',
              background: saving || charOver ? '#334155' : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
              border: 'none', color: saving || charOver ? '#64748b' : '#0f172a',
              cursor: saving || charOver ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.82rem',
              boxShadow: saving || charOver ? 'none' : '0 0 16px rgba(96,165,250,0.3)',
              transition: 'all 0.15s',
            }}>
            {saving ? '⏳ Salvando...' : '✓ Salvar Perfil'}
          </button>
        </div>
      </div>
    </div>
  );
}
