import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sword, X, User, Users, Dices, RefreshCw, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby, PickEntry, Substitution } from '../../types';
import { PlayerSlot } from './PlayerSlot';
import { MAJOR_GODS, MAPS } from '../../constants';

interface TeamColumnProps {
  team: 'A' | 'B';
  lobby: Lobby;
  isCurrentTurn: boolean;
  t: any;
  isCaptain1: boolean;
  isCaptain2: boolean;
  timeLeft?: number | null;
  timerDuration?: number;
  optimisticAction?: { id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban', playerId?: number, playerName?: string } | null;
}

export function TeamColumn({ team, lobby, isCurrentTurn, t, isCaptain1, isCaptain2, timeLeft, timerDuration, optimisticAction }: TeamColumnProps) {
  const [showSubAlert, setShowSubAlert] = useState(false);
  const prevGameRef = useRef<number>(0);
  
  const lastSubs = (Array.isArray(lobby.lastSubs) ? lobby.lastSubs : []) as Substitution[];
  const mySubs = lastSubs.filter(s => s.team === team);

  useEffect(() => {
    if (lobby.phase.startsWith('god_') && mySubs.length > 0 && lobby.currentGame !== prevGameRef.current) {
      setShowSubAlert(true);
      prevGameRef.current = lobby.currentGame;
      const timer = setTimeout(() => setShowSubAlert(false), 10000);
      return () => clearTimeout(timer);
    } else if (lobby.status === 'waiting') {
      prevGameRef.current = 0;
      setShowSubAlert(false);
    }
  }, [lobby.phase, mySubs.length, lobby.currentGame, lobby.status]);

  const optimisticPicks = Array.isArray(lobby.picks) ? [...lobby.picks] : [];
  const optimisticBans = Array.isArray(lobby.replayLog) ? [...lobby.replayLog] : [];

  if (optimisticAction) {
    if (optimisticAction.type === 'pick' && isCurrentTurn) {
      if (optimisticAction.playerId !== undefined) {
        const pickIndex = optimisticPicks.findIndex(p => p.team === team && p.playerId === optimisticAction.playerId && p.godId === null);
        if (pickIndex !== -1) {
          optimisticPicks[pickIndex] = { ...optimisticPicks[pickIndex], godId: optimisticAction.id, playerName: optimisticAction.playerName || optimisticPicks[pickIndex].playerName };
        }
      } else {
        const pickIndex = optimisticPicks.findIndex(p => p.team === team && p.godId === null);
        if (pickIndex !== -1) {
          optimisticPicks[pickIndex] = { ...optimisticPicks[pickIndex], godId: optimisticAction.id };
        }
      }
    } else if (optimisticAction.type === 'ban' && isCurrentTurn) {
      optimisticBans.push({
        action: 'BAN',
        target: 'GOD',
        player: team,
        gameNumber: lobby.currentGame,
        id: optimisticAction.id,
        turnIndex: lobby.turn,
        timestamp: new Date().toISOString()
      });
    } else if (optimisticAction.type === 'map_ban' && isCurrentTurn) {
      optimisticBans.push({
        action: 'BAN',
        target: 'MAP',
        player: team,
        gameNumber: lobby.currentGame,
        id: optimisticAction.id,
        turnIndex: lobby.turn,
        timestamp: new Date().toISOString()
      });
    } else if (optimisticAction.type === 'map_pick' && isCurrentTurn) {
      optimisticBans.push({
        action: 'PICK',
        target: 'MAP',
        player: team,
        gameNumber: lobby.currentGame,
        id: optimisticAction.id,
        turnIndex: lobby.turn,
        timestamp: new Date().toISOString()
      });
    }
  }

  const teamPicks = optimisticPicks.filter(p => p.team === team);
  
  const teamGodBans = optimisticBans
    .filter(step => step.action === 'BAN' && step.target === 'GOD' && step.player === team && step.gameNumber === lobby.currentGame);

  const teamMapBans = optimisticBans
    .filter(step => step.action === 'BAN' && step.target === 'MAP' && step.player === team && step.gameNumber === lobby.currentGame);
  
  const teamMapPicks = optimisticBans
    .filter(step => step.action === 'PICK' && step.target === 'MAP' && step.player === team && step.gameNumber === lobby.currentGame);
  
  const isMyTeam = (team === 'A' && isCaptain1) || (team === 'B' && isCaptain2);
  const captainName = team === 'A' ? lobby.captain1Name : lobby.captain2Name;
  const teamName = captainName || (team === 'A' ? 'Host' : 'Guest');

  return (
    <div className={cn(
      "flex flex-col gap-6 h-full p-6",
      team === 'A' ? "border-r border-slate-900" : "border-l border-slate-900"
    )}>
      {/* Team Header */}
      <div className={cn(
        "flex items-center gap-4 mb-4",
        team === 'B' && "flex-row-reverse text-right"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
          team === 'A' ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"
        )}>
          {team === 'A' ? <Shield className="w-6 h-6" /> : <Sword className="w-6 h-6" />}
        </div>
        <div>
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
            {lobby.config.teamSize === 1 ? (team === 'A' ? t.roleHost : t.roleGuest) : (team === 'A' ? t.teamA : t.teamB)}
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {teamName}
          </h2>
        </div>
      </div>

      {/* Active Roster List (Shown during God Draft for team sizes > 1) */}
      {lobby.config.teamSize > 1 && lobby.phase.startsWith('god_') && (
        <div className="space-y-2 mb-2">
          <div className={cn(
            "flex items-center gap-2 mb-1",
            team === 'B' && "flex-row-reverse"
          )}>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              {t.activeRoster || 'ROSTER'}
            </span>
            <div className="h-px flex-1 bg-slate-900/50" />
          </div>
          
          <div className="flex flex-col gap-2">
            {teamPicks.map((pick, i) => (
              <div key={i} className={cn("flex items-center gap-2", team === 'B' && "flex-row-reverse text-right")}>
                <span className="w-6 h-6 rounded-md bg-slate-900/50 flex items-center justify-center border border-slate-800">
                  <User className="w-3 h-3 text-slate-500" />
                </span>
                <span className="text-xs font-bold text-white tracking-widest uppercase">
                  {pick.playerName || pick.assignedPlayerName || `Player ${i+1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Substitutions Notification Overlay */}
      <AnimatePresence>
        {showSubAlert && mySubs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: team === 'A' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-4 bg-slate-900 border border-amber-500/50 rounded-2xl p-4 shadow-xl shadow-amber-500/10 overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 10, ease: "linear" }}
                className={cn("h-full bg-amber-500", team === 'B' && "ml-auto")}
              />
            </div>

            <div className={cn("flex items-center gap-3 mb-3", team === 'B' && "flex-row-reverse text-right")}>
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-amber-500 animate-spin-slow" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">{t.substitutions || 'SUBSTITUTIONS'}</h4>
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{t.rosterUpdated || 'ROSTER UPDATED'}</p>
              </div>
            </div>

            <div className="space-y-2">
              {mySubs.map((sub, idx) => (
                <div 
                  key={idx}
                  className={cn("flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800", team === 'B' && "flex-row-reverse")}
                >
                  <div className="flex flex-col flex-1">
                    <div className={cn("flex items-center gap-1", team === 'B' && "flex-row-reverse justify-end")}>
                      <UserMinus className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold text-slate-500 line-through">{sub.playerOut}</span>
                    </div>
                    <div className={cn("flex items-center gap-1", team === 'B' && "flex-row-reverse justify-end")}>
                      <UserPlus className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-black text-white truncate">{sub.playerIn}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bans Section */}
      {(lobby.config.hasBans || lobby.config.mapBanCount > 0) && (
        <div className="space-y-4">
          {/* Map Bans */}
          {lobby.config.mapBanCount > 0 && (
            <div className="space-y-2">
              <div className={cn(
                "flex items-center gap-2 mb-1",
                team === 'B' && "flex-row-reverse"
              )}>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.mapBans || 'MAP BANS'}</span>
                <div className="h-px flex-1 bg-slate-900/50" />
              </div>
              <div className={cn(
                "flex gap-2",
                team === 'B' && "flex-row-reverse"
              )}>
                {Array.from({ length: lobby.config.mapBanCount }).map((_, i) => {
                  const banStep = teamMapBans[i];
                  const mapId = banStep?.id;
                  const map = MAPS.find(m => m.id === mapId);
                  
                  return (
                    <div 
                      key={i}
                      className={cn(
                        "w-36 h-24 rounded-2xl border-2 overflow-hidden transition-all duration-500 relative",
                        map ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "border-slate-800 bg-slate-950 flex items-center justify-center"
                      )}
                    >
                      {map ? (
                        <>
                          <img 
                            src={map.image} 
                            alt={map.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover sepia-[0.5] hue-rotate-[-50deg] saturate-[2]"
                          />
                          <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center">
                            <X className="w-6 h-6 text-red-500 drop-shadow-lg" strokeWidth={3} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-center">
                            <span className="text-[8px] font-black text-white uppercase truncate block">
                              {t.mapNames?.[map.id] || map.name}
                            </span>
                          </div>
                          {banStep?.isRandom && (
                            <div className="absolute top-2 right-2 bg-slate-950/80 rounded-full p-1 z-10">
                              <Dices className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-1 h-3 bg-slate-900 rotate-45 rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* God Bans */}
          {lobby.config.hasBans && (
            <div className="space-y-2">
              <div className={cn(
                "flex items-center gap-2 mb-1",
                team === 'B' && "flex-row-reverse"
              )}>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.godBans || 'GOD BANS'}</span>
                <div className="h-px flex-1 bg-slate-900/50" />
              </div>
              <div className={cn(
                "flex gap-2",
                team === 'B' && "flex-row-reverse"
              )}>
                {Array.from({ length: lobby.config.banCount }).map((_, i) => {
                  const banStep = teamGodBans[i];
                  const banId = banStep?.id;
                  const god = MAJOR_GODS.find(g => g.id === banId);
                  
                  return (
                    <motion.div 
                      key={i}
                      initial={god ? { scale: 1.5, rotate: 10, filter: 'grayscale(0%)' } : false}
                      animate={god ? { scale: 1, rotate: 0, filter: 'grayscale(100%)' } : {}}
                      transition={{ type: "spring", damping: 10 }}
                      className={cn(
                        "w-28 h-28 rounded-3xl border-2 overflow-hidden transition-all duration-500 relative",
                        god ? "border-red-500/50 opacity-40" : "border-slate-800 bg-slate-950 flex items-center justify-center"
                      )}
                    >
                      {god ? (
                        <>
                          <img 
                            src={god.image} 
                            alt={god.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex items-center justify-center bg-red-500/20"
                          >
                            <X className="w-8 h-8 text-red-500 drop-shadow-lg" />
                          </motion.div>
                          {banStep?.isRandom && (
                            <div className="absolute top-2 right-2 bg-slate-950/80 rounded-full p-1 z-10">
                              <Dices className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-1 h-4 bg-slate-800 rotate-45 rounded-full" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Map Picks (Casca Grossa Playoffs) */}
          {lobby.config.preset === 'CASCA' && lobby.config.tournamentStage === 'PLAYOFFS' && teamMapPicks.length > 0 && (
            <div className="space-y-2">
              <div className={cn(
                "flex items-center gap-2 mb-1",
                team === 'B' && "flex-row-reverse"
              )}>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.mapPicks || 'MAP PICKS'}</span>
                <div className="h-px flex-1 bg-slate-900/50" />
              </div>
              <div className={cn(
                "flex gap-2",
                team === 'B' && "flex-row-reverse"
              )}>
                {teamMapPicks.map((pickStep, i) => {
                  const mapId = pickStep.id;
                  const map = MAPS.find(m => m.id === mapId);
                  return (
                    <div 
                      key={i}
                      className={cn(
                        "w-36 h-24 rounded-2xl border-2 overflow-hidden transition-all duration-500 relative",
                        "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                      )}
                    >
                      {map && (
                        <>
                          <img 
                            src={map.image} 
                            alt={map.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-center">
                            <span className="text-[8px] font-black text-white uppercase truncate block">
                              {t.mapNames?.[map.id] || map.name}
                            </span>
                          </div>
                          {pickStep.isRandom && (
                            <div className="absolute top-2 right-2 bg-slate-950/80 rounded-full p-1">
                              <Dices className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Players Section */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        {/* Picks Section */}
        <div className={cn(
          "flex items-center gap-2 mb-2",
          team === 'B' && "flex-row-reverse"
        )}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.picks}</span>
          <div className="h-px flex-1 bg-slate-900" />
        </div>
        
        {lobby.config.teamSize === 1 ? (
          <div className="flex flex-wrap gap-3">
            {teamPicks.map((pick, idx) => {
              const turn = lobby.turnOrder[lobby.turn];
              const isGodTurn = turn?.target === 'GOD';
              const isTeamTurn = turn?.player === team || turn?.player === 'BOTH';
              
              // Find the first player in this team who hasn't picked a god yet
              const nextPickForTeam = teamPicks.find(p => p.godId === null);
              const isCurrentPlayerTurn = isGodTurn && isTeamTurn && pick.playerId === nextPickForTeam?.playerId;
              
              const hoveredGodId = team === 'A' ? lobby.hoveredGodIdA : lobby.hoveredGodIdB;
              const god = MAJOR_GODS.find(g => g.id === pick.godId) || (isCurrentPlayerTurn && hoveredGodId ? MAJOR_GODS.find(g => g.id === hoveredGodId) : null);
              const isHovered = !pick.godId && god && isCurrentPlayerTurn;

              return (
                <motion.div
                  key={pick.playerId + '-' + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative w-24 h-32 rounded-2xl overflow-hidden border-2 transition-all duration-500",
                    isCurrentPlayerTurn 
                      ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-500/10" 
                      : "border-slate-800 bg-slate-900/40",
                    isHovered && "opacity-75"
                  )}
                >
                  {god ? (
                    <>
                      <img src={god.image} alt={god.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                        <div className="text-[8px] font-black text-white uppercase tracking-tighter truncate">{god.name}</div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-800" />
                    </div>
                  )}
                  {isCurrentPlayerTurn && (
                    <motion.div 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {teamPicks.map((pick, idx) => {
              const turn = lobby.turnOrder[lobby.turn];
              const isGodTurn = turn?.target === 'GOD';
              const isTeamTurn = turn?.player === team || turn?.player === 'BOTH';
              
              // Find the first player in this team who hasn't picked a god yet
              const nextPickForTeam = teamPicks.find(p => p.godId === null);
              const isCurrentPlayerTurn = isGodTurn && isTeamTurn && pick.playerId === nextPickForTeam?.playerId;
              
              // Hide name from enemy team until god is picked
              const isMyTeam = (isCaptain1 && team === 'A') || (isCaptain2 && team === 'B');
              const hasGod = pick.godId !== null;
              const shouldHideName = !isMyTeam && !hasGod && lobby.config.preset === 'MCL';
              const hoveredGodId = team === 'A' ? lobby.hoveredGodIdA : lobby.hoveredGodIdB;
              
              return (
                <PlayerSlot                
                  key={pick.playerId + '-' + idx} 
                  pick={pick} 
                  isCurrentTurn={isCurrentPlayerTurn}
                  t={t}
                  isHidden={shouldHideName}
                  preset={lobby.config.preset}
                  index={idx}
                  hoveredGodId={isCurrentPlayerTurn ? hoveredGodId : null}
                  timeLeft={timeLeft}
                  timerDuration={timerDuration || lobby.config.timerDuration || 60}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Team Stats/Info Footer */}
      <div className={cn(
        "mt-auto pt-6 border-t border-slate-900 flex items-center gap-4 text-slate-500",
        team === 'B' && "flex-row-reverse text-right"
      )}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-widest">{lobby.config.teamSize}v{lobby.config.teamSize}</span>
        </div>
        <div className="h-4 w-px bg-slate-800" />
        <div className="text-xs font-medium uppercase tracking-widest">
          {lobby.config.isExclusive ? t.exclusive : t.nonExclusive}
        </div>
      </div>
    </div>
  );
}
