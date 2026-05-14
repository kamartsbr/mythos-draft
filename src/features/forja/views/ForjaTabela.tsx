import React, { useState, useEffect, useMemo } from 'react';
import { ForjaViewProps, ForjaTeam, ForjaPlayer } from '../types';
import { useForjaTeams } from '../hooks/useForjaTeams';
import { useForjaPlayers } from '../hooks/useForjaPlayers';
import { db } from '../../../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { LobbyConfig, Lobby } from '../../../types';
import { MAJOR_GODS } from '../../../data/gods';
import { FORJA_MAP_POOL, getMCLPicks } from '../../../constants';
import { updateTeamGroup, deleteForjaLobby } from '../services/forjaService';
import { lobbyService, generateId } from '../../../services/lobbyService';

/**
 * Render the Forja tournament standings, scheduled matches, and administrative controls.
 *
 * Displays group tables, group and playoff match lists, and live match statuses. When `isAdmin` is true,
 * exposes UI to manage team group assignments, create official Forja lobbies with a generated match name and config,
 * and remove existing Forja matches. The component subscribes to Forja lobbies in Firestore and updates the view in real time.
 *
 * @param isAdmin - Whether the current user has admin privileges; enables management UI when true
 * @returns A React element containing standings, match lists, and optional admin interfaces
 */
export default function ForjaTabela({ isAdmin }: ForjaViewProps) {
  const { teams } = useForjaTeams(true);
  const { rankedPlayers } = useForjaPlayers(true);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário Admin
  const [selectedTeamA, setSelectedTeamA] = useState('');
  const [selectedTeamB, setSelectedTeamB] = useState('');
  const [matchStage, setMatchStage] = useState<'GROUP' | 'PLAYOFFS_BO3' | 'PLAYOFFS_BO5'>('GROUP');
  const [matchGroup, setMatchGroup] = useState<string>('A');
  
  // 🚨 NOVOS ESTADOS PARA NOMENCLATURA INTELIGENTE
  const [groupRound, setGroupRound] = useState<string>('1');
  const [playoffRound, setPlayoffRound] = useState<string>('Quartas');

  // Gestão de Grupos
  const [isManagingGroups, setIsManagingGroups] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'lobbies'),
      where('config.preset', '==', 'FORJA'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filtrar apenas partidas oficiais
        setLobbies(docs.filter((d: any) => d.config?.isOfficialForjaMatch || d.config?.forjaTeamA));
        setLoading(false);
      },
      err => {
        console.error('Erro ao buscar partidas Forja', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const calculateStandings = (groupId: string) => {
    const groupTeams = teams.filter(t => t.groupId === groupId);
    const groupLobbies = lobbies.filter(l => l.config.tournamentStage === 'GROUP' && l.config.forjaGroupId === groupId && l.status === 'completed');

    const standings = groupTeams.map(team => {
      let gamesWon = 0;
      let gamesLost = 0;
      let matchesPlayed = 0;

      groupLobbies.forEach(lobby => {
        if (lobby.config.forjaTeamA === team.id) {
          gamesWon += (lobby.teamAScore || 0);
          gamesLost += (lobby.teamBScore || 0);
          matchesPlayed++;
        } else if (lobby.config.forjaTeamB === team.id) {
          gamesWon += (lobby.teamBScore || 0);
          gamesLost += (lobby.teamAScore || 0);
          matchesPlayed++;
        }
      });

      return {
        ...team,
        gamesWon,
        gamesLost,
        matchesPlayed,
        points: gamesWon
      };
    });

    return standings.sort((a, b) => b.points - a.points || (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost));
  };

  // ==========================================
  // LÓGICA DE UX: FILTROS E AUTO-SWAP (JUIZ)
  // ==========================================

  useEffect(() => {
    setSelectedTeamA('');
    setSelectedTeamB('');
  }, [matchGroup, matchStage]);

  const availableTeamsForA = useMemo(() => {
    if (matchStage === 'GROUP') {
      return teams.filter(t => t.groupId === matchGroup);
    }
    return teams;
  }, [teams, matchGroup, matchStage]);

  const availableTeamsForB = useMemo(() => {
    return availableTeamsForA.filter(t => t.id !== selectedTeamA);
  }, [availableTeamsForA, selectedTeamA]);

  useEffect(() => {
    if (selectedTeamA && selectedTeamB && matchStage === 'GROUP') {
      const standings = calculateStandings(matchGroup);
      const teamAData = standings.find(t => t.id === selectedTeamA);
      const teamBData = standings.find(t => t.id === selectedTeamB);

      if (teamAData && teamBData) {
        const teamBIsBetter = 
          teamBData.points > teamAData.points || 
          (teamBData.points === teamAData.points && (teamBData.gamesWon - teamBData.gamesLost) > (teamAData.gamesWon - teamAData.gamesLost));

        if (teamBIsBetter) {
          setSelectedTeamA(selectedTeamB);
          setSelectedTeamB(selectedTeamA);
        }
      }
    }
  }, [selectedTeamA, selectedTeamB, matchGroup, matchStage, lobbies, teams]);

  // ==========================================
  // CRIAÇÃO DO LOBBY COM NOME DINÂMICO
  // ==========================================
  const handleCreateMatch = async () => {
    if (!selectedTeamA || !selectedTeamB || selectedTeamA === selectedTeamB) {
      alert('Selecione dois times diferentes.');
      return;
    }

    const teamA = teams.find(t => t.id === selectedTeamA);
    const teamB = teams.find(t => t.id === selectedTeamB);

    // 🚨 Geração do Nome Bonito 
    let matchName = '';
    if (matchStage === 'GROUP') {
      // Ex: GrC - R1 - Time Host x Time Guest
      matchName = `Gr${matchGroup} - R${groupRound} - ${teamA?.team_name} x ${teamB?.team_name}`;
    } else {
      // Ex: Quartas - Time Host x Time Guest
      matchName = `${playoffRound} - ${teamA?.team_name} x ${teamB?.team_name}`;
    }

    const isPlayoffs = matchStage !== 'GROUP';

    const config: LobbyConfig = {
      name: matchName,
      preset: 'FORJA',
      isOfficialForjaMatch: true,
      tournamentStage: matchStage,
      forjaTeamA: teamA?.id,
      forjaTeamB: teamB?.id,
      forjaGroupId: matchStage === 'GROUP' ? matchGroup : undefined,
      seriesType: matchStage === 'GROUP' ? '3G' : (matchStage === 'PLAYOFFS_BO5' ? 'BO5' : 'BO3'),
      teamSize: 3,
      customGameCount: matchStage === 'GROUP' ? 3 : (matchStage === 'PLAYOFFS_BO5' ? 5 : 3),
      pickType: 'alternated',
      isExclusive: true, // Official Forja is Exclusive
      hasBans: false,
      banCount: 0,
      mapBanCount: 0,
      mapTurnOrder: [],
      godTurnOrder: [],
      allowedMaps: FORJA_MAP_POOL,
      allowedPantheons: MAJOR_GODS.map(g => g.id),
      firstMapRandom: false,
      loserPicksNextMap: false,
      acePick: false,
      acePickHidden: false,
      isPrivate: false,
      timerDuration: 60,
      hasMap3RandomRoll: true,
      hasPerMapBans: isPlayoffs,
    };

    const id = generateId();
    const lobby: Lobby = {
      id,
      status: 'waiting',
      phase: 'waiting',
      captain1: null,
      captain2: null,
      captain1Name: '',
      captain2Name: null,
      teamAPlayers: [],
      teamBPlayers: [],
      readyA: false,
      readyB: false,
      readyA_report: false,
      readyB_report: false,
      readyA_nextGame: false,
      readyB_nextGame: false,
      rosterChangedA: false,
      rosterChangedB: false,
      lastSubs: [],
      resetRequest: null,
      spectators: [],
      config,
      selectedMap: null,
      seriesMaps: ['', '', ''],
      mapBans: [],
      turn: 0,
      turnOrder: [],
      bans: [],
      picks: getMCLPicks(1, null, null),
      scoreA: 0,
      scoreB: 0,
      reportVoteA: null,
      reportVoteB: null,
      voteConflict: false,
      voteConflictCount: 0,
      currentGame: 1,
      pickerVoteA: null,
      pickerVoteB: null,
      pickerPlayerA: null,
      pickerPlayerB: null,
      history: [],
      replayLog: [],
      lastWinner: null,
      mapPool: [],
      timerStart: serverTimestamp() as any,
      createdAt: serverTimestamp() as any,
      lastActivityAt: serverTimestamp() as any,
      hiddenActions: [],
    };

    try {
      await lobbyService.createLobby(id, lobby);

      alert(`Partida criada com sucesso!`);
      setSelectedTeamA('');
      setSelectedTeamB('');
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteMatch = async (lobbyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta partida? Esta ação é irreversível.')) return;
    try {
      await deleteForjaLobby(lobbyId);
      // onSnapshot listener will update the list automatically
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`);
    }
  };

  const handleUpdateTeamGroup = async (teamId: string, groupId: string) => {
    try {
      await updateTeamGroup(teamId, groupId === 'none' ? null : groupId);
    } catch (err: any) {
      alert(`Erro ao atualizar grupo: ${err.message}`);
    }
  };

  return (
    <section className="forja-view">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title"><span>📊</span> Tabela & Partidas</h2>
          <p className="forja-page-subtitle">Acompanhe os resultados da Fase de Grupos e Playoffs.</p>
        </div>
        {isAdmin && (
          <button 
            className={`forja-btn ${isManagingGroups ? 'forja-btn--secondary' : 'forja-btn--ghost'}`}
            onClick={() => setIsManagingGroups(!isManagingGroups)}
          >
            {isManagingGroups ? '✓ Fechar Gestão' : '⚙️ Organizar Grupos'}
          </button>
        )}
      </div>

      {isAdmin && isManagingGroups && (
        <div style={{ background: 'rgba(30,41,59,0.5)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #334155', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#facc15', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Distribuição de Times nos Grupos
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {teams.sort((a,b) => a.team_name.localeCompare(b.team_name)).map(team => (
              <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500 }}>{team.team_name}</span>
                <select 
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.75rem', borderRadius: '0.3rem', padding: '0.2rem' }}
                  value={team.groupId || 'none'}
                  onChange={e => handleUpdateTeamGroup(team.id, e.target.value)}
                >
                  <option value="none">— Sem Grupo —</option>
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                  <option value="C">Grupo C</option>
                  <option value="D">Grupo D</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && !isManagingGroups && (
        <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #1e293b', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>⚙️ Criar Lobby Oficial de Partida</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* LINHA 1: Fase e Rodada/Etapa */}
            <div>
              <label className="forja-reg-label">Fase do Torneio</label>
              <select className="forja-reg-input" value={matchStage} onChange={e => setMatchStage(e.target.value as any)}>
                <option value="GROUP">Fase de Grupos (3 Games)</option>
                <option value="PLAYOFFS_BO3">Playoffs (Bo3)</option>
                <option value="PLAYOFFS_BO5">Playoffs (Bo5)</option>
              </select>
            </div>
            
            {matchStage === 'GROUP' ? (
              <>
                <div>
                  <label className="forja-reg-label">Grupo</label>
                  <select className="forja-reg-input" value={matchGroup} onChange={e => setMatchGroup(e.target.value)}>
                    {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>Grupo {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="forja-reg-label">Rodada</label>
                  <select className="forja-reg-input" value={groupRound} onChange={e => setGroupRound(e.target.value)}>
                    {['1', '2', '3', '4', '5', 'Desempate'].map(r => <option key={r} value={r}>Rodada {r}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="forja-reg-label">Etapa do Playoff</label>
                  <select className="forja-reg-input" value={playoffRound} onChange={e => setPlayoffRound(e.target.value)}>
                    <option value="Oitavas">Oitavas de Final</option>
                    <option value="Quartas">Quartas de Final</option>
                    <option value="Semi">Semifinal</option>
                    <option value="3º Lugar">Disputa de 3º Lugar</option>
                    <option value="Final">Grande Final</option>
                  </select>
                </div>
                <div></div> {/* Espaçador */}
              </>
            )}

            {/* LINHA 2: Times */}
            <div>
              <label className="forja-reg-label">Time A (Host)</label>
              <select className="forja-reg-input" value={selectedTeamA} onChange={e => setSelectedTeamA(e.target.value)}>
                <option value="">Selecione...</option>
                {availableTeamsForA.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
            </div>
            <div>
              <label className="forja-reg-label">Time B (Guest)</label>
              <select 
                className="forja-reg-input" 
                value={selectedTeamB} 
                onChange={e => setSelectedTeamB(e.target.value)}
                disabled={!selectedTeamA}
              >
                <option value="">{selectedTeamA ? 'Selecione...' : 'Escolha o Time A primeiro'}</option>
                {availableTeamsForB.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
            </div>
            <div></div> {/* Espaçador */}
          </div>

          <button className="forja-btn forja-btn--primary" onClick={handleCreateMatch}>
            ⚔️ Gerar Lobby
          </button>
        </div>
      )}

      {loading ? (
        <div className="forja-empty"><div className="forja-loader-spinner"/></div>
      ) : (
        <div style={{ display: 'grid', gap: '3rem' }}>
          {['A', 'B', 'C', 'D'].map(group => {
            const standings = calculateStandings(group);
            const groupLobbies = lobbies.filter(l => l.config.tournamentStage === 'GROUP' && l.config.forjaGroupId === group);
            
            if (standings.length === 0 && groupLobbies.length === 0) return null;

            return (
              <div key={group} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
                {/* Standings Table */}
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#facc15', marginBottom: '1rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', paddingBottom: '0.5rem' }}>
                    Classificação - Grupo {group}
                  </h3>
                  <div style={{ background: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #1e293b' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ background: '#1e293b', color: '#94a3b8' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Time</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>J</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>G+</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>G-</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', color: '#facc15' }}>Pts</th>
                        </tr>
                      </thead>
                      <tbody style={{ color: '#cbd5e1' }}>
                        {standings.map((row, idx) => {
                          const isTop2 = idx < 2;
                          const captain = rankedPlayers.find(p => p.discord_id === row.captain_id);
                          const captainNick = captain ? captain.nick : '...';

                          return (
                            <tr 
                              key={row.id} 
                              style={{ 
                                borderBottom: '1px solid #1e293b',
                                background: isTop2 ? 'rgba(74, 222, 128, 0.05)' : undefined,
                                borderLeft: isTop2 ? '4px solid #4ade80' : '4px solid transparent'
                              }}
                            >
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                 <span style={{ marginRight: '0.5rem', opacity: 0.5 }}>{idx + 1}.</span>
                                 <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 400, marginRight: '0.5rem' }}>
                                   [{captainNick}]
                                 </span>
                                 {row.team_name}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>{row.matchesPlayed}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', color: '#4ade80' }}>{row.gamesWon}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', color: '#f87171' }}>{row.gamesLost}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#facc15' }}>{row.points}</td>
                            </tr>
                          );
                        })}
                        {standings.length === 0 && (
                          <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Nenhum time atribuído a este grupo.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Match List */}
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#facc15', marginBottom: '1rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', paddingBottom: '0.5rem' }}>
                    Partidas - Grupo {group}
                  </h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {groupLobbies.map(lobby => (
                      <div key={lobby.id} style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                        <div>
                          <h4 style={{ color: '#f8fafc', fontWeight: 600, margin: '0 0 0.15rem 0', fontSize: '0.9rem' }}>{lobby.config.name}</h4>
                          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>
                            Status: <span style={{ color: lobby.status === 'completed' ? '#4ade80' : '#facc15' }}>{lobby.status}</span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {lobby.status === 'completed' ? (
                            <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                              <span style={{ color: lobby.teamAScore > lobby.teamBScore ? '#4ade80' : '#f87171' }}>{lobby.teamAScore}</span>
                              <span style={{ color: '#475569', margin: '0 0.4rem' }}>x</span>
                              <span style={{ color: lobby.teamBScore > lobby.teamAScore ? '#4ade80' : '#f87171' }}>{lobby.teamBScore}</span>
                            </div>
                          ) : (
                            <a href={`/lobby/${lobby.id}`} target="_blank" rel="noreferrer" className="forja-btn forja-btn--primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                              Lobby
                            </a>
                          )}
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteMatch(lobby.id)}
                              className="forja-btn forja-btn--ghost"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#f87171' }}
                              title="Remover Partida"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {groupLobbies.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', padding: '1rem' }}>Sem partidas criadas.</p>}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Playoffs Section */}
          {(() => {
            const playoffLobbies = lobbies.filter(l => l.config.tournamentStage !== 'GROUP');
            if (playoffLobbies.length === 0) return null;
            return (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#facc15', marginBottom: '1rem', borderBottom: '1px solid rgba(250, 204, 21, 0.2)', paddingBottom: '0.5rem' }}>
                  Playoffs
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
                  {playoffLobbies.map(lobby => (
                    <div key={lobby.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                      <div>
                        <h4 style={{ color: '#f8fafc', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{lobby.config.name}</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                          Status: <span style={{ color: lobby.status === 'completed' ? '#4ade80' : '#facc15' }}>{lobby.status}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {lobby.status === 'completed' ? (
                          <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>
                            <span style={{ color: lobby.teamAScore > lobby.teamBScore ? '#4ade80' : '#f87171' }}>{lobby.teamAScore}</span>
                            <span style={{ color: '#475569', margin: '0 0.5rem' }}>x</span>
                            <span style={{ color: lobby.teamBScore > lobby.teamAScore ? '#4ade80' : '#f87171' }}>{lobby.teamBScore}</span>
                          </div>
                        ) : (
                          <a href={`/lobby/${lobby.id}`} target="_blank" rel="noreferrer" className="forja-btn forja-btn--primary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>
                            Lobby
                          </a>
                        )}
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteMatch(lobby.id)}
                              className="forja-btn forja-btn--ghost"
                              style={{ padding: '0.5rem 0.75rem', color: '#f87171' }}
                              title="Remover Partida"
                            >
                              🗑️
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {lobbies.length === 0 && !isManagingGroups && (
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