import { Sword, Users, Copy, Volume2, VolumeX, Bug, User, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby } from '../../types';
import { soundService } from '../../services/soundService';
import { useState, useEffect } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { BugReportModal } from './BugReportModal';

interface HeaderProps {
  lobby: Lobby;
  lang: 'en' | 'pt' | 'es';
  t: any;
  scoreA: number;
  scoreB: number;
  spectatorCount: number;
  setShowSpectatorModal: (val: boolean) => void;
  copyUrl: () => void;
  leave: () => void;
  leaveSlot: () => void;
  isCaptain: boolean;
  setLang: (lang: 'en' | 'pt' | 'es') => void;
  showBugModal: boolean;
  setShowBugModal: (val: boolean) => void;
  nickname: string;
  setNickname: (val: string) => void;
}

export function Header({ 
  lobby, 
  lang, 
  t, 
  scoreA, 
  scoreB, 
  spectatorCount, 
  setShowSpectatorModal, 
  copyUrl, 
  leave,
  leaveSlot,
  isCaptain,
  setLang,
  showBugModal,
  setShowBugModal,
  nickname,
  setNickname
}: HeaderProps) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);

  useEffect(() => {
    setTempNickname(nickname);
  }, [nickname]);

  const handleUpdateNickname = () => {
    if (tempNickname.trim()) {
      setNickname(tempNickname);
      localStorage.setItem('mythos_nickname', tempNickname);
      setIsEditingNick(false);
    }
  };

  const toggleSound = () => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    soundService.setEnabled(newState);
  };

  return (
    <header className="border-b border-slate-900 bg-slate-950/50 backdrop-blur-md z-[60]">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Sword className="w-8 h-8 text-amber-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none mb-1">DRAFT</span>
            <span className="font-black text-lg sm:text-xl tracking-tight text-white uppercase italic truncate block">{lobby.config.name || t.title}</span>
          </div>
          <div className="h-8 w-px bg-slate-800 mx-2 shrink-0" />
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">ID</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">{lobby.id}</span>
              <button onClick={copyUrl} className="p-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all group">
                <Copy className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Enhanced Series Score */}
          <div className="flex items-center gap-4 px-6 py-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
                {lobby.config.preset === 'MCL' ? `MCL T3X3 - R${lobby.config.mclRound || 1}` : (lang === 'pt' ? lobby.config.seriesType.replace('BO', 'MD') : lobby.config.seriesType)}
              </span>
              <div className="h-4 w-px bg-slate-800" />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-lg font-black uppercase tracking-tight",
                  scoreA > scoreB ? "text-blue-400" : "text-slate-400"
                )}>
                  {lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}
                </span>
                <span className="text-3xl font-black text-white bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/30 min-w-[3rem] text-center">
                  {scoreA}
                </span>
              </div>

              <div className="text-xl font-black text-slate-700 italic">VS</div>

              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-white bg-red-500/20 px-3 py-1 rounded-lg border border-red-500/30 min-w-[3rem] text-center">
                  {scoreB}
                </span>
                <span className={cn(
                  "text-lg font-black uppercase tracking-tight",
                  scoreB > scoreA ? "text-red-400" : "text-slate-400"
                )}>
                  {lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-2">
              <div className="h-4 w-px bg-slate-800" />
              <span className="text-sm font-black text-amber-500 uppercase tracking-widest">G{lobby.currentGame}</span>
            </div>
          </div>

          <div className={cn(
            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border",
            lobby.status === 'waiting' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
            lobby.status === 'drafting' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
            "bg-green-500/10 border-green-500/20 text-green-400"
          )}>
            {lobby.status === 'waiting' ? t.waitingPlayers : lobby.status === 'drafting' ? t.draftingInProgress : t.draftComplete}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSpectatorModal(true)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all flex items-center gap-2 group"
            >
              <Users className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                {spectatorCount}
              </span>
            </button>
            <button 
              onClick={toggleSound} 
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all group"
              title={isSoundEnabled ? "Mute Sounds" : "Unmute Sounds"}
            >
              {isSoundEnabled ? (
                <Volume2 className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
              ) : (
                <VolumeX className="w-5 h-5 text-red-500 group-hover:text-red-400 transition-colors" />
              )}
            </button>
            <div className="h-8 w-px bg-slate-800 mx-1" />
            
            {/* Nickname Editing */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              {isEditingNick ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    className="bg-transparent border-none text-[10px] font-black text-white uppercase tracking-wider outline-none w-24 sm:w-32 focus:ring-0 p-0"
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateNickname()}
                    autoFocus
                    maxLength={20}
                  />
                  <button 
                    onClick={handleUpdateNickname}
                    className="p-1 hover:text-green-400 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditingNick(false);
                      setTempNickname(nickname);
                    }}
                    className="p-1 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingNick(true)}
                  className="flex items-center gap-2 group whitespace-nowrap"
                >
                  <User className="w-4 h-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
                    {nickname || 'PLAYER'}
                  </span>
                </button>
              )}
            </div>

            <div className="h-8 w-px bg-slate-800 mx-1" />
            <LanguageToggle lang={lang} setLang={setLang} />
            <div className="h-8 w-px bg-slate-800 mx-1" />
            <button 
              onClick={() => setShowBugModal(true)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
              title={t.reportBug || "Report a Bug"}
            >
              <Bug className="w-5 h-5 text-slate-500 group-hover:text-red-500 transition-colors" />
            </button>
            <div className="h-8 w-px bg-slate-800 mx-1" />
            {isCaptain && lobby.status !== 'finished' && (
              <button 
                onClick={leaveSlot} 
                className="px-6 py-2.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950 transition-all rounded-xl text-amber-500 font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-500/5 mr-2"
                title={lang === 'en' ? "Leave your slot and free it for someone else" : "Sair da sua posição e liberá-la para outra pessoa"}
              >
                {lang === 'en' ? "FREE SLOT" : "LIBERAR VAGA"}
              </button>
            )}
            <button 
              onClick={leave} 
              className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all rounded-xl text-red-500 font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/5"
            >
              {t.leave}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
