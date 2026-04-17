import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sword, Users, Check, X, User, MapPin, Copy, Link as LinkIcon, Languages } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby } from '../../types';
import { PLAYER_COLORS } from '../../constants';
import { LanguageToggle } from '../UI/LanguageToggle';

interface JoinLobbyModalProps {
  lobby: Lobby;
  t: any;
  lang: 'en' | 'pt' | 'es';
  setLang: (lang: 'en' | 'pt' | 'es') => void;
  nickname: string;
  setNickname: (val: string) => void;
  isAdmin?: boolean;
  onJoin: (role: 'A' | 'B' | 'SPECTATOR', position: number, playerNames: Record<number, string>, nickname: string) => void;
  onSoloJoin?: (nickname: string) => void;
  onClose: () => void;
  copyUrl: () => void;
  getShareableUrl: () => string;
  guestId: string | null;
}

export function JoinLobbyModal({ lobby, t, lang, setLang, nickname, setNickname, onJoin, onSoloJoin, onClose, copyUrl, getShareableUrl, isAdmin, guestId }: JoinLobbyModalProps) {
  const isFinished = lobby.status === 'finished';
  const [role, setRole] = useState<'A' | 'B' | 'SPECTATOR' | null>(isFinished ? 'SPECTATOR' : null);
  const [captainPosition, setCaptainPosition] = useState<number | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<number, string>>({});
  const [teamName, setTeamName] = useState('');
  const [localNickname, setLocalNickname] = useState(nickname);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canJoinA = !lobby.captain1 || lobby.captain1 === guestId;
  const canJoinB = !lobby.captain2 || lobby.captain2 === guestId;

  const teamSize = lobby.config.teamSize;
  const isMCL = lobby.config.preset?.includes('MCL');
  const teamSlots = role === 'A' ? (isMCL ? [1, 4, 5] : [1, 5, 4]) : (isMCL ? [2, 3, 6] : [2, 6, 3]);
  const activeSlots = teamSize === 1 ? (role === 'A' ? [5] : [6]) : teamSize === 2 ? (role === 'A' ? [1, 4] : [2, 3]) : teamSlots;

  // Initialize roster when role changes
  useEffect(() => {
    if (role && role !== 'SPECTATOR') {
      const teamSlots = role === 'A' ? [1, 4, 5] : [3, 2, 6];
      const activeSlots = teamSize === 1 ? (role === 'A' ? [5] : [6]) : teamSize === 2 ? (role === 'A' ? [1, 4] : [3, 2]) : teamSlots;

      setPlayerNames(prev => {
        const next = { ...prev };
        const existingPlayers = role === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers;
        
        if (existingPlayers && existingPlayers.length > 0) {
          existingPlayers.forEach(p => {
            next[p.position] = p.name;
          });
        } else {
          activeSlots.forEach(id => {
            if (next[id] === undefined || (teamSize === 1 && next[id] === '')) {
              next[id] = teamSize === 1 ? localNickname : '';
            }
          });
        }
        
        // Default captain position if current one is invalid for this role
        if (!activeSlots.includes(captainPosition || -1)) {
          const defaultPos = activeSlots[0];
          setCaptainPosition(defaultPos);
          if (!next[defaultPos]) {
            next[defaultPos] = localNickname;
          }
        }
        return next;
      });
      
      // Default team name
      if (teamSize === 1) {
        setTeamName(localNickname);
      } else {
        const existingTeamName = role === 'A' ? lobby.captain1Name : lobby.captain2Name;
        if (existingTeamName) {
          setTeamName(existingTeamName);
        } else if (!teamName || teamName === t.teamA || teamName === t.teamB || teamName === 'Team A' || teamName === 'Team B' || teamName === 'Time A' || teamName === 'Time B') {
          setTeamName(role === 'A' ? t.teamA : t.teamB);
        }
      }
    }
  }, [role, teamSize, localNickname, t.teamA, t.teamB, isMCL, lobby.teamAPlayers, lobby.teamBPlayers, lobby.captain1Name, lobby.captain2Name]);

  // Handle position change (Movement Bug Fix)
  const handlePositionChange = (newPos: number) => {
    if (newPos === captainPosition) return;
    
    setPlayerNames(prev => {
      const next = { ...prev };
      const existingNameAtNewPos = next[newPos] || '';
      
      // Swap: Move captain to new pos, move whoever was there to captain's old pos
      next[newPos] = localNickname;
      if (captainPosition !== null) {
        next[captainPosition] = existingNameAtNewPos;
      }
      return next;
    });
    setCaptainPosition(newPos);
  };

  // Handle teammate name change (Overwrite Bug Fix)
  const handlePlayerNameChange = (id: number, name: string) => {
    if (id === captainPosition) {
      setLocalNickname(name);
    }
    setPlayerNames(prev => ({ ...prev, [id]: name }));
  };

  const handleConfirm = () => {
    const finalNickname = localNickname.trim() || (role === 'SPECTATOR' ? 'Spectator' : '');
    if (!finalNickname && role !== 'SPECTATOR') return;
    if (!role) return;
    
    if (role === 'SPECTATOR') {
      onJoin(role, 0, {}, finalNickname);
      return;
    }

    // Requirement: For 3x3 or MCL presets, Team Name and all 3 Player Names must be mandatory
    const allFilled = activeSlots.every(id => playerNames[id]?.trim());
    const teamNameFilled = teamName.trim().length > 0;

    if (isMCL || lobby.config.teamSize === 3) {
      if (!allFilled || !teamNameFilled) {
        alert(lang === 'en' ? "Please fill in the Team Name and all Player Names." : "Por favor, preencha o Nome da Equipe e todos os Nomes dos Jogadores.");
        return;
      }
    } else {
      if (!allFilled) {
        alert(lang === 'en' ? "Please fill in all Player Names." : "Por favor, preencha todos os Nomes dos Jogadores.");
        return;
      }
    }

    const defaultTeamName = teamSize === 1 ? localNickname : (role === 'A' ? t.teamA : t.teamB);
    const finalTeamName = teamSize === 1 ? localNickname : (teamName.trim() || defaultTeamName);

    onJoin(role, captainPosition!, { ...playerNames, [role === 'A' ? 100 : 200]: finalTeamName }, localNickname);
  };

  const getPositionLabel = (id: number) => {
    if (isMCL || lobby.config.teamSize === 3) {
      if (id === 1 || id === 3) return lang === 'en' ? 'Player 1' : 'Jogador 1';
      if (id === 4 || id === 2) return lang === 'en' ? 'Player 2' : 'Jogador 2';
      if (id === 5 || id === 6) return lang === 'en' ? 'Player 3' : 'Jogador 3';
    }
    if (id === 5 || id === 6) return t.middle;
    return t.corner;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t.joinTitle}</h2>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{lobby.config.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle lang={lang} setLang={setLang} />
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Team Name */}
          {!isFinished && teamSize > 1 && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-3 h-3" />
                {t.teamName}
              </label>
              <input 
                type="text" 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={role === 'A' ? (lang === 'en' ? 'Team A (Host)' : 'Time A (Host)') : (lang === 'en' ? 'Team B (Guest)' : 'Time B (Convidado)')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
          )}

          {/* Nickname */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" />
              {teamSize === 1 ? t.playerName : t.nickname}
            </label>
            <input 
              type="text" 
              value={localNickname}
              onChange={(e) => {
                setLocalNickname(e.target.value);
                if (captainPosition !== null) {
                  setPlayerNames(prev => ({ ...prev, [captainPosition]: e.target.value }));
                }
              }}
              placeholder={t.nicknamePlaceholder}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* Role Selection */}
          {!isFinished && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sword className="w-3 h-3" />
                {t.joinAs}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  disabled={!canJoinA}
                  onClick={() => setRole('A')}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group relative",
                    role === 'A' ? "bg-blue-500/10 border-blue-500" : "bg-slate-950 border-slate-800 hover:border-slate-700",
                    !canJoinA && "opacity-40 cursor-not-allowed grayscale"
                  )}
                >
                  <Shield className={cn("w-8 h-8", role === 'A' ? "text-blue-500" : "text-slate-700")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {lobby.captain1 === guestId ? (lang === 'en' ? 'RE-JOIN HOST' : 'REENTRAR HOST') : t.roleHost}
                  </span>
                  {!canJoinA && <LockIcon className="absolute top-2 right-2 w-3 h-3 text-slate-600" />}
                </button>
                <button
                  disabled={!canJoinB}
                  onClick={() => setRole('B')}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group relative",
                    role === 'B' ? "bg-red-500/10 border-red-500" : "bg-slate-950 border-slate-800 hover:border-slate-700",
                    !canJoinB && "opacity-40 cursor-not-allowed grayscale"
                  )}
                >
                  <Sword className={cn("w-8 h-8", role === 'B' ? "text-red-500" : "text-slate-700")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {lobby.captain2 === guestId ? (lang === 'en' ? 'RE-JOIN GUEST' : 'REENTRAR CONVIDADO') : t.roleGuest}
                  </span>
                  {!canJoinB && <LockIcon className="absolute top-2 right-2 w-3 h-3 text-slate-600" />}
                </button>
                <button
                  onClick={() => setRole('SPECTATOR')}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group",
                    role === 'SPECTATOR' ? "bg-amber-500/10 border-amber-500" : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <Users className={cn("w-8 h-8", role === 'SPECTATOR' ? "text-amber-500" : "text-slate-700")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">{t.roleSpectator}</span>
                </button>
              </div>
            </div>
          )}

          {/* Team Roster (Only for players) */}
          {!isFinished && role && role !== 'SPECTATOR' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {teamSize === 1 ? t.playerName : t.teamRoster}
                </label>
                {teamSize > 1 && (
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    {t.selectCaptainPos}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {activeSlots.map((id) => (
                  <div key={id} className="flex gap-4 items-center">
                    {teamSize > 1 && (
                      <button
                        onClick={() => handlePositionChange(id)}
                        className={cn(
                          "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all shrink-0",
                          captainPosition === id 
                            ? "bg-amber-500 border-amber-500 text-slate-950" 
                            : "bg-slate-950 border-slate-800 text-slate-700 hover:border-slate-700"
                        )}
                        title={t.selectCaptainPos}
                      >
                        <User className="w-6 h-6" />
                      </button>
                    )}
                    <div className="flex-1 relative">
                      {!isMCL && (
                        <div 
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                          style={{ backgroundColor: PLAYER_COLORS[id as keyof typeof PLAYER_COLORS] }}
                        />
                      )}
                      <input 
                        type="text"
                        value={playerNames[id] || ''}
                        onChange={(e) => handlePlayerNameChange(id, e.target.value)}
                        placeholder={teamSize === 1 ? t.nicknamePlaceholder : `${getPositionLabel(id)} ${t.playerName}...`}
                        className={cn(
                          "w-full bg-slate-950 border rounded-xl pr-4 py-3 text-sm focus:outline-none transition-all",
                          !isMCL ? "pl-8" : "px-4",
                          id === captainPosition ? "font-bold" : "",
                          role === 'A' ? "focus:border-blue-500" : "focus:border-red-500"
                        )}
                        style={{ 
                          borderColor: !isMCL && playerNames[id]?.trim() ? PLAYER_COLORS[id as keyof typeof PLAYER_COLORS] : '#1e293b',
                          color: !isMCL && id === captainPosition ? PLAYER_COLORS[id as keyof typeof PLAYER_COLORS] : 'white'
                        }}
                      />
                    </div>
                    {teamSize > 1 && (
                      <div className="w-24 text-right">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {getPositionLabel(id)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Invite Link Section */}
          {!isFinished && (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{t.inviteLink}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t.shareWithOpponent}</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400 truncate flex items-center font-mono">
                  {getShareableUrl()}
                </div>
                <button 
                  onClick={handleCopy}
                  className={cn(
                    "px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2",
                    copied ? "bg-green-500 text-slate-950" : "bg-slate-800 hover:bg-slate-700 text-white"
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
          )}

          <button
            disabled={!role || (!localNickname.trim() && role !== 'SPECTATOR') || (!isFinished && role !== 'SPECTATOR' && activeSlots.some(id => !playerNames[id]?.trim()))}
            onClick={handleConfirm}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isFinished ? (lang === 'en' ? 'VIEW DRAFT' : 'VER DRAFT') : t.startDraftBtn}
            <Check className="w-6 h-6" />
          </button>

          {isAdmin && onSoloJoin && (
            <button
              onClick={() => onSoloJoin(localNickname)}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-500 font-black text-sm uppercase tracking-widest border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              {lang === 'en' ? 'Solo Test Mode (Admin Only)' : 'Modo de Teste Solo (Apenas Admin)'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
