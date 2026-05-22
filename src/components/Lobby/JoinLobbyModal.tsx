import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sword, Users, Check, X, User, MapPin, Copy, Link as LinkIcon, Languages } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby } from '../../types';
import { PLAYER_COLORS } from '../../constants';
import { LanguageToggle } from '../UI/LanguageToggle';
import { useForjaDiscordAuth } from '../../features/forja/hooks/useForjaDiscordAuth';
import { useForjaTeams } from '../../features/forja/hooks/useForjaTeams';
import { useForjaPlayers } from '../../features/forja/hooks/useForjaPlayers';
import { Lock, ChevronDown, User as UserIcon } from 'lucide-react';

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

/**
 * Modal UI for joining a lobby as Host (A), Guest (B), or Spectator, with optional Forja preset integration.
 *
 * Renders role selection, nickname/team name inputs, roster editing (text inputs or Forja dropdown), invite link and confirm flow;
 * pre-fills and validates roster/team data when a Forja preset is active, enforces captain authorization and lineup uniqueness,
 * and calls provided callbacks to perform join, solo-join (admin), close, and share actions.
 *
 * @param props.lobby - Lobby data and configuration used to derive available slots, preset, captains and existing players.
 * @param props.t - Localized text strings used by the component.
 * @param props.lang - Current UI language code.
 * @param props.setLang - Setter to change the UI language.
 * @param props.nickname - Initial nickname value.
 * @param props.setNickname - Setter to update the nickname upstream.
 * @param props.onJoin - Called when the user confirms joining; receives (role, captainPosition, namesRecord, nickname).
 * @param props.onSoloJoin - Optional admin-only callback invoked for solo test joins.
 * @param props.onClose - Callback invoked to close the modal.
 * @param props.copyUrl - Function that copies the invite URL to the clipboard.
 * @param props.getShareableUrl - Function that returns the current shareable invite URL string.
 * @param props.isAdmin - Whether the current user has admin privileges (enables solo-join button).
 * @param props.guestId - Guest identifier used to detect re-join permissions for host/guest slots.
 *
 * @returns The React element for the join lobby modal.
 */
export function JoinLobbyModal({ lobby, t, lang, setLang, nickname, setNickname, onJoin, onSoloJoin, onClose, copyUrl, getShareableUrl, isAdmin, guestId }: JoinLobbyModalProps) {
  const isFinished = lobby.status === 'finished';
  const [role, setRole] = useState<'A' | 'B' | 'SPECTATOR' | null>(isFinished ? 'SPECTATOR' : null);
  const [captainPosition, setCaptainPosition] = useState<number | null>(null);
  const [playerNames, setPlayerNames] = useState<Record<number, string>>({});
  const [teamName, setTeamName] = useState('');
  const [localNickname, setLocalNickname] = useState(nickname);
  const [copied, setCopied] = useState(false);

  // Forja Auto-fill data
  const { teams } = useForjaTeams(true);
  const { rankedPlayers } = useForjaPlayers(true);
  const lastRole = useRef<string | null>(null);

  const isForjaPreset = lobby.config.preset === 'FORJA';
  const forjaTeamId = role === 'A' ? lobby.config.forjaTeamA : lobby.config.forjaTeamB;
  const forjaTeam = isForjaPreset ? teams.find(t => t.id === forjaTeamId) : null;

  const { discordUser, isAdmin: isForjaAdmin } = useForjaDiscordAuth();

  const teamRoster = useMemo(() => {
    if (!forjaTeam || !rankedPlayers.length) return [];
    
    // 🔥 SOLUÇÃO TOTAL: Buscar em RANKED PLAYERS para garantir que reservas DINÂMICOS (overflow) apareçam
    const teamMembers = rankedPlayers.filter(p => 
      (p.team_id && p.team_id === forjaTeam.id) || 
      (forjaTeam.members && forjaTeam.members.includes(p.discord_id))
    );

    // Include all tournament reserves so they can be selected for substitutions
    const campReserves = rankedPlayers.filter(p => p.is_reserve);

    // Garantir unicidade por discord_id
    const combined = [...teamMembers, ...campReserves];
    const unique = Array.from(new Map(combined.map(p => [p.discord_id, p])).values());
    
    // Ordenar: Titulares primeiro (is_reserve: false)
    return unique.sort((a, b) => {
      if (a.is_reserve !== b.is_reserve) {
        return a.is_reserve ? 1 : -1;
      }
      return a.nick.localeCompare(b.nick);
    });
  }, [forjaTeam, rankedPlayers]);

  const userAuthIdentity = useMemo(() => {
    if (!discordUser) return null;
    const p = teamRoster.find(x => x.discord_id === discordUser.discord_id);
    return p?.nick || discordUser.username;
  }, [discordUser, teamRoster]);

  // 🔥 SOLUÇÃO: Forçar Idioma PT-BR por Padrão na Forja
  useEffect(() => {
    if (isForjaPreset && lang === 'en') {
      setLang('pt');
    }
  }, [isForjaPreset, lang, setLang]);

  const handleCopy = () => {
    copyUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Se captainA/B_discordId não está definido (ex: custom game), qualquer um pode entrar nessa vaga.
  // A restrição só se aplica quando um capitão específico foi pré-configurado (partidas oficiais da Forja).
  const isHostAuthorized  = !isForjaPreset || isForjaAdmin || !lobby.config.captainA_discordId || (discordUser && discordUser.discord_id === lobby.config.captainA_discordId);
  const isGuestAuthorized = !isForjaPreset || isForjaAdmin || !lobby.config.captainB_discordId || (discordUser && discordUser.discord_id === lobby.config.captainB_discordId);

  const canJoinA = (!lobby.captain1 || lobby.captain1 === guestId || (isForjaPreset && discordUser && discordUser.discord_id === lobby.config.captainA_discordId)) && isHostAuthorized;
  const canJoinB = (!lobby.captain2 || lobby.captain2 === guestId || (isForjaPreset && discordUser && discordUser.discord_id === lobby.config.captainB_discordId)) && isGuestAuthorized;

  const teamSize = lobby.config.teamSize;
  const isMCL = lobby.config.preset?.includes('MCL');

  // FIXED: activeSlots are now simple roster indices (0, 1, 2) - memoized to prevent re-creation
  const activeSlots = useMemo(() => Array.from({ length: teamSize }, (_, i) => i), [teamSize]);

  // Initialize roster when role changes
  useEffect(() => {
    if (!role || role === 'SPECTATOR') {
      lastRole.current = role;
      return;
    }

    const roleChanged = lastRole.current !== role;
    lastRole.current = role;

    // 🔥 SOLUÇÃO: Reset de Estado ao Trocar de Lado (Anti-Leak)
    setPlayerNames(prev => {
      // Se não houve mudança de papel e já temos dados válidos, mantemos (respeita edição manual)
      if (!roleChanged && Object.keys(prev).length > 0 && captainPosition !== null && prev[captainPosition]) return prev;

      const next: Record<number, string> = {};
      const existingPlayers = role === 'A' ? lobby.teamAPlayers : lobby.teamBPlayers;
      
      // FIXED: Map existing clean array to indices
      if (existingPlayers && Array.isArray(existingPlayers)) {
        existingPlayers.forEach((p, idx) => {
          next[idx] = p.name;
        });
      }
      
      // 🔥 SOLUÇÃO: Blindagem de Identidade do Capitão
      const captainNameForRoster = isForjaPreset 
        ? (userAuthIdentity || forjaTeam?.team_name || '---')
        : localNickname;

      // Ensure captain has a name
      activeSlots.forEach(idx => {
        if (next[idx] === undefined) {
          next[idx] = idx === captainPosition ? captainNameForRoster : '';
        }
      });
      
      // Auto-fill for FORJA (Starters)
      if (isForjaPreset && forjaTeam && teamRoster.length > 0) {
        activeSlots.forEach((idx) => {
          if (!next[idx] || next[idx] === '---') {
            const player = teamRoster[idx] || teamRoster[0];
            next[idx] = player.nick || '---';
          }
        });
      }

      return next;
    });
    
    // Default team name
    if (isForjaPreset && forjaTeam) {
      setTeamName(forjaTeam.team_name);
      
      // 🔥 SOLUÇÃO: Correção da "Crise de Identidade" do Capitão
      // No modo FORJA, Host/Guest NUNCA deve ser "Spectator"
      if (userAuthIdentity) {
        setLocalNickname(userAuthIdentity);
      } else {
        setLocalNickname(forjaTeam.team_name);
      }
    } else if (teamSize === 1) {
      const existingTeamName = role === 'A' ? (lobby.teamAName || lobby.captain1Name) : (lobby.teamBName || lobby.captain2Name);
      setTeamName(prev => {
        if (!roleChanged && prev) return prev;
        return existingTeamName || prev || (role === 'A' ? t.teamA : t.teamB);
      });
    }
  }, [role, teamSize, isForjaPreset, forjaTeam?.id, teamRoster, userAuthIdentity, t.teamA, t.teamB, activeSlots, captainPosition]);

  // 🔥 SOLUÇÃO: Sincronização Segura da Posição do Capitão (Anti-Loop)
  useEffect(() => {
    if (!role || role === 'SPECTATOR') return;
    
    if (!activeSlots.includes(captainPosition || -1)) {
      setCaptainPosition(activeSlots[0]);
    }
  }, [role, activeSlots, captainPosition]);


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
    const finalTeamName = (teamName.trim() || (teamSize === 1 ? localNickname : defaultTeamName));

    // 🔥 SOLUÇÃO: Validação Anti-Clone (Não permitir jogadores duplicados)
    if (isForjaPreset) {
      const selectedNicks = Object.values(playerNames).filter(n => n && n !== '---');
      if (new Set(selectedNicks).size !== selectedNicks.length) {
        alert(lang === 'pt' ? "Jogadores duplicados detectados! Cada vaga deve ter um jogador único." : "Duplicate players detected! Each slot must have a unique player.");
        return;
      }
      if (selectedNicks.length < activeSlots.length) {
        alert(lang === 'pt' ? "Por favor, preencha todos os jogadores da lineup." : "Please fill all players in the lineup.");
        return;
      }
    }

    // FIXED: Convert playerNames Record to clean array
    const rosterArray = activeSlots.map(idx => playerNames[idx]);
    
    // We send names as a Record for backward compatibility or refactor onJoin later
    // But importantly, the IDs used here are now relative indices 0, 1, 2.
    const namesRecord: Record<number, string> = { ...playerNames };
    namesRecord[role === 'A' ? 100 : 200] = finalTeamName;

    onJoin(role, captainPosition!, namesRecord, localNickname);
  };

  const getPositionLabel = (idx: number) => {
    if (isMCL || lobby.config.teamSize === 3) {
      return lang === 'en' ? `Player ${idx + 1}` : `Jogador ${idx + 1}`;
    }
    return idx === 1 ? t.middle : t.corner;
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
                  title={!isHostAuthorized ? (lang === 'en' ? "Only the official Captain can take this slot" : "Apenas o Capitão oficial pode assumir esta vaga") : undefined}
                >
                  <Shield className={cn("w-8 h-8", role === 'A' ? "text-blue-500" : "text-slate-700")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {lobby.captain1 === guestId ? (lang === 'en' ? 'RE-JOIN HOST' : 'REENTRAR HOST') : t.roleHost}
                  </span>
                  {!isHostAuthorized && isForjaPreset && (
                    <span className="text-[8px] text-amber-500 font-bold uppercase leading-tight text-center max-w-[80px]">
                      {lang === 'en' ? 'Locked for Captain' : 'Apenas para Capitão'}
                    </span>
                  )}
                  {!canJoinA && <Lock className="absolute top-2 right-2 w-3 h-3 text-slate-600" />}
                </button>
                <button
                  disabled={!canJoinB}
                  onClick={() => setRole('B')}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group relative",
                    role === 'B' ? "bg-red-500/10 border-red-500" : "bg-slate-950 border-slate-800 hover:border-slate-700",
                    !canJoinB && "opacity-40 cursor-not-allowed grayscale"
                  )}
                  title={!isGuestAuthorized ? (lang === 'en' ? "Only the official Captain can take this slot" : "Apenas o Capitão oficial pode assumir esta vaga") : undefined}
                >
                  <Sword className={cn("w-8 h-8", role === 'B' ? "text-red-500" : "text-slate-700")} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {lobby.captain2 === guestId ? (lang === 'en' ? 'RE-JOIN GUEST' : 'REENTRAR CONVIDADO') : t.roleGuest}
                  </span>
                  {!isGuestAuthorized && isForjaPreset && (
                    <span className="text-[8px] text-amber-500 font-bold uppercase leading-tight text-center max-w-[80px]">
                      {lang === 'en' ? 'Locked for Captain' : 'Apenas para Capitão'}
                    </span>
                  )}
                  {!canJoinB && <Lock className="absolute top-2 right-2 w-3 h-3 text-slate-600" />}
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

          {/* Team Name */}
          {!isFinished && teamSize > 1 && role && role !== 'SPECTATOR' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-3 h-3" />
                {t.teamName}
              </label>
              {isForjaPreset && forjaTeam ? (
                <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                  {forjaTeam.image_url ? (
                    <img src={forjaTeam.image_url} alt={forjaTeam.team_name} className="w-10 h-10 rounded-lg object-cover border border-slate-800 shadow-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
                      <Shield className="w-5 h-5 text-slate-700" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider leading-none mb-1">{forjaTeam.team_name}</p>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-none">Time Oficial Forja</p>
                  </div>
                </div>
              ) : (
                <input 
                  type="text" 
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={role === 'A' ? (lang === 'en' ? 'Team A (Host)' : 'Time A (Host)') : (lang === 'en' ? 'Team B (Guest)' : 'Time B (Convidado)')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 transition-all"
                />
              )}
            </motion.div>
          )}

          {/* Nickname (Hidden for FORJA Captains to simplify UX) */}
          {(!isForjaPreset || role === 'SPECTATOR') && role && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
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
            </motion.div>
          )}



          {/* Team Roster (Only for players) */}
          {!isFinished && role && role !== 'SPECTATOR' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6"
            >
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {isForjaPreset ? (lang === 'pt' ? 'Confirmar Lineup (Titulares)' : 'Confirm Lineup (Starters)') : (teamSize === 1 ? t.playerName : t.teamRoster)}
                </label>
                {teamSize > 1 && !isForjaPreset && (
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    {t.selectCaptainPos}
                  </span>
                )}

              {isForjaPreset && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">👑</span>
                  <div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">
                      {lang === 'pt' ? 'Capitão do Draft' : 'Draft Captain'}
                    </p>
                    <p className="text-sm font-bold text-white leading-none">
                      {userAuthIdentity || forjaTeam?.team_name || '---'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {activeSlots.map((id) => (
                  <div key={id} className="flex gap-4 items-center">
                    {teamSize > 1 && !isForjaPreset && (
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
                      {/* FIXED: No magic turn-based colors here */}
                      
                      {isForjaPreset && teamRoster.length > 0 ? (
                        <div className="relative">
                          <select
                            value={playerNames[id] || ''}
                            onChange={(e) => handlePlayerNameChange(id, e.target.value)}
                            className={cn(
                              "w-full bg-slate-950 border rounded-xl pr-10 py-3 text-sm focus:outline-none transition-all appearance-none cursor-pointer",
                              "px-4",
                              id === captainPosition ? "font-bold text-amber-500 border-amber-500/50" : "border-slate-800 text-white"
                            )}
                          >
                            {id === captainPosition && !teamRoster.some(p => p.nick === playerNames[id]) && (
                               <option value={playerNames[id]}>{playerNames[id]}</option>
                            )}
                             {teamRoster.map(p => {
                                const isSelectedElsewhere = Object.entries(playerNames).some(([sid, name]) => Number(sid) !== id && name === p.nick);
                                return (
                                  <option key={p.discord_id} value={p.nick} disabled={isSelectedElsewhere}>
                                    {p.nick} {p.is_reserve ? (lang === 'en' ? '(Reserve)' : '(Reserva)') : ''}
                                    {isSelectedElsewhere ? (lang === 'en' ? ' (Selected)' : ' (Já selecionado)') : ''}
                                  </option>
                                );
                              })}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                      ) : (
                        <input 
                          type="text"
                          value={playerNames[id] || ''}
                          onChange={(e) => handlePlayerNameChange(id, e.target.value)}
                          placeholder={teamSize === 1 ? t.nicknamePlaceholder : `${getPositionLabel(id)} ${t.playerName}...`}
                          className={cn(
                            "w-full bg-slate-950 border rounded-xl pr-4 py-3 text-sm focus:outline-none transition-all",
                            "px-4",
                            id === captainPosition ? "font-bold" : "",
                            role === 'A' ? "focus:border-blue-500" : "focus:border-red-500"
                          )}
                          style={{ 
                            borderColor: id === captainPosition ? (role === 'A' ? '#3b82f6' : '#ec4899') : '#1e293b',
                            color: 'white'
                          }}
                        />
                      )}
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

