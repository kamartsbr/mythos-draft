import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sword, Check, Lock, Clock, Info, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby, God } from '../../types';
import { MAJOR_GODS, MAPS } from '../../constants';
import { MapVisualizer } from '../MapVisualizer';

interface GodPickerProps {
  lobby: Lobby;
  isCaptain1: boolean;
  isCaptain2: boolean;
  handlePickerAction: (id: string, playerId?: number) => void;
  timeLeft: number | null;
  t: any;
  optimisticAction: { id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban' } | null;
}

export function GodPicker({ lobby, isCaptain1, isCaptain2, handlePickerAction, timeLeft, t, optimisticAction }: GodPickerProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedGodId, setSelectedGodId] = useState<string | null>(null);
  const myTeam = isCaptain1 ? 'A' : isCaptain2 ? 'B' : null;
  const myVote = isCaptain1 ? lobby.pickerVoteA : lobby.pickerVoteB;
  const optimisticVote = (optimisticAction?.type === 'pick') ? optimisticAction.id : null;
  const effectiveVote = myVote || optimisticVote;
  
  const players = myTeam === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers;

  const handleGodSelect = (godId: string) => {
    if (lobby.config.preset === 'MCL') {
        setSelectedGodId(godId);
    } else {
        handlePickerAction(godId);
    }
  };

  // When player is selected
  useEffect(() => {
    if (selectedPlayerId && selectedGodId) {
        handlePickerAction(selectedGodId, selectedPlayerId);
    }
  }, [selectedPlayerId, selectedGodId, handlePickerAction]);
  
  const isRevealing = lobby.phase === 'revealing';
  
  const teamAGods = lobby.picks.filter(p => p.team === 'A' && p.godId).map(p => p.godId!);
  const teamBGods = lobby.picks.filter(p => p.team === 'B' && p.godId).map(p => p.godId!);
  
  const usedGodsA = lobby.history.map(h => h.picksA[0]).filter(Boolean);
  const usedGodsB = lobby.history.map(h => h.picksB[0]).filter(Boolean);

  const isCascaGroup = lobby.config.preset === 'CASCA' && lobby.config.tournamentStage === 'GROUP';
  const gameMap = MAPS.find(m => m.id === lobby.selectedMap);
  
  const myGodPool = isCascaGroup 
    ? MAJOR_GODS.filter(g => g.culture !== 'Aztec' && (!lobby.config.allowedPantheons || lobby.config.allowedPantheons.includes(g.id))).map(g => g.id)
    : (myTeam === 'A' ? teamAGods : teamBGods);
    
  const myUsedGods = isCascaGroup ? [] : (myTeam === 'A' ? usedGodsA : usedGodsB);

  const opponentTeam = myTeam === 'A' ? 'B' : 'A';
  const opponentVote = opponentTeam === 'A' ? lobby.pickerVoteA : lobby.pickerVoteB;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/50 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sword className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1">
                {t.godPickerTitle || 'CHOOSE YOUR DIVINITY'}
              </h2>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  isRevealing ? "bg-amber-500" : myVote ? "bg-green-500" : "bg-blue-500"
                )} />
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  {isRevealing ? t.revealingGods : myVote ? t.waitingOpponent : t.selectYourGod}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer removed from here */}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isRevealing ? (
            <div className="flex-1 relative flex flex-col items-center justify-center p-6 gap-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0%,transparent_70%)]" />
              
              <div className="w-full max-w-sm mx-auto relative z-10">
                <MapVisualizer 
                  lobby={lobby} 
                  isVisible={() => true} 
                  isCaptain1={isCaptain1}
                  isCaptain2={isCaptain2}
                  t={t}
                  timeLeft={timeLeft}
                />
              </div>

              <div className="relative z-10 flex items-center gap-6 md:gap-12">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, x: -50 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="px-3 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}</span>
                  </div>
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                    {MAJOR_GODS.find(g => g.id === lobby.pickerVoteA || (isCaptain1 && effectiveVote === g.id))?.image && (
                      <img 
                        src={MAJOR_GODS.find(g => g.id === lobby.pickerVoteA || (isCaptain1 && effectiveVote === g.id))?.image} 
                        alt="God A" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    {MAJOR_GODS.find(g => g.id === lobby.pickerVoteA || (isCaptain1 && effectiveVote === g.id))?.name}
                  </h3>
                </motion.div>

                <div className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter select-none">VS</div>

                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, x: 50 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="px-3 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full">
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">{lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}</span>
                  </div>
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                    {MAJOR_GODS.find(g => g.id === lobby.pickerVoteB || (isCaptain2 && effectiveVote === g.id))?.image && (
                      <img 
                        src={MAJOR_GODS.find(g => g.id === lobby.pickerVoteB || (isCaptain2 && effectiveVote === g.id))?.image} 
                        alt="God B" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    {MAJOR_GODS.find(g => g.id === lobby.pickerVoteB || (isCaptain2 && effectiveVote === g.id))?.name}
                  </h3>
                </motion.div>
              </div>

              <div className="px-6 py-2 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-[0.3em] rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse">
                {t.revealing || 'REVEALING GODS...'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Added MapVisualizer to selection phase */}
              <div className="p-4 flex justify-center">
                <div className="w-full max-w-[200px]">
                  <MapVisualizer 
                    lobby={lobby} 
                    isVisible={() => true} 
                    isCaptain1={isCaptain1}
                    isCaptain2={isCaptain2}
                    selectedPositionId={selectedPlayerId || undefined}
                    t={t}
                    timeLeft={timeLeft}
                  />
                </div>
              </div>
              {/* God Selection Grid */}
              <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-amber-500" />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.yourPool || 'AVAILABLE GODS'}</h3>
                  </div>
                  <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                    {myGodPool.length} {t.godsAvailable || 'Gods Available'}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 pb-2">
                    {myGodPool.map(godId => {
                      const god = MAJOR_GODS.find(g => g.id === godId);
                      const isUsed = myUsedGods.includes(godId);
                      const isSelected = effectiveVote === godId;
                      const isDisabled = isUsed || !!effectiveVote || (!isCaptain1 && !isCaptain2);

                      if (!god) return null;

                      return (
                        <motion.button
                          key={godId}
                          whileHover={!isDisabled ? { scale: 1.05, y: -1 } : {}}
                          whileTap={!isDisabled ? { scale: 0.95 } : {}}
                          onClick={() => !isDisabled && handleGodSelect(godId)}
                          className={cn(
                            "relative aspect-[4/5] rounded-lg overflow-hidden border transition-all duration-500 group",
                            isSelected ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]" :
                            isUsed ? "border-slate-800 opacity-30 grayscale" :
                            isDisabled ? "border-slate-800 opacity-50" :
                            "border-slate-800 hover:border-amber-500/50 bg-slate-950"
                          )}
                        >
                          <img 
                            src={god.image} 
                            alt={god.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                          <div className="absolute bottom-1 left-0 right-0 text-center px-0.5">
                            <span className="text-[6px] font-black text-white uppercase tracking-tighter truncate block">{god.name}</span>
                          </div>
                          
                          {isUsed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                              <Lock className="w-3 h-3 text-slate-600" />
                            </div>
                          )}
                          
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px]">
                              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                <Check className="w-2.5 h-2.5 text-slate-950" strokeWidth={4} />
                              </div>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MCL Player Selection */}
              {lobby.config.preset === 'MCL' && effectiveVote && !selectedPlayerId && (
                  <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Select Player</h3>
                    <div className="flex gap-3">
                        {(myTeam === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers)?.map(p => (
                            <button 
                                key={p.position}
                                onClick={() => setSelectedPlayerId(p.position)}
                                className="px-6 py-3 bg-slate-800 hover:bg-amber-500/20 border-2 border-slate-700 hover:border-amber-500 rounded-xl text-white font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-amber-500/10"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                  </div>
              )}

              {/* Status & Selected Info */}
              <div className="bg-slate-950/50 border-t border-slate-800/50 p-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.yourSelection || 'YOUR SELECTION'}</span>
                    <div className="flex items-center gap-3">
                      {effectiveVote ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            {MAJOR_GODS.find(g => g.id === effectiveVote)?.image && (
                              <img 
                                src={MAJOR_GODS.find(g => g.id === effectiveVote)?.image} 
                                alt="Selected" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-tight">
                              {MAJOR_GODS.find(g => g.id === effectiveVote)?.name}
                            </h4>
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
                              {myVote ? (t.confirmed || 'CONFIRMED') : (t.sending || 'SENDING...')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-slate-700">
                          <div className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center">
                            <Sword className="w-4 h-4 opacity-20" />
                          </div>
                          <p className="text-[8px] font-bold uppercase tracking-widest">{t.awaitingSelection || 'AWAITING SELECTION'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-10 w-px bg-slate-800" />

                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.opponentStatus}</span>
                  <div className={cn(
                    "px-4 py-1.5 rounded-xl border transition-all duration-500 flex items-center gap-3",
                    opponentVote 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-slate-900/50 border-slate-800"
                  )}>
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                      opponentVote ? "bg-green-500 text-slate-950" : "bg-slate-950 text-slate-700"
                    )}>
                      {opponentVote ? <Check className="w-4 h-4" strokeWidth={3} /> : <Clock className="w-4 h-4 animate-pulse" />}
                    </div>
                    <div className="text-right">
                      <h4 className={cn("text-[10px] font-black uppercase tracking-tight", opponentVote ? "text-green-500" : "text-slate-400")}>
                        {opponentVote ? t.ready : t.thinking}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="p-2 bg-slate-950 border-t border-slate-800/50 shrink-0">
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Info className="w-2.5 h-2.5" />
            <p className="text-[7px] font-bold uppercase tracking-widest">
              {isCascaGroup ? t.godPickerNoteGroup : t.godPickerNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
