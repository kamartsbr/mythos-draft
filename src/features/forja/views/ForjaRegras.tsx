/**
 * Forja de Hefesto — Aba: Regras
 * Conteúdo editável via CMS (Firestore). Admin edita inline.
 */
import React from 'react';
import { ForjaViewProps } from '../types';
import { useForjaContent, useForjaPrizes } from '../hooks/useForjaContent';
import ForjaContentEditor from '../components/ForjaContentEditor';
import ForjaPremiacaoEditor from '../components/ForjaPremiacaoEditor';

export default function ForjaRegras({ discordUser, isAdmin }: ForjaViewProps) {
  const { data, loading } = useForjaContent('rules');
  const { data: prizes }  = useForjaPrizes();

  return (
    <section className="forja-view forja-view--regras">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>📜</span> Regras do Torneio</h2>
          <p className="forja-page-subtitle">Leia com atenção antes de se inscrever</p>
        </div>
      </div>

      {loading ? (
        <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
      ) : (
        <>
          {/* Conteúdo das regras */}
          {isAdmin ? (
            <ForjaContentEditor
              docId="rules"
              data={data}
              updatedBy={discordUser?.username ?? 'admin'}
            />
          ) : (
            <div className="forja-content-sections">
              {(data?.sections ?? []).map((s, i) => (
                <div key={i} className="forja-content-section">
                  <h3 className="forja-content-section__title">{s.title}</h3>
                  <div className="forja-content-section__body">
                    {s.content.split('\n').map((line, j) => (
                      <p key={j}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {(!data || data.sections.length === 0) && (
                <div className="forja-empty">
                  <span>📋</span>
                  <p>Regras em breve. Fique ligado no Discord!</p>
                </div>
              )}
            </div>
          )}

          {/* Premiação */}
          <div style={{ marginTop: '2.5rem' }}>
            <ForjaPremiacaoEditor
              data={prizes}
              updatedBy={discordUser?.username ?? 'admin'}
              readOnly={!isAdmin}
            />
          </div>

          {/* Seed default content button (só admin, sem conteúdo) */}
          {isAdmin && !data && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                className="forja-btn forja-btn--secondary"
                onClick={async () => {
                  const { seedDefaultContent } = await import('../services/forjaService');
                  await seedDefaultContent(discordUser?.username ?? 'admin');
                }}
              >
                🌱 Inicializar conteúdo padrão
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
