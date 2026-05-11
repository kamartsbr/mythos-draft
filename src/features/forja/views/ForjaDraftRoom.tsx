/**
 * Forja de Hefesto — Sala de Draft (Capitão)
 * Vista para o Capitão fazer seus picks em tempo real.
 * Visível apenas para capitães logados + admin.
 */
import React, { useEffect, useMemo } from 'react';
import { ForjaViewProps, ForjaPlayer } from '../types';
import { useForjaPlayers }      from '../hooks/useForjaPlayers';
import { useForjaTeams }            from '../hooks/useForjaTeams';
import { useForjaDraftSession } from '../hooks/useForjaDraftSession';
import { makeDraftPick, updateCaptainPresence } from '../services/forjaService';

const PRESENCE_INTERVAL_MS = 120_000; // 🚨 CORRIGIDO: Agora pulsa a cada 2 minutos

// ─── Online indicator ─────────────────────────────────────────────────────────
function OnlineDot({ lastSeenMs }: { lastSeenMs?: number }) {
  const isOnline = lastSeenMs && Date.now() - lastSeenMs < 150_000; // Ajustado visualmente para combinar com o novo tempo
  return (
    <span
      title={isOnline ? 'Online' : 'Offline'}
      style={{
        display: 'inline-block', width: '0.6rem', height: '0.6rem',
        borderRadius: '50%', background: isOnline ? '#4ade80' : '#475569',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Pick Card (ATUALIZADO COM ELO EFETIVO) ───────────────────────────────────
function PickCard({ player, onPick, disabled }: {
  player: ForjaPlayer;
  onPick: () => void;
  disabled: boolean;
}) {
  const [imgErr, setImgErr] = React.useState(false);
  const fallback = `https://cdn.discordapp.com/embed/avatars/${parseInt(player.discord_id.slice(-1)) % 6}.png`;
  const tierColor = player.tier === 'B' ? '#60a5fa' : player.tier === 'C' ? '#94a3b8' : '#facc15';

  // Cálculo da Média para o Draft
  const effectiveElo = (player as any).elo_efetivo || Math.round(((player.elo_1v1 || 0) + (player.elo_tg || 0)) / 2);

  return (
    <div className={`forja-draft-room-card ${disabled ? 'forja-draft-room-card--disabled' : ''}`}>
      <img
        src={imgErr ? fallback : player.avatar_url}
        alt={player.nick}
        onError={() => setImgErr(true)}
        referrerPolicy="no-referrer"
        className="forja-draft-room-card__avatar"
      />
      <div className="forja-draft-room-card__info">
        <span className="forja-draft-room-card__nick">{player.nick}</span>
        <span style={{ fontSize: '0.7rem', color: tierColor, fontWeight: 700 }}>Tier {player.tier}</span>
        
        {/* Display de Elos Otimizado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
          <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800 }}>
            Média: {effectiveElo || '—'}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#475569' }}>
            1v1: {player.elo_1v1 || '—'} | TG: {player.elo_tg || '—'}
          </span>
        </div>
      </div>
      <button
        className="forja-btn forja-btn--primary"
        style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', flexShrink: 0 }}
        onClick={onPick}
        disabled={disabled}
      >
        ✓ Escolher
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForjaDraftRoom({ discordUser, isAdmin }: ForjaViewProps) {
  const { rankedPlayers: players, loading: playersLoading } = useForjaPlayers();
  const { teams }                               = useForjaTeams(true);
  const { session, loading: sessionLoading } = useForjaDraftSession();

  // 🚨 CORRIGIDO: Fim do Loop Infinito de Leituras e Gravações 🚨
  useEffect(() => {
    // Sai rápido se não tivermos a identificação do usuário
    if (!discordUser?.discord_id) return;
    
    const myId = discordUser.discord_id;
    
    // Atualiza a presença na entrada da sala
    updateCaptainPresence(myId);
    
    // Configura o relógio num intervalo longo e seguro
    const interval = setInterval(() => updateCaptainPresence(myId), PRESENCE_INTERVAL_MS);
    
    // Limpeza do relógio ao sair da tela
    return () => clearInterval(interval);
  }, [discordUser?.discord_id]); // A variável 'session' foi removida das dependências para não triggar loop

  const playerMap = useMemo(() => {
    const m: Record<string, ForjaPlayer> = {};
    players.forEach(p => { m[p.discord_id] = p; });
    return m;
  }, [players]);

  // Time do capitão logado
  const myTeam = discordUser
    ? teams.find(t => t.captain_id === discordUser.discord_id)
    : undefined;

  const isMyTurn = session && myTeam
    ? session.current_team_id === myTeam.id
    : false;

  // Jogadores disponíveis do tier atual
  const expectedTier = session?.current_round ?? 'B';
  const availableForPick = players.filter(
    p => p.status === 'available' && (p as any).computedTier === expectedTier
  );

  const handlePick = async (player: ForjaPlayer) => {
    if (!session) return;
    try {
      await makeDraftPick(session, player, false);
    } catch (e: any) {
      alert('Erro ao fazer pick: ' + e.message);
    }
  };

  // Permissão: capitão do time OU admin
  const isCaptain = !!myTeam;
  const canAccess = isAdmin || isCaptain;

  if (!discordUser) {
    return (
      <section className="forja-view">
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>🔑</span>
          <p>Faça login com Discord para acessar a Sala de Draft.</p>
        </div>
      </section>
    );
  }

  if (!canAccess) {
    return (
      <section className="forja-view">
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <p>Acesso restrito aos Capitães e ao Administrador.</p>
        </div>
      </section>
    );
  }

  if (sessionLoading) {
    return <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>;
  }

  if (!session) {
    return (
      <section className="forja-view">
        <div className="forja-empty">
          <span style={{ fontSize: '3rem' }}>⏳</span>
          <p>O Draft ainda não começou. Aguarde o Admin iniciar às <strong>15h do sábado</strong>.</p>
        </div>
      </section>
    );
  }

  const currentTeam = teams.find(t => t.id === session.current_team_id);

  return (
    <section className="forja-view forja-view--draft-room">
      <div className="forja-page-header">
        <div>
          <h2 className="forja-page-title">
            <span>🎯</span> Sala de Draft
            {isMyTurn && <span className="forja-draft-room-your-turn">SUA VEZ!</span>}
          </h2>
          <p className="forja-page-subtitle">
            Rodada <strong>{session.current_round}</strong> · Pick #{session.current_pick_index + 1} de {session.pick_order_sequence.length}
            {myTeam && ` · Você: ${myTeam.team_name}`}
          </p>
        </div>
      </div>

      {/* Status da vez */}
      <div className={`forja-draft-room-status ${isMyTurn ? 'forja-draft-room-status--myturn' : ''}`}>
        {session.status === 'completed' ? (
          <span style={{ color: '#4ade80', fontWeight: 700 }}>🏆 Draft concluído!</span>
        ) : (
          <>
            <OnlineDot lastSeenMs={session.captain_presences?.[currentTeam?.captain_id ?? ''] ?? 0} />
            <span>
              Aguardando: <strong style={{ color: '#f59e0b' }}>
                {currentTeam?.team_name ?? '...'}
              </strong>
              {' '}(Cap: {playerMap[currentTeam?.captain_id ?? '']?.nick ?? '—'})
            </span>
            {isMyTurn && <span style={{ color: '#4ade80', fontWeight: 700, marginLeft: 'auto' }}>← ESCOLHA UM JOGADOR</span>}
          </>
        )}
      </div>

      {/* Presença dos capitães */}
      <div className="forja-draft-room-presences">
        {teams.map(team => {
          const cap = playerMap[team.captain_id];
          const lastSeen = session.captain_presences?.[team.captain_id] ?? 0;
          return (
            <div key={team.id} className="forja-draft-room-presence-item">
              <OnlineDot lastSeenMs={lastSeen} />
              <span>{team.team_name}</span>
              <span style={{ color: '#475569', fontSize: '0.68rem' }}>({cap?.nick ?? '—'})</span>
            </div>
          );
        })}
      </div>

      {/* Pool de jogadores disponíveis */}
      {session.status === 'active' && (
        <div className="forja-draft-room-pool">
          <h3 className="forja-section-title" style={{ marginBottom: '1rem' }}>
            <span>{expectedTier === 'B' ? '🔵' : '⚪'}</span>
            Jogadores Tier {expectedTier} disponíveis ({availableForPick.length})
          </h3>
          {playersLoading ? (
            <div className="forja-tab-loader"><div className="forja-loader-spinner" /></div>
          ) : availableForPick.length === 0 ? (
            <div className="forja-empty" style={{ minHeight: '150px' }}>
              <p>Nenhum jogador Tier {expectedTier} disponível.</p>
            </div>
          ) : (
            <div className="forja-draft-room-cards">
              {availableForPick.map(player => (
                <PickCard
                  key={player.discord_id}
                  player={player}
                  onPick={() => handlePick(player)}
                  disabled={(!isMyTurn && !isAdmin) || session.status !== 'active'}
                />
              ))}
            </div>
          )}
          {!isMyTurn && !isAdmin && session.status === 'active' && (
            <p className="forja-reg-hint" style={{ textAlign: 'center', marginTop: '1rem' }}>
              Aguarde sua vez para fazer um pick.
            </p>
          )}
        </div>
      )}

      {/* Times em formação */}
      <div className="forja-draft-room-teams">
        {teams.map(team => {
          const members = team.members.map(id => playerMap[id]).filter(Boolean);
          return (
            <div key={team.id} className={`forja-draft-room-team ${team.id === session.current_team_id ? 'forja-draft-room-team--active' : ''}`}>
              <strong>{team.team_name}</strong>
              {members.map(m => (
                <span key={m.discord_id} className="forja-draft-room-team-member">
                  <img src={m.avatar_url} alt={m.nick} referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {m.nick}
                  {m.discord_id === team.captain_id && ' 👑'}
                </span>
              ))}
              {members.length < 3 && (
                <span className="forja-draft-room-team-empty">
                  {3 - members.length} slot(s) restante(s)
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}