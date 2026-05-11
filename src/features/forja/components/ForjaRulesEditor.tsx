/**
 * ============================================================
 * ForjaRulesEditor — Fase 3
 * Editor de blocos de regras com drag & drop para reordenar.
 * Admin: drag to reorder + edit inline + add/delete blocks.
 * Público: exibição estática limpa.
 * ============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  DragDropContext, Droppable, Draggable,
  DropResult, DraggableProvided, DroppableProvided,
} from '@hello-pangea/dnd';
import { ForjaViewProps } from '../types';
import { ForjaRulesBlock } from '../types';
import {
  subscribeToForjaRulesBlocks,
  saveRulesBlocks,
  addRulesBlock,
  deleteRulesBlock,
} from '../services/forjaService';
import { useForjaPrizes } from '../hooks/useForjaContent';
import ForjaPremiacaoEditor from './ForjaPremiacaoEditor';

// ─── Block Editor (Admin Inline) ──────────────────────────────────────────────

function EditableBlock({
  block,
  provided,
  isDragging,
  onUpdate,
  onDelete,
}: {
  block: ForjaRulesBlock;
  provided: DraggableProvided;
  isDragging: boolean;
  onUpdate: (id: string, field: 'title' | 'content', value: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{
        ...provided.draggableProps.style,
        marginBottom: '1rem',
        background: isDragging ? 'rgba(245,158,11,0.12)' : 'rgba(30,41,59,0.9)',
        border: `1px solid ${isDragging ? 'rgba(245,158,11,0.5)' : '#334155'}`,
        borderRadius: '0.75rem',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        boxShadow: isDragging ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {/* Drag Handle + Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b',
      }}>
        {/* Drag handle */}
        <div
          {...provided.dragHandleProps}
          title="Arraste para reordenar"
          style={{
            display: 'flex', flexDirection: 'column', gap: '3px',
            cursor: 'grab', padding: '0.2rem', opacity: 0.5, flexShrink: 0,
          }}
        >
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: '18px', height: '2px', background: '#94a3b8',
              borderRadius: '1px',
            }} />
          ))}
        </div>

        {/* Title input */}
        <input
          value={block.title}
          onChange={e => onUpdate(block.id, 'title', e.target.value)}
          placeholder="Título do bloco..."
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Delete button */}
        <button
          onClick={() => onDelete(block.id)}
          title="Remover bloco"
          style={{
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.4rem',
            borderRadius: '0.3rem', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          🗑
        </button>
      </div>

      {/* Content textarea */}
      <textarea
        value={block.content}
        onChange={e => onUpdate(block.id, 'content', e.target.value)}
        placeholder="Conteúdo do bloco..."
        rows={4}
        style={{
          width: '100%', padding: '0.875rem 1rem',
          background: 'transparent', border: 'none',
          color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.6,
          resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ─── Static Block (Public view) ───────────────────────────────────────────────

function StaticBlock({ block }: { block: ForjaRulesBlock }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b',
      borderRadius: '0.875rem', padding: '1.25rem 1.5rem',
      marginBottom: '1rem',
    }}>
      <h3 style={{
        margin: '0 0 0.75rem', color: '#f59e0b', fontSize: '1rem',
        fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '1.5rem', height: '1.5rem', background: 'rgba(245,158,11,0.12)',
          borderRadius: '50%', fontSize: '0.6rem', fontWeight: 900,
          color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
        }}>
          {(block.order ?? 0) + 1}
        </span>
        {block.title}
      </h3>
      <div style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7 }}>
        {block.content.split('\n').map((line, i) => (
          <p key={i} style={{ margin: '0 0 0.4rem' }}>{line}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForjaRulesEditor({ discordUser, isAdmin }: ForjaViewProps) {
  const [blocks, setBlocks]     = useState<ForjaRulesBlock[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  
  const { data: prizes } = useForjaPrizes();

  // Subscribe to blocks
  useEffect(() => {
    const unsub = subscribeToForjaRulesBlocks(
      (data) => {
        // CORREÇÃO AQUI: Garantindo que todos os blocos antigos tenham um 'id'
        const safeData = data.map((block, index) => ({
          ...block,
          id: block.id || `legacy-block-${index}`,
          order: block.order ?? index
        }));
        setBlocks(safeData);
        setLoading(false);
      },
      (err)  => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...blocks];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setBlocks(reordered.map((b, i) => ({ ...b, order: i })));
    setDirty(true);
  }, [blocks]);

  const handleUpdate = useCallback((id: string, field: 'title' | 'content', value: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    setDirty(true);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este bloco de regras?')) return;
    try {
      await deleteRulesBlock(id, discordUser?.username ?? 'admin');
    } catch (e: any) { setError(e.message); }
  };

  const handleAdd = async () => {
    try {
      await addRulesBlock(discordUser?.username ?? 'admin');
    } catch (e: any) { setError(e.message); }
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveRulesBlocks(blocks, discordUser?.username ?? 'admin');
      setDirty(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="forja-view forja-view--regras">
      {/* Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>📜</span> Regras do Torneio</h2>
          <p className="forja-page-subtitle">
            {isAdmin ? 'Arraste para reordenar · Edite inline · Salve quando pronto' : 'Leia com atenção antes de se inscrever'}
          </p>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {dirty && (
              <span style={{ fontSize: '0.72rem', color: '#f59e0b', animation: 'pulse 1.5s infinite' }}>
                ⚠ Alterações não salvas
              </span>
            )}
            {savedMsg && (
              <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>✓ Salvo!</span>
            )}
            <button
              className="forja-btn forja-btn--ghost"
              onClick={handleAdd}
              style={{ fontSize: '0.78rem' }}
              id="rules-add-block-btn"
            >
              + Adicionar Bloco
            </button>
            <button
              className="forja-btn forja-btn--primary"
              onClick={handleSave}
              disabled={saving || !dirty}
              id="rules-save-btn"
              style={{
                fontSize: '0.78rem',
                opacity: !dirty ? 0.5 : 1,
              }}
            >
              {saving ? '⏳ Salvando...' : '✓ Salvar Ordem'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="forja-modal-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : blocks.length === 0 ? (
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>📋</span>
          <p>Regras em breve.</p>
          {isAdmin && (
            <button className="forja-btn forja-btn--secondary" onClick={handleAdd} style={{ marginTop: '1rem' }}>
              + Criar primeiro bloco
            </button>
          )}
        </div>
      ) : isAdmin ? (
        /* ── Admin: Drag & Drop editor ── */
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="rules-blocks">
            {(provided: DroppableProvided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ marginTop: '1rem' }}
              >
                {blocks.map((block, index) => (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(prov, snap) => (
                      <EditableBlock
                        block={block}
                        provided={prov}
                        isDragging={snap.isDragging}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        /* ── Public: Static view ── */
        <div style={{ marginTop: '1rem' }}>
          {blocks.map(block => (
            <StaticBlock key={block.id} block={block} />
          ))}
        </div>
      )}

      {/* Premiação */}
      <div style={{ marginTop: '3rem' }}>
        <ForjaPremiacaoEditor
          data={prizes}
          updatedBy={discordUser?.username ?? 'admin'}
          readOnly={!isAdmin}
        />
      </div>
    </section>
  );
}