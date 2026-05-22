import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, RefreshCw, Trash2, FastForward, Play, Power, Edit3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DraftEditModal } from './DraftEditModal';
import { Lobby } from '../../types';

interface AdminBarProps {
  isAdmin: boolean;
  onResetGame: () => void;
  onResetSeries: () => void;
  onForceFinish: () => void;
  onForceWO: (winner: 'A'|'B', fillMaxScore?: boolean) => void;
  onReportScore: (winner: 'A'|'B', isAdminOverride: boolean) => void;
  onForceUnpause: () => void;
  onForceStart: () => void;
  t: any;
  status: string;
  phase: string;
  lobby: Lobby;
}

/**
 * Render an admin control bar with privileged actions and an edit-draft modal.
 *
 * Renders a visually prominent admin panel containing conditional action buttons
 * (force start, unpause, finish), edit-draft, soft reset, and hard reset. Displays
 * nothing when `isAdmin` is false.
 *
 * @param isAdmin - If `true`, show the admin bar; otherwise render `null`
 * @param onResetGame - Callback invoked after confirming a soft reset (current game only)
 * @param onResetSeries - Callback invoked after confirming a hard reset (wipes entire lobby)
 * @param onForceFinish - Callback to immediately finish the current drafting phase
 * @param onForceUnpause - Callback to forcibly unpause a paused draft
 * @param onForceStart - Callback to force-start the draft when waiting or ready
 * @param t - Translation/props passthrough forwarded to the DraftEditModal
 * @param status - Lobby status used to determine which force actions are shown
 * @param phase - Lobby phase used to determine which force actions are shown
 * @param lobby - Lobby data forwarded to the DraftEditModal for editing
 *
 * @returns The admin bar element when `isAdmin` is `true`, otherwise `null`.
 */
export function AdminBar({ 
  isAdmin, onResetGame, onResetSeries, onForceFinish, onForceWO, onReportScore, onForceUnpause, onForceStart, t, status, phase, lobby 
}: AdminBarProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWOModal, setShowWOModal] = useState<'A' | 'B' | null>(null);
  if (!isAdmin) return null;

  const handleResetGame = () => {
    if (window.confirm("RESET CURRENT GAME: This will clear all picks/bans for the current game ONLY. Series score will be kept. Proceed?")) {
      onResetGame();
    }
  };

  const handleResetSeries = () => {
    if (window.confirm("HARD RESET: This will wipe the ENTIRE LOBBY progress, including score and maps. Proceed?")) {
      onResetSeries();
    }
  };

  const handleForceWO = (winner: 'A' | 'B') => {
    setShowWOModal(winner);
  };

  const handleForceReport = (winner: 'A' | 'B') => {
    const teamName = winner === 'A' ? (lobby.teamAName || lobby.captain1Name || 'Team A') : (lobby.teamBName || lobby.captain2Name || 'Team B');
    if (window.confirm(`FORCE REPORT: Are you sure you want to forcibly declare ${teamName} as the winner of GAME ${lobby.currentGame}?`)) {
      onReportScore(winner, true);
    }
  };

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-slate-900 border-b border-red-500/30 px-6 py-2 flex items-center justify-between gap-4 z-[100] shadow-[0_4px_20px_rgba(220,38,38,0.1)]"
    >
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
          <Shield className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest block">ADMIN PANEL</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Authorized Access Only</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Force Start (Waiting Phase) */}
        {(status === 'waiting' || phase === 'ready') && (
          <button
            onClick={onForceStart}
            title="Force start the draft immediately"
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Play className="w-3 h-3" />
            Force Start
          </button>
        )}

        {/* Force Unpause */}
        {phase === 'pause' && (
          <button
            onClick={onForceUnpause}
            title="Forcibly unpause the draft"
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Power className="w-3 h-3" />
            Unpause
          </button>
        )}

        {/* Force Report Game */}
        {status === 'drafting' && (
          <div className="flex items-center gap-1 bg-amber-950/50 p-1 rounded-lg border border-amber-500/20">
            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-1">Force Game {lobby.currentGame}</span>
            <button
              onClick={() => handleForceReport('A')}
              title="Force Win Game Team A"
              className="px-2 py-1 bg-amber-600/80 hover:bg-amber-500 text-white rounded text-[9px] font-black uppercase transition-all"
            >
              Win A
            </button>
            <button
              onClick={() => handleForceReport('B')}
              title="Force Win Game Team B"
              className="px-2 py-1 bg-amber-600/80 hover:bg-amber-500 text-white rounded text-[9px] font-black uppercase transition-all"
            >
              Win B
            </button>
          </div>
        )}

        {/* Force Finish */}
        {status === 'drafting' && (
          <button
            onClick={onForceFinish}
            title="Immediately end current phase and skip to next or result"
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <FastForward className="w-3 h-3" />
            Force Finish
          </button>
        )}

        {/* Force WO */}
        {status !== 'finished' && (
          <div className="flex gap-1 bg-red-950/50 p-1 rounded-lg border border-red-500/20">
            <button
              onClick={() => handleForceWO('A')}
              title="Force Win Team A (W.O.)"
              className="px-2 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-[9px] font-black uppercase transition-all"
            >
              W.O. A
            </button>
            <button
              onClick={() => handleForceWO('B')}
              title="Force Win Team B (W.O.)"
              className="px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded text-[9px] font-black uppercase transition-all"
            >
              W.O. B
            </button>
          </div>
        )}

        {/* Edit Draft */}
        <button
          onClick={() => setShowEditModal(true)}
          title="Edit lobby name and captain names in real-time"
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
        >
          <Edit3 className="w-3 h-3" />
          Editar Draft
        </button>

        {/* Soft Reset */}
        <button
          onClick={handleResetGame}
          title="Reset only the current game picks/bans. Keeps series score."
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Soft Reset
        </button>

        {/* Hard Reset */}
        <button
          onClick={handleResetSeries}
          title="COMPLETE WIPE: Resets scores, maps, and all draft progress."
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Trash2 className="w-3 h-3" />
          Hard Reset
        </button>
      </div>

      <DraftEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        lobby={lobby}
        t={t}
      />

      {/* W.O. Resolution Modal */}
      <AnimatePresence>
        {showWOModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWOModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-red-500/50 rounded-2xl shadow-[0_20px_50px_rgba(220,38,38,0.2)] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-800 bg-red-950/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">Decretar Vitória por W.O.</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-300">
                  O time <strong className={showWOModal === 'A' ? "text-blue-400" : "text-red-400"}>
                    {showWOModal === 'A' ? (lobby.teamAName || lobby.captain1Name || 'Team A') : (lobby.teamBName || lobby.captain2Name || 'Team B')}
                  </strong> receberá a vitória da série. Escolha como preencher o histórico de mapas pendentes:
                </p>
                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={() => { onForceWO(showWOModal, false); setShowWOModal(null); }}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500 rounded-xl text-left transition-all"
                  >
                    <div className="font-black text-white uppercase tracking-widest text-sm">Opção A: Encerrar Série Seca</div>
                    <div className="text-xs text-slate-400 mt-1">Manter placar acumulado real atual e preencher os jogos restantes com W.O. 0-0.</div>
                  </button>
                  <button
                    onClick={() => { onForceWO(showWOModal, true); setShowWOModal(null); }}
                    className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-red-500 rounded-xl text-left transition-all"
                  >
                    <div className="font-black text-white uppercase tracking-widest text-sm">Opção B: Preencher com Pontuação Máxima</div>
                    <div className="text-xs text-slate-400 mt-1">Força o teto da série, injetando vitórias cheias nos mapas restantes para este time.</div>
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowWOModal(null)}
                  className="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
