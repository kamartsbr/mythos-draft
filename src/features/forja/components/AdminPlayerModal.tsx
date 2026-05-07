/**
 * ============================================================
 *  AdminPlayerModal — Fase 2
 *  Modal para Admin editar campos de gestão de um jogador:
 *   • Top Deuses flexível (1–5 god IDs, com preview visual)
 *   • Toggle Esports ELO + campo de valor manual
 *   • Mover para / remover do Banco de Reservas
 *   • Promover / rebaixar de role Admin
 * ============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { RankedPlayer } from '../forjaUtils';
import { updatePlayerAdminFields, setPlayerRole } from '../services/forjaService';
import { MAJOR_GODS } from '../../../data/gods';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CULTURE_COLORS: Record<string, string> = {
  Greek: '#60a5fa', Egyptian: '#f59e0b', Norse: '#a78bfa',
  Atlantean: '#4ade80', Japanese: '#f87171', Chinese: '#fb923c', Aztec: '#e879f9',
};

// ─── GodPickerButton ──────────────────────────────────────────────────────────

function GodPickerButton({
  godId, selected, onToggle,
}: { godId: string; selected: boolean; onToggle: () => void }) {
  const god = MAJOR_GODS.find(g => g.id === godId);
  if (!god) return null;
  const color = CULTURE_COLORS[god.culture] ?? '#94a3b8';

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${god.name} (${god.culture})`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
        padding: '0.4rem', borderRadius: '0.5rem', cursor: 'pointer',
        border: selected ? `2px solid ${color}` : '2px solid transparent',
        background: selected ? `${color}22` : 'rgba(255,255,255,0.04)',
        boxShadow: selected ? `0 0 8px ${color}66` : 'none',
        transition: 'all 0.15s ease', minWidth: '3.5rem',
      }}
    >
      <img src={god.image} alt={god.name}
        style={{ width: '2.25rem', height: '2.25rem', objectFit: 'contain' }}
        referrerPolicy="no-referrer" loading="lazy" />
      <span style={{ fontSize: '0.55rem', color: selected ? color : '#64748b',
        fontWeight: selected ? 700 : 400, textAlign: 'center', lineHeight: 1.2 }}>
        {god.name}
      </span>
    </button>
  );
}

// ─── Slot preview (selecionados) ──────────────────────────────────────────────

function SelectedGodSlot({ godId, onRemove }: { godId: string; onRemove: () => void }) {
  const god = MAJOR_GODS.find(g => g.id === godId);
  const color = god ? (CULTURE_COLORS[god.culture] ?? '#94a3b8') : '#94a3b8';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      background: `${color}18`, border: `1px solid ${color}55`,
      borderRadius: '0.5rem', padding: '0.3rem 0.5rem',
    }}>
      {god && (
        <img src={god.image} alt={god.name}
          style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }}
          referrerPolicy="no-referrer" />
      )}
      <span style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{god?.name ?? godId}</span>
      <button type="button" onClick={onRemove}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: '0.65rem', marginLeft: 'auto', padding: '0 0.1rem' }}>✕</button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminPlayerModalProps {
  player: RankedPlayer | null;
  onClose: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPlayerModal({ player, onClose }: AdminPlayerModalProps) {
  // Top Gods
  const [selectedGods, setSelectedGods] = useState<string[]>([]);
  const [godSearch, setGodSearch]       = useState('');

  // Esports ELO
  const [esportsEnabled, setEsportsEnabled] = useState(false);
  const [esportsValue, setEsportsValue]     = useState('');

  // Reserve
  const [isReserve, setIsReserve] = useState(false);

  // Role
  const [currentRole, setCurrentRole] = useState<'player' | 'admin'>('player');

  // UI State
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<'gods' | 'elo' | 'admin'>('gods');

  const overlayRef = useRef<HTMLDivElement>(null);

  // Sincroniza estado com o player aberto
  useEffect(() => {
    if (!player) return;
    setSelectedGods(player.top_gods_admin ?? player.top_gods.slice(0, 5).map(g => g.god));
    setEsportsEnabled(player.esports_elo_enabled ?? false);
    setEsportsValue(String(player.esports_elo_value ?? player.esports_elo ?? ''));
    setIsReserve(player.is_reserve ?? false);
    setCurrentRole(player.role ?? 'player');
    setError(null);
    setSuccess(false);
    setGodSearch('');
    setActiveSection('gods');
  }, [player?.discord_id]);

  if (!player) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleGod = (godId: string) => {
    setSelectedGods(prev => {
      if (prev.includes(godId)) return prev.filter(g => g !== godId);
      if (prev.length >= 5) return prev; // máx 5
      return [...prev, godId];
    });
  };

  const removeGodAt = (godId: string) => {
    setSelectedGods(prev => prev.filter(g => g !== godId));
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false);
    try {
      await updatePlayerAdminFields(player.discord_id, {
        top_gods_admin:      selectedGods,
        esports_elo_enabled: esportsEnabled,
        esports_elo_value:   esportsEnabled && esportsValue ? Number(esportsValue) : null,
        is_reserve:          isReserve,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async () => {
    const newRole = currentRole === 'admin' ? 'player' : 'admin';
    if (!confirm(`${newRole === 'admin' ? 'Promover' : 'Rebaixar'} ${player.nick} para ${newRole}?`)) return;
    setSaving(true); setError(null);
    try {
      await setPlayerRole(player.discord_id, newRole);
      setCurrentRole(newRole);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao alterar role.');
    } finally {
      setSaving(false);
    }
  };

  // Filtro de deuses
  const filteredGods = MAJOR_GODS.filter(g =>
    g.name.toLowerCase().includes(godSearch.toLowerCase()) ||
    g.culture.toLowerCase().includes(godSearch.toLowerCase())
  );

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
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '1.25rem', width: '100%', maxWidth: '680px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(245,158,11,0.08)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          <img src={player.avatar_url} alt={player.nick}
            style={{ width: '3rem', height: '3rem', borderRadius: '0.6rem', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
            onError={e => { (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/0.png`; }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
              🛡️ {player.nick}
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Rank #{player.rank} · ELO {player.elo_1v1.toLocaleString()} · {player.is_brazilian ? '🇧🇷' : '🇵🇹'}
              {currentRole === 'admin' && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>ADMIN</span>}
            </p>
          </div>
          <button onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none',
              color: '#475569', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1,
              padding: '0.25rem' }}>
            ✕
          </button>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          {([
            { id: 'gods',  label: '⚡ Top Deuses' },
            { id: 'elo',   label: '🏆 Esports ELO' },
            { id: 'admin', label: '🔑 Permissões' },
          ] as const).map(s => (
            <button key={s.id} type="button"
              onClick={() => setActiveSection(s.id)}
              style={{
                flex: 1, padding: '0.75rem 0.5rem', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                color: activeSection === s.id ? '#f59e0b' : '#475569',
                borderBottom: activeSection === s.id ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '1.5rem' }}>

          {/* ── Section: Top Deuses ── */}
          {activeSection === 'gods' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                  Deuses Selecionados ({selectedGods.length}/5)
                </label>
                {selectedGods.length === 0 ? (
                  <p style={{ color: '#475569', fontSize: '0.78rem', fontStyle: 'italic' }}>
                    Nenhum deus selecionado. Use o seletor abaixo (mínimo 1, máximo 5).
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selectedGods.map(gId => (
                      <SelectedGodSlot key={gId} godId={gId} onRemove={() => removeGodAt(gId)} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text" placeholder="Buscar deus ou cultura..." value={godSearch}
                  onChange={e => setGodSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid #334155',
                    color: '#f8fafc', fontSize: '0.8rem', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* God Grid */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.35rem',
                maxHeight: '280px', overflowY: 'auto',
                padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.75rem',
              }}>
                {filteredGods.map(god => (
                  <GodPickerButton
                    key={god.id} godId={god.id}
                    selected={selectedGods.includes(god.id)}
                    onToggle={() => toggleGod(god.id)}
                  />
                ))}
                {filteredGods.length === 0 && (
                  <p style={{ color: '#475569', fontSize: '0.8rem', padding: '1rem' }}>Nenhum resultado.</p>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.7rem', color: '#475569' }}>
                💡 Estes deuses substituem os dados automáticos do scraper na exibição pública.
                Deixe vazio para usar os dados do AoMStats.
              </p>
            </div>
          )}

          {/* ── Section: Esports ELO ── */}
          {activeSection === 'elo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '0.75rem', padding: '1rem',
              }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  O <strong style={{ color: '#f59e0b' }}>Esports ELO</strong> é um valor manual para
                  ex-profissionais e veteranos que teriam um ELO de matchmaking muito alto em ambiente
                  competitivo. Quando ativado, sobrepõe o ELO 1v1 no sort e na exibição.
                </p>

                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setEsportsEnabled(v => !v)}
                    style={{
                      width: '3rem', height: '1.6rem', borderRadius: '1rem',
                      background: esportsEnabled ? '#f59e0b' : '#334155',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s',
                    }}
                    id={`esports-toggle-${player.discord_id}`}
                    aria-checked={esportsEnabled}
                    role="switch"
                  >
                    <span style={{
                      position: 'absolute', top: '0.2rem',
                      left: esportsEnabled ? '1.4rem' : '0.2rem',
                      width: '1.2rem', height: '1.2rem', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </button>
                  <span style={{ fontSize: '0.85rem', color: esportsEnabled ? '#f59e0b' : '#64748b', fontWeight: 600 }}>
                    {esportsEnabled ? 'Esports ELO Ativo' : 'Desativado'}
                  </span>
                </div>

                {/* Valor */}
                {esportsEnabled && (
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Valor do Esports ELO
                    </label>
                    <input
                      type="number" min={0} max={9999} value={esportsValue}
                      onChange={e => setEsportsValue(e.target.value)}
                      placeholder="Ex: 2450"
                      style={{
                        width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)',
                        color: '#facc15', fontSize: '1rem', fontWeight: 700,
                        outline: 'none', boxSizing: 'border-box',
                      }}
                      id={`esports-value-${player.discord_id}`}
                    />
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>
                      ELO atual 1v1: <strong style={{ color: '#60a5fa' }}>{player.elo_1v1.toLocaleString()}</strong>
                      {' · '}TG: <strong style={{ color: '#60a5fa' }}>{player.elo_tg.toLocaleString()}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Reserve toggle */}
              <div style={{
                background: 'rgba(100,116,139,0.08)', border: '1px solid #334155',
                borderRadius: '0.75rem', padding: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                      🪑 Banco de Reservas
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      Jogadores na reserva não participam do draft principal mas podem ser realocados.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReserve(v => !v)}
                    style={{
                      width: '3rem', height: '1.6rem', borderRadius: '1rem', flexShrink: 0,
                      background: isReserve ? '#64748b' : '#334155',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s',
                    }}
                    aria-checked={isReserve}
                    role="switch"
                  >
                    <span style={{
                      position: 'absolute', top: '0.2rem',
                      left: isReserve ? '1.4rem' : '0.2rem',
                      width: '1.2rem', height: '1.2rem', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Section: Permissões ── */}
          {activeSection === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: currentRole === 'admin'
                  ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)',
                border: `1px solid ${currentRole === 'admin' ? 'rgba(245,158,11,0.3)' : '#334155'}`,
                borderRadius: '0.75rem', padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '3rem', height: '3rem', borderRadius: '50%',
                    background: currentRole === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}>
                    {currentRole === 'admin' ? '👑' : '👤'}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', fontWeight: 700 }}>
                      Role atual: <span style={{ color: currentRole === 'admin' ? '#f59e0b' : '#94a3b8' }}>
                        {currentRole === 'admin' ? 'Admin' : 'Jogador'}
                      </span>
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      {currentRole === 'admin'
                        ? 'Pode editar dados de todos os jogadores, gerenciar times e regras.'
                        : 'Pode editar apenas seu próprio perfil (link, disponibilidade, frase).'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRoleToggle}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '0.7rem', borderRadius: '0.6rem',
                    background: currentRole === 'admin'
                      ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${currentRole === 'admin' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                    color: currentRole === 'admin' ? '#f87171' : '#f59e0b',
                    cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700,
                    fontSize: '0.8rem', transition: 'all 0.15s',
                  }}
                  id={`role-toggle-${player.discord_id}`}
                >
                  {saving ? '⏳ Aguarde...' : currentRole === 'admin'
                    ? '↓ Rebaixar para Jogador' : '↑ Promover para Admin'}
                </button>
              </div>

              <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.6rem' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#f87171', lineHeight: 1.5 }}>
                  ⚠️ <strong>Atenção:</strong> Admins podem alterar dados de qualquer jogador,
                  incluindo Esports ELO e deuses. Use com responsabilidade.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #1e293b',
          display: 'flex', gap: '0.75rem', alignItems: 'center',
          flexShrink: 0,
        }}>
          {error && (
            <span style={{ fontSize: '0.75rem', color: '#f87171', flex: 1 }}>⚠️ {error}</span>
          )}
          {success && (
            <span style={{ fontSize: '0.75rem', color: '#4ade80', flex: 1 }}>✓ Salvo com sucesso!</span>
          )}
          {!error && !success && <span style={{ flex: 1 }} />}

          <button type="button" onClick={onClose}
            disabled={saving}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '0.6rem',
              background: 'transparent', border: '1px solid #334155',
              color: '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
            Cancelar
          </button>

          {activeSection !== 'admin' && (
            <button
              type="button" onClick={handleSave} disabled={saving}
              id={`admin-modal-save-${player.discord_id}`}
              style={{
                padding: '0.6rem 1.5rem', borderRadius: '0.6rem',
                background: saving ? '#334155' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none', color: saving ? '#64748b' : '#0f172a',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.82rem',
                boxShadow: saving ? 'none' : '0 0 16px rgba(245,158,11,0.35)',
                transition: 'all 0.15s',
              }}>
              {saving ? '⏳ Salvando...' : '✓ Salvar Alterações'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
