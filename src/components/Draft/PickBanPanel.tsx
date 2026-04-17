import { motion, AnimatePresence } from 'motion/react';
import { Search, Info, Check, X, Shield, Sword, Map as MapIcon, Lock, Users, Clock, Dices } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Lobby, God, MapInfo } from '../../types';
import { MAJOR_GODS, MAPS, PANTHEONS } from '../../constants';
import { MapVisualizer } from '../MapVisualizer';
import { ConfirmModal } from '../UI/ConfirmModal';
import { DraftResultCard } from './DraftResultCard';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

interface PickBanPanelProps {
  lobby: Lobby;
  isCaptain1: boolean;
  isCaptain2: boolean;
  handleAction: (id: string, playerId?: number, playerName?: string) => void;
  t: any;
  lang: string;
  reportScore: (winner: 'A' | 'B') => void;
  viewGameIndex: number | null;
  setViewGameIndex: (val: number | null) => void;
  isAdmin: boolean;
  forceFinish: () => void;
  resetCurrentGame: () => void;
  timeLeft: number | null;
}

export function PickBanPanel({ 
  lobby, isCaptain1, isCaptain2, handleAction, t, lang, reportScore, 
  viewGameIndex, setViewGameIndex, isAdmin, forceFinish, resetCurrentGame, timeLeft 
}: PickBanPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedPantheon, setSelectedPantheon] = useState<string | 'ALL'>('ALL');
  const [lastPhase, setLastPhase] = useState<string | null>(null);
  const [selectedGodId, setSelectedGodId] = useState<string | null>(null);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showResetGameConfirm, setShowResetGameConfirm] = useState(false);
  const [showSnakeWarning, setShowSnakeWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lobby.config.preset === 'MCL' && lobby.selectedMap === 'snake_dance' && lobby.phase === 'post_draft') {
      setShowSnakeWarning(true);
    }
  }, [lobby.selectedMap, lobby.phase, lobby.config.preset]);

  const exportImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    
    // Wait for images to potentially load and layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const isFinished = lobby.status === 'finished';
      const width = isFinished ? 1200 : 800;
      const gameRows = Math.ceil(lobby.history.length / 3);
      const height = isFinished ? (500 + (gameRows * 350)) : 600;

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#020617',
        skipFonts: true,
        fontEmbedCSS: '',
        width,
        height,
        style: {
          opacity: '1',
          visibility: 'visible',
          transform: 'none'
        }
      });
      const link = document.createElement('a');
      link.download = `mythos-draft-${lobby.id.slice(0, 6)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
      setError(lang === 'en' ? 'Failed to save image. Please try again.' : 'Falha ao salvar imagem. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };
  
  const currentTurn = lobby.turnOrder[lobby.turn];
  const isMyTurn = (isCaptain1 && currentTurn?.player === 'A') || 
                   (isCaptain2 && currentTurn?.player === 'B') ||
                   (currentTurn?.player === 'BOTH') ||
                   (isAdmin && currentTurn?.player === 'ADMIN');

  const selectedPositionId = useMemo(() => {
    if (lobby.phase !== 'god_pick') return undefined;
    
    const team = currentTurn?.player;
    if (team === 'A' || team === 'B') {
      const nextPick = lobby.picks.find(p => p.team === team && p.godId === null);
      return nextPick?.playerId;
    } else if (team === 'BOTH') {
      const nextPick = lobby.picks.find(p => p.godId === null);
      return nextPick?.playerId;
    }
    return undefined;
  }, [lobby.phase, lobby.picks, currentTurn]);

  // Phase transition effect
  useEffect(() => {
    if (!isMyTurn) {
      setSelectedGodId(null);
    }
  }, [isMyTurn]);

  useEffect(() => {
    setSelectedGodId(null);
  }, [lobby.turn]);

  useEffect(() => {
    if (lobby.phase !== lastPhase && lobby.status === 'drafting') {
      setLastPhase(lobby.phase);
      setShowPhaseTransition(true);
      setIsTransitioning(true);
      
      // Auto-dismiss after 2 seconds instead of 3 to reduce perceived lag
      const timer = setTimeout(() => {
        setShowPhaseTransition(false);
        setIsTransitioning(false);
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [lobby.phase, lobby.status, lastPhase]);

  const getPhaseTitle = (phase: string) => {
    // Try camelCase first
    const camelPhase = phase.replace(/_([a-z])/g, (g) => g[1].toUpperCase()) + 'Phase';
    if (t[camelPhase]) return t[camelPhase];
    
    // Fallback to manual translation or formatted string
    const manual: Record<string, string> = {
      'map_ban': t.mapBanPhase || 'Map Ban Phase',
      'map_pick': t.mapPickPhase || 'Map Pick Phase',
      'god_ban': t.godBanPhase || 'God Ban Phase',
      'god_pick': t.godPickPhase || 'God Pick Phase',
      'ace_pick': t.acePickPhase || 'Ace Pick Phase'
    };
    return manual[phase] || phase.replace('_', ' ').toUpperCase();
  };

  // If we are viewing a previous game, we show its results
  const isViewingHistory = viewGameIndex !== null;
  const historyGame = isViewingHistory ? lobby.history[viewGameIndex!] : null;

  const filteredGods = useMemo(() => {
    return MAJOR_GODS.filter(god => {
      const matchesSearch = god.name.toLowerCase().includes(search.toLowerCase());
      const matchesPantheon = selectedPantheon === 'ALL' || god.culture === selectedPantheon;
      const isAllowed = !lobby.config.allowedPantheons || 
                        lobby.config.allowedPantheons.length === 0 || 
                        lobby.config.allowedPantheons.includes(god.id);
      return matchesSearch && matchesPantheon && isAllowed;
    });
  }, [search, selectedPantheon, lobby.config.allowedPantheons]);

  const availableMaps = useMemo(() => {
    let maps = MAPS;
    if (lobby.config.allowedMaps && lobby.config.allowedMaps.length > 0) {
      maps = MAPS.filter(m => lobby.config.allowedMaps.includes(m.id));
    }

    // Special Case: Casca Grossa Playoffs restricted selection for subsequent games
    if (lobby.config.preset === 'CASCA' && lobby.config.tournamentStage === 'PLAYOFFS' && lobby.currentGame > 1 && lobby.mapPool) {
      maps = maps.filter(m => lobby.mapPool?.includes(m.id));
    }

    return maps;
  }, [lobby.config.allowedMaps, lobby.config.preset, lobby.config.tournamentStage, lobby.currentGame, lobby.mapPool]);

  const isGodBanned = (godId: string) => lobby.bans.includes(godId);
  const isGodPicked = (godId: string) => lobby.picks.some(p => p.godId === godId);
  const isGodPickedByMyTeam = (godId: string) => {
    const myTeam = isCaptain1 ? 'A' : isCaptain2 ? 'B' : null;
    if (!myTeam) return false;
    return lobby.picks.some(p => p.team === myTeam && p.godId === godId);
  };
  const isMapBanned = (mapId: string) => lobby.mapBans.includes(mapId);
  const isMapPicked = (mapId: string) => lobby.seriesMaps.includes(mapId);

  if (isViewingHistory && historyGame) {
    const gameMap = MAPS.find(m => m.id === historyGame.mapId);
    return (
      <div className="flex-1 flex flex-col p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewGameIndex(null)}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                {t.game} {historyGame.gameNumber} {t.history}
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                {gameMap ? (t.mapNames?.[gameMap.id] || gameMap.name) : t.unknownMap}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest",
            historyGame.winner === 'A' ? "bg-blue-500/20 text-blue-500" : "bg-red-500/20 text-red-500"
          )}>
            {historyGame.winner === 'A' ? (lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)) : (lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB))} {t.won}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 overflow-y-auto custom-scrollbar pt-4">
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            <MapVisualizer 
              lobby={lobby} 
              isVisible={() => true} 
              game={historyGame}
              t={t}
            />
            
            <div className="w-full flex justify-between gap-4 px-2">
              <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow-xl">
                <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-2">
                  <Shield className="w-3 h-3" /> {lobby.captain1Name || t.teamA}
                </div>
                {historyGame.rosterA?.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">{p.playerName || `Player ${i+1}`}</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase">{t[p.position] || p.position}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow-xl">
                <div className="text-[9px] font-black text-red-500 uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-2 justify-end">
                  {lobby.captain2Name || t.teamB} <Sword className="w-3 h-3" />
                </div>
                {historyGame.rosterB?.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 flex-row-reverse">
                    <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">{p.playerName || `Player ${i+1}`}</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase">{t[p.position] || p.position}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setViewGameIndex(null)}
            className="mt-4 px-8 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white hover:border-slate-700 transition-all"
          >
            {t.backToCurrentDraft}
          </button>
        </div>
      </div>
    );
  }

  if (lobby.phase === 'post_draft' && lobby.status === 'drafting') {
    const gameMapId = lobby.seriesMaps[lobby.currentGame - 1];
    const gameMap = MAPS.find(m => m.id === gameMapId);

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-full">
                {t.game} {lobby.currentGame}
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {t.battlefieldStrategy || 'Battlefield Strategy'}
              </h2>
            </div>
            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              {lobby.config.seriesType} {t.series}
            </span>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center gap-8">
            <div className="w-full max-w-md">
              {lobby.config.preset !== 'CASCA' && (
                <MapVisualizer 
                  lobby={lobby} 
                  isVisible={() => true} 
                  isCaptain1={isCaptain1}
                  isCaptain2={isCaptain2}
                  selectedPositionId={selectedPositionId}
                  t={t}
                />
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center max-w-md">
              <h3 className="text-amber-500 font-black uppercase tracking-widest text-sm mb-2">
                {t.gameInProgress || 'GAME IN PROGRESS'}
              </h3>
              <p className="text-slate-300 text-xs font-medium leading-relaxed">
                {t.gameInProgressDesc || 'Agora joguem a partida e voltem aqui apenas após o término do jogo. NÃO FECHEM O LINK DO DRAFT!'}
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex gap-4 w-full max-w-sm">
                <button
                  onClick={() => reportScore(null as any)}
                  disabled={(!isCaptain1 && !isCaptain2) || (isCaptain1 && lobby.readyA_report) || (isCaptain2 && lobby.readyB_report)}
                  className={cn(
                    "flex-1 py-4 font-black text-lg rounded-2xl uppercase tracking-widest transition-all shadow-xl",
                    ((!isCaptain1 && !isCaptain2) || (isCaptain1 && lobby.readyA_report) || (isCaptain2 && lobby.readyB_report))
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20"
                  )}
                >
                  {!isCaptain1 && !isCaptain2 
                    ? t.spectating || 'SPECTATING'
                    : (isCaptain1 && lobby.readyA_report) || (isCaptain2 && lobby.readyB_report) 
                      ? t.waitingOpponent
                      : t.continueToReport}
                </button>
                
                <button
                  onClick={exportImage}
                  disabled={isExporting}
                  className="px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                  title="Export Match Card"
                >
                  <MapIcon className={cn("w-5 h-5", isExporting && "animate-pulse")} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{isExporting ? t.exporting || 'EXPORTING...' : t.export || 'EXPORT'}</span>
                </button>
              </div>

              <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
                <DraftResultCard lobby={lobby} t={t} cardRef={cardRef} />
              </div>
              
              {(lobby.readyA_report || lobby.readyB_report) && (
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", lobby.readyA_report ? "bg-green-500" : "bg-slate-700")} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", lobby.readyB_report ? "bg-green-500" : "bg-slate-700")} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (lobby.phase === 'map_ban' || lobby.phase === 'map_pick') {
    return (
      <div className="flex flex-col h-full p-8">
        <div className="mb-8 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-1">
              {t[lobby.phase + 'Phase'] || lobby.phase.replace('_', ' ').toUpperCase()}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              {currentTurn?.player === 'ADMIN' 
                ? (lobby.phase === 'map_pick' ? t.systemPickingMap : t.systemPicking)
                : (isMyTurn ? t.yourTurn : t.waitingOpponent)}
            </p>
          </div>

          {timeLeft !== null && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "px-8 py-2 md:py-3 rounded-2xl border-2 flex items-center gap-4 transition-all duration-300 bg-slate-900/40 backdrop-blur-md shadow-xl",
                timeLeft <= 5 ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]" : "border-slate-800"
              )}
            >
              <Clock className={cn("w-5 h-5 md:w-6 md:h-6", timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-amber-500")} />
              <span className={cn("text-3xl md:text-5xl font-black tabular-nums tracking-tight", timeLeft <= 5 ? "text-red-500" : "text-white")}>
                {timeLeft}
              </span>
            </motion.div>
          )}

          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setShowResetGameConfirm(true)}
                    className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/5"
                  >
                    Reset Current Game
                  </button>
                  <button 
                    onClick={() => setShowFinishConfirm(true)}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5 mr-4"
                  >
                    {t.forceFinish || "Forçar Fim"}
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
              <MapIcon className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {availableMaps.length} {t.mapsAvailable}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar max-w-5xl mx-auto w-full">
          {availableMaps.map(map => {
            const isBanned = isMapBanned(map.id);
            const isPicked = isMapPicked(map.id);
            const isDisabled = isBanned || isPicked || !isMyTurn;

            return (
              <motion.button
                key={map.id}
                whileHover={!isDisabled ? { scale: 1.05, y: -4 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
                onClick={() => !isDisabled && handleAction(map.id)}
                disabled={isDisabled}
                className={cn(
                  "relative aspect-video rounded-2xl overflow-hidden border-2 transition-all duration-300 group",
                  isBanned ? "border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]" :
                  isPicked ? "border-green-500/50 opacity-40 grayscale" :
                  isMyTurn ? "border-slate-800 hover:border-amber-500 shadow-lg hover:shadow-amber-500/10" :
                  "border-slate-800 opacity-60 grayscale"
                )}
              >
                <img 
                  src={map.image} 
                  alt={map.name}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                    isBanned && "grayscale saturate-[3] sepia-[0.2] hue-rotate-[-50deg] brightness-[0.7]"
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight truncate block">
                    {t.mapNames?.[map.id] || map.name}
                  </span>
                </div>
                {isBanned && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/60 backdrop-blur-[1px] z-10">
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="relative"
                    >
                      <X className="w-16 h-16 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,1)]" strokeWidth={4} />
                    </motion.div>
                    <motion.span 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] font-black text-red-500 uppercase tracking-[0.3em] mt-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    >
                      {t.banned}
                    </motion.span>
                  </div>
                )}
                {isPicked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/80 backdrop-blur-[2px] z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Check className="w-16 h-16 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" strokeWidth={3} />
                    </motion.div>
                    <motion.span 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mt-2 drop-shadow-md"
                    >
                      {t.picked}
                    </motion.span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-8 relative overflow-hidden">
      {/* Phase Transition Overlay */}
      <AnimatePresence>
        {showPhaseTransition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            onClick={() => setShowPhaseTransition(false)}
            className="absolute inset-0 z-[100] flex items-center justify-center cursor-pointer"
          >
            <div className="bg-slate-900/60 border-y border-amber-500/30 w-full py-12 flex flex-col items-center shadow-[0_0_100px_rgba(0,0,0,0.5)]">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-amber-500 font-black text-sm uppercase tracking-[0.5em] mb-4"
              >
                {t.actionRequired}
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter text-center px-4"
              >
                {getPhaseTitle(lobby.phase)}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse"
              >
                {t.clickToDismiss || 'CLICK TO DISMISS'}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchGods}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
          />
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowResetGameConfirm(true)}
              className="px-6 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/5"
            >
              Reset Current Game
            </button>
            <button 
              onClick={() => setShowFinishConfirm(true)}
              className="px-6 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
            >
              {t.forceFinish || "Forçar Fim"}
            </button>
          </div>
        )}
      </div>

      {lobby.selectedMap && lobby.config.preset !== 'CASCA' && (
        <div className="mb-4 flex flex-col items-center">
          <div className="w-full max-w-xs sm:max-w-sm">
            <MapVisualizer 
              lobby={lobby} 
              isVisible={() => true} 
              isCaptain1={isCaptain1}
              isCaptain2={isCaptain2}
              selectedPositionId={selectedPositionId}
              t={t}
              timeLeft={timeLeft}
            />
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        onConfirm={forceFinish}
        title={lang === 'en' ? "Admin: Force Finish" : "Admin: Forçar Finalização"}
        message={lang === 'en' 
          ? "This will immediately end the draft and go to the results screen. Are you sure?" 
          : "Isso encerrará imediatamente o draft e irá para a tela de resultados. Tem certeza?"}
        confirmText={lang === 'en' ? "Finish Draft" : "Finalizar Draft"}
      />

      <ConfirmModal 
        isOpen={showResetGameConfirm}
        onClose={() => setShowResetGameConfirm(false)}
        onConfirm={() => {
          resetCurrentGame();
          setShowResetGameConfirm(false);
        }}
        title={lang === 'en' ? "Admin: Reset Current Game" : "Admin: Resetar Jogo Atual"}
        message={lang === 'en' 
          ? "This will clear all picks and bans for the current game only, returning to the start of this game's draft phase. Series score and history will be preserved. Are you sure?" 
          : "Isso limpará todas as escolhas e banimentos apenas do jogo atual, retornando ao início da fase de draft deste jogo. O placar da série e o histórico serão preservados. Tem certeza?"}
        confirmText={lang === 'en' ? "Reset Game" : "Resetar Jogo"}
      />

      {/* Snake Dance Warning Overlay */}
      <AnimatePresence>
        {showSnakeWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl bg-slate-900 border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)] rounded-3xl p-8 flex flex-col items-center text-center gap-6"
            >
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center border-2 border-amber-500 animate-pulse">
                <Info className="w-10 h-10 text-amber-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  {t.snakeDanceWarningTitle}
                </h3>
                <p className="text-slate-400 font-medium leading-relaxed">
                  {t.snakeDanceWarning}
                </p>
              </div>
              <button
                onClick={() => setShowSnakeWarning(false)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl uppercase tracking-widest transition-all shadow-xl shadow-amber-500/20"
              >
                {t.readyBtn || "ENTENDIDO"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gods Grid Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {t[lobby.phase + 'Phase'] || lobby.phase.replace('_', ' ').toUpperCase()}
          </h2>
          <motion.p 
            animate={isMyTurn ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em]",
              isMyTurn ? "text-amber-500" : "text-slate-500"
            )}
          >
            {isMyTurn ? t.yourTurn : (lobby.phase === 'god_picker' ? t.waitingOpponentConfirm : t.opponentTurn)}
          </motion.p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
          <Info className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {lobby.config.isExclusive ? t.exclusive : t.nonExclusive}
          </span>
        </div>
      </div>

      {/* Gods Grid */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 pb-2">
          {filteredGods.map(god => {
            const isAztec = god.culture === 'Aztec';
            const isBanned = isGodBanned(god.id);
            const isPicked = isGodPicked(god.id);
            const isPickedByMyTeam = isGodPickedByMyTeam(god.id);
            const isDisabled = isAztec || isBanned || (lobby.config.isExclusive && isPicked) || isPickedByMyTeam || !isMyTurn;

            return (
              <motion.button
                key={god.id}
                layoutId={`god-${god.id}`}
                whileHover={!isDisabled ? { scale: 1.05, y: -1 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (isDisabled) return;
                  if (lobby.config.preset === 'MCL' && lobby.phase === 'god_pick') {
                    setSelectedGodId(prev => prev === god.id ? null : god.id);
                  } else {
                    handleAction(god.id);
                  }
                }}
                disabled={isDisabled}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border transition-all duration-300 group",
                  isAztec ? "border-slate-800 opacity-60" :
                  isBanned ? "border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.4)]" :
                  (isPicked && lobby.config.isExclusive) || isPickedByMyTeam ? "border-blue-900/50 opacity-40 grayscale" :
                  selectedGodId === god.id ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105" :
                  isMyTurn ? "border-slate-800 hover:border-amber-500 shadow-lg hover:shadow-amber-500/10" :
                  "border-slate-800 opacity-60 grayscale"
                )}
              >
                <img 
                  src={god.image} 
                  alt={god.name}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                    isBanned && "grayscale saturate-[3] sepia-[0.2] hue-rotate-[-50deg] brightness-[0.5]"
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-1">
                  <span className="text-[7px] font-black text-white uppercase tracking-tighter truncate block text-center">
                    {god.name}
                  </span>
                </div>
                
                {/* Status Overlays */}
                <AnimatePresence>
                  {isAztec && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-slate-950/60"
                    >
                      <Lock className="w-6 h-6 text-slate-500" />
                    </motion.div>
                  )}
                  
                  {isBanned && !isAztec && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/60 backdrop-blur-[1px]"
                    >
                      <motion.div
                        initial={{ rotate: -45, scale: 5 }}
                        animate={{ rotate: -12, scale: 1 }}
                        className="border border-red-500 px-1 py-0.5 rounded shadow-2xl"
                      >
                        <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter italic">BANNED</span>
                      </motion.div>
                      <X className="w-8 h-8 text-red-500 absolute opacity-20" strokeWidth={3} />
                    </motion.div>
                  )}
                  
                  {((isPicked && lobby.config.isExclusive) || isPickedByMyTeam) && !isAztec && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-blue-950/60 backdrop-blur-[1px]"
                    >
                      <motion.div
                        initial={{ rotate: 12, scale: 5 }}
                        animate={{ rotate: 12, scale: 1 }}
                        className="border border-blue-500 px-1 py-0.5 rounded shadow-2xl"
                      >
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter italic">PICKED</span>
                      </motion.div>
                      <Check className="w-8 h-8 text-blue-500 absolute opacity-20" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* MCL Player Selection */}
      {lobby.config.preset === 'MCL' && lobby.phase === 'god_pick' && isMyTurn && (
        <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <h4 className="text-xs font-bold text-slate-300 mb-2 text-center uppercase tracking-widest">
            {selectedGodId ? t.selectPlayerForGod || "Select a player for this God" : t.selectGodFirst || "Select a God first"}
          </h4>
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {(isCaptain1 ? lobby.teamAPlayers : lobby.teamBPlayers).map((tp, idx) => {
              const lowerTpName = tp.name.toLowerCase().trim();
              const isAssigned = lobby.picks.some(p => 
                p.team === (isCaptain1 ? 'A' : 'B') && 
                p.playerName?.toLowerCase().trim() === lowerTpName && 
                p.godId !== null
              );
              return (
                <button
                  key={idx}
                  disabled={!selectedGodId || isAssigned}
                  onClick={() => {
                    if (selectedGodId && !isAssigned) {
                      // MCL Rule: The player selected always goes to the NEXT available pick slot
                      // regardless of where their name was "preserved" from the previous game.
                      const targetPick = lobby.picks.find(p => p.team === (isCaptain1 ? 'A' : 'B') && p.godId === null);
                      
                      if (targetPick) {
                        handleAction(selectedGodId, targetPick.playerId, tp.name);
                        setSelectedGodId(null);
                      }
                    }
                  }}
                  className={cn(
                    "px-4 py-3 sm:px-8 sm:py-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-1 shadow-lg",
                    isAssigned ? "border-slate-800 opacity-50 grayscale" :
                    selectedGodId ? "border-slate-700 hover:border-amber-500 hover:bg-amber-500/20 hover:shadow-amber-500/10 cursor-pointer" :
                    "border-slate-800 opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "text-xs sm:text-sm font-black uppercase tracking-widest truncate max-w-[100px] sm:max-w-[140px]",
                    isAssigned ? "text-slate-500" : "text-white"
                  )}>
                    {tp.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 pt-6 border-t border-slate-900 flex flex-col gap-8">
        {/* Series Progress Bar (Image Reference Style) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t.seriesScore}</span>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">{lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}</span>
                <span className="text-2xl font-black text-blue-500">{lobby.scoreA}</span>
              </div>
              <div className="text-xl font-black text-slate-700 italic uppercase tracking-tighter">VS</div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black text-red-500">{lobby.scoreB}</span>
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">{lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: lobby.config.seriesType === 'CUSTOM' ? (lobby.config.customGameCount || 1) : parseInt(lobby.config.seriesType.replace('BO', '')) }).map((_, idx) => {
              const game = lobby.history[idx];
              const isCurrent = idx === lobby.currentGame - 1;
              const map = game ? MAPS.find(m => m.id === game.mapId) : (isCurrent ? MAPS.find(m => m.id === lobby.selectedMap) : null);
              
              return (
                <button 
                  key={idx}
                  onClick={() => {
                    if (game) setViewGameIndex(idx);
                    else if (isCurrent) setViewGameIndex(null);
                  }}
                  className={cn(
                    "relative w-32 h-20 rounded-2xl border-2 transition-all duration-300 overflow-hidden group",
                    game ? (game.winner === 'A' ? "border-blue-500/50 hover:border-blue-500" : "border-red-500/50 hover:border-red-500") :
                    isCurrent ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]" :
                    "border-slate-800 opacity-40"
                  )}
                >
                  {map ? (
                    <>
                      <img src={map.image} alt="Map" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors" />
                      {game && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shadow-2xl",
                            game.winner === 'A' ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                          )}>
                            <Check className="w-6 h-6" strokeWidth={4} />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 py-1 text-[8px] font-black text-center uppercase tracking-tighter text-white border-t border-white/5">
                        G{idx + 1}: {t.mapNames?.[map.id] || map.name}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-800">
                      G{idx + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.banned}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.picked}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Info className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-widest">
              {isMyTurn ? t.yourTurnToAct : t.waitingOpponentTurn}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
