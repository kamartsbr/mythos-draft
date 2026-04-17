import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, X, Check, RefreshCw, UserPlus, UserMinus } from 'lucide-react';
import { Lobby, PickEntry, Substitution } from '../../types';
import { cn } from '../../lib/utils';

import { getMCLTeamOrder } from '../../data/draft';

interface RosterEditorProps {
  lobby: Lobby;
  team: 'A' | 'B';
  onClose: () => void;
  onSave: (newPicks: PickEntry[], subs: Substitution[]) => void;
  t: any;
}

export function RosterEditor({ lobby, team, onClose, onSave, t }: RosterEditorProps) {
  const teamPicks = useMemo(() => {
    const picks = lobby.picks.filter(p => p.team === team);
    const isMCL = lobby.config.preset?.includes('MCL');
    
    // Sort picks to ensure Player 1, 2, 3 order
    return [...picks].sort((a, b) => {
      if (isMCL) {
        const useGame2Order = lobby.currentGame === 2 || (lobby.currentGame === 3 && lobby.lastWinner === 'A');
        const order = getMCLTeamOrder(team, lobby.selectedMap || null, useGame2Order);
        return order.indexOf(a.playerId) - order.indexOf(b.playerId);
      }
      return a.playerId - b.playerId;
    });
  }, [lobby.picks, team, lobby.config.preset]);

  const teamPlayers = team === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers;
  
  const [editedPicks, setEditedPicks] = useState<PickEntry[]>([]);
  const hasInitialized = useRef(false);

  // Initialize and sync editedPicks ONLY ONCE or when team changes
  useEffect(() => {
    if (hasInitialized.current) return;

    const initialPicks = teamPicks.map(p => {
      // Find player info by matching playerId to the stored position in teamPlayers
      const playerInfo = teamPlayers?.find(tp => tp.position === p.playerId);
      return {
        ...p,
        playerName: p.playerName || playerInfo?.name || ''
      };
    });
    setEditedPicks(initialPicks);
    hasInitialized.current = true;
  }, [teamPicks, teamPlayers]);
  
  const handleNameChange = (playerId: number, name: string) => {
    setEditedPicks(prev => prev.map(p => 
      p.playerId === playerId ? { ...p, playerName: name } : p
    ));
  };

  const handleSave = () => {
    if (editedPicks.some(p => !p.playerName?.trim())) return;
    
    const oldNames = teamPlayers?.map(tp => tp.name.trim()) || [];
    const newNames = editedPicks.map(p => p.playerName?.trim() || '');

    const leaving = oldNames.filter(name => !newNames.some(n => n.toLowerCase() === name.toLowerCase()));
    const entering = newNames.filter(name => !oldNames.some(n => n.toLowerCase() === name.toLowerCase()));

    const subs: Substitution[] = [];
    
    // Pair entering and leaving players to show actual roster changes
    for (let i = 0; i < Math.max(entering.length, leaving.length); i++) {
      const playerIn = entering[i] || '';
      const playerOut = leaving[i] || '';
      
      if (playerIn || playerOut) {
        subs.push({
          team,
          playerIn: playerIn || '?',
          playerOut: playerOut || '?',
          position: 'corner' // Keep for type compatibility but won't be displayed
        });
      }
    }

    // Create full picks array with updates
    const allPicks = lobby.picks.map(p => {
      if (p.team === team) {
        const edited = editedPicks.find(ep => ep.playerId === p.playerId);
        return edited || p;
      }
      return p;
    });

    onSave(allPicks, subs);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.editRoster || 'EDIT ROSTER'}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.changePlayersDesc || 'Change player names for the next game'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {editedPicks.map((pick, idx) => {
            const getLabel = () => {
              if (lobby.config.preset?.includes('MCL') || lobby.config.teamSize === 3) {
                return `${t.player || 'Player'} ${idx + 1}`;
              }
              return pick.position === 'middle' ? (t.middle || 'Middle') : (t.corner || 'Corner');
            };

            return (
              <div key={pick.playerId} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{getLabel()}</span>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    value={pick.playerName}
                    onChange={(e) => handleNameChange(pick.playerId, e.target.value)}
                    className={cn(
                      "w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-colors",
                      !pick.playerName?.trim() ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-amber-500/50"
                    )}
                    placeholder={t.playerNamePlaceholder || "Enter player name..."}
                  />
                  {!pick.playerName?.trim() && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-widest">
                      {t.nameRequired || 'Name is required'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all"
          >
            {t.cancel || 'CANCEL'}
          </button>
          <button
            onClick={handleSave}
            disabled={editedPicks.some(p => !p.playerName?.trim())}
            className={cn(
              "flex-1 py-4 font-black rounded-2xl uppercase tracking-widest transition-all shadow-lg",
              editedPicks.some(p => !p.playerName?.trim())
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20"
            )}
          >
            {t.confirmBtn || 'SAVE CHANGES'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface SubstitutionAlertProps {
  subs: Substitution[];
  onComplete: () => void;
  t: any;
}

export function SubstitutionAlert({ subs, onComplete, t }: SubstitutionAlertProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[150] w-full max-w-md px-4"
    >
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl shadow-amber-500/20 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500">
          <motion.div 
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 5, ease: "linear" }}
            onAnimationComplete={onComplete}
            className="h-full bg-white/30"
          />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg">
            <RefreshCw className="w-6 h-6 text-slate-950 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight">{t.substitutions || 'SUBSTITUTIONS'}</h4>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{t.rosterUpdated || 'ROSTER UPDATED FOR NEXT GAME'}</p>
          </div>
        </div>

        <div className="space-y-3">
          {subs.map((sub, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800"
            >
              <div className="flex items-center gap-3">
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
        </div>
      </div>
    </motion.div>
  );
}
