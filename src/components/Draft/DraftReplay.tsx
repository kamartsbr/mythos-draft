import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, X, Map as MapIcon, Sword, Shield, Layout } from 'lucide-react';
import { Lobby, ReplayStep, PickEntry } from '../../types';
import { MAPS, MAJOR_GODS } from '../../constants';
import { cn } from '../../lib/utils';
import { MapVisualizer } from '../MapVisualizer';

interface DraftReplayProps {
  lobby: Lobby;
  onClose: () => void;
  t: any;
  lang: 'en' | 'pt';
}

export function DraftReplay({ lobby, onClose, t, lang }: DraftReplayProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1500);
  const [showMap, setShowMap] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const replayLog = useMemo(() => lobby.replayLog || [], [lobby.replayLog]);

  useEffect(() => {
    if (logRef.current && currentStep >= 0) {
      const activeItem = logRef.current.children[currentStep] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStep]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && currentStep < replayLog.length - 1) {
      timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, playbackSpeed);
    } else if (currentStep >= replayLog.length - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, replayLog.length, playbackSpeed]);

  // Reconstruct state up to currentStep
  const state = useMemo(() => {
    const mapBans: string[] = [];
    const godBans: string[] = [];
    const picksA: string[] = [];
    const picksB: string[] = [];
    const seriesMaps: string[] = [];
    const picksWithSlots: { godId: string, team: 'A' | 'B', playerId?: number }[] = [];

    const currentGameNumber = currentStep >= 0 ? replayLog[currentStep].gameNumber : 1;

    for (let i = 0; i <= currentStep; i++) {
      const step = replayLog[i];
      
      if (step.action === 'PICK' && step.target === 'MAP') {
        seriesMaps.push(step.id);
      }

      if (step.gameNumber === currentGameNumber) {
        if (step.action === 'BAN') {
          if (step.target === 'MAP') mapBans.push(step.id);
          else godBans.push(step.id);
        } else if (step.action === 'PICK' && step.target === 'GOD') {
          if (step.player === 'A') picksA.push(step.id);
          else if (step.player === 'B') picksB.push(step.id);
          
          picksWithSlots.push({ godId: step.id, team: step.player as 'A' | 'B', playerId: step.playerId });
        }
      }
    }

    return { mapBans, godBans, picksA, picksB, seriesMaps, currentGameNumber, picksWithSlots };
  }, [replayLog, currentStep]);

  const gameForVisualizer = useMemo(() => {
    const mapId = state.seriesMaps[state.currentGameNumber - 1] || lobby.seriesMaps[state.currentGameNumber - 1] || lobby.selectedMap;
    
    return {
      gameNumber: state.currentGameNumber,
      mapId: mapId || '',
      winner: 'A' as const,
      picksA: state.picksA,
      picksB: state.picksB,
      rosterA: lobby.picks.filter(p => p.team === 'A').map((p, idx) => {
        const pickByPlayerId = state.picksWithSlots.find(ps => ps.team === 'A' && ps.playerId === p.playerId);
        if (pickByPlayerId) return { ...p, godId: pickByPlayerId.godId };
        return { ...p, godId: state.picksA[idx] || null };
      }),
      rosterB: lobby.picks.filter(p => p.team === 'B').map((p, idx) => {
        const pickByPlayerId = state.picksWithSlots.find(ps => ps.team === 'B' && ps.playerId === p.playerId);
        if (pickByPlayerId) return { ...p, godId: pickByPlayerId.godId };
        return { ...p, godId: state.picksB[idx] || null };
      })
    };
  }, [state, lobby]);

  const currentAction = currentStep >= 0 ? replayLog[currentStep] : null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col p-4 md:p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <RotateCcw className="w-6 h-6 md:w-8 md:h-8 text-amber-500" />
            {t.draftReplay || 'Draft Replay'}
          </h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs md:text-sm">
              {lobby.config.name}
            </p>
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                {t.game || 'Game'} {state.currentGameNumber}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowMap(!showMap)}
            className={cn(
              "p-2 md:p-3 rounded-xl border transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest",
              showMap 
                ? "bg-amber-500 border-amber-500 text-slate-950" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            )}
          >
            {showMap ? <Layout className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
            {showMap ? (t.viewBoard || 'View Board') : (t.viewMap || 'View Map')}
          </button>
          <button 
            onClick={onClose}
            className="p-2 md:p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Left: Team A Picks */}
        <div className="md:col-span-3 space-y-4 order-2 md:order-1">
          <h3 className="text-lg md:text-xl font-bold text-blue-500 flex items-center gap-2 mb-2 md:mb-4">
            <Shield className="w-4 h-4 md:w-5 md:h-5" />
            {lobby.captain1Name || 'Team A'}
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-2 md:gap-3">
            {Array.from({ length: lobby.config.teamSize }).map((_, i) => {
              const godId = state.picksA[i];
              const god = MAJOR_GODS.find(g => g.id === godId);
              
              // Find player name from history if available
              const gameNum = currentAction?.gameNumber || 1;
              const gameHistory = lobby.history.find(h => h.gameNumber === gameNum);
              const player = gameHistory?.rosterA?.[i];
              const playerName = player?.playerName || (lobby.config.teamSize === 1 ? (lobby.captain1Name || 'Team A') : `Player ${i + 1}`);

              return (
                <div key={i} className="h-20 md:h-24 bg-slate-900/50 border border-slate-800 rounded-xl md:rounded-2xl overflow-hidden flex items-center gap-2 md:gap-4 p-2 md:p-4">
                  {god ? (
                    <>
                      <img src={god.image} className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl object-cover" referrerPolicy="no-referrer" />
                      <div className="flex flex-col min-w-0">
                        <div className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">{playerName}</div>
                        <div className="font-bold text-white text-[10px] md:text-base truncate">{god.name}</div>
                      </div>
                    </>
                  ) : (
                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-slate-950 border border-slate-800 border-dashed" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

          {/* Center: Replay Visualization */}
          <div className="md:col-span-6 flex flex-col gap-4 md:gap-6 order-1 md:order-2 min-h-0">
            {showMap ? (
              <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 md:p-8 flex items-center justify-center overflow-hidden">
                <div className="w-full max-w-lg">
                  <MapVisualizer 
                    lobby={lobby}
                    isVisible={() => true}
                    game={gameForVisualizer}
                    t={t}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Current Action Highlight */}
                <div className="h-40 md:h-48 bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl flex items-center justify-center p-4 md:p-8 relative overflow-hidden shrink-0">
                  <AnimatePresence mode="wait">
                    {currentAction ? (
                      <motion.div 
                        key={currentStep}
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.1, opacity: 0, y: -20 }}
                        className="flex flex-col items-center text-center"
                      >
                        <div className={cn(
                          "text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-1 md:mb-2",
                          currentAction.player === 'A' ? "text-blue-500" : currentAction.player === 'B' ? "text-red-500" : "text-amber-500"
                        )}>
                          {currentAction.player === 'A' ? lobby.captain1Name : currentAction.player === 'B' ? lobby.captain2Name : 'ADMIN'} {currentAction.action}
                        </div>
                        <div className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2 md:mb-4">
                          {currentAction.target === 'MAP' 
                            ? (t.mapNames?.[currentAction.id] || MAPS.find(m => m.id === currentAction.id)?.name)
                            : (MAJOR_GODS.find(g => g.id === currentAction.id)?.name)
                          }
                        </div>
                        <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl overflow-hidden border-2 border-amber-500 shadow-2xl shadow-amber-500/20">
                          <img 
                            src={currentAction.target === 'MAP' 
                              ? MAPS.find(m => m.id === currentAction.id)?.image 
                              : MAJOR_GODS.find(g => g.id === currentAction.id)?.image
                            } 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <div className="text-slate-600 font-bold uppercase tracking-widest text-sm">Ready to Play</div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Timeline / Steps */}
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 overflow-hidden flex flex-col min-h-[300px]">
                  <h4 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Sequence Log</h4>
                  <div ref={logRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {replayLog.map((step, idx) => {
                      const isNewGame = idx === 0 || replayLog[idx - 1].gameNumber !== step.gameNumber;
                      return (
                        <React.Fragment key={idx}>
                          {isNewGame && (
                            <div className="py-2 px-4 bg-slate-900/80 rounded-lg border border-slate-800 mb-2 mt-4 first:mt-0">
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                {t.game || 'Game'} {step.gameNumber}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setCurrentStep(idx);
                              setIsPlaying(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl transition-all text-left group",
                              currentStep === idx ? "bg-amber-500/10 border border-amber-500/50" : "hover:bg-slate-900 border border-transparent"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center font-black text-[10px] md:text-xs shrink-0",
                              currentStep === idx ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-500"
                            )}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-[10px] md:text-xs font-bold uppercase tracking-tighter",
                                  step.player === 'A' ? "text-blue-500" : step.player === 'B' ? "text-red-500" : "text-amber-500"
                                )}>
                                  {step.player === 'A' ? 'P1' : step.player === 'B' ? 'P2' : 'ADM'} {step.action}
                                </span>
                                <span className="text-[8px] md:text-[10px] text-slate-600 font-mono">
                                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                              <div className={cn(
                                "text-xs md:text-sm font-bold truncate",
                                currentStep === idx ? "text-white" : "text-slate-400"
                              )}>
                                {step.target === 'MAP' 
                                  ? (t.mapNames?.[step.id] || MAPS.find(m => m.id === step.id)?.name)
                                  : (MAJOR_GODS.find(g => g.id === step.id)?.name)
                                }
                              </div>
                            </div>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

        {/* Right: Team B Picks */}
        <div className="md:col-span-3 space-y-4 order-3">
          <h3 className="text-lg md:text-xl font-bold text-red-500 flex items-center gap-2 mb-2 md:mb-4 justify-end">
            {lobby.captain2Name || 'Team B'}
            <Sword className="w-4 h-4 md:w-5 md:h-5" />
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-2 md:gap-3">
            {Array.from({ length: lobby.config.teamSize }).map((_, i) => {
              const godId = state.picksB[i];
              const god = MAJOR_GODS.find(g => g.id === godId);
              
              // Find player name from history if available
              const gameNum = currentAction?.gameNumber || 1;
              const gameHistory = lobby.history.find(h => h.gameNumber === gameNum);
              const player = gameHistory?.rosterB?.[i];
              const playerName = player?.playerName || (lobby.config.teamSize === 1 ? (lobby.captain2Name || 'Team B') : `Player ${i + 1}`);

              return (
                <div key={i} className="h-20 md:h-24 bg-slate-900/50 border border-slate-800 rounded-xl md:rounded-2xl overflow-hidden flex items-center justify-end gap-2 md:gap-4 p-2 md:p-4">
                  {god ? (
                    <>
                      <div className="flex flex-col min-w-0 items-end">
                        <div className="text-[8px] md:text-[10px] font-black text-red-500 uppercase tracking-widest truncate">{playerName}</div>
                        <div className="font-bold text-white text-[10px] md:text-base text-right truncate">{god.name}</div>
                      </div>
                      <img src={god.image} className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl object-cover" referrerPolicy="no-referrer" />
                    </>
                  ) : (
                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-slate-950 border border-slate-800 border-dashed" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls Footer */}
      <div className="mt-4 md:mt-8 bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => { setCurrentStep(-1); setIsPlaying(false); }}
            className="p-2 md:p-3 rounded-lg md:rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="h-8 w-[1px] bg-slate-800 mx-1 md:mx-2 hidden md:block" />
          <button 
            onClick={() => { setCurrentStep(prev => Math.max(-1, prev - 1)); setIsPlaying(false); }}
            className="p-2 md:p-3 rounded-lg md:rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
          >
            {isPlaying ? <Pause className="w-6 h-6 md:w-8 md:h-8 fill-current" /> : <Play className="w-6 h-6 md:w-8 md:h-8 fill-current ml-1" />}
          </button>
          <button 
            onClick={() => { setCurrentStep(prev => Math.min(replayLog.length - 1, prev + 1)); setIsPlaying(false); }}
            className="p-2 md:p-3 rounded-lg md:rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 w-full md:mx-12">
          <div className="flex justify-between text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 md:mb-2">
            <span>Progress</span>
            <span>{currentStep + 1} / {replayLog.length}</span>
          </div>
          <div className="h-2 md:h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-[1px] md:p-[2px]">
            <motion.div 
              className="h-full bg-amber-500 rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / replayLog.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Speed</span>
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg md:rounded-xl p-1">
            {[
              { label: '0.5x', val: 3000 },
              { label: '1x', val: 1500 },
              { label: '2x', val: 750 }
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setPlaybackSpeed(s.val)}
                className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-black transition-all",
                  playbackSpeed === s.val ? "bg-amber-500 text-slate-950" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
