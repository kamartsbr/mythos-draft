import React, { useState, useEffect } from 'react';
import { ForjaViewProps } from '../types';
import { useForjaTeams } from '../hooks/useForjaTeams';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { DraftConfig } from '../../../types';
import { MAJOR_GODS } from '../../../data/gods';
import { FORJA_MAP_POOL } from '../../../constants';

export default function ForjaTabela({ isAdmin }: ForjaViewProps) {
  const { teams } = useForjaTeams();
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário Admin
  const [selectedTeamA, setSelectedTeamA] = useState('');
  const [selectedTeamB, setSelectedTeamB] = useState('');
  const [matchStage, setMatchStage] = useState<'GROUP' | 'PLAYOFFS_BO3' | 'PLAYOFFS_BO5'>('GROUP');
  const [matchGroup, setMatchGroup] = useState<string>('A');

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const q = query(
          collection(db, 'lobbies'),
          where('config.preset', '==', 'FORJA'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setLobbies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Erro ao buscar partidas Forja', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const handleCreateMatch = async () => {
    if (!selectedTeamA || !selectedTeamB || selectedTeamA === selectedTeamB) {
      alert('Selecione dois times diferentes.');
      return;
    }

    const teamA = teams.find(t => t.id === selectedTeamA);
    const teamB = teams.find(t => t.id === selectedTeamB);

    let numGames = 3;
    if (matchStage === 'PLAYOFFS_BO5') numGames = 5;

    const stageLabel = matchStage === 'GROUP' ? 'Fase de Grupos' : (matchStage === 'PLAYOFFS_BO3' ? 'Playoffs (BO3)' : 'Playoffs (BO5)');
    const matchName = `FdH ${stageLabel} - ${teamA?.team_name} x ${teamB?.team_name}`;

    const config: DraftConfig = {
      name: matchName,
      preset: 'FORJA',
      tournamentStage: matchStage,
      forjaTeamA: teamA?.id,
      forjaTeamB: teamB?.id,
      forjaGroupId: matchStage === 'GROUP' ? matchGroup : undefined,
      seriesType: matchStage === 'PLAYOFFS_BO5' ? 'BO5' : 'BO3',
      allowedMaps: FORJA_MAP_POOL,
      allowedPantheons: MAJOR_GODS.map(g => g.id),
      teamSize: 3,
      customGameCount: 3,
      mapBanCount: 0,
      banCount: 0,
      acePick: false,
      isExclusive: false,
      pickType: 'alternated',
      firstMapRandom: false,
      loserPicksNextMap: false,
      timerDuration: 60,
      mapTurnOrder: [],
      godTurnOrder: [],
      hasBans: false,
    };

    try {
      const docRef = await addDoc(collection(db, 'lobbies'), {
        config,
        status: 'waiting',
        hostId: null,
        guestId: null,
        hostConnected: false,
        guestConnected: false,
        spectators: [],
        createdAt: serverTimestamp(),
        currentGame: 1,
        teamAScore: 0,
        teamBScore: 0,
        currentTurnIndex: 0,
        seriesMaps: [],
        selectedMap: null,
        draftMapIndex: 0,
      });

      alert(`Partida criada com sucesso! ID: ${docRef.id}`);
      setSelectedTeamA('');
      setSelectedTeamB('');
      setSelectedMaps([]);
      // Refresh
      const snap = await getDocs(query(collection(db, 'lobbies'), where('config.preset', '==', 'FORJA'), orderBy('createdAt', 'desc')));
      setLobbies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const toggleMap = (mapId: string) => {
    setSelectedMaps(prev => 
      prev.includes(mapId) ? prev.filter(id => id !== mapId) : [...prev, mapId]
    );
  };

  return (
    <section className="forja-view">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>📊</span> Tabela & Partidas</h2>
          <p className="forja-page-subtitle">Acompanhe os resultados da Fase de Grupos e Playoffs.</p>
        </div>
      </div>

      {isAdmin && (
        <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #1e293b', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>⚙️ Criar Lobby Oficial de Partida</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="forja-reg-label">Time A (Host)</label>
              <select className="forja-reg-input" value={selectedTeamA} onChange={e => setSelectedTeamA(e.target.value)}>
                <option value="">Selecione...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
            </div>
            <div>
              <label className="forja-reg-label">Time B (Guest)</label>
              <select className="forja-reg-input" value={selectedTeamB} onChange={e => setSelectedTeamB(e.target.value)}>
                <option value="">Selecione...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
            </div>
            <div>
              <label className="forja-reg-label">Fase</label>
              <select className="forja-reg-input" value={matchStage} onChange={e => setMatchStage(e.target.value as any)}>
                <option value="GROUP">Fase de Grupos (Bo3)</option>
                <option value="PLAYOFFS_BO3">Playoffs (Bo3)</option>
                <option value="PLAYOFFS_BO5">Playoffs (Bo5)</option>
              </select>
            </div>
            {matchStage === 'GROUP' && (
              <div>
                <label className="forja-reg-label">Grupo</label>
                <select className="forja-reg-input" value={matchGroup} onChange={e => setMatchGroup(e.target.value)}>
                  {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>Grupo {g}</option>)}
                </select>
              </div>
            )}
          </div>



          <button className="forja-btn forja-btn--primary" onClick={handleCreateMatch}>
            ⚔️ Gerar Lobby
          </button>
        </div>
      )}

      {loading ? (
        <div className="forja-empty"><div className="forja-loader-spinner"/></div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {['A', 'B', 'C', 'D'].map(group => {
            const groupLobbies = lobbies.filter(l => l.config.tournamentStage === 'GROUP' && l.config.forjaGroupId === group);
            if (groupLobbies.length === 0) return null;
            return (
              <div key={group}>
                <h3 style={{ fontSize: '1.2rem', color: '#facc15', marginBottom: '1rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', paddingBottom: '0.5rem' }}>
                  Grupo {group}
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {groupLobbies.map(lobby => (
                    <div key={lobby.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ color: '#f8fafc', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{lobby.config.name}</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                          Status: <span style={{ color: lobby.status === 'completed' ? '#4ade80' : '#facc15' }}>{lobby.status}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {lobby.status === 'completed' ? (
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            <span style={{ color: lobby.teamAScore > lobby.teamBScore ? '#4ade80' : '#f87171' }}>{lobby.teamAScore}</span>
                            <span style={{ color: '#64748b', margin: '0 0.5rem' }}>x</span>
                            <span style={{ color: lobby.teamBScore > lobby.teamAScore ? '#4ade80' : '#f87171' }}>{lobby.teamBScore}</span>
                          </div>
                        ) : (
                          <a href={`/lobby/${lobby.id}`} target="_blank" rel="noreferrer" className="forja-btn forja-btn--primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                            Entrar na Lobby
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Playoffs Lobbies */}
          {(() => {
            const playoffLobbies = lobbies.filter(l => l.config.tournamentStage !== 'GROUP');
            if (playoffLobbies.length === 0) return null;
            return (
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#facc15', marginBottom: '1rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', paddingBottom: '0.5rem' }}>
                  Playoffs
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {playoffLobbies.map(lobby => (
                    <div key={lobby.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ color: '#f8fafc', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{lobby.config.name}</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                          Status: <span style={{ color: lobby.status === 'completed' ? '#4ade80' : '#facc15' }}>{lobby.status}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {lobby.status === 'completed' ? (
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            <span style={{ color: lobby.teamAScore > lobby.teamBScore ? '#4ade80' : '#f87171' }}>{lobby.teamAScore}</span>
                            <span style={{ color: '#64748b', margin: '0 0.5rem' }}>x</span>
                            <span style={{ color: lobby.teamBScore > lobby.teamAScore ? '#4ade80' : '#f87171' }}>{lobby.teamBScore}</span>
                          </div>
                        ) : (
                          <a href={`/lobby/${lobby.id}`} target="_blank" rel="noreferrer" className="forja-btn forja-btn--primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                            Entrar na Lobby
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {lobbies.length === 0 && (
            <div className="forja-empty">
              <span>🏟️</span>
              <p>Nenhuma partida agendada ainda.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
