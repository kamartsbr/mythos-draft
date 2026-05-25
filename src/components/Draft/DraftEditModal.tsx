import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, User, Shield, Layout } from 'lucide-react';
import { Lobby } from '../../types';
import { lobbyService } from '../../services/lobbyService';
import { cn } from '../../lib/utils';

interface DraftEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lobby: Lobby;
  t: any;
}

/**
 * Renders a modal for editing a lobby draft's configurable fields and persisting updates.
 *
 * The modal allows editing the lobby name, team names, and the 3v3 team rosters. When visible, it initializes its form from `lobby`, saves updates to the lobby on confirm, and calls `onClose` after a successful save.
 *
 * @param isOpen - Controls whether the modal is visible
 * @param onClose - Callback invoked to close the modal
 * @param lobby - Source lobby data used to populate and save the form values
 * @param t - Translation/context prop (unused)
 * @returns The component's rendered JSX element
 */
export function DraftEditModal({ isOpen, onClose, lobby, t }: DraftEditModalProps) {
  const [name, setName] = useState(lobby.config.name);
  const [teamAName, setTeamAName] = useState(lobby.teamAName || '');
  const [teamBName, setTeamBName] = useState(lobby.teamBName || '');
  
  // Team A Roster
  const [pA1, setPA1] = useState(lobby.playerA1 || lobby.captain1Name || "Player 1");
  const [pA2, setPA2] = useState(lobby.playerA2 || "Player 2");
  const [pA3, setPA3] = useState(lobby.playerA3 || "Player 3");

  // Team B Roster
  const [pB1, setPB1] = useState(lobby.playerB1 || lobby.captain2Name || "Player 1");
  const [pB2, setPB2] = useState(lobby.playerB2 || "Player 2");
  const [pB3, setPB3] = useState(lobby.playerB3 || "Player 3");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form state when modal opens or lobby changes
  useEffect(() => {
    if (isOpen) {
      setName(lobby.config.name);
      setTeamAName(lobby.teamAName || '');
      setTeamBName(lobby.teamBName || '');
      
      setPA1(lobby.playerA1 || lobby.captain1Name || "Player 1");
      setPA2(lobby.playerA2 || "Player 2");
      setPA3(lobby.playerA3 || "Player 3");
      
      setPB1(lobby.playerB1 || lobby.captain2Name || "Player 1");
      setPB2(lobby.playerB2 || "Player 2");
      setPB3(lobby.playerB3 || "Player 3");
      
      setSaveError(null);
    }
  }, [
    isOpen, 
    lobby.config.name, 
    lobby.teamAName, 
    lobby.teamBName, 
    lobby.playerA1, lobby.captain1Name, lobby.playerA2, lobby.playerA3,
    lobby.playerB1, lobby.captain2Name, lobby.playerB2, lobby.playerB3
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updatePayload = {
        name: name.trim(),
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        playerA1: pA1.trim() || lobby.playerA1 || lobby.captain1Name || "Player 1",
        playerA2: pA2.trim() || "Player 2",
        playerA3: pA3.trim() || "Player 3",
        playerB1: pB1.trim() || lobby.playerB1 || lobby.captain2Name || "Player 1",
        playerB2: pB2.trim() || "Player 2",
        playerB3: pB3.trim() || "Player 3",
        // Retrocompatibilidade garantida para as HUDs antigas:
        captain1Name: pA1.trim() || lobby.playerA1 || lobby.captain1Name || "Player 1",
        captain2Name: pB1.trim() || lobby.playerB1 || lobby.captain2Name || "Player 1",
      };

      await lobbyService.updateLobbyAtomically(lobby.id, updatePayload);
      onClose();
    } catch (err) {
      console.error("Failed to save lobby edits:", err);
      setSaveError((err as any)?.message || String(err));
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Shield className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Editar Draft</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Admin Control Panel</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Lobby Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Layout className="w-3 h-3" />
                  Nome do Lobby
                </label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all text-white font-bold"
                  placeholder="Ex: Torneio Mythos - Final"
                />
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-2 gap-8">
                {/* TEAM A */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                      <Layout className="w-3 h-3" />
                      Nome do Time A (Host)
                    </label>
                    <input 
                      type="text"
                      value={teamAName}
                      onChange={(e) => setTeamAName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-black text-blue-500/70 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                      <User className="w-3 h-3" />
                      Team A Roster
                    </label>
                    
                    <input 
                      type="text"
                      value={pA1}
                      onChange={(e) => setPA1(e.target.value)}
                      placeholder="Player 1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-slate-300"
                    />
                    <input 
                      type="text"
                      value={pA2}
                      onChange={(e) => setPA2(e.target.value)}
                      placeholder="Player 2"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-slate-300"
                    />
                    <input 
                      type="text"
                      value={pA3}
                      onChange={(e) => setPA3(e.target.value)}
                      placeholder="Player 3"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-slate-300"
                    />
                  </div>
                </div>

                {/* TEAM B */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                      <Layout className="w-3 h-3" />
                      Nome do Time B (Guest)
                    </label>
                    <input 
                      type="text"
                      value={teamBName}
                      onChange={(e) => setTeamBName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-all text-white"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-black text-red-500/70 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                      <User className="w-3 h-3" />
                      Team B Roster
                    </label>

                    <input 
                      type="text"
                      value={pB1}
                      onChange={(e) => setPB1(e.target.value)}
                      placeholder="Player 1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50 transition-all text-slate-300"
                    />
                    <input 
                      type="text"
                      value={pB2}
                      onChange={(e) => setPB2(e.target.value)}
                      placeholder="Player 2"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50 transition-all text-slate-300"
                    />
                    <input 
                      type="text"
                      value={pB3}
                      onChange={(e) => setPB3(e.target.value)}
                      placeholder="Player 3"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500/50 transition-all text-slate-300"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-slate-950/50 border-t border-slate-800 flex flex-col gap-3">
              {saveError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  Erro ao salvar: {saveError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
