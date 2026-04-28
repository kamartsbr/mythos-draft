import { motion, AnimatePresence } from 'motion/react';
import { User, Shield, Dices } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PickEntry } from '../../types';
import { MAJOR_GODS } from '../../constants';

interface PlayerSlotProps {
  pick: PickEntry;
  isCurrentTurn: boolean;
  t: any;
  isHidden?: boolean;
  preset?: string;
  key?: string | number;
  index?: number;
  hoveredGodId?: string | null;
  timeLeft?: number | null;
  timerDuration?: number;
}

export function PlayerSlot({ pick, isCurrentTurn, t, isHidden, preset, index, hoveredGodId, timeLeft, timerDuration }: PlayerSlotProps) {
  const god = MAJOR_GODS.find(g => g.id === pick.godId) || (isCurrentTurn && hoveredGodId ? MAJOR_GODS.find(g => g.id === hoveredGodId) : undefined);
  const isHovered = !pick.godId && god && isCurrentTurn;

  const getPlayerLabel = () => {
    if (preset === 'MCL') {
      // Team A: 1 (Red) -> Player 1, 4 (Orange) -> Player 2, 5 (Yellow) -> Player 3
      if (pick.playerId === 1) return (t.player || 'Player') + ' 1';
      if (pick.playerId === 4) return (t.player || 'Player') + ' 2';
      if (pick.playerId === 5) return (t.player || 'Player') + ' 3';
      
      // Team B: 2 (Pink) -> Player 1, 3 (Blue) -> Player 2, 6 (Cyan) -> Player 3
      if (pick.playerId === 2) return (t.player || 'Player') + ' 1';
      if (pick.playerId === 3) return (t.player || 'Player') + ' 2';
      if (pick.playerId === 6) return (t.player || 'Player') + ' 3';
    }
    return pick.position === 'corner' ? t.corner : t.middle;
  };

  const showColor = !isHidden && (god || preset !== 'MCL');
  const displayName = isHidden 
    ? (pick.team === 'A' ? t.teamA : t.teamB) 
    : (isHovered ? (t.selecting || 'Selecting...') : (pick.playerName || (preset === 'MCL' ? `${t.selecting || 'Selecting'}...` : `Player ${pick.playerId}`)));

  return (
    <motion.div 
      initial={{ opacity: 0, x: pick.team === 'A' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "relative group h-24 rounded-2xl overflow-hidden border transition-all duration-500",
        isCurrentTurn 
          ? "border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.4)] bg-amber-500/10 ring-2 ring-amber-500/20" 
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      )}
    >
      {/* Background God Image */}
      {god && (
        <motion.div 
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: isHovered ? 0.15 : 0.3, scale: 1 }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={god.image || null} 
            alt={god.name}
            referrerPolicy="no-referrer"
            className={cn("w-full h-full object-cover transition-all duration-700", isHovered ? "grayscale" : "grayscale-[0.6] group-hover:grayscale-0")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        </motion.div>
      )}

      <div className="relative z-10 h-full flex items-center px-4 gap-4">
        {/* Player Color Indicator */}
        <div 
          className="w-2 h-14 rounded-full shadow-lg transition-colors duration-500"
          style={{ backgroundColor: showColor ? pick.color : '#1e293b', opacity: isHovered ? 0.5 : 1 }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {isHidden ? (pick.team === 'A' ? t.teamA : t.teamB) : getPlayerLabel()}
            </span>
            {isCurrentTurn && (
              <motion.span 
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-[10px] font-bold text-amber-500 uppercase tracking-widest"
              >
                • {t.picking}
              </motion.span>
            )}
          </div>
          <h3 className={cn(
            "text-xl font-black truncate drop-shadow-md transition-colors duration-500",
            (god || !preset || preset !== 'MCL') ? "text-white" : "text-slate-700",
            isHovered && "text-slate-400"
          )}>
            {displayName}
          </h3>
          <p className={cn(
            "text-xs font-black uppercase tracking-widest flex items-center gap-1",
            god && !isHovered ? "text-amber-500" : "text-slate-600"
          )}>
            {god ? god.name : t.selecting}
            {pick.isRandom && <Dices className="w-3 h-3 text-amber-500" title="Randomly selected" />}
          </p>
        </div>

        {/* God Icon */}
        <div className={cn(
          "w-16 h-16 rounded-2xl border-2 overflow-hidden transition-all duration-500 relative shadow-2xl",
          god ? "border-amber-500/50 rotate-0 scale-100" : "border-slate-800 rotate-12 scale-90 bg-slate-950 flex items-center justify-center",
          isHovered && "opacity-60 border-dashed"
        )}>
          <AnimatePresence mode="wait">
            {god ? (
              <motion.div
                key={god.id}
                initial={{ scale: 2, opacity: 0, rotate: 45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="w-full h-full"
              >
                {god.image && (
                  <img 
                    src={god.image} 
                    alt={god.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
                <motion.div 
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-white"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <User className="w-6 h-6 text-slate-800" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Turn Progress Bar */}
      {isCurrentTurn && timeLeft !== null && timerDuration != null && (
        <motion.div 
          animate={{ width: `${(timeLeft / timerDuration) * 100}%` }}
          className="absolute bottom-0 left-0 h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
        />
      )}
    </motion.div>
  );
}
