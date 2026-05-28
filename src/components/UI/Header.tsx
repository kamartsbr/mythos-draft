import { Sword, Users, Copy, Volume2, VolumeX, Bug, User, X, Check, Shield, Key, Coffee } from 'lucide-react';
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
  isAdmin?: boolean;
  authenticateAdmin?: (token: string) => boolean;
  logoutAdmin?: () => void;
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
  setNickname,
  isAdmin,
  authenticateAdmin,
  logoutAdmin
}: HeaderProps) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

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

  const handleCopyPix = () => {
    navigator.clipboard.writeText("41345391889")
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      })
      .catch(() => {
        // Silently catch clipboard copy errors
      });
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(lobby.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch (err) {
      copyUrl();
    }
  };

  return (
    <header className="lobby-topbar z-[60] w-full h-20 px-4 lg:px-6">
      {/* 1. Left Zone: Compact Donation Widget */}
      <div className="topbar-coffee flex items-center shrink-0">
        <div className="flex items-center bg-slate-900/60 border border-slate-800 p-0.5 rounded-xl hover:border-amber-500/30 transition-all duration-300 max-w-[190px] xl:max-w-none shrink-0">
          <button 
            onClick={handleCopyPix}
            className="flex items-center gap-1.5 px-2 py-1 group shrink-0"
            title={copySuccess ? (t.donation?.pixCopied || "Copied!") : (t.donation?.email || "goldpentakill@gmail.com")}
          >
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-amber-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
              <Coffee className="w-3.5 h-3.5 text-amber-500 relative animate-bounce-subtle shrink-0" />
            </div>
            <span className="text-[9px] font-black text-amber-500/90 uppercase tracking-widest hidden xl:inline select-none">
              {t.donation?.title || 'Coffee'}
            </span>
          </button>
          
          <div className="hidden sm:flex items-center gap-1 p-0.5 bg-white/5 rounded-lg border border-white/5 shrink-0">
            <button
              onClick={handleCopyPix}
              className={cn(
                "px-2 py-1 text-[8px] font-black rounded transition-all uppercase tracking-tight flex items-center gap-1 shrink-0",
                copySuccess ? "text-green-400 bg-green-500/10" : "text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10"
              )}
            >
              <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] shrink-0" />
              {copySuccess ? "COPIED" : "PIX"}
            </button>
            <div className="w-px h-2.5 bg-white/10 shrink-0" />
            <a
              href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=joaocarfan@hotmail.com&currency_code=USD"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[8px] font-black text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-all uppercase tracking-tight flex items-center gap-1 shrink-0"
            >
              <span className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)] shrink-0" />
              Paypal
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Match Identity Zone: Draft Info (Left) & Balanced Score Capsule (Right) */}
      <div className="topbar-match">
        {/* Draft Identity Block */}
        <div className="flex items-center gap-3 min-w-0">
          <Sword className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex flex-col min-w-0 select-none">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] leading-none mb-1">
              {lobby.config.preset === 'MCL' ? `MCL T3X3 · R${lobby.config.mclRound || 1}` : (lang === 'pt' ? lobby.config.seriesType.replace('BO', 'MD') : lobby.config.seriesType)}
            </span>
            <span className="font-extrabold text-sm tracking-tight text-white uppercase italic draft-title leading-tight" title={lobby.config.name || t.title}>
              {lobby.config.name || t.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[9px] font-bold text-slate-400">ID</span>
              <span className="text-slate-300 font-mono text-[10px] tracking-wider select-all">{lobby.id}</span>
              <div className="relative flex items-center shrink-0">
                <button 
                  onClick={handleCopyId}
                  className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                  title="Copy Lobby ID"
                  aria-live="polite"
                >
                  {copiedId ? (
                    <Check className="w-2.5 h-2.5 text-green-400 scale-110 transition-all duration-300" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-slate-400 hover:text-white transition-colors" />
                  )}
                </button>
                {copiedId && (
                  <span className="absolute left-full ml-2 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-wider rounded whitespace-nowrap shadow-lg shadow-black/50 select-none animate-pulse">
                    Copied!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ScoreCapsule Block with Game Badge */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end">
          <div className="score-capsule bg-slate-950/80 border border-slate-900 px-3 py-1.5 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
            <span className={cn(
              "text-right truncate text-xs font-black uppercase tracking-tight text-slate-400",
              scoreA > scoreB ? "text-blue-400" : ""
            )}>
              {(lobby.teamAName || lobby.captain1Name) || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}
            </span>
            <span className="text-center text-lg font-black text-white bg-blue-500/20 py-0.5 rounded-lg border border-blue-500/30">
              {scoreA}
            </span>
            <span className="text-center text-[10px] font-black text-slate-600 italic">
              VS
            </span>
            <span className="text-center text-lg font-black text-white bg-red-500/20 py-0.5 rounded-lg border border-red-500/30">
              {scoreB}
            </span>
            <span className={cn(
              "text-left truncate text-xs font-black uppercase tracking-tight text-slate-400",
              scoreB > scoreA ? "text-red-400" : ""
            )}>
              {(lobby.teamBName || lobby.captain2Name) || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}
            </span>
          </div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl shrink-0">
            G{lobby.currentGame}
          </span>
        </div>
      </div>

      {/* 3. Actions & Status Zone */}
      <div className="topbar-actions flex items-center gap-3 shrink-0">
        {/* Status Pill */}
        <div className={cn(
          "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0",
          lobby.status === 'waiting' ? "bg-blue-500/5 border-blue-500/10 text-blue-400" :
          lobby.status === 'drafting' ? "bg-amber-500/5 border-amber-500/10 text-amber-400" :
          "bg-green-500/5 border-green-500/10 text-green-400"
        )}>
          {lobby.status === 'waiting' ? t.waitingPlayers : lobby.status === 'drafting' ? t.draftingInProgress : t.draftComplete}
        </div>

        <div className="h-6 w-px bg-slate-800/80 shrink-0" />

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSpectatorModal(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all flex items-center gap-1.5 group"
          >
            <Users className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {spectatorCount}
            </span>
          </button>
          <button 
            onClick={toggleSound} 
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all group"
            title={isSoundEnabled ? "Mute Sounds" : "Unmute Sounds"}
          >
            {isSoundEnabled ? (
              <Volume2 className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            ) : (
              <VolumeX className="w-4 h-4 text-red-500 group-hover:text-red-400 transition-colors" />
            )}
          </button>

          {/* Discreet Admin Login Button */}
          {authenticateAdmin && (
            <button 
              onClick={() => {
                if (isAdmin) {
                   if (window.confirm('Do you want to exit Admin mode?')) {
                      logoutAdmin?.();
                   }
                   return;
                }
                const pass = window.prompt('Admin password:');
                if (pass) {
                   const ok = authenticateAdmin(pass);
                   if (ok) alert('Admin mode enabled.');
                   else alert('Incorrect password.');
                }
              }}
              className={cn(
                "p-2 rounded-lg transition-all duration-300",
                isAdmin 
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50" 
                  : "bg-slate-900 border border-slate-800 text-slate-500 hover:text-amber-500 hover:border-amber-500/50"
              )}
              title={isAdmin ? "Admin Active" : "Admin Login"}
            >
              {isAdmin ? <Shield className="w-4 h-4" /> : <Key className="w-4 h-4" />}
            </button>
          )}

          {/* Nickname Editing */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
            {isEditingNick ? (
              <div className="flex items-center gap-1">
                <input 
                  type="text"
                  className="bg-transparent border-none text-[9px] font-black text-white uppercase tracking-wider outline-none w-16 sm:w-24 focus:ring-0 p-0"
                  value={tempNickname}
                  onChange={(e) => setTempNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateNickname()}
                  autoFocus
                  maxLength={20}
                />
                <button 
                  onClick={handleUpdateNickname}
                  className="p-0.5 hover:text-green-400 transition-colors"
                >
                  <Check className="w-3.5 h-3.5 text-green-500" />
                </button>
                <button 
                  onClick={() => {
                    setIsEditingNick(false);
                    setTempNickname(nickname);
                  }}
                  className="p-0.5 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingNick(true)}
                className="flex items-center gap-1.5 group whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-500 transition-colors" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
                  {nickname || 'PLAYER'}
                </span>
              </button>
            )}
          </div>

          <LanguageToggle lang={lang} setLang={setLang} />
          <button 
            onClick={() => setShowBugModal(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
            title={t.reportBug || "Report a Bug"}
          >
            <Bug className="w-4 h-4 text-slate-500 group-hover:text-red-500 transition-colors" />
          </button>
          {isCaptain && lobby.status !== 'finished' && (
            <button 
              onClick={leaveSlot} 
              className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950 transition-all rounded-lg text-amber-500 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/5"
              title={lang === 'en' ? "Leave your slot and free it for someone else" : "Sair da sua posição e liberá-la para outra pessoa"}
            >
              {lang === 'en' ? "FREE" : "LIBERAR"}
            </button>
          )}
          <button 
            onClick={leave} 
            className="px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all rounded-lg text-red-500 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/5"
          >
            {t.leave}
          </button>
        </div>
      </div>
    </header>
  );
}
