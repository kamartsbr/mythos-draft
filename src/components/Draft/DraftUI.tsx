import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dices } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { useSoundNotifications } from '../../hooks/useSoundNotifications';
import { soundService } from '../../services/soundService';
import { Lobby } from '../../types';
import { DraftHeader } from './DraftHeader';
import { AdminBar } from './AdminBar';
import { DraftBoard } from './DraftBoard';
import { SpectatorPanel } from './SpectatorPanel';
import { JoinLobbyModal } from '../Lobby/JoinLobbyModal';
import { Header } from '../UI/Header';
import { DraftReplay } from './DraftReplay';
import { SpectatorSummary } from './SpectatorSummary';
import { Chat } from './Chat';
import { cn } from '../../lib/utils';
import { MAPS } from '../../constants';

interface DraftUIProps {
  lobby: Lobby;
  guestId: string;
  isCaptain1: boolean;
  isCaptain2: boolean;
  handleAction: (id: string, playerId?: number) => void;
  copyUrl: () => void;
  getShareableUrl: () => string;
  setLobbyId: (id: string | null) => void;
  t: any;
  handleReady: (isReady?: boolean) => void;
  isProcessing: boolean;
  optimisticReady: boolean | null;
  optimisticAction: { id: string, type: 'pick' | 'ban' | 'map_pick' | 'map_ban' } | null;
  isMyTurn: boolean;
  myTeam: 'A' | 'B' | 'BOTH' | null;
  handlePickerAction: (id: string, playerId?: number) => void;
  reportScore: (winner: 'A' | 'B') => void;
  resetVotes: () => void;
  nickname: string;
  setNickname: (val: string) => void;
  joinLobby: (id: string, role: 'A' | 'B' | 'SPECTATOR', pos: number, names: Record<number, string>, nickname: string) => void;
  soloJoin: (id: string, nickname: string) => void;
  lang: string;
  showInviteModal: boolean;
  setShowInviteModal: (val: boolean) => void;
  showJoinModal: boolean;
  setShowJoinModal: (val: boolean) => void;
  isSpectator: boolean;
  setIsSpectator: (val: boolean) => void;
  showSpectatorModal: boolean;
  setShowSpectatorModal: (val: boolean) => void;
  isAdmin: boolean;
  authenticateAdmin: (token: string) => boolean;
  logoutAdmin: () => void;
  forceReset: () => void;
  resetCurrentGame: () => void;
  forceFinish: () => void;
  forceUnpause: () => void;
  forceStartDraft: () => void;
  leaveSlot: () => void;
  playerNames: Record<number, string>;
  setPlayerNames: (val: any) => void;
  preferredPosition: 'corner' | 'middle';
  setPreferredPosition: (val: 'corner' | 'middle') => void;
  onHome: () => void;
  error: string | null;
  setError: (val: string | null) => void;
  setLang: (lang: 'en' | 'pt' | 'es') => void;
  updateRoster: (newPicks: any[], subs: any[]) => void;
  clearSubs: () => void;
  requestReset: () => void;
  respondReset: (accept: boolean) => void;
  showBugModal: boolean;
  setShowBugModal: (val: boolean) => void;
}

export function DraftUI(props: DraftUIProps) {
  const { lobby, isCaptain1, isCaptain2, handleAction, handlePickerAction, t, setLobbyId, onHome, error, setError, getShareableUrl, updateRoster, clearSubs, requestReset, respondReset, showBugModal, setShowBugModal, forceStartDraft } = props;
  const { timeLeft } = useTimer(lobby, isCaptain1, isCaptain2, handleAction, handlePickerAction);
  useSoundNotifications(lobby, timeLeft, isCaptain1, isCaptain2);
  
  const [viewGameIndex, setViewGameIndex] = useState<number | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [showSummary, setShowSummary] = useState(props.isSpectator && lobby.status !== 'finished' && lobby.phase !== 'reporting');
  
  // Reset viewGameIndex when phase changes to drafting to ensure we show the live draft
  useEffect(() => {
    if (lobby.status === 'drafting' && lobby.phase !== 'ready') {
      setViewGameIndex(null);
    }
  }, [lobby.status, lobby.phase]);

  // Ensure showSummary is updated if the lobby is in progress
  useEffect(() => {
    if (props.isSpectator && lobby.status === 'drafting' && lobby.phase !== 'reporting') {
      // Logic for spectators during ongoing draft if needed
    }
  }, [lobby.status, lobby.phase, props.isSpectator]);
  const picks = Array.isArray(lobby.picks) ? lobby.picks : [];
  const bans = Array.isArray(lobby.bans) ? lobby.bans : [];
  const prevPicksCount = useRef(picks.length);
  const prevBansCount = useRef(bans.length);

  useEffect(() => {
    if (picks.length > prevPicksCount.current) {
      soundService.play('pick');
    }
    if (bans.length > prevBansCount.current) {
      soundService.play('ban');
    }
    prevPicksCount.current = picks.length;
    prevBansCount.current = bans.length;
  }, [picks.length, bans.length]);

  const seriesMapsList = useMemo(() => (Array.isArray(lobby.seriesMaps) ? lobby.seriesMaps : Object.values(lobby.seriesMaps || {})), [lobby.seriesMaps]);

  const mapElements = useMemo(() => seriesMapsList.map((mapId, idx) => {
    const map = MAPS.find(m => m.id.toLowerCase() === (mapId || '').toLowerCase());
    const isCurrent = lobby.currentGame === idx + 1;
    const history = Array.isArray(lobby.history) ? lobby.history : [];
    const canView = history && history[idx];
    const replayLog = Array.isArray(lobby.replayLog) ? lobby.replayLog : [];
    const pickStep = replayLog.find(step => step.action === 'PICK' && step.target === 'MAP' && step.id === mapId && step.gameNumber === idx + 1);

    return (
      <motion.div 
        key={idx}
        initial={false}
        animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
        whileHover={canView ? { scale: 1.05 } : {}}
        onClick={() => canView && setViewGameIndex(idx)}
        role={canView ? "button" : "presentation"}
        tabIndex={canView ? 0 : undefined}
        aria-label={map ? t.mapNames?.[map.id] || map.name : `GAME ${idx + 1}`}
        onKeyDown={(e) => {
          if (canView && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setViewGameIndex(idx);
          }
        }}
        className={cn(
          "relative w-56 aspect-video rounded-2xl overflow-hidden border-4 transition-all duration-500",
          isCurrent ? "border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] z-10" : 
          canView ? "border-slate-800 opacity-80 cursor-pointer hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500" : "border-slate-800 opacity-40 grayscale"
        )}
      >
        {map ? (
          <img src={map.image} alt={map.name} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-slate-950 flex items-center justify-center">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">GAME {idx + 1}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4">
          <span className={cn(
            "text-xs font-black uppercase tracking-widest flex items-center gap-1",
            isCurrent ? "text-amber-500" : "text-slate-500"
          )}>
            {map ? (t.mapNames?.[map.id] || map.name) : `GAME ${idx + 1}`}
            {pickStep?.isRandom && <Dices className="w-3 h-3 text-amber-500" />}
          </span>
        </div>
      </motion.div>
    );
  }), [seriesMapsList, lobby.currentGame, lobby.history, lobby.replayLog, t.mapNames]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden selection:bg-amber-500/30">
      <Header 
        lobby={lobby}
        lang={props.lang as 'en' | 'pt' | 'es'}
        t={t}
        scoreA={lobby.scoreA}
        scoreB={lobby.scoreB}
        spectatorCount={lobby.spectators?.length || 0}
        setShowSpectatorModal={props.setShowSpectatorModal}
        copyUrl={props.copyUrl}
        leave={() => setLobbyId(null)}
        leaveSlot={props.leaveSlot}
        isCaptain={props.isCaptain1 || props.isCaptain2}
        setLang={props.setLang}
        showBugModal={showBugModal}
        setShowBugModal={setShowBugModal}
        nickname={props.nickname}
        setNickname={props.setNickname}
        isAdmin={props.isAdmin}
        authenticateAdmin={props.authenticateAdmin}
        logoutAdmin={props.logoutAdmin}
      />

      <AdminBar 
        isAdmin={props.isAdmin}
        onResetGame={props.resetCurrentGame}
        onResetSeries={props.forceReset}
        onForceFinish={props.forceFinish}
        onForceUnpause={props.forceUnpause}
        onForceStart={props.forceStartDraft}
        t={t}
        status={lobby.status}
        phase={lobby.phase}
      />

      <main className="flex-1 flex flex-col pt-[68px] md:pt-0 overflow-y-auto md:overflow-hidden relative custom-scrollbar">
        <DraftHeader 
          lobby={lobby} 
          timeLeft={timeLeft} 
          t={t} 
        />

        {props.isSpectator && (
          <div className="px-6 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.spectatorMode || 'SPECTATOR MODE'}</span>
            </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/streamer/${lobby.id}`;
                      window.open(url, '_blank');
                    }}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                  >
                    STREAMER HUD
                  </button>
              <button
                onClick={() => setShowSummary(!showSummary)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                  showSummary 
                    ? "bg-amber-500 border-amber-500 text-slate-950" 
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                )}
              >
                {showSummary ? t.viewDraftBoard || 'VIEW DRAFT BOARD' : t.viewSummary || 'VIEW SUMMARY'}
              </button>
            </div>
          </div>
        )}

        {/* Series Maps Bar - Always Visible */}
        {(lobby.config.preset === 'MCL' || (lobby.status !== 'finished' && lobby.config.teamSize !== 1)) && (
          <div className="bg-slate-900/30 border-b border-slate-900 p-4 md:p-6 z-30 overflow-x-auto custom-scrollbar" aria-label="Series Maps">
            <div className="flex items-center justify-start md:justify-center gap-4 md:gap-8 min-w-max px-4">
              {mapElements}
            </div>
          </div>
        )}

        {showSummary ? (
          <SpectatorSummary 
            lobby={lobby} 
            t={t} 
            lang={props.lang} 
            onViewGame={(idx) => {
              setViewGameIndex(idx);
              setShowSummary(false);
            }} 
          />
        ) : (
          <DraftBoard 
            {...props} 
            timeLeft={timeLeft} 
            viewGameIndex={viewGameIndex}
            setViewGameIndex={setViewGameIndex}
            onShowReplay={() => setShowReplay(true)}
            isMyTurn={props.isMyTurn}
            myTeam={props.myTeam}
          />
        )}
      </main>

      <AnimatePresence>
        {showReplay && (
          <DraftReplay 
            lobby={lobby}
            onClose={() => setShowReplay(false)}
            t={t}
            lang={props.lang as 'en' | 'pt'}
          />
        )}
      </AnimatePresence>

      {props.showSpectatorModal && (
        <SpectatorPanel 
          spectators={lobby.spectators || []} 
          onClose={() => props.setShowSpectatorModal(false)}
          t={t}
        />
      )}

      {props.showJoinModal && (
        <JoinLobbyModal 
          lobby={lobby}
          t={t}
          lang={props.lang as 'en' | 'pt' | 'es'}
          setLang={props.setLang}
          nickname={props.nickname}
          setNickname={props.setNickname}
          isAdmin={props.isAdmin}
          onJoin={(role, pos, names, nick) => {
            props.joinLobby(lobby.id, role, pos, names, nick);
            props.setShowJoinModal(false);
          }}
          onSoloJoin={(nick) => {
            props.soloJoin(lobby.id, nick);
            props.setShowJoinModal(false);
          }}
          guestId={props.guestId}
          onClose={() => props.setLobbyId(null)}
          copyUrl={props.copyUrl}
          getShareableUrl={getShareableUrl}
        />
      )}

      {/* Real-time Chat Container */}
      {!props.showJoinModal && (
        <Chat 
          lobbyId={lobby.id}
          guestId={props.guestId}
          nickname={props.nickname}
          isCaptain1={props.isCaptain1}
          isCaptain2={props.isCaptain2}
          isAdmin={props.isAdmin}
          isSpectator={props.isSpectator}
          t={t}
        />
      )}
    </div>
  );
}
