/**
 * ForjaAddPlayerModal — Modal de Admin para adicionar jogador manualmente pelo Discord ID.
 * Opção A: Discord ID + Nick + URL AoMStats → fetch automático → preview → confirmar.
 * Inclui: pitch_quote e disponibilidade configuráveis pelo admin (caso o jogador tenha problema com Discord).
 */

import React, { useState } from 'react';
import { adminRegisterPlayer, parseAomProfileId } from '../services/forjaService';
import { AVAILABILITY_LABELS } from '../forjaUtils';

const FUNCTIONS_BASE_URL = 'https://us-central1-boxwood-plating-368522.cloudfunctions.net';

interface Props {
  discordUserId: string;
  discordUsername: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FetchedProfile {
  elo_1v1:   number;
  elo_tg:    number;
  elo_efetivo: number;
  avatar_url: string | null;
  top_gods:  any[];
}

/**
 * Modal UI for administrators to manually add a player using a Discord ID and an AoMStats profile.
 *
 * @param discordUserId - Discord user ID of the admin opening the modal
 * @param discordUsername - Admin's Discord username (used as `addedBy` and fallback for `pitchQuote`)
 * @param onClose - Callback invoked to close the modal
 * @param onSuccess - Optional callback invoked after a player is successfully added
 * @returns The React element for the add-player modal
 */
export default function ForjaAddPlayerModal({ discordUserId, discordUsername, onClose, onSuccess }: Props) {
  // Dados básicos
  const [discordId,   setDiscordId]   = useState('');
  const [nick,        setNick]        = useState('');
  const [aomUrl,      setAomUrl]      = useState('');
  const [isBrazilian, setIsBrazilian] = useState(true);

  // Campos extras (resposta 1: admin pode preencher pro jogador)
  const [pitchQuote,    setPitchQuote]    = useState('');
  const [availability,  setAvailability]  = useState<string[]>([]);

  // Fetch do perfil AoM
  const [fetchedProfile, setFetchedProfile] = useState<FetchedProfile | null>(null);
  const [fetching,       setFetching]       = useState(false);
  const [fetchError,     setFetchError]     = useState<string | null>(null);

  // Salvamento
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const profileId = parseAomProfileId(aomUrl);

  const toggleAvailability = (key: string) =>
    setAvailability(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const handleFetchProfile = async () => {
    if (!profileId) return setFetchError('URL ou ID do AoMStats inválido.');
    setFetching(true);
    setFetchError(null);
    setFetchedProfile(null);
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const fetchAomProfile = httpsCallable(functions, 'fetchaomprofile');

      const result = await fetchAomProfile({ id: profileId });
      const json = result.data as any;
      if (json.isError) throw new Error(json.message || 'Erro na API.');

      const elo_efetivo = Math.round((json.elo_1v1 + json.elo_tg) / 2) || 0;
      setFetchedProfile({
        elo_1v1:     json.elo_1v1  ?? 0,
        elo_tg:      json.elo_tg   ?? 0,
        elo_efetivo: elo_efetivo,
        avatar_url:  json.avatar_url ?? null,
        top_gods:    Array.isArray(json.top_gods) ? json.top_gods.slice(0, 5) : [],
      });
    } catch (e: any) {
      setFetchError(e?.message || 'Não foi possível buscar o perfil.');
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async () => {
    if (!discordId.trim() || !/^\d{17,20}$/.test(discordId.trim()))
      return setSaveError('Discord ID inválido — 17 a 20 dígitos numéricos.');
    if (!nick.trim())  return setSaveError('Nick é obrigatório.');
    if (!profileId)    return setSaveError('URL do AoMStats inválida.');

    setSaving(true);
    setSaveError(null);
    try {
      await adminRegisterPlayer({
        discordId:    discordId.trim(),
        nick:         nick.trim(),
        aomProfileId: profileId,
        elo1v1:       fetchedProfile?.elo_1v1  ?? 0,
        eloTg:        fetchedProfile?.elo_tg   ?? 0,
        topGods:      fetchedProfile?.top_gods ?? [],
        avatarUrl:    fetchedProfile?.avatar_url ?? undefined,
        pitchQuote:   pitchQuote.trim() || `Adicionado manualmente por ${discordUsername}`,
        availability,
        isBrazilian,
        addedBy:      discordUsername,
      });
      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setSaveError(e?.message || 'Erro ao adicionar jogador.');
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

  const canSubmit = discordId && nick && aomUrl && !saving;

  return (
    <div
      id="forja-add-player-modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        overflowY: 'auto',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(96,165,250,0.3)', borderRadius: '1.25rem', padding: '2rem',
        width: '100%', maxWidth: '500px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ color: '#60a5fa', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
            ➕ Adicionar Jogador Manual
          </h2>
          <button id="forja-add-player-close-btn" onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 0, marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Use quando você conhece o jogador e quer inscrevê-lo sem o fluxo normal do Discord OAuth.
          O snapshot oficial (sábado 14h) atualizará os dados de ELO depois.
        </p>

        {/* Dados básicos */}
        <p style={sectionTitle}>Dados do Jogador</p>

        <div style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="forja-add-discord-id" style={labelStyle}>
            Discord ID <span style={{ color: '#475569' }}>(17–20 dígitos)</span>
          </label>
          <input id="forja-add-discord-id" type="text" value={discordId}
            onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ''))}
            placeholder="ex: 123456789012345678" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="forja-add-nick" style={labelStyle}>Nick de jogo</label>
          <input id="forja-add-nick" type="text" value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="ex: KamaRTS" maxLength={32} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="forja-add-aomurl" style={labelStyle}>URL ou ID do AoMStats.io</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input id="forja-add-aomurl" type="text" value={aomUrl}
              onChange={(e) => { setAomUrl(e.target.value); setFetchedProfile(null); setFetchError(null); }}
              placeholder="https://aomstats.io/profiles/12345 ou 12345"
              style={{ ...inputStyle, flex: 1 }} />
            <button id="forja-add-fetch-btn" onClick={handleFetchProfile}
              disabled={fetching || !aomUrl.trim()}
              style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa', borderRadius: '0.5rem', padding: '0.6rem 0.875rem', cursor: fetching || !aomUrl.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
              {fetching ? '⏳' : '🔍 Buscar'}
            </button>
          </div>
        </div>

        {fetchError && (
          <div style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '0.5rem', padding: '0.6rem', fontSize: '0.78rem', marginBottom: '0.85rem' }}>
            ⚠️ {fetchError} — O jogador entrará com ELO 0 e o snapshot de sábado vai corrigir.
          </div>
        )}

        {fetchedProfile && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              {fetchedProfile.avatar_url && (
                <img src={fetchedProfile.avatar_url} alt="avatar" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.4rem', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              )}
              <div>
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.82rem' }}>✅ Perfil encontrado!</div>
                <div style={{ color: '#64748b', fontSize: '0.72rem' }}>ID: {profileId}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1v1: <strong style={{ color: '#f8fafc' }}>{fetchedProfile.elo_1v1}</strong></span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TG: <strong style={{ color: '#f8fafc' }}>{fetchedProfile.elo_tg}</strong></span>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Média: <strong>{fetchedProfile.elo_efetivo}</strong></span>
            </div>
          </div>
        )}

        {/* Configurações opcionais — Feature 3 Resposta 1 */}
        <p style={sectionTitle}>Informações Extras (opcional)</p>

        <div style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="forja-add-pitch" style={labelStyle}>
            Frase de Efeito <span style={{ color: '#475569' }}>(catchphrase do jogador)</span>
          </label>
          <input id="forja-add-pitch" type="text" value={pitchQuote}
            onChange={(e) => setPitchQuote(e.target.value)}
            placeholder="ex: Cada partida é uma forja da alma."
            maxLength={120} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={labelStyle}>
            Disponibilidade <span style={{ color: '#475569' }}>(pode editar depois)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(AVAILABILITY_LABELS).map(([key, { label, icon }]) => {
              const selected = availability.includes(key);
              return (
                <button key={key} type="button" onClick={() => toggleAvailability(key)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: selected ? 'rgba(96,165,250,0.2)' : 'rgba(30,41,59,0.8)',
                    border: selected ? '1px solid rgba(96,165,250,0.6)' : '1px solid #334155',
                    color: selected ? '#93c5fd' : '#64748b',
                    transition: 'all 0.15s',
                  }}>
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nacionalidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(30,41,59,0.5)', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
          <label htmlFor="forja-add-brazilian-toggle" style={{ ...labelStyle, flex: 1, cursor: 'pointer', marginBottom: 0 }}>
            Jogador Brasileiro 🇧🇷
            <span style={{ display: 'block', color: '#475569', fontWeight: 400 }}>Desative para jogadores de Portugal</span>
          </label>
          <button id="forja-add-brazilian-toggle" onClick={() => setIsBrazilian(v => !v)}
            style={{ width: '3rem', height: '1.5rem', borderRadius: '1rem', background: isBrazilian ? '#10b981' : '#475569', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: '0.175rem', left: isBrazilian ? '1.4rem' : '0.175rem', width: '1.15rem', height: '1.15rem', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
          </button>
        </div>

        {saveError && (
          <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.65rem 0.875rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ❌ {saveError}
          </div>
        )}
        {success && (
          <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.5rem', padding: '0.65rem 0.875rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ✅ Jogador adicionado com sucesso!
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button id="forja-add-player-cancel-btn" onClick={onClose}
            style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '0.6rem', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button id="forja-add-player-confirm-btn" onClick={handleAdd}
            disabled={!canSubmit}
            style={{ background: !canSubmit ? 'rgba(96,165,250,0.2)' : 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', color: !canSubmit ? '#475569' : '#fff', borderRadius: '0.6rem', padding: '0.6rem 1.5rem', cursor: !canSubmit ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>
            {saving ? '⏳ Adicionando…' : '➕ Adicionar Jogador'}
          </button>
        </div>
      </div>
    </div>
  );
}
