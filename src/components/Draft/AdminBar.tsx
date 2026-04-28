import { motion } from 'motion/react';
import { Shield, RefreshCw, Trash2, FastForward, Play, Power } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AdminBarProps {
  isAdmin: boolean;
  onResetGame: () => void;
  onResetSeries: () => void;
  onForceFinish: () => void;
  onForceUnpause: () => void;
  onForceStart: () => void;
  t: any;
  status: string;
  phase: string;
}

export function AdminBar({ 
  isAdmin, onResetGame, onResetSeries, onForceFinish, onForceUnpause, onForceStart, t, status, phase 
}: AdminBarProps) {
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
    </motion.div>
  );
}
