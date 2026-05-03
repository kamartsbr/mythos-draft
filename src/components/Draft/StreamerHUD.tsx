import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lobby, PickEntry, Substitution } from '../../types';
import { lobbyService } from '../../services/lobbyService';
import { MAPS, MAJOR_GODS, TRANSLATIONS } from '../../constants';
import { cn } from '../../lib/utils';
import { Loader2, Eye, EyeOff, Settings2, ChevronLeft, ChevronRight, Trophy, Clock, X, RefreshCw, UserPlus, UserMinus, User } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { MapVisualizer } from '../MapVisualizer';
import { LanguageToggle } from '../UI/LanguageToggle';

interface StreamerHUDProps {
  lobbyId: string;
}

export function StreamerHUD({ lobbyId }: StreamerHUDProps) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'pt' | 'en' | 'es' | 'fr' | 'de' | 'ru' | 'da' | 'it' | 'mx'>('pt');
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  // Manual Control State
  const [manualMode, setManualMode] = useState(false);
  const [displayGameIdx, setDisplayGameIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [visibleElements, setVisibleElements] = useState({
    score: true,
    picks: true,
    maps: true,
    bans: false
  });
  const [showSnakeWarning, setShowSnakeWarning] = useState(false);
  const [hudScale, setHudScale] = useState(0.75);
  const [copiedObs, setCopiedObs] = useState(false);
  const [persistentSubs, setPersistentSubs] = useState<Substitution[]>([]);
  const manualModeRef = useRef(manualMode);
  manualModeRef.current = manualMode;

  const isObsMode = new URLSearchParams(window.location.search).get('view') === 'obs';

  const { timeLeft } = useTimer(lobby, false, false, () => {}, () => {});

  // Load settings from URL if in OBS mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isObs = params.get('view') === 'obs';
    
    if (isObs) {
      const scale = params.get('scale');
      if (scale) setHudScale(parseFloat(scale));
      
      const langParam = params.get('lang');
      if (langParam) setLang(langParam as any);
      
      const score = params.get('score');
      const picks = params.get('picks');
      const maps = params.get('maps');
      const bans = params.get('bans');
      
      setVisibleElements({
        score: score !== 'false',
        picks: picks !== 'false',
        maps: maps !== 'false',
        bans: bans === 'true'
      });
    }
  }, [isObsMode]);

  useEffect(() => {
    if (lobby?.config.preset === 'MCL' && lobby?.selectedMap === 'snake_dance' && lobby?.phase === 'post_draft') {
      setShowSnakeWarning(true);
    }
  }, [lobby?.selectedMap, lobby?.phase, lobby?.config.preset]);

  useEffect(() => {
    const unsubscribe = lobbyService.subscribeToLobby(
      lobbyId, 
      (updatedLobby) => {
        setLobby(updatedLobby);
        setLoading(false);
        
        // Auto-sync game index if not in manual mode (ref avoids re-subscribing on toggle)
        if (!manualModeRef.current && updatedLobby) {
          // If we are in ready phase, show the previous game results if available
          const autoIdx = (updatedLobby.phase === 'ready' && updatedLobby.currentGame > 1)
            ? updatedLobby.currentGame - 2
            : updatedLobby.currentGame - 1;
          setDisplayGameIdx(Math.max(0, autoIdx));
        }
      },
      (err) => {
        console.error("Overlay subscription error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [lobbyId]);

  useEffect(() => {
    if (lobby?.lastSubs && lobby.lastSubs.length > 0) {
      setPersistentSubs(prev => {
        // Only add subs that aren't already in the persistent list (unique check by player names and team)
        const newSubs = lobby.lastSubs!.filter(s => 
          !prev.some(p => p.playerIn === s.playerIn && p.playerOut === s.playerOut && p.team === s.team)
        );
        return [...prev, ...newSubs];
      });
    }
  }, [lobby?.lastSubs]);

  const copyObsUrl = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('view', 'obs');
    url.searchParams.set('scale', hudScale.toString());
    url.searchParams.set('lang', lang);
    url.searchParams.set('score', visibleElements.score.toString());
    url.searchParams.set('picks', visibleElements.picks.toString());
    url.searchParams.set('maps', visibleElements.maps.toString());
    url.searchParams.set('bans', visibleElements.bans.toString());
    
    navigator.clipboard.writeText(url.toString());
    setCopiedObs(true);
    setTimeout(() => setCopiedObs(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-white font-bold">
        Lobby not found
      </div>
    );
  }

  const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
  const seriesMaps = Array.isArray(lobby.seriesMaps) ? lobby.seriesMaps : [];
  const history = Array.isArray(lobby.history) ? lobby.history : [];
  const turnOrder = Array.isArray(lobby.turnOrder) ? lobby.turnOrder : [];
  const spectators = Array.isArray(lobby.spectators) ? lobby.spectators : [];

  const teamAPicks = picks.filter(p => p.team === 'A');
  const teamBPicks = picks.filter(p => p.team === 'B');

  const is1v1 = lobby.config.teamSize === 1;
  const isGodPickerPhase = ['god_picker', 'revealing', 'post_draft', 'reporting'].includes(lobby.phase);

  // Determine if we should show history or current draft
  const isViewingHistory = manualMode || 
                           lobby.phase === 'post_draft' || 
                           lobby.phase === 'reporting' || 
                           lobby.status === 'finished' ||
                           (lobby.phase === 'ready' && lobby.currentGame > 1 && displayGameIdx < lobby.currentGame - 1);

  const historyGame = history[displayGameIdx];
  const displayedGameWinner = historyGame?.winner;

  // For 1v1, if we are in a match phase, we only want to show the currently selected gods
  const displayPicksA = isViewingHistory && historyGame
    ? (historyGame.rosterA || historyGame.picksA.map((godId, i) => ({ godId, team: 'A', playerName: `Player ${i+1}`, playerId: i+1 })))
    : (is1v1 && isGodPickerPhase 
        ? [{ godId: lobby.pickerVoteA, team: 'A', playerName: lobby.captain1Name || 'Host', playerId: 1 }]
        : teamAPicks);
  
  const displayPicksB = isViewingHistory && historyGame
    ? (historyGame.rosterB || historyGame.picksB.map((godId, i) => ({ godId, team: 'B', playerName: `Player ${i+1}`, playerId: i+1 })))
    : (is1v1 && isGodPickerPhase
        ? [{ godId: lobby.pickerVoteB, team: 'B', playerName: lobby.captain2Name || 'Guest', playerId: 1 }]
        : teamBPicks);

  const getGod = (godId: string | null) => MAJOR_GODS.find(g => g.id === godId);

  const isMyTeamTurn = (team: 'A' | 'B') => {
    if (isViewingHistory) return false;
    const turn = turnOrder[lobby.turn];
    if (!turn) return false;
    return turn.target === 'GOD' && (turn.player === team || turn.player === 'BOTH');
  };

  const currentlyPickingPlayerId = (team: 'A' | 'B') => {
    const godPicksBeforeThisTurn = turnOrder
      .filter((t, i) => i < lobby.turn && t.target === 'GOD' && (t.player === team || t.player === 'BOTH'))
      .length;
    const originalTeamPicks = picks.filter(p => p.team === team);
    return originalTeamPicks[godPicksBeforeThisTurn]?.playerId;
  };

  const getStatusMessages = () => {
    const messages: string[] = [];

    if (isViewingHistory) {
      if (displayedGameWinner) {
        messages.push(`${t.victory} - ${displayedGameWinner === 'A' ? (lobby.captain1Name || t.teamA) : (lobby.captain2Name || t.teamB)}`);
      } else {
        messages.push(`${t.game} ${displayGameIdx + 1}`);
      }
    }

    if (!manualMode) {
      switch (lobby.phase) {
        case 'setup': messages.push(t.setupPhase); break;
        case 'ready': messages.push(t.readyPhase); break;
        case 'map_pick': messages.push(t.mapPickPhase); break;
        case 'roster_edit': messages.push(t.rosterEditPhase); break;
        case 'reporting': messages.push(t.reportingPhase); break;
        case 'post_draft': messages.push(t.postDraftPhase); break;
        case 'finished': messages.push(t.finishedPhase); break;
      }
    }

    return messages;
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      {/* Background Color Layer */}
      <div className="absolute inset-0 bg-slate-950" />
      
      {/* Background Media Layer */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none"
        style={{ filter: 'brightness(0.7) contrast(1.1)' }}
      >
        <source src="/mythosdraftstreamerhudbackgroundv1.mp4" type="video/mp4" />
      </video>

      {/* Watermark Cover Logo */}
      <div className="absolute bottom-[9.5%] right-[1.5%] z-0 pointer-events-none opacity-80">
        <img 
          src="https://static.wikia.nocookie.net/ageofempires/images/2/20/AoMR_OM_icon.png/revision/latest?cb=20251217080958" 
          alt="AoM Logo" 
          className="w-28 h-28 object-contain drop-shadow-2xl"
          referrerPolicy="no-referrer"
        />
      </div>
      
      {/* Streamer Controls */}
      <AnimatePresence>
        {showControls && !isObsMode && (
          <motion.div 
            drag
            dragMomentum={false}
            dragConstraints={{ left: 0, right: window.innerWidth - 300, top: 0, bottom: window.innerHeight - 400 }}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-slate-900/95 border border-cyan-500/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-xl space-y-5 w-72 pointer-events-auto cursor-move"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,1)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Neon HUD Controller</span>
              </div>
              <button onClick={() => setShowControls(false)} className="text-slate-500 hover:text-white transition-colors">
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 -mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Language</span>
                <LanguageToggle lang={lang} setLang={setLang as any} />
              </div>

              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manual Override</span>
                  <button 
                    onClick={() => setManualMode(!manualMode)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      manualMode ? "bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" : "bg-slate-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                      manualMode ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-tight">
                  Enable to manually control which game is displayed on the HUD.
                </p>
              </div>

              {manualMode && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Game Display</span>
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-2">
                    <button 
                      onClick={() => setDisplayGameIdx(Math.max(0, displayGameIdx - 1))}
                      className="p-2 hover:text-cyan-400 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-white">GAME {displayGameIdx + 1}</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Manual</span>
                    </div>
                    <button 
                      onClick={() => setDisplayGameIdx(Math.min(seriesMaps.length - 1, displayGameIdx + 1))}
                      className="p-2 hover:text-cyan-400 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Module Visibility</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(visibleElements).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setVisibleElements(prev => ({ ...prev, [key]: !val }))}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                        val 
                          ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" 
                          : "bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600"
                      )}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              {/* HUD Scaling Control */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HUD Scaling</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setHudScale(0.75)}
                      className="text-[8px] font-black text-cyan-500 hover:text-cyan-400 uppercase tracking-tighter"
                    >
                      Reset (75%)
                    </button>
                    <span className="text-[10px] font-bold text-cyan-400">{Math.round(hudScale * 100)}%</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.2" 
                  step="0.05" 
                  value={hudScale} 
                  onChange={(e) => setHudScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* OBS Link Generator */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={copyObsUrl}
                  className={cn(
                    "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2",
                    copiedObs 
                      ? "bg-green-500 text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                      : "bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  )}
                >
                   {copiedObs ? "LINK COPIED!" : "COPY CLEAN OBS LINK"}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[8px] text-slate-500">
                <Settings2 className="w-3 h-3" />
                <span>OBS Browser Source: 1920x1080</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showControls && !isObsMode && (
        <button 
          onClick={() => setShowControls(true)}
          className="fixed left-6 top-6 z-50 p-3 bg-slate-900/80 border border-cyan-500/30 rounded-2xl text-cyan-500 hover:text-white hover:bg-cyan-500/20 transition-all pointer-events-auto shadow-lg backdrop-blur-md"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      )}

      {/* Snake Dance Warning Overlay (Streamer Style) */}
      <AnimatePresence>
        {showSnakeWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl bg-slate-900/90 border-2 border-cyan-500 shadow-[0_0_60px_rgba(6,182,212,0.3)] rounded-[2.5rem] p-12 flex flex-col items-center text-center gap-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
              <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)] relative z-10">
                <Trophy className="w-12 h-12 text-cyan-400" />
              </div>
              <div className="relative z-10">
                <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  {t.snakeDanceWarningTitle}
                </h3>
                <p className="text-cyan-100/70 text-lg font-bold leading-relaxed max-w-md">
                  {t.snakeDanceWarning}
                </p>
              </div>
              <button
                onClick={() => setShowSnakeWarning(false)}
                className="relative z-10 px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95"
              >
                {t.readyBtn || "CONFIRMAR"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN HUD CONTENT */}
      <div 
        className="max-w-[1920px] mx-auto h-screen flex flex-col items-center justify-between py-16 px-24 pointer-events-none relative z-[55] transition-transform duration-500 ease-out"
        style={{ transform: `scale(${hudScale})`, transformOrigin: 'center top' }}
      >
        
        {/* TOP: Scoreboard */}
        <AnimatePresence>
          {visibleElements.score && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-16 w-full max-w-[1400px]">
                {/* Team A */}
                <div className="flex flex-col items-end flex-1 w-0">
                  <div className="flex items-center gap-4">
                    {((lobby.status === 'finished' && lobby.scoreA > lobby.scoreB) || (lobby.status !== 'finished' && isViewingHistory && displayedGameWinner === 'A')) && (
                      <Trophy className={cn(
                        "w-8 h-8 animate-bounce",
                        displayedGameWinner === 'A' && lobby.status !== 'finished' ? "text-cyan-400" : "text-amber-500"
                      )} />
                    )}
                    <span className={cn(
                      "text-5xl font-black uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] whitespace-nowrap",
                      displayedGameWinner === 'A' ? "text-cyan-400" : "text-white"
                    )}>
                      {lobby.captain1Name || 'TEAM A'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gradient-to-l from-cyan-500 to-transparent mt-2 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                  
                  {/* Roster A */}
                  {!is1v1 && lobby.phase.startsWith('god_') && (
                    <div className="flex gap-4 mt-4">
                      {teamAPicks.map((pick, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-950/50 px-3 py-1 rounded-full border border-slate-900">
                          <User className="w-3 h-3 text-cyan-400" />
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">{pick.playerName || pick.assignedPlayerName || `P${i+1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score Center */}
                <div className="relative group shrink-0">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                  <div className="relative flex items-center gap-8 bg-slate-950/90 border-2 border-cyan-500/50 px-12 py-6 rounded-[2rem] backdrop-blur-xl shadow-[0_0_50px_rgba(6,182,212,0.3)] min-w-[320px] justify-center">
                    <span className="text-7xl font-black text-cyan-400 tabular-nums drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] w-[1.5ch] text-center">{lobby.scoreA}</span>
                    <div className="w-1 h-16 bg-slate-800 rounded-full" />
                    <span className="text-7xl font-black text-cyan-400 tabular-nums drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] w-[1.5ch] text-center">{lobby.scoreB}</span>
                  </div>
                  {/* Series Type Badge */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 px-5 py-1 rounded-full text-[12px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.5)] text-center flex items-center justify-center">
                    <span className="ml-[0.2em]">{lobby.config.seriesType?.toUpperCase() === 'CUSTOM' ? t.custom : lobby.config.seriesType}</span>
                  </div>
                </div>

                {/* Team B */}
                <div className="flex flex-col items-start flex-1 w-0">
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-5xl font-black uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] whitespace-nowrap",
                      displayedGameWinner === 'B' ? "text-red-400" : "text-white"
                    )}>
                      {lobby.captain2Name || 'TEAM B'}
                    </span>
                    {((lobby.status === 'finished' && lobby.scoreB > lobby.scoreA) || (lobby.status !== 'finished' && isViewingHistory && displayedGameWinner === 'B')) && (
                      <Trophy className={cn(
                        "w-8 h-8 animate-bounce",
                        displayedGameWinner === 'B' && lobby.status !== 'finished' ? "text-red-400" : "text-amber-500"
                      )} />
                    )}
                  </div>
                  <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-transparent mt-2 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                  
                  {/* Roster B */}
                  {!is1v1 && lobby.phase.startsWith('god_') && (
                    <div className="flex gap-4 mt-4">
                      {teamBPicks.map((pick, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-950/50 px-3 py-1 rounded-full border border-slate-900">
                          <User className="w-3 h-3 text-red-500" />
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">{pick.playerName || pick.assignedPlayerName || `P${i+1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Phase Indicator */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-6 py-2 bg-slate-950/80 border border-cyan-500/30 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center justify-center"
              >
                <span className="text-xs font-black text-cyan-400 uppercase tracking-[0.4em] animate-pulse ml-[0.4em]">
                  {String(t[lobby.phase.replace(/_([a-z])/g, (g) => g[1].toUpperCase()) + 'Phase' as keyof typeof t] || 
                   (lobby.phase === 'finished' ? t.finished : lobby.phase.replace('_', ' ').toUpperCase()))}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MIDDLE: Picks */}
        <AnimatePresence>
          {visibleElements.picks && (
            <div className="flex-1 w-full flex items-center justify-between px-12">
              {/* Team A Picks */}
              <div className="flex flex-col gap-6 flex-1">
                {displayPicksA.map((pick, idx) => {
                  const isCurrentPlayerTurn = isMyTeamTurn('A') && pick.playerId === currentlyPickingPlayerId('A');
                  const hoveredGodId = lobby.hoveredGodIdA;
                  const god = getGod(pick.godId) || (hoveredGodId ? getGod(hoveredGodId) : undefined);
                  const isHovered = !pick.godId && god && isCurrentPlayerTurn;
                  const isRevealing = lobby.phase === 'revealing' || lobby.phase === 'post_draft' || lobby.phase === 'reporting';
                  const showGod = !is1v1 || !isGodPickerPhase || isRevealing;
                  const playerColor = pick.color || '#06b6d4';
                  const isLoser = displayedGameWinner === 'B';

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
                      className={cn("flex items-center gap-6 group", isLoser && "grayscale opacity-50")}
                    >
                      <div 
                        className={cn("w-24 h-24 rounded-2xl overflow-hidden border-2 bg-slate-900 shadow-2xl transition-all relative", isHovered && "opacity-60 border-dashed")}
                        style={{ borderColor: `${playerColor}50`, boxShadow: `0 0 30px ${playerColor}20` }}
                      >
                        {god && showGod ? (
                          <img src={god.image} alt={god.name} className={cn("w-full h-full object-cover", isHovered && "grayscale")} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <div className="w-10 h-10 border-4 border-slate-800 border-t-cyan-500 rounded-full animate-spin" />
                          </div>
                        )}
                        {/* Position Indicator */}
                        {pick.position && (
                          <div className="absolute top-1 right-1 bg-slate-950/80 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-slate-400 border border-slate-800">
                            {pick.position}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: playerColor, boxShadow: `0 0 10px ${playerColor}` }} />
                          <span className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: playerColor }}>
                            {is1v1 ? (lobby.captain1Name || 'HOST') : (pick.playerName || `PLAYER ${pick.playerId}`)}
                          </span>
                        </div>
                        <span className={cn("text-3xl font-black uppercase text-white tracking-tight drop-shadow-xl", isHovered && "text-slate-400")}>
                          {god && showGod ? god.name : (is1v1 && isGodPickerPhase && pick.godId ? 'GOD READY' : 'SELECTING...')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Center: Map Visualizer & Timer */}
              <div className="flex flex-col items-center justify-center gap-8 w-[600px] shrink-0">
                {/* Timer & Status */}
                <div className="flex flex-col items-center gap-4">
                  {timeLeft !== null && !isViewingHistory && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-4 bg-slate-950/80 border border-cyan-500/30 px-8 py-4 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                    >
                      <Clock className={cn("w-8 h-8", timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-cyan-400")} />
                      <span className={cn(
                        "text-5xl font-black tabular-nums tracking-tighter",
                        timeLeft <= 10 ? "text-red-500" : "text-white"
                      )}>
                        {timeLeft}
                      </span>
                    </motion.div>
                  )}
                  
                  {getStatusMessages().length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-2"
                    >
                      {getStatusMessages().map((msg, idx) => (
                        <div key={idx} className="px-6 py-2 bg-slate-950/90 border border-slate-800 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center">
                          <span className={cn(
                            "text-sm font-black uppercase tracking-[0.2em] ml-[0.2em]",
                            idx === 0 && isViewingHistory && displayedGameWinner === 'A' ? "text-cyan-400" : 
                            idx === 0 && isViewingHistory && displayedGameWinner === 'B' ? "text-red-400" : 
                            "text-amber-400"
                          )}>
                            {msg}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Map Visualizer */}
                <div className="w-full">
                  <MapVisualizer 
                    lobby={lobby} 
                    isVisible={(pick) => {
                      const isRevealing = lobby.phase === 'revealing' || lobby.phase === 'post_draft' || lobby.phase === 'reporting';
                      const showGod = !is1v1 || !isGodPickerPhase || isRevealing;
                      return pick.godId !== null && showGod;
                    }}
                    game={isViewingHistory ? historyGame : undefined}
                    t={t}
                  />
                </div>
              </div>

              {/* Team B Picks */}
              <div className="flex flex-col gap-6 items-end flex-1">
                {displayPicksB.map((pick, idx) => {
                  const isCurrentPlayerTurn = isMyTeamTurn('B') && pick.playerId === currentlyPickingPlayerId('B');
                  const hoveredGodId = lobby.hoveredGodIdB;
                  const god = getGod(pick.godId) || (hoveredGodId ? getGod(hoveredGodId) : undefined);
                  const isHovered = !pick.godId && god && isCurrentPlayerTurn;
                  const isRevealing = lobby.phase === 'revealing' || lobby.phase === 'post_draft' || lobby.phase === 'reporting';
                  const showGod = !is1v1 || !isGodPickerPhase || isRevealing;
                  const playerColor = pick.color || '#ef4444';
                  const isLoser = displayedGameWinner === 'A';

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
                      className={cn("flex items-center gap-6 group flex-row-reverse", isLoser && "grayscale opacity-50")}
                    >
                      <div 
                        className={cn("w-24 h-24 rounded-2xl overflow-hidden border-2 bg-slate-900 shadow-2xl transition-all relative", isHovered && "opacity-60 border-dashed")}
                        style={{ borderColor: `${playerColor}50`, boxShadow: `0 0 30px ${playerColor}20` }}
                      >
                        {god && showGod ? (
                          <img src={god.image} alt={god.name} className={cn("w-full h-full object-cover", isHovered && "grayscale")} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <div className="w-10 h-10 border-4 border-slate-800 border-t-red-500 rounded-full animate-spin" />
                          </div>
                        )}
                        {/* Position Indicator */}
                        {pick.position && (
                          <div className="absolute top-1 left-1 bg-slate-950/80 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-slate-400 border border-slate-800">
                            {pick.position}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col text-right">
                        <div className="flex items-center gap-2 flex-row-reverse">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: playerColor, boxShadow: `0 0 10px ${playerColor}` }} />
                          <span className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: playerColor }}>
                            {is1v1 ? (lobby.captain2Name || 'GUEST') : (pick.playerName || `PLAYER ${pick.playerId}`)}
                          </span>
                        </div>
                        <span className={cn("text-3xl font-black uppercase text-white tracking-tight drop-shadow-xl", isHovered && "text-slate-400")}>
                          {god && showGod ? god.name : (is1v1 && isGodPickerPhase && pick.godId ? 'GOD READY' : 'SELECTING...')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Persistent Subs for Streamer (Persistent until dismissed) */}
        <div className="fixed inset-y-0 left-0 w-[280px] md:w-[340px] flex flex-col justify-center pointer-events-none p-6 md:p-8 z-[45] gap-4">
          <AnimatePresence mode="popLayout">
            {persistentSubs.filter(s => s.team === 'A').map((sub, idx) => (
              <motion.div
                key={`sub-a-${idx}`}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-900/95 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl shadow-amber-500/30 pointer-events-auto relative group translate-y-4 md:translate-y-6"
              >
                <button 
                  onClick={() => setPersistentSubs(prev => prev.filter(p => p !== sub))}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-slate-950 animate-spin-slow" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{t.substitutions || 'SUBSTITUTIONS'}</h4>
                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{t.rosterUpdated || 'ROSTER UPDATED'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <UserMinus className="w-3 h-3 text-red-500" />
                      <span className="text-xs font-bold text-slate-500 line-through">{sub.playerOut}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-3 h-3 text-green-500" />
                      <span className="text-sm font-black text-white">{sub.playerIn}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="fixed inset-y-0 right-0 w-[280px] md:w-[340px] flex flex-col justify-center pointer-events-none p-6 md:p-8 z-[45] gap-4">
          <AnimatePresence mode="popLayout">
            {persistentSubs.filter(s => s.team === 'B').map((sub, idx) => (
              <motion.div
                key={`sub-b-${idx}`}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-900/95 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl shadow-amber-500/30 pointer-events-auto relative group text-right translate-y-4 md:translate-y-6"
              >
                <button 
                  onClick={() => setPersistentSubs(prev => prev.filter(p => p !== sub))}
                  className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4 mb-4 flex-row-reverse">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-slate-950 animate-spin-slow" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{t.substitutions || 'SUBSTITUTIONS'}</h4>
                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{t.rosterUpdated || 'ROSTER UPDATED'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 flex-row-reverse">
                  <div className="flex flex-col text-right">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <UserMinus className="w-3 h-3 text-red-500" />
                      <span className="text-xs font-bold text-slate-500 line-through">{sub.playerOut}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <UserPlus className="w-3 h-3 text-green-500" />
                      <span className="text-sm font-black text-white">{sub.playerIn}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* BOTTOM: Maps */}
        <AnimatePresence>
          {visibleElements.maps && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full flex justify-center gap-8 pb-12"
            >
              {(Array.isArray(lobby.seriesMaps) ? lobby.seriesMaps : Object.values(lobby.seriesMaps || {})).map((mapId, idx) => {
                const map = MAPS.find(m => m.id === mapId);
                const isPlayed = idx < (manualMode ? displayGameIdx : lobby.currentGame - 1);
                const isCurrent = idx === (manualMode ? displayGameIdx : lobby.currentGame - 1);
                const winner = lobby.history?.[idx]?.winner;

                return (
                  <div 
                    key={idx}
                    className={cn(
                      "relative w-64 aspect-video rounded-2xl overflow-hidden border-2 transition-all duration-700",
                      isCurrent ? "border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] scale-110 z-10" : 
                      isPlayed ? "border-slate-800 opacity-60 grayscale" : "border-slate-800/30 opacity-20"
                    )}
                  >
                    {map ? (
                      <img src={map.image} alt={map.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">{t.game} {idx + 1}</span>
                      </div>
                    )}
                    {winner && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
                        <div className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-2xl border-2 shadow-2xl transform -rotate-12",
                          winner === 'A' ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-cyan-500/20" : "bg-red-500/20 border-red-500 text-red-400 shadow-red-500/20"
                        )}>
                          <Trophy className="w-8 h-8" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {winner === 'A' ? (lobby.captain1Name || t.teamA) : (lobby.captain2Name || t.teamB)} {t.won || 'WON'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                      <span className={cn(
                        "text-[11px] font-black uppercase tracking-[0.2em]",
                        isCurrent ? "text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" : "text-slate-500"
                      )}>
                        {map ? (t.mapNames?.[map.id] || map.name) : `${t.game} ${idx + 1}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
