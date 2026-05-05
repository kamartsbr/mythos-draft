/**
 * ForjaPremiacaoEditor — Editor de premiação para Admin
 * Admin define o total do prize pool e % por posição.
 */
import React, { useState, useEffect } from 'react';
import { ForjaPrizeConfig, ForjaPrizeDistribution } from '../types';
import { updateForjaContent } from '../services/forjaService';

interface Props {
  data: ForjaPrizeConfig | null;
  updatedBy: string;
  readOnly?: boolean;
}

function calcValue(total: number, percent: number): string {
  if (!total) return '—';
  return `R$ ${(total * percent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function ForjaPremiacaoEditor({ data, updatedBy, readOnly = false }: Props) {
  const [editing, setEditing]   = useState(false);
  const [total, setTotal]       = useState(data?.total_prize ?? 0);
  const [notes, setNotes]       = useState(data?.notes ?? '');
  const [dist, setDist]         = useState<ForjaPrizeDistribution[]>(
    data?.distribution ?? [
      { place: 1, label: '🥇 1º Lugar', percent: 50 },
      { place: 2, label: '🥈 2º Lugar', percent: 25 },
      { place: 3, label: '🥉 3º/4º Lugar', percent: 12.5 },
      { place: 4, label: '🏅 3º/4º Lugar', percent: 12.5 },
    ]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) { setTotal(data.total_prize); setNotes(data.notes); setDist(data.distribution); }
  }, [data]);

  const totalPct = dist.reduce((s, d) => s + d.percent, 0);

  const handleSave = async () => {
    if (Math.abs(totalPct - 100) > 0.1) { alert('Os percentuais devem somar 100%.'); return; }
    setSaving(true);
    try {
      await updateForjaContent('prizes', { total_prize: total, currency: 'BRL', distribution: dist, notes }, updatedBy);
      setEditing(false);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="forja-premiacao">
      <div className="forja-premiacao-header">
        <h3 className="forja-section-title"><span>🏆</span> Premiação</h3>
        {!readOnly && !editing && (
          <button className="forja-btn forja-btn--ghost" style={{ fontSize: '0.72rem' }} onClick={() => setEditing(true)}>
            ✏️ Editar
          </button>
        )}
      </div>

      {editing && !readOnly ? (
        <div className="forja-premiacao-edit">
          <div className="forja-reg-field">
            <label className="forja-reg-label">Prize Pool Total (R$)</label>
            <input type="number" className="forja-reg-input" min={0} value={total}
              onChange={e => setTotal(Number(e.target.value))} />
          </div>
          {dist.map((d, i) => (
            <div key={i} className="forja-premiacao-row-edit">
              <input className="forja-reg-input" style={{ flex: 2 }} value={d.label}
                onChange={e => setDist(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))} />
              <input type="number" className="forja-reg-input" style={{ flex: 1, width: '80px' }}
                min={0} max={100} step={0.5} value={d.percent}
                onChange={e => setDist(prev => prev.map((p, j) => j === i ? { ...p, percent: Number(e.target.value) } : p))} />
              <span style={{ color: '#64748b', fontSize: '0.75rem', flexShrink: 0 }}>%</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: Math.abs(totalPct - 100) > 0.1 ? '#f87171' : '#4ade80' }}>
              Total: {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) > 0.1 ? '⚠️ deve ser 100%' : '✓'}
            </span>
            <div className="forja-reg-actions" style={{ marginTop: 0 }}>
              <button className="forja-btn forja-btn--ghost" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="forja-btn forja-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? '...' : '💾 Salvar'}
              </button>
            </div>
          </div>
          <div className="forja-reg-field" style={{ marginTop: '0.75rem' }}>
            <label className="forja-reg-label">Observações</label>
            <textarea className="forja-reg-input" rows={2} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Patrocinadores, regras de pagamento..." />
          </div>
        </div>
      ) : (
        <div className="forja-premiacao-view">
          {total > 0 && (
            <div className="forja-premiacao-total">
              Prize Pool: <strong style={{ color: '#f59e0b' }}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          )}
          <div className="forja-premiacao-grid">
            {dist.map((d, i) => (
              <div key={i} className="forja-premiacao-item">
                <span className="forja-premiacao-label">{d.label}</span>
                <span className="forja-premiacao-pct">{d.percent}%</span>
                {total > 0 && (
                  <span className="forja-premiacao-value">{calcValue(total, d.percent)}</span>
                )}
              </div>
            ))}
          </div>
          {notes && <p className="forja-cms-meta" style={{ marginTop: '0.75rem' }}>{notes}</p>}
          {!total && (
            <p className="forja-cms-meta">Prize pool a ser anunciado em breve.</p>
          )}
        </div>
      )}
    </div>
  );
}
