import { motion } from 'motion/react';
import { Clock, Map as MapIcon, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby } from '../../types';
import { MAPS } from '../../constants';

interface DraftHeaderProps {
  lobby: Lobby;
  timeLeft: number | null;
  t: any;
}

export function DraftHeader({ lobby, timeLeft, t }: DraftHeaderProps) {
  const currentTurn = lobby.turnOrder[lobby.turn];
  const selectedMap = MAPS.find(m => m.id === lobby.selectedMap);

  return (
    <div className="fixed top-0 left-0 right-0 md:sticky bg-slate-950 border-b border-slate-900 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between z-50 shadow-md">
      {/* Turn Indicator */}
      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
            {t.currentPhase}
          </span>
          <div className="flex items-center gap-2 md:gap-3">
            <h2 className={cn(
              "text-sm md:text-xl font-black uppercase tracking-tight",
              lobby.voteConflictCount >= 2 ? "text-red-500" : "text-white"
            )}>
              {lobby.voteConflictCount >= 2 ? (t.draftCanceled || 'DRAFT CANCELED') : (t[lobby.phase] || lobby.phase.replace('_', ' '))}
            </h2>
            {currentTurn && lobby.voteConflictCount < 2 && (
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] md:text-xs font-bold uppercase tracking-widest",
                currentTurn.player === 'A' ? "bg-blue-500/20 text-blue-400" :
                currentTurn.player === 'B' ? "bg-red-500/20 text-red-400" :
                "bg-amber-500/20 text-amber-400"
              )}>
                {currentTurn.player === 'A' ? (lobby.captain1Name || t.teamA) : 
                 currentTurn.player === 'B' ? (lobby.captain2Name || t.teamB) : 
                 currentTurn.player === 'ADMIN' ? (t.system || 'SYSTEM') :
                 t.bothTeams}
              </div>
            )}
          </div>
        </div>

        <div className="h-8 md:h-10 w-px bg-slate-900" />

        <div className="flex flex-col hidden sm:flex">
          <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
            {t.turn}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-lg md:text-xl font-black text-amber-500">{Math.min(lobby.turn + 1, lobby.turnOrder.length)}</span>
            <span className="text-slate-700 font-bold">/</span>
            <span className="text-slate-500 font-bold">{lobby.turnOrder.length}</span>
          </div>
        </div>
      </div>

      {/* Empty div to keep flex-between balanced if needed, or just remove it */}
      <div className="w-16 md:w-32"></div>
    </div>
  );
}
