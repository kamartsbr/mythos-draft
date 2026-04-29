import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Clock } from 'lucide-react';
import { Lobby, MapInfo, PickEntry, GameResult } from '../types';
import { MAPS, MAJOR_GODS } from '../constants';
import { cn } from '../lib/utils';

interface MapVisualizerProps {
  lobby: Lobby;
  isVisible: (pick: PickEntry) => boolean;
  isCaptain1?: boolean;
  isCaptain2?: boolean;
  game?: GameResult;
  selectedPositionId?: number;
  t?: any;
  timeLeft?: number | null;
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ lobby, isVisible, isCaptain1, isCaptain2, game, selectedPositionId, t, timeLeft }) => {
  const mapId = game ? game.mapId : lobby.selectedMap;
  const selectedMap = MAPS.find(m => m.id.toLowerCase() === (mapId || '').toLowerCase());
  const mapRef = React.useRef<HTMLDivElement>(null);

  if (!selectedMap || !selectedMap.positions) {
    return (
      <div className="w-full aspect-square bg-slate-900/50 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-500 italic text-sm p-8 text-center">
        {mapId ? "Map visualization not available for this map" : "Select a map to see the battlefield"}
      </div>
    );
  }

  const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
  
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div 
        ref={mapRef}
        className="relative w-full aspect-square bg-slate-950 rounded-3xl border-4 border-slate-900 overflow-hidden shadow-2xl group"
      >
        {/* Map Background */}
        <img 
          src={selectedMap.image} 
          alt={selectedMap.name}
          className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-700"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = 'https://picsum.photos/seed/mythos/800/450';
          }}
        />
        
        {/* Grid Overlay for flavor */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.4)_100%)]" />
        
        {/* Player Positions */}
        {selectedMap.positions.map((pos) => {
          let godId: string | null = null;
          let team: 'A' | 'B' | null = null;
          let playerName: string | null = null;
          let playerColor: string | null = null;
          let showGod = false;
          const isSelected = selectedPositionId === pos.playerId;

          if (game) {
            // Logic for past game visualization
            const teamSize = lobby.config.teamSize;
            const picksA = Array.isArray(game.picksA) ? game.picksA : [];
            const picksB = Array.isArray(game.picksB) ? game.picksB : [];
            const colorsA = Array.isArray(game.colorsA) ? game.colorsA : [];
            const colorsB = Array.isArray(game.colorsB) ? game.colorsB : [];

            if (teamSize === 1) {
              if (pos.playerId === 1) { godId = picksA[0]; team = 'A'; }
              if (pos.playerId === 2) { godId = picksB[0]; team = 'B'; }
            } else if (teamSize === 2) {
              if (pos.playerId === 1) { godId = picksA[0]; team = 'A'; }
              if (pos.playerId === 2) { godId = picksA[1]; team = 'A'; }
              if (pos.playerId === 3) { godId = picksB[0]; team = 'B'; }
              if (pos.playerId === 4) { godId = picksB[1]; team = 'B'; }
            } else {
              if (pos.playerId === 1) { godId = picksA[0]; team = 'A'; }
              if (pos.playerId === 4) { godId = picksA[1]; team = 'A'; }
              if (pos.playerId === 5) { godId = picksA[2]; team = 'A'; }
              if (pos.playerId === 3) { godId = picksB[0]; team = 'B'; }
              if (pos.playerId === 2) { godId = picksB[1]; team = 'B'; }
              if (pos.playerId === 6) { godId = picksB[2]; team = 'B'; }
            }
            showGod = !!godId;
            const colorIdx = team === 'A' ? picksA.indexOf(godId!) : picksB.indexOf(godId!);
            playerColor = team === 'A' 
              ? (colorsA[colorIdx] || '#3b82f6') 
              : (colorsB[colorIdx] || '#ef4444');
            
            // Try to find player name in roster
            const roster = team === 'A' ? game.rosterA : game.rosterB;
            const safeRoster = Array.isArray(roster) ? roster : [];
            const playerInRoster = safeRoster.find(p => p.playerId === pos.playerId);
            playerName = playerInRoster?.playerName || (team === 'A' ? (lobby.captain1Name || 'Team A') : (lobby.captain2Name || 'Team B'));
          } else {
            // Logic for current draft visualization
            const pick = picks.find(p => p.playerId === pos.playerId);
            godId = pick?.godId || null;
            team = pick?.team || null;
            showGod = !!godId && isVisible(pick!);
            playerColor = pick?.color || (pick?.team === 'A' ? '#3b82f6' : '#ef4444');
            
            const isMyTeam = (isCaptain1 && team === 'A') || (isCaptain2 && team === 'B');
            if (showGod || isMyTeam) {
              playerName = pick?.playerName || `P${pos.playerId}`;
            } else {
              playerName = `P${pos.playerId}`;
            }
          }

          const god = godId ? MAJOR_GODS.find(g => g.id === godId) : null;

          return (
            <div 
              key={pos.playerId}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
                isSelected && "z-50 scale-125"
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="relative flex flex-col items-center">
                {/* Player Name above God */}
                {showGod && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-1 px-2 py-0.5 bg-slate-950/80 rounded border border-slate-800 shadow-lg"
                  >
                    <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                      {playerName}
                    </span>
                  </motion.div>
                )}

                {/* Position Marker / Pulse */}
                {!showGod && (
                  <div className="relative">
                    {/* Background Glow for Selected */}
                    {isSelected && (
                      <motion.div
                        animate={{
                          scale: [1, 1.6, 1],
                          opacity: [0.4, 0.8, 0.4],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-amber-500/40 blur-2xl"
                        style={{ left: '50%', top: '50%' }}
                      />
                    )}

                    <motion.div 
                      animate={{ 
                        scale: isSelected ? [1, 1.5, 1] : [1, 1.2, 1], 
                        opacity: isSelected ? [1, 0.9, 1] : [0.5, 0.3, 0.5],
                        boxShadow: isSelected 
                          ? [
                              "0 0 15px 5px rgba(245, 158, 11, 0.5)", 
                              "0 0 40px 15px rgba(245, 158, 11, 0.9)", 
                              "0 0 15px 5px rgba(245, 158, 11, 0.5)"
                            ] 
                          : "none"
                      }}
                      transition={{ duration: isSelected ? 0.8 : 2, repeat: Infinity }}
                      className={cn(
                        "w-[42px] h-[42px] md:w-[50px] md:h-[50px] rounded-full border-2 flex items-center justify-center transition-all duration-300",
                        isSelected ? "border-white bg-amber-500 shadow-[0_0_25px_rgba(251,191,36,0.8)]" : "opacity-50"
                      )}
                      style={{ 
                        borderColor: isSelected ? '#ffffff' : playerColor, 
                        backgroundColor: isSelected ? '#f59e0b' : `${playerColor}33` 
                      }}
                    >
                      {isSelected && (
                        <motion.div
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-full h-full rounded-full bg-white/40 shadow-[inset_0_0_10px_white]"
                        />
                      )}
                    </motion.div>

                    {/* Next Indicator Label */}
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
                      >
                        <div className="bg-amber-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
                          <motion.div
                            animate={{ x: [-2, 2, -2] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            <ArrowRight className="w-2 h-2" />
                          </motion.div>
                          {t?.nextPick || 'NEXT'}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* God Icon */}
                <AnimatePresence mode="wait">
                  {showGod && (
                    <motion.div
                      initial={{ scale: 0, rotate: -45, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={cn(
                        "w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-full border-2 bg-slate-900 overflow-hidden shadow-2xl z-10 relative",
                        isSelected && "ring-4 ring-amber-500 ring-offset-2 ring-offset-slate-950"
                      )}
                      style={{ borderColor: playerColor, boxShadow: `0 0 25px ${playerColor}60` }}
                    >
                      <img 
                        src={god?.image} 
                        alt={god?.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Team Indicator Badge */}
                      <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full border border-slate-950 flex items-center justify-center text-[10px] font-black text-white"
                        style={{ backgroundColor: playerColor }}
                      >
                        {team}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* God Name Label */}
                <div className="mt-1 whitespace-nowrap">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 shadow-lg",
                    isSelected ? "text-amber-500 border-amber-500/50" : ""
                  )}
                    style={{ color: isSelected ? '#f59e0b' : playerColor }}
                  >
                    {showGod ? god?.name : `P${pos.playerId}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* Map Name Below */}
      <div className="flex flex-col items-center gap-3">
        <div className="bg-slate-900/50 border border-slate-800 px-8 py-3 rounded-2xl shadow-xl">
          <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">
            {selectedMap.name}
          </h4>
        </div>

        {timeLeft !== null && timeLeft !== undefined && !isNaN(timeLeft) && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "px-8 py-3 rounded-xl border-2 flex items-center gap-4 transition-all duration-300 bg-slate-900/40 backdrop-blur-md shadow-lg",
              timeLeft <= 5 ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "border-slate-800"
            )}
          >
            <Clock className={cn("w-5 h-5", (timeLeft || 0) <= 5 ? "text-red-500 animate-pulse" : "text-amber-500")} />
            <span className={cn("text-3xl font-black tabular-nums tracking-tight", (timeLeft || 0) <= 5 ? "text-red-500" : "text-white")}>
              {typeof timeLeft === 'number' && !isNaN(timeLeft) ? timeLeft : '--'}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
