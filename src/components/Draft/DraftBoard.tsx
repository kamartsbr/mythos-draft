import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Trophy, AlertTriangle, Sword, Shield, Users, ArrowRight, Clock, Copy, Link as LinkIcon, Map as MapIcon, Pause, X, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby, PickEntry, Substitution } from '../../types';
import { MAPS } from '../../constants';
import { TeamColumn } from './TeamColumn';
import { PickBanPanel } from './PickBanPanel';
import { GodPicker } from './GodPicker';
import { EndScreen } from './EndScreen';
import { ConfirmModal } from '../UI/ConfirmModal';
import { RosterEditor } from './RosterEditor';

interface DraftBoardProps {
  lobby: Lobby;
  guestId: string;
  isCaptain1: boolean;
  isCaptain2: boolean;
  handleAction: (id: string, playerId?: number) => void;
  handlePickerAction: (id: string, playerId?: number) => void;
  copyUrl: () => void;
  t: any;
  handleReady: (isReady?: boolean) => void;
  isProcessing: boolean;
  optimisticReady: boolean | null;
  optimisticAction: { id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban' } | null;
  reportScore: (winner: 'A' | 'B') => void;
  resetVotes: () => void;
  onHome: () => void;
  lang: string;
  timeLeft: number | null;
  error: string | null;
  setError: (val: string | null) => void;
  viewGameIndex: number | null;
  setViewGameIndex: (val: number | null) => void;
  isAdmin: boolean;
  forceReset: () => void;
  resetCurrentGame: () => void;
  forceFinish: () => void;
  forceUnpause: () => void;
  forceStartDraft: () => void;
  onShowReplay: () => void;
  updateRoster: (newPicks: PickEntry[], subs: Substitution[]) => void;
  clearSubs: () => void;
  requestReset: () => void;
  respondReset: (accept: boolean) => void;
}

export function DraftBoard(props: DraftBoardProps) {
  const { lobby, isCaptain1, isCaptain2, t, handleReady, isProcessing, optimisticReady, optimisticAction, reportScore, resetVotes, copyUrl, handlePickerAction, onHome, viewGameIndex, setViewGameIndex, error, setError, isAdmin, forceReset, resetCurrentGame, forceFinish, forceUnpause, updateRoster, clearSubs, requestReset, respondReset, forceStartDraft } = props;
  
  // Safety check for mallformed lobby data
  if (!lobby || !lobby.config) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando dados do lobby...</p>
      </div>
    );
  }

  const [confirmWinner, setConfirmWinner] = useState<'A' | 'B' | null>(null);
  const [conflictCountdown, setConflictCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRosterEditor, setShowRosterEditor] = useState<false | 'A' | 'B'>(false);
  const [hasDismissedComboWarning, setHasDismissedComboWarning] = useState(false);
  const [showComboWarning, setShowComboWarning] = useState(false);

  const readyA = (isCaptain1 && optimisticReady !== null) ? optimisticReady : (lobby.readyA || false);
  const readyB = (isCaptain2 && optimisticReady !== null) ? optimisticReady : (lobby.readyB || false);
  const readyA_next = (isCaptain1 && optimisticReady !== null) ? optimisticReady : (lobby.readyA_nextGame || false);
  const readyB_next = (isCaptain2 && optimisticReady !== null) ? optimisticReady : (lobby.readyB_nextGame || false);

  const isGame1Ready = lobby.currentGame === 1 && (lobby.status === 'waiting' || lobby.phase === 'ready' || lobby.phase === 'waiting');
  const isReadyWaitPhase = isGame1Ready || lobby.phase === 'ready_picker';
  const displayReadyA = isReadyWaitPhase ? readyA : readyA_next;
  const displayReadyB = isReadyWaitPhase ? readyB : readyB_next;

  const isTeamSizeWithRoster = lobby.config.teamSize > 1 || lobby.config.preset === 'MCL';

  useEffect(() => {
    setHasDismissedComboWarning(false);
  }, [lobby.currentGame]);

  useEffect(() => {
    if (lobby.config.preset === 'MCL' && !hasDismissedComboWarning) {
      const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
      const teamAPicks = picks.filter(p => p.team === 'A').map(p => p.godId);
      const teamBPicks = picks.filter(p => p.team === 'B').map(p => p.godId);

      const hasComboA = (teamAPicks.includes('ra') || teamAPicks.includes('set')) && teamAPicks.includes('demeter');
      const hasComboB = (teamBPicks.includes('ra') || teamBPicks.includes('set')) && teamBPicks.includes('demeter');

      if ((isCaptain1 && hasComboA) || (isCaptain2 && hasComboB)) {
        setShowComboWarning(true);
      } else {
        setShowComboWarning(false);
      }
    } else {
      setShowComboWarning(false);
    }
  }, [lobby.picks, lobby.config.preset, isCaptain1, isCaptain2, hasDismissedComboWarning]);

  useEffect(() => {
    const lastSubs = Array.isArray(lobby.lastSubs) ? lobby.lastSubs : [];
    if (lobby.phase.startsWith('god_') && lastSubs.length > 0) {
      if (isAdmin || isCaptain1) { // Limit to one client avoiding duplicate DB writes
        const timer = setTimeout(() => {
          clearSubs();
        }, 10000);
        return () => clearTimeout(timer);
      }
    }
  }, [lobby.phase, lobby.lastSubs, isAdmin, isCaptain1, clearSubs]);

  useEffect(() => {
    if (lobby.voteConflict && lobby.voteConflictCount < 2) {
      // Only initialize to 10 if it's currently null
      setConflictCountdown(prev => prev === null ? 10 : prev);
      
      const interval = setInterval(() => {
        setConflictCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            resetVotes();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setConflictCountdown(null);
    }
  }, [lobby.voteConflict, lobby.voteConflictCount, isCaptain1, resetVotes]);

  // If we are viewing history, we should show the PickBanPanel in history mode
  if (viewGameIndex !== null) {
    return (
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 overflow-y-auto md:overflow-hidden custom-scrollbar">
        <div className="order-2 md:order-1 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-r border-slate-900">
          <TeamColumn 
            team="A" 
            lobby={lobby} 
            isCurrentTurn={false} 
            t={t} 
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            timeLeft={props.timeLeft}
            timerDuration={lobby.config.timerDuration || 60}
            optimisticAction={optimisticAction}
          />
        </div>
        <div className="order-1 md:order-2 col-span-12 md:col-span-6 bg-slate-950/30 backdrop-blur-sm relative flex flex-col overflow-hidden min-h-[600px] md:min-h-0">
          <PickBanPanel 
            lobby={lobby}
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            handleAction={props.handleAction}
            t={t}
            lang={props.lang}
            reportScore={reportScore}
            viewGameIndex={viewGameIndex}
            setViewGameIndex={setViewGameIndex}
            isAdmin={isAdmin}
            forceFinish={forceFinish}
            resetCurrentGame={props.resetCurrentGame}
            requestReset={requestReset}
            timeLeft={props.timeLeft}
            optimisticAction={optimisticAction}
          />
        </div>
        <div className="order-3 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-l border-slate-900">
          <TeamColumn 
            team="B" 
            lobby={lobby} 
            isCurrentTurn={false} 
            t={t} 
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            timeLeft={props.timeLeft}
            timerDuration={lobby.config.timerDuration || 60}
            optimisticAction={optimisticAction}
          />
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    copyUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (lobby.phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-8">
            <Users className="w-12 h-12 text-blue-500" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tight">{t.waitingForOpponent}</h2>
          <p className="text-slate-400 mb-12">{t.shareInviteDesc}</p>
          
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-4 group">
              <LinkIcon className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors" />
              <input 
                type="text" 
                readOnly 
                value={window.location.href}
                className="flex-1 bg-transparent border-none text-slate-300 text-sm focus:outline-none"
              />
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className={cn(
                "w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-lg shadow-xl",
                copied 
                  ? "bg-green-500 text-slate-950 shadow-green-500/20" 
                  : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20"
              )}
            >
              {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
              {copied ? t.linkCopied : t.copyInviteLink}
            </motion.button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4 text-slate-600">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.waitingForJoin}</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Post-Draft Map Info Screen - REMOVED full screen overlay
  // We will integrate this into PickBanPanel instead

  // Post-Game Ready State
  if (lobby.phase === 'ready') {
    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence>
          {showComboWarning && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
            >
              <div className="max-w-md w-full bg-red-600 border-2 border-red-400 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] text-center">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">{t.bannedComboTitle || 'COMBO BANIDO!'}</h2>
                <p className="text-red-50 mb-8 font-bold leading-relaxed">
                  {t.bannedComboDesc || 'A tática do Hamadryad + SS está banida do campeonato MCL. Sua composição atual (Ra/Set + Demeter) viola esta regra e pode resultar em desclassificação.'}
                </p>
                <button 
                  onClick={() => setHasDismissedComboWarning(true)}
                  className="w-full py-4 bg-white text-red-600 rounded-2xl font-black text-lg hover:bg-red-50 transition-all shadow-xl"
                >
                  {t.iUnderstand || 'EU ENTENDO'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center"
          >
            <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
              <Clock className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tight">
              {t.readyNextGame?.replace('{game}', lobby.currentGame.toString())}
            </h2>
            <p className="text-slate-400 mb-12">{t.readyNextGameDesc}</p>
            
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                {(isCaptain1 || isCaptain2) && (
                  <button
                    onClick={() => handleReady(!(isCaptain1 ? displayReadyA : displayReadyB))}
                    disabled={isProcessing}
                    className={cn(
                      "flex-1 md:flex-none px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all shadow-xl",
                      (isCaptain1 ? displayReadyA : displayReadyB)
                        ? "bg-slate-800 text-amber-500 border-2 border-amber-500/50 hover:bg-slate-700"
                        : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20",
                      isProcessing && "opacity-70 cursor-wait"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    ) : (isCaptain1 ? displayReadyA : displayReadyB) 
                      ? (t.waitingOpponent || 'WAITING FOR OPPONENT') 
                      : (t.readyBtn || 'READY')}
                  </button>
                )}

                {isTeamSizeWithRoster && (
                  <div className="flex gap-2">
                    {(isCaptain1 || (isAdmin && !isCaptain2)) && (
                      <button
                        onClick={() => setShowRosterEditor('A')}
                        className="px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {(isAdmin && !isCaptain1) ? "EDIT A" : t.editRoster}
                      </button>
                    )}
                    {(isCaptain2 || (isAdmin && !isCaptain1)) && (
                      <button
                        onClick={() => setShowRosterEditor('B')}
                        className="px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {(isAdmin && !isCaptain2) ? "EDIT B" : t.editRoster}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isTeamSizeWithRoster && (
                <AnimatePresence>
                  {((isCaptain1 && lobby.rosterChangedB) || (isCaptain2 && lobby.rosterChangedA)) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-3 px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">{t.enemyRosterChanged}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              <div className="flex gap-8">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain1Name || t.teamA}</span>
                  <div className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    displayReadyA ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
                  )}>
                    {displayReadyA ? t.ready : t.waiting}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain2Name || t.teamB}</span>
                  <div className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    displayReadyB ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
                  )}>
                    {displayReadyB ? t.ready : t.waiting}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        <AnimatePresence>
          {showRosterEditor && (
            <RosterEditor 
              lobby={lobby}
              team={showRosterEditor}
              onClose={() => setShowRosterEditor(false)}
              onSave={updateRoster}
              t={t}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (lobby.phase === 'ready_picker') {
    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center"
          >
            <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
              <Sword className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tight">
              {t.readyForPicker || 'PREPARE FOR SELECTION'}
            </h2>
            <p className="text-slate-400 mb-12">{t.readyForPickerDesc || 'God pool drafted. Get ready to pick your god for the current map.'}</p>
            
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => handleReady(!(isCaptain1 ? displayReadyA : displayReadyB))}
                className={cn(
                  "px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all shadow-xl",
                  (isCaptain1 ? displayReadyA : displayReadyB)
                    ? "bg-slate-800 text-amber-500 border-2 border-amber-500/50 hover:bg-slate-700"
                    : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20"
                )}
              >
                {(isCaptain1 ? displayReadyA : displayReadyB) 
                  ? (t.waitingOpponent || 'WAITING FOR OPPONENT') 
                  : (t.readyBtn || 'READY')}
              </button>

              <div className="flex gap-8">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain1Name || t.teamA}</span>
                  <div className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    displayReadyA ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
                  )}>
                    {displayReadyA ? t.ready : t.waiting}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain2Name || t.teamB}</span>
                  <div className={cn(
                    "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    displayReadyB ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
                  )}>
                    {displayReadyB ? t.ready : t.waiting}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        <AnimatePresence>
          {showRosterEditor && (
            <RosterEditor 
              lobby={lobby}
              team={showRosterEditor}
              onClose={() => setShowRosterEditor(false)}
              onSave={updateRoster}
              t={t}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (lobby.phase === 'reporting') {
    const isVoted = (isCaptain1 && lobby.reportVoteA) || (isCaptain2 && lobby.reportVoteB);

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence>
          {showComboWarning && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
            >
              <div className="max-w-md w-full bg-red-600 border-2 border-red-400 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] text-center">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">{t.bannedComboTitle || 'COMBO BANIDO!'}</h2>
                <p className="text-red-50 mb-8 font-bold leading-relaxed">
                  {t.bannedComboDesc || 'A tática do Hamadryad + SS está banida do campeonato MCL. Sua composição atual (Ra/Set + Demeter) viola esta regra e pode resultar em desclassificação.'}
                </p>
                <button 
                  onClick={() => setHasDismissedComboWarning(true)}
                  className="w-full py-4 bg-white text-red-600 rounded-2xl font-black text-lg hover:bg-red-50 transition-all shadow-xl"
                >
                  {t.iUnderstand || 'EU ENTENDO'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
            <Trophy className="w-12 h-12 text-amber-500" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tight">{t.reportResult}</h2>
          <p className="text-slate-400 mb-12">{t.reportDesc}</p>

          {!isVoted ? (
            <>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setConfirmWinner('A')}
                  disabled={!isCaptain1 && !isCaptain2}
                  className={cn(
                    "p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 group",
                    confirmWinner === 'A' ? "bg-blue-500/10 border-blue-500" : "bg-slate-950 border-slate-800 hover:border-blue-500/50",
                    (!isCaptain1 && !isCaptain2) && "opacity-50 cursor-not-allowed grayscale"
                  )}
                >
                  <Shield className={cn(
                    "w-12 h-12 transition-colors",
                    confirmWinner === 'A' ? "text-blue-500" : "text-slate-700 group-hover:text-blue-400"
                  )} />
                  <span className="font-black text-xl uppercase tracking-tight">{(lobby.captain1Name || t.teamA)} {t.won}</span>
                </button>
                <button
                  onClick={() => setConfirmWinner('B')}
                  disabled={!isCaptain1 && !isCaptain2}
                  className={cn(
                    "p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 group",
                    confirmWinner === 'B' ? "bg-red-500/10 border-red-500" : "bg-slate-950 border-slate-800 hover:border-red-500/50",
                    (!isCaptain1 && !isCaptain2) && "opacity-50 cursor-not-allowed grayscale"
                  )}
                >
                  <Sword className={cn(
                    "w-12 h-12 transition-colors",
                    confirmWinner === 'B' ? "text-red-500" : "text-slate-700 group-hover:text-red-400"
                  )} />
                  <span className="font-black text-xl uppercase tracking-tight">{(lobby.captain2Name || t.teamB)} {t.won}</span>
                </button>
              </div>

              <AnimatePresence>
                {confirmWinner && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <p className="text-amber-500 font-bold uppercase tracking-widest text-xs">
                      {t.confirmWinnerMsg || 'Are you sure about this result?'}
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          reportScore(confirmWinner);
                          setConfirmWinner(null);
                        }}
                        className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl uppercase tracking-widest transition-all"
                      >
                        {t.confirmBtn || 'CONFIRM VOTE'}
                      </button>
                      <button
                        onClick={() => setConfirmWinner(null)}
                        className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all"
                      >
                        {t.cancel || 'CANCEL'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 mb-8">
              <div className="flex items-center justify-center gap-4 text-green-500 mb-2">
                <Check className="w-6 h-6" />
                <span className="font-black uppercase tracking-widest">{t.voteSubmitted || 'VOTE SUBMITTED'}</span>
              </div>
              <p className="text-slate-500 text-sm uppercase tracking-widest font-bold">
                {t.waitingOpponentVote}
              </p>
            </div>
          )}

          {lobby.voteConflict && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                <span className="font-black uppercase tracking-widest text-sm">{t.conflict}</span>
              </div>
              {conflictCountdown !== null && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <Clock className="w-4 h-4" />
                    <span>{t.resettingIn || 'Resetting in'} {conflictCountdown}s</span>
                  </div>
                  <button
                    onClick={() => resetVotes()}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    {t.resetNow || 'RESET NOW'}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <div className="mt-12 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain1Name || t.teamA}</span>
              <div className={cn(
                "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                lobby.reportVoteA ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
              )}>
                {lobby.reportVoteA ? t.voted : t.waiting}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain2Name || t.teamB}</span>
              <div className={cn(
                "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                lobby.reportVoteB ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
              )}>
                {lobby.reportVoteB ? t.voted : t.waiting}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (lobby.status === 'finished' && lobby.phase === 'finished') {
    return (
      <EndScreen 
        lobby={lobby} 
        t={t} 
        onHome={props.onHome} 
        onShowReplay={props.onShowReplay}
      />
    );
  }

  if (lobby.phase === 'god_picker' || lobby.phase === 'revealing') {
    return (
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 overflow-y-auto md:overflow-hidden custom-scrollbar">
        <AnimatePresence>
          {showComboWarning && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
            >
              <div className="max-w-md w-full bg-red-600 border-2 border-red-400 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] text-center">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">{t.bannedComboTitle || 'COMBO BANIDO!'}</h2>
                <p className="text-red-50 mb-8 font-bold leading-relaxed">
                  {t.bannedComboDesc || 'A tática do Hamadryad + SS está banida do campeonato MCL. Sua composição atual (Ra/Set + Demeter) viola esta regra e pode resultar em desclassificação.'}
                </p>
                <button 
                  onClick={() => setHasDismissedComboWarning(true)}
                  className="w-full py-4 bg-white text-red-600 rounded-2xl font-black text-lg hover:bg-red-50 transition-all shadow-xl"
                >
                  {t.iUnderstand || 'EU ENTENDO'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team A */}
        <div className="order-2 md:order-1 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-r border-slate-900">
          <TeamColumn 
            team="A" 
            lobby={lobby} 
            isCurrentTurn={false} 
            t={t} 
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            timeLeft={props.timeLeft}
            timerDuration={lobby.config.timerDuration || 60}
            optimisticAction={optimisticAction}
          />
        </div>

        {/* Center Panel: God Picker */}
        <div className="order-1 md:order-2 col-span-12 md:col-span-6 bg-slate-950/30 backdrop-blur-sm relative flex flex-col overflow-hidden min-h-[600px] md:min-h-0">
          <GodPicker 
            lobby={lobby}
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            handlePickerAction={handlePickerAction}
            timeLeft={props.timeLeft}
            t={t}
            optimisticAction={optimisticAction}
          />
        </div>

        {/* Team B */}
        <div className="order-3 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-l border-slate-900">
          <TeamColumn 
            team="B" 
            lobby={lobby} 
            isCurrentTurn={false} 
            t={t} 
            isCaptain1={isCaptain1}
            isCaptain2={isCaptain2}
            timeLeft={props.timeLeft}
            timerDuration={lobby.config.timerDuration || 60}
            optimisticAction={optimisticAction}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 overflow-y-auto md:overflow-hidden custom-scrollbar">
      <AnimatePresence>
        {showComboWarning && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="max-w-md w-full bg-red-600 border-2 border-red-400 rounded-3xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] text-center">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">{t.bannedComboTitle || 'COMBO BANIDO!'}</h2>
              <p className="text-red-50 mb-8 font-bold leading-relaxed">
                {t.bannedComboDesc || 'A tática do Hamadryad + SS está banida do campeonato MCL. Sua composição atual (Ra/Set + Demeter) viola esta regra e pode resultar em desclassificação.'}
              </p>
              <button 
                onClick={() => setHasDismissedComboWarning(true)}
                className="w-full py-4 bg-white text-red-600 rounded-2xl font-black text-lg hover:bg-red-50 transition-all shadow-xl"
              >
                {t.iUnderstand || 'EU ENTENDO'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team A */}
      <div className="order-2 md:order-1 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-r border-slate-900">
        <TeamColumn 
          team="A" 
          lobby={lobby} 
          isCurrentTurn={lobby.turnOrder[lobby.turn]?.player === 'A' || lobby.turnOrder[lobby.turn]?.player === 'BOTH'} 
          t={t} 
          isCaptain1={isCaptain1}
          isCaptain2={isCaptain2}
          timeLeft={props.timeLeft}
          timerDuration={lobby.config.timerDuration || 60}
          optimisticAction={optimisticAction}
        />
      </div>

      {/* Center Panel */}
      <div className="order-1 md:order-2 col-span-12 md:col-span-6 bg-slate-950/30 backdrop-blur-sm relative flex flex-col overflow-hidden min-h-[600px] md:min-h-0">
        {/* Background Image Decor */}
        <div className="absolute inset-0 -z-10 opacity-10 pointer-events-none">
          <img 
            src="https://static.wikia.nocookie.net/ageofempires/images/d/d3/AoMR_OM_cover_portrait.jpg/revision/latest" 
            alt="" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        {props.error && (
          <div className="absolute top-4 left-4 right-4 z-[60] p-4 bg-red-500/20 border border-red-500/50 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">{props.error}</span>
            </div>
            <button 
              onClick={() => props.setError(null)}
              className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}
        <PickBanPanel 
          lobby={lobby}
          isCaptain1={isCaptain1}
          isCaptain2={isCaptain2}
          handleAction={props.handleAction}
          t={t}
          lang={props.lang}
          reportScore={reportScore}
          viewGameIndex={viewGameIndex}
          setViewGameIndex={setViewGameIndex}
          isAdmin={isAdmin}
          forceFinish={forceFinish}
          resetCurrentGame={props.resetCurrentGame}
          requestReset={requestReset}
          timeLeft={props.timeLeft}
          optimisticAction={optimisticAction}
        />

        {/* Reset Request Overlay */}
        <AnimatePresence>
          {lobby.resetRequest && lobby.resetRequest.status === 'pending' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 text-center"
            >
              <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
                  <RefreshCw className="w-10 h-10 text-amber-500" />
                </div>
                
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">
                  {t.resetRequestedTitle || "RESET REQUESTED"}
                </h3>
                
                <p className="text-slate-300 mb-8 leading-relaxed">
                  {lobby.resetRequest.requestedBy === 'A' ? (lobby.captain1Name || t.teamA) : (lobby.captain2Name || t.teamB)} {t.requestedResetDesc || "has requested to reset the current game draft due to a mistake."}
                </p>

                {((isCaptain1 && lobby.resetRequest.requestedBy === 'B') || (isCaptain2 && lobby.resetRequest.requestedBy === 'A')) ? (
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => respondReset(true)}
                      className="w-full py-4 bg-green-500 hover:bg-green-600 text-slate-950 font-black rounded-2xl uppercase tracking-widest transition-all shadow-xl"
                    >
                      {t.acceptReset || "ACCEPT RESET"}
                    </button>
                    <button 
                      onClick={() => respondReset(false)}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black rounded-2xl uppercase tracking-widest transition-all"
                    >
                      {t.declineReset || "DECLINE RESET"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="px-6 py-3 bg-slate-800 rounded-xl text-slate-400 font-bold uppercase tracking-widest text-xs">
                      {t.waitingForOpponent || "WAITING FOR OPPONENT"}
                    </div>
                    {lobby.resetRequest.requestedBy === (isCaptain1 ? 'A' : 'B') && (
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        {t.yourRequestSent || "Your request has been sent to the opponent"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paused Overlay */}
        <AnimatePresence>
          {lobby.isPaused && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 text-center"
            >
              <div className="max-w-xs space-y-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Pause className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  {t.draftPaused}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {!lobby.captain1Active && !lobby.captain2Active 
                    ? t.bothLeft
                    : !lobby.captain1Active 
                      ? `${lobby.captain1Name || 'Host'} ${t.leftDraft}`
                      : `${lobby.captain2Name || 'Guest'} ${t.leftDraft}`
                  }
                  <br />
                  {t.waitingForReturn}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Team B */}
      <div className="order-3 col-span-12 md:col-span-3 border-t md:border-t-0 md:border-l border-slate-900">
        <TeamColumn 
          team="B" 
          lobby={lobby} 
          isCurrentTurn={lobby.turnOrder[lobby.turn]?.player === 'B' || lobby.turnOrder[lobby.turn]?.player === 'BOTH'} 
          t={t} 
          isCaptain1={isCaptain1}
          isCaptain2={isCaptain2}
          timeLeft={props.timeLeft}
          timerDuration={lobby.config.timerDuration || 60}
          optimisticAction={optimisticAction}
        />
      </div>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {showRosterEditor && (
          <RosterEditor 
            lobby={lobby}
            team={showRosterEditor}
            onClose={() => setShowRosterEditor(false)}
            onSave={updateRoster}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReadyPhase(props: { 
  lobby: Lobby, 
  isCaptain1: boolean, 
  isCaptain2: boolean, 
  t: any, 
  handleReady: (isReady?: boolean) => void, 
  isTeamSizeWithRoster: boolean, 
  setShowRosterEditor: (val: false | 'A' | 'B') => void, 
  isAdmin: boolean, 
  rosterChangedA?: boolean, 
  rosterChangedB?: boolean,
  isProcessing: boolean,
  optimisticReady: boolean | null
}) {
  const { lobby, isCaptain1, isCaptain2, t, handleReady, isTeamSizeWithRoster, setShowRosterEditor, isAdmin, isProcessing, optimisticReady } = props;
  
  const isReady = (isCaptain1 || isCaptain2) && optimisticReady !== null 
    ? optimisticReady 
    : (isCaptain1 ? lobby.readyA_nextGame : lobby.readyB_nextGame);

  const readyA_next = (isCaptain1 && optimisticReady !== null) ? optimisticReady : (lobby.readyA_nextGame || false);
  const readyB_next = (isCaptain2 && optimisticReady !== null) ? optimisticReady : (lobby.readyB_nextGame || false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center"
      >
        <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
          <Clock className="w-12 h-12 text-amber-500" />
        </div>
        <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tight">
          {t.readyNextGame?.replace('{game}', lobby.currentGame.toString())}
        </h2>
        <p className="text-slate-400 mb-12">{t.readyNextGameDesc}</p>
        
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
            <button
              onClick={() => handleReady(!isReady)}
              disabled={(!isCaptain1 && !isCaptain2) || isProcessing}
              className={cn(
                "flex-1 md:flex-none px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all shadow-xl",
                (!isCaptain1 && !isCaptain2)
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : isReady
                    ? "bg-slate-800 text-amber-500 border-2 border-amber-500/50 hover:bg-slate-700"
                    : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20",
                isProcessing && "opacity-70 cursor-wait"
              )}
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (!isCaptain1 && !isCaptain2)
                ? (t.spectatorMode || 'SPECTATOR MODE')
                : isReady 
                  ? (t.waitingOpponent || 'WAITING FOR OPPONENT') 
                  : (t.readyBtn || 'READY')}
            </button>

            {isTeamSizeWithRoster && (
              <div className="flex gap-2">
                {(isCaptain1 || (isAdmin && !isCaptain2)) && (
                  <button
                    onClick={() => setShowRosterEditor('A')}
                    className="px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {(isAdmin && !isCaptain1) ? "EDIT A" : t.editRoster}
                  </button>
                )}
                {(isCaptain2 || (isAdmin && !isCaptain1)) && (
                  <button
                    onClick={() => setShowRosterEditor('B')}
                    className="px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {(isAdmin && !isCaptain2) ? "EDIT B" : t.editRoster}
                  </button>
                )}
              </div>
            )}
          </div>

          {isTeamSizeWithRoster && (
            <AnimatePresence>
              {((isCaptain1 && lobby.rosterChangedB) || (isCaptain2 && lobby.rosterChangedA)) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3 px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">{t.enemyRosterChanged}</span>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div className="flex gap-8">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain1Name || t.teamA}</span>
              <div className={cn(
                "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                readyA_next ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
              )}>
                {readyA_next ? t.ready : t.waiting}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lobby.captain2Name || t.teamB}</span>
              <div className={cn(
                "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                readyB_next ? "bg-green-500/20 text-green-500" : "bg-slate-800 text-slate-600"
              )}>
                {readyB_next ? t.ready : t.waiting}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
