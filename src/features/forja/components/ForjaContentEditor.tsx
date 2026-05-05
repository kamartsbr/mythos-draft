/**
 * ForjaContentEditor — Editor CMS inline para Admin
 * Permite editar seções de texto (Regras, Formato) sem mexer no código.
 */
import React, { useState, useEffect } from 'react';
import { ForjaContentDoc, ForjaContentSection } from '../types';
import { updateForjaContent, ForjaContentId } from '../services/forjaService';

interface Props {
  docId: ForjaContentId;
  data: ForjaContentDoc | null;
  updatedBy: string;
}

function SectionEditor({
  section, index, onSave, onDelete,
}: {
  section: ForjaContentSection;
  index: number;
  onSave: (i: number, s: ForjaContentSection) => void;
  onDelete: (i: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle]     = useState(section.title);
  const [content, setContent] = useState(section.content);

  useEffect(() => { setTitle(section.title); setContent(section.content); }, [section]);

  return (
    <div className="forja-cms-section">
      {editing ? (
        <div className="forja-cms-edit-panel">
          <input
            className="forja-reg-input forja-cms-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da seção"
          />
          <textarea
            className="forja-reg-input forja-cms-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={6}
            placeholder="Conteúdo da seção (texto simples, use quebras de linha para parágrafos)"
          />
          <div className="forja-reg-actions">
            <button
              className="forja-btn forja-btn--danger"
              style={{ marginRight: 'auto', fontSize: '0.72rem' }}
              onClick={() => { if (confirm('Remover esta seção?')) onDelete(index); }}
            >
              🗑 Remover
            </button>
            <button className="forja-btn forja-btn--ghost" onClick={() => setEditing(false)}>Cancelar</button>
            <button
              className="forja-btn forja-btn--primary"
              onClick={() => { onSave(index, { title, content }); setEditing(false); }}
              disabled={!title.trim()}
            >
              ✓ Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="forja-cms-section-view">
          <div className="forja-cms-section-header">
            <h4 className="forja-cms-section-title">{section.title}</h4>
            <button
              className="forja-btn forja-btn--ghost"
              style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}
              onClick={() => setEditing(true)}
            >
              ✏️ Editar
            </button>
          </div>
          <p className="forja-cms-section-content">{section.content}</p>
        </div>
      )}
    </div>
  );
}

export default function ForjaContentEditor({ docId, data, updatedBy }: Props) {
  const [sections, setSections] = useState<ForjaContentSection[]>(data?.sections ?? []);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => { setSections(data?.sections ?? []); }, [data]);

  const handleSaveSection = (i: number, s: ForjaContentSection) => {
    const next = sections.map((sec, idx) => idx === i ? s : sec);
    setSections(next);
    persist(next);
  };

  const handleDeleteSection = (i: number) => {
    const next = sections.filter((_, idx) => idx !== i);
    setSections(next);
    persist(next);
  };

  const handleAddSection = () => {
    const next = [...sections, { title: 'Nova Seção', content: 'Conteúdo aqui...' }];
    setSections(next);
    persist(next);
  };

  const persist = async (next: ForjaContentSection[]) => {
    setSaving(true); setSaved(false);
    try {
      await updateForjaContent(docId, { sections: next }, updatedBy);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Erro ao salvar: ' + (e as any).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="forja-cms-editor">
      <div className="forja-cms-toolbar">
        <span className="forja-cms-status">
          {saving ? '⏳ Salvando...' : saved ? '✅ Salvo!' : `${sections.length} seção(ões)`}
        </span>
        <button className="forja-btn forja-btn--secondary" style={{ fontSize: '0.72rem' }} onClick={handleAddSection}>
          + Adicionar Seção
        </button>
      </div>

      <div className="forja-cms-sections">
        {sections.map((s, i) => (
          <SectionEditor
            key={i}
            section={s}
            index={i}
            onSave={handleSaveSection}
            onDelete={handleDeleteSection}
          />
        ))}
      </div>

      {data?.updated_by && (
        <p className="forja-cms-meta">
          Última edição por <strong>{data.updated_by}</strong>
        </p>
      )}
    </div>
  );
}
