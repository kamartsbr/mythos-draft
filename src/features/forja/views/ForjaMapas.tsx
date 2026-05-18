/**
 * ============================================================
 *  ForjaMapas — Aba de Mapas do Torneio
 *
 *  Público: escuta a pool ativa no Firestore em tempo real.
 *  Admin:   painel de gestão com grid de todos os mapas disponíveis,
 *           toggle visual, controle de tamanho (8–15) e botão Salvar.
 * ============================================================
 */
import React, { useState, useEffect } from 'react';
import { ForjaViewProps } from '../types';
import { MAPS } from '../../../data/maps';
import { useForjaMapPool } from '../hooks/useForjaMapPool';
import { saveForjaMapPool, seedDefaultMapPool } from '../services/forjaService';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MIN_POOL_SIZE = 8;
const MAX_POOL_SIZE = MAPS.length;

// ─── MapCard (público, read-only) ─────────────────────────────────────────────

function MapCardPublic({ name, image }: { name: string; image: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(15,23,42,0.8)', padding: '1rem',
      borderRadius: '0.875rem', border: '1px solid #1e293b',
      transition: 'transform 0.15s, border-color 0.15s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLElement).style.borderColor = '#334155';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.borderColor = '#1e293b';
      }}
    >
      <img
        src={image} alt={name}
        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '0.75rem' }}
        referrerPolicy="no-referrer" loading="lazy"
      />
      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
        {name}
      </span>
    </div>
  );
}

// ─── MapCard (admin, toggleable) ─────────────────────────────────────────────

function MapCardAdmin({
  map, selected, canSelect, onToggle,
}: {
  map: typeof MAPS[0];
  selected: boolean;
  canSelect: boolean;
  onToggle: () => void;
}) {
  const isDisabled = !selected && !canSelect;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      title={
        isDisabled
          ? 'Limite da pool atingido. Remova um mapa antes de adicionar outro.'
          : selected ? `Remover ${map.name}` : `Adicionar ${map.name}`
      }
      id={`map-toggle-${map.id}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0.75rem', borderRadius: '0.875rem', cursor: isDisabled ? 'not-allowed' : 'pointer',
        background: selected
          ? 'rgba(96,165,250,0.12)'
          : isDisabled ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.7)',
        border: selected
          ? '2px solid #60a5fa'
          : isDisabled ? '2px solid #1e293b' : '2px solid #1e293b',
        opacity: isDisabled ? 0.4 : 1,
        transition: 'all 0.15s',
        position: 'relative', textAlign: 'center',
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.borderColor = selected ? '#93c5fd' : '#334155';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = selected ? '#60a5fa' : '#1e293b';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: 'absolute', top: '0.4rem', right: '0.4rem',
          background: '#60a5fa', color: '#0f172a',
          width: '1.25rem', height: '1.25rem', borderRadius: '50%',
          fontSize: '0.65rem', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 8px rgba(96,165,250,0.5)',
        }}>✓</div>
      )}

      <img
        src={map.image} alt={map.name}
        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.4rem', marginBottom: '0.5rem' }}
        referrerPolicy="no-referrer" loading="lazy"
      />
      <span style={{
        color: selected ? '#93c5fd' : '#94a3b8',
        fontWeight: selected ? 700 : 500, fontSize: '0.72rem',
      }}>
        {map.name}
      </span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaMapas({ discordUser, isAdmin }: ForjaViewProps) {
  const { activeMaps, activeMapIds, poolSize, loading, error, poolDoc } = useForjaMapPool();

  // ── Estado local do Admin ────────────────────────────────────────────────
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [localPoolSize, setLocalPoolSize] = useState<number>(10);
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState<string | null>(null);
  const [dirty, setDirty]                 = useState(false);

  // Sincroniza estado local com o Firestore quando os dados chegam
  useEffect(() => {
    setLocalSelected(activeMapIds);
    setLocalPoolSize(poolSize);
    setDirty(false);
  }, [activeMapIds.join(','), poolSize]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleMap = (id: string) => {
    setLocalSelected(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        setDirty(true);
        return prev.filter(m => m !== id);
      }
      if (prev.length >= localPoolSize) return prev; // Bloqueia se atingiu limite
      setDirty(true);
      return [...prev, id];
    });
  };

  const handlePoolSizeChange = (size: number) => {
    const clamped = Math.min(MAX_POOL_SIZE, Math.max(MIN_POOL_SIZE, size));
    setLocalPoolSize(clamped);
    // Se reduziu o tamanho e ultrapassou o limite, trunca a seleção atual
    if (localSelected.length > clamped) {
      setLocalSelected(prev => prev.slice(0, clamped));
    }
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await saveForjaMapPool(localSelected, localPoolSize, discordUser?.username ?? 'admin');
      setDirty(false);
      setSaveMsg(`✓ Pool salva! ${localSelected.length}/${localPoolSize} mapas ativos.`);
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e: any) {
      setSaveMsg(`⚠️ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefault = async () => {
    await seedDefaultMapPool(discordUser?.username ?? 'admin');
  };

  // ── Render Público ────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <section className="forja-view">
        <div className="forja-page-header">
          <div>
            <h2 className="forja-page-title"><span>🗺️</span> Mapas do Torneio</h2>
            <p className="forja-page-subtitle">
              {loading
                ? 'Carregando pool oficial...'
                : `${activeMaps.length} mapas selecionados para a Forja de Hefesto`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
        ) : error ? (
          <div className="forja-empty"><span>⚠️</span><p>{error}</p></div>
        ) : activeMaps.length === 0 ? (
          <div className="forja-empty">
            <span style={{ fontSize: '3rem' }}>🗺️</span>
            <p>A pool de mapas ainda não foi definida. Aguarde o Admin!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '1.25rem', marginTop: '1.5rem',
          }}>
            {activeMaps.map(m => (
              <MapCardPublic key={m.id} name={m.name} image={m.image} />
            ))}
          </div>
        )}
      </section>
    );
  }

  // ── Render Admin ──────────────────────────────────────────────────────────

  const canSelect = localSelected.length < localPoolSize;

  return (
    <section className="forja-view">
      {/* Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🗺️</span> Gestão da Pool de Mapas</h2>
          <p className="forja-page-subtitle">
            Selecione os mapas ativos · Clique para ligar/desligar · Salve quando pronto
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Pool size input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              Tamanho da pool:
            </label>
            <input
              type="number"
              min={MIN_POOL_SIZE}
              max={MAX_POOL_SIZE}
              value={localPoolSize}
              onChange={e => handlePoolSizeChange(Number(e.target.value))}
              id="map-pool-size-input"
              style={{
                width: '64px', padding: '0.4rem 0.5rem', borderRadius: '0.5rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid #334155',
                color: '#f8fafc', fontSize: '0.85rem', textAlign: 'center', outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>({MIN_POOL_SIZE}–{MAX_POOL_SIZE})</span>
          </div>

          {/* Counter badge */}
          <div style={{
            padding: '0.35rem 0.85rem', borderRadius: '2rem',
            background: localSelected.length === localPoolSize
              ? 'rgba(96,165,250,0.15)' : localSelected.length > localPoolSize
              ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${localSelected.length === localPoolSize ? '#60a5fa' : localSelected.length > localPoolSize ? '#f87171' : '#334155'}`,
            color: localSelected.length === localPoolSize ? '#60a5fa' : localSelected.length > localPoolSize ? '#f87171' : '#94a3b8',
            fontSize: '0.78rem', fontWeight: 700,
          }}>
            {localSelected.length} / {localPoolSize}
          </div>

          {/* Status / save msg */}
          {saveMsg && (
            <span style={{
              fontSize: '0.75rem',
              color: saveMsg.startsWith('✓') ? '#4ade80' : '#f87171',
            }}>
              {saveMsg}
            </span>
          )}
          {dirty && !saveMsg && (
            <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>⚠ Alterações não salvas</span>
          )}

          {/* Seed default (apenas se não inicializado) */}
          {!poolDoc && (
            <button
              className="forja-btn forja-btn--ghost"
              onClick={handleSeedDefault}
              style={{ fontSize: '0.75rem' }}
              id="map-seed-default-btn"
            >
              🌱 Carregar padrão
            </button>
          )}

          {/* Save button */}
          <button
            className="forja-btn forja-btn--primary"
            onClick={handleSave}
            disabled={saving || !dirty || localSelected.length > localPoolSize}
            id="map-pool-save-btn"
            style={{
              fontSize: '0.78rem',
              opacity: !dirty || localSelected.length > localPoolSize ? 0.5 : 1,
            }}
          >
            {saving ? '⏳ Salvando...' : '✓ Salvar Pool'}
          </button>
        </div>
      </div>

      {/* Warning: over limit */}
      {localSelected.length > localPoolSize && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: '0.6rem', padding: '0.75rem 1rem',
          fontSize: '0.78rem', color: '#fca5a5', marginBottom: '1rem',
        }}>
          ⚠️ A seleção ({localSelected.length}) ultrapassa o tamanho da pool ({localPoolSize}).
          Reduza a seleção ou aumente o tamanho antes de salvar.
        </div>
      )}

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '0.875rem', marginTop: '1.5rem',
        }}>
          {MAPS.map(m => (
            <MapCardAdmin
              key={m.id}
              map={m}
              selected={localSelected.includes(m.id)}
              canSelect={canSelect}
              onToggle={() => toggleMap(m.id)}
            />
          ))}
        </div>
      )}

      {/* Footer hint */}
      <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: '#334155', textAlign: 'center' }}>
        {MAPS.length} mapas disponíveis no jogo · {localSelected.length} selecionados ·
        {' '}{MAPS.length - localSelected.length} não incluídos
      </p>
    </section>
  );
}
