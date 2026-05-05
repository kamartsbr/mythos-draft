/**
 * Forja de Hefesto — Aba: Schedule
 * Passo 4: dados reais do Firestore + CRUD admin inline.
 */
import React, { useState } from 'react';
import { ForjaViewProps, ForjaScheduleEntry } from '../types';
import { useForjaSchedule } from '../hooks/useForjaSchedule';
import {
  addScheduleEntry, updateScheduleEntry, deleteScheduleEntry,
} from '../services/forjaService';

// ─── Match Form Modal ─────────────────────────────────────────────────────────
interface MatchFormProps {
  initial?: Partial<ForjaScheduleEntry>;
  onSave: (data: Omit<ForjaScheduleEntry, 'id'>) => Promise<void>;
  onCancel: () => void;
}

function MatchForm({ initial, onSave, onCancel }: MatchFormProps) {
  const toInputDate = (ts: any) => {
    if (!ts) return '';
    const ms = typeof ts === 'number' ? ts : ts.seconds ? ts.seconds * 1000 : Date.parse(ts);
    return new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [matchup, setMatchup]       = useState(initial?.matchup ?? '');
  const [dateStr, setDateStr]       = useState(toInputDate(initial?.date));
  const [streamerName, setStreamerName] = useState(initial?.streamer_name ?? '');
  const [streamerLink, setStreamerLink] = useState(initial?.streamer_link ?? '');
  const [saving, setSaving]         = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const dateMs = dateStr ? new Date(dateStr).getTime() : null;
    await onSave({
      matchup, date: dateMs, streamer_name: streamerName, streamer_link: streamerLink,
    });
    setSaving(false);
  };

  return (
    <div className="forja-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="forja-modal" style={{ maxWidth: '440px' }}>
        <div className="forja-modal-header">
          <div className="forja-modal-header__title">
            <span className="forja-modal-header__icon">📅</span>
            {initial?.id ? 'Editar Partida' : 'Adicionar Partida'}
          </div>
          <button className="forja-modal-close" onClick={onCancel}>✕</button>
        </div>
        <form className="forja-modal-body" onSubmit={handleSave}>
          <div className="forja-reg-field">
            <label className="forja-reg-label">Confronto *</label>
            <input className="forja-reg-input" placeholder="Time A vs Time B" value={matchup}
              onChange={e => setMatchup(e.target.value)} required />
          </div>
          <div className="forja-reg-field">
            <label className="forja-reg-label">Data e Hora</label>
            <input className="forja-reg-input" type="datetime-local" value={dateStr}
              onChange={e => setDateStr(e.target.value)} />
          </div>
          <div className="forja-reg-field">
            <label className="forja-reg-label">Nome do Streamer / Caster</label>
            <input className="forja-reg-input" placeholder="Twitch: omoradin" value={streamerName}
              onChange={e => setStreamerName(e.target.value)} />
          </div>
          <div className="forja-reg-field">
            <label className="forja-reg-label">Link da Stream</label>
            <input className="forja-reg-input" type="url" placeholder="https://twitch.tv/..." value={streamerLink}
              onChange={e => setStreamerLink(e.target.value)} />
          </div>
          <div className="forja-reg-actions">
            <button type="button" className="forja-btn forja-btn--ghost" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="forja-btn forja-btn--primary" disabled={saving || !matchup.trim()}>
              {saving ? '⏳ Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function formatDate(ts: any): string {
  if (!ts) return 'Data a confirmar';
  try {
    const ms = typeof ts === 'number' ? ts : ts.seconds ? ts.seconds * 1000 : Date.parse(ts);
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(ms)) + ' (BRT)';
  } catch { return 'Data inválida'; }
}

function MatchCard({ entry, isAdmin, onEdit, onDelete }: {
  entry: ForjaScheduleEntry;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="forja-schedule-match-card">
      <div className="forja-schedule-match-card__date">{formatDate(entry.date)}</div>
      <div className="forja-schedule-match-card__matchup">{entry.matchup}</div>
      {entry.streamer_name && (
        <div className="forja-schedule-match-card__stream">
          🎙 {entry.streamer_link
            ? <a href={entry.streamer_link} target="_blank" rel="noreferrer">{entry.streamer_name}</a>
            : entry.streamer_name}
        </div>
      )}
      {isAdmin && (
        <div className="forja-schedule-admin-actions">
          <button className="forja-btn forja-btn--ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.75rem' }} onClick={onEdit}>✏️ Editar</button>
          <button className="forja-btn forja-btn--danger" style={{ fontSize: '0.7rem', padding: '0.3rem 0.75rem' }} onClick={onDelete}>🗑 Remover</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaSchedule({ isAdmin }: ForjaViewProps) {
  const { entries, loading, error } = useForjaSchedule();
  const [showForm, setShowForm]     = useState(false);
  const [editEntry, setEditEntry]   = useState<ForjaScheduleEntry | null>(null);

  const handleSave = async (data: Omit<ForjaScheduleEntry, 'id'>) => {
    if (editEntry) {
      await updateScheduleEntry(editEntry.id, data);
    } else {
      await addScheduleEntry(data);
    }
    setShowForm(false);
    setEditEntry(null);
  };

  const handleDelete = async (id: string, matchup: string) => {
    if (!confirm(`Remover a partida "${matchup}"?`)) return;
    await deleteScheduleEntry(id);
  };

  const openEdit = (entry: ForjaScheduleEntry) => { setEditEntry(entry); setShowForm(true); };
  const openAdd  = () => { setEditEntry(null); setShowForm(true); };

  return (
    <section className="forja-view forja-view--schedule">
      {/* Header */}
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>📅</span> Cronograma de Partidas</h2>
          <p className="forja-page-subtitle">Horários, confrontos e links de transmissão</p>
        </div>
        {isAdmin && (
          <button
            id="forja-schedule-add-btn"
            className="forja-btn forja-btn--primary"
            onClick={openAdd}
          >
            + Adicionar Partida
          </button>
        )}
      </div>

      {error && <div className="forja-modal-error">⚠️ {error}</div>}

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>📋</span>
          <p>{isAdmin ? 'Nenhuma partida cadastrada. Clique em "+ Adicionar Partida" para começar.' : 'O cronograma ainda não foi publicado. Fique ligado no Discord!'}</p>
        </div>
      ) : (
        <div className="forja-schedule-list">
          {entries.map(entry => (
            <MatchCard
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onEdit={() => openEdit(entry)}
              onDelete={() => handleDelete(entry.id, entry.matchup)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="forja-schedule-footer">
        <span>🕐 Todos os horários exibidos em BRT (UTC-3)</span>
        <a href="https://discord.gg/seu-server" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
          Discord para notificações →
        </a>
      </div>

      {/* Form modal */}
      {showForm && (
        <MatchForm
          initial={editEntry ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditEntry(null); }}
        />
      )}
    </section>
  );
}
