import React from 'react';
import { Trophy, X } from 'lucide-react';
import { Lobby } from '../../types';
import { MAJOR_GODS, MAPS } from '../../constants';
import { cn } from '../../lib/utils';

interface DraftResultCardProps {
  lobby: Lobby;
  t: any;
  cardRef: React.RefObject<HTMLDivElement | null>;
}

const getProxyUrl = (url: string | undefined) => {
  if (!url) return '';
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}`;
};

export function DraftResultCard({ lobby, t, cardRef }: DraftResultCardProps) {
  const isFinished = lobby.status === 'finished';
  const currentMap = MAPS.find(m => m.id === lobby.selectedMap);
  
  const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
  const replayLog = Array.isArray(lobby.replayLog) ? lobby.replayLog : [];
  const history = Array.isArray(lobby.history) ? lobby.history : [];

  // If finished, we show a wider card with all games
  const gameRows = Math.ceil(history.length / 3);
  const cardWidth = isFinished ? '1200px' : '800px';
  // Base height (header + score + footer) + rows of games
  // Increased base and row height to prevent cut-off
  const cardHeight = isFinished 
    ? `${500 + (gameRows * 350)}px` 
    : '600px';

  // Extract bans from replayLog
  const teamABans = replayLog.filter(step => step.action === 'BAN' && step.target === 'GOD' && step.player === 'A').map(step => step.id);
  const teamBBans = replayLog.filter(step => step.action === 'BAN' && step.target === 'GOD' && step.player === 'B').map(step => step.id);
  
  const teamAMapBans = replayLog.filter(step => step.action === 'BAN' && step.target === 'MAP' && step.player === 'A').map(step => step.id);
  const teamBMapBans = replayLog.filter(step => step.action === 'BAN' && step.target === 'MAP' && step.player === 'B').map(step => step.id);

  return (
    <div 
      ref={cardRef}
      style={{ 
        width: cardWidth, 
        height: cardHeight, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#020617',
        color: 'white',
        padding: isFinished ? '60px' : '40px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'visible'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex flex-col">
          <h1 className={cn("font-black text-white uppercase tracking-tighter", isFinished ? "text-6xl" : "text-4xl")}>MYTHOS DRAFT</h1>
          <p className="text-amber-500 font-bold uppercase tracking-[0.3em] text-xs">AGE OF MYTHOLOGY: RETOLD</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-slate-500 font-black uppercase tracking-widest text-xs">
              {isFinished 
                ? `${lobby.config.seriesType} ${t.series} • ${t.seriesConcluded}` 
                : `${t.game} ${lobby.currentGame} / ${lobby.config.seriesType}`}
            </span>
          </div>
        </div>
      </div>

      {isFinished ? (
        <div className="flex-1 flex flex-col gap-12">
          {/* Series Score Summary */}
          <div className="flex items-center justify-center gap-16 bg-slate-900/40 border border-slate-800/50 rounded-[40px] p-10">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-black text-blue-500 uppercase tracking-[0.3em]">{t.teamA}</span>
              <h2 className="text-4xl font-black text-white uppercase tracking-tight whitespace-nowrap">
                {lobby.captain1Name || t.roleHost}
              </h2>
              {teamAMapBans.length > 0 && (
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.mapBans || 'MAP BANS'}</span>
                  <div className="flex gap-2">
                    {teamAMapBans.map((mapId, i) => {
                      const map = MAPS.find(m => m.id === mapId);
                      return (
                        <div key={i} className="relative w-16 h-10 rounded-md overflow-hidden border border-red-500/30">
                          <img src={getProxyUrl(map?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60">
                            <X className="absolute inset-0 m-auto w-6 h-6 text-red-500/50" strokeWidth={3} />
                            <span className="relative z-10 text-[6px] font-black text-red-100 uppercase tracking-tighter text-center leading-none px-1 drop-shadow-md">
                              {t.mapNames?.[mapId] || map?.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-10">
              <div className="text-8xl font-black text-blue-500 tabular-nums drop-shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                {lobby.scoreA}
              </div>
              <div className="text-3xl font-black text-slate-800 italic uppercase">VS</div>
              <div className="text-8xl font-black text-red-500 tabular-nums drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                {lobby.scoreB}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-black text-red-500 uppercase tracking-[0.3em]">{t.teamB}</span>
              <h2 className="text-4xl font-black text-white uppercase tracking-tight whitespace-nowrap">
                {lobby.captain2Name || t.roleGuest}
              </h2>
              {teamBMapBans.length > 0 && (
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.mapBans || 'MAP BANS'}</span>
                  <div className="flex gap-2">
                    {teamBMapBans.map((mapId, i) => {
                      const map = MAPS.find(m => m.id === mapId);
                      return (
                        <div key={i} className="relative w-16 h-10 rounded-md overflow-hidden border border-red-500/30">
                          <img src={getProxyUrl(map?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60">
                            <X className="absolute inset-0 m-auto w-6 h-6 text-red-500/50" strokeWidth={3} />
                            <span className="relative z-10 text-[6px] font-black text-red-100 uppercase tracking-tighter text-center leading-none px-1 drop-shadow-md">
                              {t.mapNames?.[mapId] || map?.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-3 gap-6">
            {history.map((game, idx) => {
              const map = MAPS.find(m => m.id === game.mapId);
              return (
                <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
                  <div className="relative h-28">
                    <img src={getProxyUrl(map?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t.game} {idx + 1}</div>
                      <div className="text-sm font-bold text-white uppercase tracking-tight">{t.mapNames?.[game.mapId] || map?.name}</div>
                    </div>
                    <div className={cn(
                      "absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center border-2",
                      game.winner === 'A' ? "bg-blue-500/20 border-blue-500 text-blue-500" : "bg-red-500/20 border-red-500 text-red-500"
                    )}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                      </svg>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Team A Picks */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{lobby.captain1Name || t.teamA}</span>
                          {game.winner === 'A' && <Trophy className="w-3 h-3 text-amber-500" />}
                        </div>
                        {game.winner === 'A' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {game.picksA.map((godId, gIdx) => {
                            const god = MAJOR_GODS.find(g => g.id === godId);
                            // For finished games, we need to get the player name from rosterA
                            // If rosterA is not available, fallback to P1, P2, etc.
                            const playerName = game.rosterA?.[gIdx]?.playerName || `P${gIdx + 1}`;
                            return (
                              <div key={gIdx} className="flex flex-col gap-0.5">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg border overflow-hidden bg-slate-950",
                                  game.winner === 'A' ? "border-blue-500/50" : "border-slate-800 grayscale opacity-50"
                                )}>
                                  <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                                </div>
                                <span className={cn(
                                  "text-[6px] font-bold uppercase tracking-tighter truncate w-10 text-center",
                                  game.winner === 'A' ? "text-slate-300" : "text-slate-600"
                                )}>
                                  {playerName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {teamABans.length > 0 && (
                          <div className="flex gap-1.5 pl-3 border-l border-slate-800 h-full items-start">
                            {teamABans.map((banId, bIdx) => {
                              const god = MAJOR_GODS.find(g => g.id === banId);
                              return (
                                <div key={bIdx} className="w-10 h-10 rounded-lg border border-red-500/50 overflow-hidden bg-slate-950 relative">
                                  <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                                    <X className="w-8 h-8 text-red-500" strokeWidth={3} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Team B Picks */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">{lobby.captain2Name || t.teamB}</span>
                          {game.winner === 'B' && <Trophy className="w-3 h-3 text-amber-500" />}
                        </div>
                        {game.winner === 'B' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {game.picksB.map((godId, gIdx) => {
                            const god = MAJOR_GODS.find(g => g.id === godId);
                            // For finished games, we need to get the player name from rosterB
                            // If rosterB is not available, fallback to P1, P2, etc.
                            const playerName = game.rosterB?.[gIdx]?.playerName || `P${gIdx + 1}`;
                            return (
                              <div key={gIdx} className="flex flex-col gap-0.5">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg border overflow-hidden bg-slate-950",
                                  game.winner === 'B' ? "border-red-500/50" : "border-slate-800 grayscale opacity-50"
                                )}>
                                  <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                                </div>
                                <span className={cn(
                                  "text-[6px] font-bold uppercase tracking-tighter truncate w-10 text-center",
                                  game.winner === 'B' ? "text-slate-300" : "text-slate-600"
                                )}>
                                  {playerName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {teamBBans.length > 0 && (
                          <div className="flex gap-1.5 pl-3 border-l border-slate-800 h-full items-start">
                            {teamBBans.map((banId, bIdx) => {
                              const god = MAJOR_GODS.find(g => g.id === banId);
                              return (
                                <div key={bIdx} className="w-10 h-10 rounded-lg border border-red-500/50 overflow-hidden bg-slate-950 relative">
                                  <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                                    <X className="w-8 h-8 text-red-500" strokeWidth={3} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-8">
          {/* Team A */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white font-black text-xl">
                {lobby.scoreA}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.teamA}</span>
                <span className="text-lg font-black text-white uppercase tracking-tight whitespace-nowrap">
                  {lobby.captain1Name || t.roleHost}
                </span>
              </div>
            </div>
            {teamAMapBans.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.mapBans || 'MAP BANS'}</span>
                <div className="flex gap-2">
                  {teamAMapBans.map((mapId, i) => {
                    const map = MAPS.find(m => m.id === mapId);
                    return (
                      <div key={i} className="relative w-16 h-10 rounded-md overflow-hidden border border-red-500/30">
                        <img src={getProxyUrl(map?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center bg-red-950/60">
                          <X className="absolute inset-0 m-auto w-6 h-6 text-red-500/50" strokeWidth={3} />
                          <span className="relative z-10 text-[6px] font-black text-red-100 uppercase tracking-tighter text-center leading-none px-1 drop-shadow-md">
                            {t.mapNames?.[mapId] || map?.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-3">
              {picks.filter(p => p.team === 'A').map((pick, i) => {
                const god = MAJOR_GODS.find(g => g.id === pick.godId);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="aspect-square rounded-xl border-2 border-blue-500/30 overflow-hidden relative">
                      <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-1 text-[7px] font-black text-center text-white uppercase">
                        {god?.name}
                      </div>
                    </div>
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter truncate text-center">
                      {lobby.rosterA?.[pick.playerId]?.playerName || pick.playerName || `P${pick.playerId}`}
                    </span>
                  </div>
                );
              })}
            </div>
            {teamABans.length > 0 && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                {teamABans.map((banId, i) => {
                  const god = MAJOR_GODS.find(g => g.id === banId);
                  return (
                    <div key={i} className="w-12 h-12 rounded-xl border border-red-500/50 overflow-hidden bg-slate-950 relative">
                      <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                        <X className="w-10 h-10 text-red-500" strokeWidth={3} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Map Center */}
          <div className="w-64 flex flex-col items-center justify-center gap-4">
            <div className="w-full aspect-video rounded-2xl border-2 border-amber-500/50 overflow-hidden shadow-2xl shadow-amber-500/10 relative">
              <img src={getProxyUrl(currentMap?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.mapNames?.[currentMap?.id || ''] || currentMap?.name}</h3>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mt-1">{t.battlefield || 'BATTLEFIELD'}</p>
            </div>
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{t.teamB}</span>
                <span className="text-lg font-black text-white uppercase tracking-tight whitespace-nowrap">
                  {lobby.captain2Name || t.roleGuest}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white font-black text-xl">
                {lobby.scoreB}
              </div>
            </div>
            {teamBMapBans.length > 0 && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.mapBans || 'MAP BANS'}</span>
                <div className="flex gap-2">
                  {teamBMapBans.map((mapId, i) => {
                    const map = MAPS.find(m => m.id === mapId);
                    return (
                      <div key={i} className="relative w-16 h-10 rounded-md overflow-hidden border border-red-500/30">
                        <img src={getProxyUrl(map?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center bg-red-950/60">
                          <X className="absolute inset-0 m-auto w-6 h-6 text-red-500/50" strokeWidth={3} />
                          <span className="relative z-10 text-[6px] font-black text-red-100 uppercase tracking-tighter text-center leading-none px-1 drop-shadow-md">
                            {t.mapNames?.[mapId] || map?.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {picks.filter(p => p.team === 'B').map((pick, i) => {
                const god = MAJOR_GODS.find(g => g.id === pick.godId);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="aspect-square rounded-xl border-2 border-red-500/30 overflow-hidden relative">
                      <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-1 text-[7px] font-black text-center text-white uppercase">
                        {god?.name}
                      </div>
                    </div>
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter truncate text-center">
                      {lobby.rosterB?.[pick.playerId]?.playerName || pick.playerName || `P${pick.playerId}`}
                    </span>
                  </div>
                );
              })}
            </div>
            {teamBBans.length > 0 && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800 justify-end">
                {teamBBans.map((banId, i) => {
                  const god = MAJOR_GODS.find(g => g.id === banId);
                  return (
                    <div key={i} className="w-12 h-12 rounded-xl border border-red-500/50 overflow-hidden bg-slate-950 relative">
                      <img src={getProxyUrl(god?.image)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                        <X className="w-10 h-10 text-red-500" strokeWidth={3} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto pt-8 border-t border-slate-900 flex justify-end items-center">
        <div className="text-xs font-black text-slate-700 uppercase tracking-[0.3em]">
          MYTHOS-DRAFT.APP / ID: {lobby.id.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
