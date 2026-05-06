import React from 'react';
import { ForjaViewProps } from '../types';
import { MAPS, FORJA_MAP_POOL } from '../../../constants';

export default function ForjaMapas({ }: ForjaViewProps) {
  const forjaMaps = MAPS.filter(m => FORJA_MAP_POOL.includes(m.id));

  return (
    <section className="forja-view">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>🗺️</span> Mapas do Torneio</h2>
          <p className="forja-page-subtitle">Abaixo estão os 10 mapas escolhidos para uso exclusivo no Forja de Hefesto.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        {forjaMaps.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0f172a', padding: '1rem', borderRadius: '1rem', border: '1px solid #1e293b' }}>
            <img
              src={m.image}
              alt={m.name}
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '1rem' }}
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
              {m.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
