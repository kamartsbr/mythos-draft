import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sword, Loader2, AlertTriangle, Github, MessageSquare, Scroll, User, X } from 'lucide-react';
import { useLobby } from './hooks/useLobby';
import { useDraft } from './hooks/useDraft';
import { useDraftConfig } from './hooks/useDraftConfig';
import { LanguageToggle } from './components/UI/LanguageToggle';
import { LobbyCreation } from './components/Lobby/LobbyCreation';
import { LobbyList } from './components/Lobby/LobbyList';
import { DraftUI } from './components/Draft/DraftUI';
import { StreamerHUD } from './components/Draft/StreamerHUD';
import { ConfirmModal } from './components/UI/ConfirmModal';
import { BugReportModal } from './components/UI/BugReportModal';
import { PatchNotesModal } from './components/UI/PatchNotesModal';
import { TRANSLATIONS, PLAYER_COLORS, MCL_ROUND_MAPS, getMCLPicks } from './constants';
import { Lobby, PickEntry } from './types';
import { lobbyService } from './services/lobbyService';
import { cn } from './lib/utils';

import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { Footer } from './components/UI/Footer';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [lang, setLang] = useState<string>('en');
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;
  const [authError, setAuthError] = useState<string | null>(null);

  // Simple Routing for Streamer HUD & Overlay
  const isOverlay = window.location.pathname.startsWith('/overlay/');
  const isStreamerHud = window.location.pathname.startsWith('/streamer/');
  const isStreamerDock = window.location.pathname.startsWith('/streamer-dock/');
  const lobbyIdFromPath = (isOverlay || isStreamerHud || isStreamerDock) ? window.location.pathname.split('/')[2] : null;

  useEffect(() => {
    const signIn = async () => {
      try {
        const { signInAnonymously, onAuthStateChanged } = await import('firebase/auth');
        const { auth } = await import('./firebase');
        const { syncServerTime } = await import('./lib/serverTime');
        
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            syncServerTime();
            // Trigger a one-time index refresh for the current database if user is premium/admin or just once per session
            lobbyService.refreshLobbyIndex().catch(console.error);
          } else {
            // Only try anonymous if no user is present
            try {
              await signInAnonymously(auth);
            } catch (e: any) {
              if (e.code === 'auth/admin-restricted-operation') {
                setAuthError('anonymous_disabled');
              } else {
                console.error("Auth failed:", e);
              }
            }
          }
        });
      } catch (e) {
        console.error("Auth setup failed:", e);
      }
    };
    signIn();
  }, []);

  const {
    lobby,
    lobbyId,
    setLobbyId,
    guestId,
    nickname,
    setNickname,
    isCaptain1,
    isCaptain2,
    isSpectator,
    setIsSpectator,
    isAdmin,
    publicLobbies,
    error,
    setError,
    loading: lobbyLoading,
    join,
    soloJoin,
    create,
    leave,
    leaveSlot,
    forceReset,
    resetCurrentGame,
    forceFinish,
    forceUnpause,
    isAuthReady
  } = useLobby(localStorage.getItem('mythos_nickname') || '');

  const {
    error: draftError,
    setError: setDraftError,
    loading: draftLoading,
    handleAction,
    handlePickerAction,
    reportScore,
    resetVotes,
    handleReady,
    isProcessing,
    optimisticReady,
    optimisticAction,
    generateStandardTurnOrder,
    updateRoster,
    clearSubs,
    requestReset,
    respondReset
  } = useDraft(lobby, isCaptain1, isCaptain2, guestId || '', lang);

  const {
    config,
    setConfig,
    lobbyName,
    setLobbyName,
    applyPreset,
    isLocked
  } = useDraftConfig();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetId = params.get('preset');
    if (presetId === 'MCL') {
      applyPreset('MCL');
    } else if (presetId && presetId.startsWith('custom_')) {
      const id = presetId.replace('custom_', '');
      lobbyService.getPreset(id).then(preset => {
        if (preset) {
          setConfig({ ...preset.config, preset: presetId });
        }
      });
    }
  }, [applyPreset]);

  const [playerNames, setPlayerNames] = useState<Record<number, string>>({});
  const [preferredPosition, setPreferredPosition] = useState<'corner' | 'middle'>('corner');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSpectatorModal, setShowSpectatorModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [isPermanent, setIsPermanent] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

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

  useEffect(() => {
    if (isAuthReady && lobbyId && lobby && !isCaptain1 && !isCaptain2 && !isSpectator) {
      // Double check against raw lobby data to avoid timing issues
      if (lobby.captain1 === guestId || lobby.captain2 === guestId) return;
      
      setShowJoinModal(true);
    }
  }, [isAuthReady, lobbyId, lobby, isCaptain1, isCaptain2, isSpectator, guestId]);

  // Auto-hide join modal if spectator status is confirmed
  useEffect(() => {
    if (isSpectator && showJoinModal) {
      setShowJoinModal(false);
    }
  }, [isSpectator, showJoinModal]);

  // Auto-join as spectator if should be spectator but not in list
  useEffect(() => {
    if (isAuthReady && lobbyId && lobby && isSpectator && !isCaptain1 && !isCaptain2 && guestId) {
      const alreadyInList = lobby.spectators?.some(s => s.id === guestId);
      if (!alreadyInList) {
        join(lobbyId, 'SPECTATOR', 0, {}, nickname || 'Spectator');
      }
    }
  }, [isAuthReady, lobbyId, lobby, isSpectator, isCaptain1, isCaptain2, guestId, nickname, join]);

  const handleCreateLobby = async () => {
    if (!isAuthReady || !guestId) return;
    if (!lobbyName.trim()) {
      setError(t.enterDraftName);
      return;
    }

    const id = Math.random().toString(36).substring(2, 9);
    const standard = generateStandardTurnOrder(config);
    const finalMapOrder = config.mapTurnOrder.length > 0 ? config.mapTurnOrder : standard.mapOrder;
    const finalGodOrder = config.godTurnOrder.length > 0 ? config.godTurnOrder : standard.godOrder;
    const finalTurnOrder = [...finalMapOrder, ...finalGodOrder];

    const picks: PickEntry[] = [];
    const teamSize = config.teamSize;
    
    const gameCount = config.seriesType === 'BO1' ? 1 : 
                      config.seriesType === 'BO3' ? 3 : 
                      config.seriesType === 'BO5' ? 5 : 
                      config.seriesType === 'BO7' ? 7 : 
                      config.seriesType === 'BO9' ? 9 : 
                      (config.customGameCount || 1);

    const initialSeriesMaps: string[] = new Array(gameCount).fill("");

    if (config.preset === 'MCL') {
      const mclPicks = getMCLPicks(1, initialSeriesMaps[0] || null, null);
      picks.push(...mclPicks);
    } else {
      let picksPerTeam = teamSize;
      if (teamSize === 1) {
        const gameCount = config.seriesType === 'BO3' ? 3 : 
                          config.seriesType === 'BO5' ? 5 : 
                          config.seriesType === 'BO7' ? 7 : 
                          config.seriesType === 'BO9' ? 9 : 
                          (config.customGameCount || 1);
        if (gameCount > 1) {
          picksPerTeam = gameCount + 1;
        }
      }

      for (let i = 0; i < picksPerTeam; i++) {
        if (teamSize === 1) {
          // 1v1 Scenario: Host (Blue) vs Guest (Red)
          // We use P5 and P6 colors as requested for 1v1
          picks.push({ 
            playerId: 5, 
            godId: null, 
            team: 'A', 
            color: PLAYER_COLORS[5], 
            position: 'middle', 
            playerName: 'Host' 
          });
          picks.push({ 
            playerId: 6, 
            godId: null, 
            team: 'B', 
            color: PLAYER_COLORS[6], 
            position: 'middle', 
            playerName: 'Guest' 
          });
        } else if (teamSize === 2) {
          if (i === 0) {
            picks.push({ playerId: 1, godId: null, team: 'A', color: PLAYER_COLORS[1], position: 'corner', playerName: 'P1' });
            picks.push({ playerId: 2, godId: null, team: 'B', color: PLAYER_COLORS[2], position: 'corner', playerName: 'P2' });
          } else {
            picks.push({ playerId: 4, godId: null, team: 'A', color: PLAYER_COLORS[4], position: 'corner', playerName: 'P4' });
            picks.push({ playerId: 3, godId: null, team: 'B', color: PLAYER_COLORS[3], position: 'corner', playerName: 'P3' });
          }
        } else {
          if (i === 0) {
            picks.push({ playerId: 1, godId: null, team: 'A', color: PLAYER_COLORS[1], position: 'corner', playerName: 'P1' });
            picks.push({ playerId: 2, godId: null, team: 'B', color: PLAYER_COLORS[2], position: 'corner', playerName: 'P2' });
          } else if (i === 1) {
            picks.push({ playerId: 5, godId: null, team: 'A', color: PLAYER_COLORS[5], position: 'middle', playerName: 'P5' });
            picks.push({ playerId: 6, godId: null, team: 'B', color: PLAYER_COLORS[6], position: 'middle', playerName: 'P6' });
          } else {
            picks.push({ playerId: 4, godId: null, team: 'A', color: PLAYER_COLORS[4], position: 'corner', playerName: 'P4' });
            picks.push({ playerId: 3, godId: null, team: 'B', color: PLAYER_COLORS[3], position: 'corner', playerName: 'P3' });
          }
        }
      }
    }

    if (config.preset === 'MCL' && config.mclRound) {
      const roundMap = MCL_ROUND_MAPS[config.mclRound];
      if (roundMap && gameCount >= 3) {
        // Map 1 and 2 will be picked, Map 3 is pre-determined.
        initialSeriesMaps[2] = roundMap;
      }
    }

    const newLobby: Lobby = {
      id,
      status: 'waiting',
      captain1: null,
      captain1Name: null,
      captain2: null,
      captain2Name: null,
      readyA: false,
      readyB: false,
      readyA_report: false,
      readyB_report: false,
      config: { ...config, name: lobbyName },
      turnOrder: finalTurnOrder,
      selectedMap: null,
      seriesMaps: initialSeriesMaps,
      mapBans: [],
      turn: 0,
      phase: 'waiting',
      bans: [],
      picks,
      scoreA: 0,
      scoreB: 0,
      reportVoteA: null,
      reportVoteB: null,
      voteConflict: false,
      voteConflictCount: 0,
      currentGame: 1,
      history: [],
      replayLog: [],
      lastWinner: null,
      timerStart: null,
      createdAt: (await import('firebase/firestore')).serverTimestamp(),
      hiddenActions: [],
      spectators: [],
      adminId: guestId,
      isHidden: false,
      isPermanent: isAdmin ? isPermanent : false,
      discordWebhookUrl: isAdmin ? discordWebhookUrl : null,
    };

    await create(id, newLobby);
    setShowJoinModal(true);
  };

  const [connStatus, setConnStatus] = useState<'testing' | 'ok' | 'fail'>('testing');

  useEffect(() => {
    const test = async () => {
      try {
        const { doc, getDocFromServer } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        // Small delay to allow initializeFirestore to settle
        await new Promise(r => setTimeout(r, 1000));
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnStatus('ok');
        console.log("App-level connection test: SUCCESS");
      } catch (e: any) {
        console.error("App-level connection test fail:", e);
        setConnStatus('fail');
        
        // Detailed error reporting for users
        if (e.message?.includes('offline') || e.message?.includes('backend')) {
          console.warn("Retrying with background knowledge: Network restriction detected.");
        }
      }
    };
    test();
  }, []);

  const getShareableUrl = () => {
    let url = window.location.href;
    if (url.includes('ais-dev-')) {
      url = url.replace('ais-dev-', 'ais-pre-');
    }
    return url;
  };

  const copyUrl = () => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url);
    setError(t.urlCopied);
    setTimeout(() => setError(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500/30 relative flex flex-col">
      {(isOverlay || isStreamerHud) && lobbyIdFromPath ? (
        <StreamerHUD lobbyId={lobbyIdFromPath} />
      ) : (
        <>
          {/* Global Language Toggle - Show when not in a lobby or when auth is required */}
          {(!lobbyId || (authError === 'anonymous_disabled' && !guestId)) && (
            <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
              {/* Nickname Display/Edit */}
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl h-10">
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
                      <Sword className="w-3.5 h-3.5" />
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
                    <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                      <User className="w-3 h-3 text-slate-950" />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-amber-500 transition-colors">
                      {nickname || 'PLAYER'}
                    </span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowPatchNotes(true)}
                className="h-10 px-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 transition-all flex items-center gap-2 group relative"
              >
                <Scroll className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest hidden sm:inline">Patch Notes</span>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
              </button>
              <LanguageToggle lang={lang} setLang={setLang as any} />
            </div>
          )}

          {lobbyLoading || (!isAuthReady && !authError) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
              <p className="text-xl font-medium">{t.loading}</p>
            </div>
          ) : authError === 'anonymous_disabled' && !guestId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black mb-4 text-white uppercase tracking-tight">
                Anonymous Login Disabled
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                To allow users to access drafts without a Google account, you need to enable Anonymous Authentication in your Firebase Console.
              </p>
              <div className="text-left bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">How to enable:</h3>
                <ol className="list-decimal pl-5 text-sm text-slate-400 space-y-3">
                  <li>Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-amber-500 hover:underline">Firebase Console</a></li>
                  <li>Select your project</li>
                  <li>Go to <strong>Authentication</strong> &gt; <strong>Sign-in method</strong></li>
                  <li>Click <strong>Add new provider</strong></li>
                  <li>Select <strong>Anonymous</strong> and enable it</li>
                  <li>Save and refresh this page</li>
                </ol>
              </div>
            </div>
          ) : !lobbyId ? (
            <div className="flex-1 relative overflow-hidden">
              {/* Background Decorative Elements */}
              <div className="mythic-glow top-[-10%] left-[-10%] w-[50%] h-[50%]" />
              <div className="mythic-glow bottom-[-10%] right-[-10%] w-[50%] h-[50%] opacity-10" />
              
              {/* Hero Background Image */}
              <div className="absolute top-0 left-0 right-0 h-[800px] opacity-40 pointer-events-none z-0">
                <img 
                  src="https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest" 
                  alt="" 
                  className="w-full h-full object-cover object-top filter brightness-125 contrast-110 saturate-125"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950" />
              </div>

              {/* Side God Columns */}
              <div className="absolute top-[750px] bottom-[450px] left-0 w-[18%] flex flex-col opacity-60 pointer-events-none hidden xl:flex z-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950 z-10" />
                {[
                  "https://static.wikia.nocookie.net/ageofempires/images/1/14/AoMRT_Greek_Zeus.webp/revision/latest/scale-to-width-down/1000?cb=20250701110532",
                  "https://static.wikia.nocookie.net/ageofempires/images/7/7c/AoMRT_Norse_Loki.webp/revision/latest/scale-to-width-down/1000?cb=20250701110502",
                  "https://static.wikia.nocookie.net/ageofempires/images/f/f5/Fuxi_artwork_AoMR.png/revision/latest/scale-to-width-down/1000?cb=20250204185506",
                  "https://static.wikia.nocookie.net/ageofempires/images/d/dd/AoMRT_Egyptian_Isis.webp/revision/latest/scale-to-width-down/1000?cb=20250701110517",
                  "https://static.wikia.nocookie.net/ageofempires/images/3/3e/Amaterasu_artwork_new_AoMR.png/revision/latest/scale-to-width-down/1000?cb=20250730190329",
                  "https://static.wikia.nocookie.net/ageofempires/images/e/e7/AoMRT_Atlantean_Kronos.webp/revision/latest/scale-to-width-down/1000?cb=20250701110454"
                ].map((url, i) => (
                        <div key={i} className="relative h-[450px] w-full shrink-0">
                          {url && (
                            <img src={url} alt="" className="w-full h-full object-cover filter brightness-125 saturate-150 contrast-110" referrerPolicy="no-referrer" loading="lazy" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950" />
                        </div>
                ))}
              </div>

              <div className="absolute top-[750px] bottom-[450px] right-0 w-[18%] flex flex-col opacity-60 pointer-events-none hidden xl:flex z-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950 z-10" />
                {[
                  "https://static.wikia.nocookie.net/ageofempires/images/7/7e/Demeter_artwork_AoMR.webp/revision/latest/scale-to-width-down/1000?cb=20260127183206",
                  "https://static.wikia.nocookie.net/ageofempires/images/e/e9/AoMR_Freyr_artwork.jpg/revision/latest/scale-to-width-down/1000?cb=20240828163623",
                  "https://static.wikia.nocookie.net/ageofempires/images/5/5c/AoMRT_Egyptian_Set-scaled.webp/revision/latest/scale-to-width-down/1000?cb=20250701110515",
                  "https://static.wikia.nocookie.net/ageofempires/images/3/37/AoMRT_Atlantean_Oranos.webp/revision/latest/scale-to-width-down/1000?cb=20250701110455",
                  "https://static.wikia.nocookie.net/ageofempires/images/5/56/Tsukuyomi_artwork_new_AoMR.png/revision/latest/scale-to-width-down/1000?cb=20250730190333",
                  "https://static.wikia.nocookie.net/ageofempires/images/4/45/Nuwa_artwork_AoMR.png/revision/latest/scale-to-width-down/1000?cb=20250204185423"
                ].map((url, i) => (
                        <div key={i} className="relative h-[450px] w-full shrink-0">
                          {url && (
                            <img src={url} alt="" className="w-full h-full object-cover filter brightness-125 saturate-150 contrast-110" referrerPolicy="no-referrer" loading="lazy" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-slate-950" />
                        </div>
                ))}
              </div>

              {/* Bottom Banner Image */}
              <div className="absolute bottom-0 left-0 right-0 h-[400px] opacity-20 pointer-events-none z-0">
                <img 
                  src="https://static.wikia.nocookie.net/ageofempires/images/3/3e/AoMR_WHM_2026_Wallpaper.webp/revision/latest" 
                  alt="" 
                  className="w-full h-full object-cover filter brightness-110 saturate-125"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>
              
              {/* WIP Banner */}
              <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 flex items-center justify-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">
                  {t.wipNotice}
                </p>
              </div>

              <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-24 relative"
                >
                  {/* Decorative Crest */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] -z-10 opacity-5 pointer-events-none">
                    <img 
                      src="https://static.wikia.nocookie.net/ageofempires/images/8/89/AoMR_Hades_icon.png" 
                      alt="" 
                      className="w-full h-full object-contain blur-3xl"
                    />
                  </div>

                  <div className="relative mb-8">
                    <motion.img 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      src="https://static.wikia.nocookie.net/ageofempires/images/e/e0/Logo_AoMR.png/revision/latest" 
                      alt="Age of Mythology: Retold" 
                      className="h-40 md:h-64 mx-auto drop-shadow-[0_0_50px_rgba(245,158,11,0.4)] filter brightness-110 saturate-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="mt-4">
                      <h1 className="text-4xl md:text-6xl font-black mythic-text bg-gradient-to-b from-white via-slate-100 to-slate-500 bg-clip-text text-transparent drop-shadow-2xl">
                        {t.title}
                      </h1>
                    </div>
                  </div>

                  <p className="text-slate-300 text-xl max-w-2xl mx-auto font-medium leading-relaxed opacity-80 italic">
                    "{t.heroSubtitle}"
                  </p>

                  {/* Pantheon GIFs Section */}
                  <div className="mt-16 flex flex-col items-center gap-8 max-w-6xl mx-auto px-4">
                    {/* Featured GIF (Atlantean - Last one) */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="relative rounded-2xl overflow-hidden border-2 border-amber-500/30 group hover:border-amber-500/60 transition-all shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)]"
                    >
                      <img 
                        src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjJrdzE4a3htbHZkbThxMmxsM2pwcGFnOXpycWdmcjNtcWVlbzRuMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/el0mymYI09FZhdWNT8/giphy.gif" 
                        alt="Atlantean Pantheon" 
                        className="w-full h-auto max-w-[600px] opacity-90 group-hover:opacity-100 transition-all duration-700"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
                    </motion.div>

                    {/* Secondary GIFs Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                      {[
                        'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnpueHVnZ3J0eGhsaWVzc2NjeXpjYmhiZDhxeDA0bXVxNzd0aXdubiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/F8SiwH88zI0xpqQX9n/giphy.gif',
                        'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGtmNDNmeTYxNnZmZ3NtYWFhc2lxcHE1MW1kNDk0anA2ajg4bmNjaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ja8kTzj7g8MMK1g0ex/giphy.gif',
                        'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXNpMGRtOXM5NmZlOXdkbmE1YjRvOWxwM3l0MHdjNWZ5dnhxbm55MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Kclw9Lg7mHYVzf6ipM/giphy.gif',
                      ].map((url, i) => (
                        <motion.div
                          key={url}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 + i * 0.1 }}
                          className="relative rounded-xl overflow-hidden border border-amber-500/20 group hover:border-amber-500/40 transition-all shadow-xl"
                        >
                          {url && (
                            <img 
                              src={url} 
                              alt="Mythic Pantheon" 
                              className="w-full h-auto opacity-80 group-hover:opacity-100 transition-all duration-500"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent pointer-events-none" />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-10 flex items-center justify-center gap-4">
                    <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/50" />
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] ${connStatus === 'ok' ? 'bg-green-500' : connStatus === 'fail' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">
                        {connStatus === 'ok' ? t.connEstablished : connStatus === 'fail' ? t.connSevered : t.connInvoking}
                      </span>
                    </div>
                    <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/50" />
                  </div>
                </motion.div>

                <div className="grid lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-7 space-y-8">
                    <LobbyCreation 
                      t={t}
                      lang={lang as any}
                      lobbyName={lobbyName}
                      setLobbyName={setLobbyName}
                      config={config}
                      setConfig={setConfig}
                      isLocked={isLocked}
                      applyPreset={applyPreset}
                      createLobby={handleCreateLobby}
                      generateStandardTurnOrder={generateStandardTurnOrder}
                      isAdmin={isAdmin}
                      isPermanent={isPermanent}
                      setIsPermanent={setIsPermanent}
                      discordWebhookUrl={discordWebhookUrl}
                      setDiscordWebhookUrl={setDiscordWebhookUrl}
                    />
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <LobbyList 
                      lobbies={publicLobbies}
                      t={t}
                      isAdmin={isAdmin}
                      onJoin={(id) => {
                        setLobbyId(id);
                        const targetLobby = publicLobbies.find(l => l.id === id);
                        if (targetLobby && (targetLobby.captain1 === guestId || targetLobby.captain2 === guestId || targetLobby.spectators?.some(s => s.id === guestId))) {
                          setShowJoinModal(false);
                        } else {
                          setShowJoinModal(true);
                        }
                      }}
                      onClearAll={() => setShowClearConfirm(true)}
                    />
                  </div>
                </div>

                <ConfirmModal 
                  isOpen={showClearConfirm}
                  onClose={() => setShowClearConfirm(false)}
                  onConfirm={async () => {
                    try {
                      await lobbyService.clearAllLobbies();
                      setShowClearConfirm(false);
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  title={t.clearAllLobbies}
                  message={t.clearAllConfirm}
                  confirmText={t.clearAllLobbies}
                  cancelText={t.cancel}
                />

                {(error || draftError) && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                  >
                    {error || draftError}
                  </motion.div>
                )}

                {/* Footer */}
                <footer className="mt-24 pt-12 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">
                      <Sword className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.createdBy}</p>
                      <p className="text-sm font-bold text-white mythic-text tracking-normal">KamaRTS</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-0">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Discord_logo.svg/1920px-Discord_logo.svg.png" 
                        alt="Discord" 
                        className="w-20 h-10 object-contain"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] -mt-1">omoradin</span>
                    </div>
                    <div className="h-4 w-px bg-slate-800" />
                    <button 
                      onClick={() => setShowPatchNotes(true)}
                      className="text-[10px] font-bold text-slate-500 hover:text-amber-500 uppercase tracking-widest transition-colors"
                    >
                      {t.patchNotesTitle}
                    </button>
                    <div className="h-4 w-px bg-slate-800" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Mythos Draft Tool &copy; 2026
                    </p>
                  </div>
                </footer>
              </div>
            </div>
          ) : (lobbyId && !lobby) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
              <p className="text-xl font-medium">{t.loading}</p>
            </div>
          ) : (
            <DraftUI 
              lobby={lobby!} 
              guestId={guestId} 
              isCaptain1={isCaptain1} 
              isCaptain2={isCaptain2} 
              isAdmin={isAdmin}
              forceReset={forceReset}
              resetCurrentGame={resetCurrentGame}
              forceFinish={forceFinish}
              forceUnpause={forceUnpause}
              leaveSlot={leaveSlot}
              handleAction={handleAction}
              handlePickerAction={handlePickerAction}
              copyUrl={copyUrl}
              getShareableUrl={getShareableUrl}
              setLobbyId={setLobbyId}
              t={t}
              handleReady={handleReady}
              isProcessing={isProcessing}
              optimisticReady={optimisticReady}
              optimisticAction={optimisticAction}
              reportScore={reportScore}
              resetVotes={resetVotes}
              nickname={nickname}
              setNickname={setNickname}
              joinLobby={join}
              soloJoin={soloJoin}
              lang={lang}
              showInviteModal={showInviteModal}
              setShowInviteModal={setShowInviteModal}
              showJoinModal={showJoinModal}
              setShowJoinModal={setShowJoinModal}
              isSpectator={isSpectator}
              setIsSpectator={setIsSpectator}
              showSpectatorModal={showSpectatorModal}
              setShowSpectatorModal={setShowSpectatorModal}
              playerNames={playerNames}
              setPlayerNames={setPlayerNames}
              preferredPosition={preferredPosition}
              setPreferredPosition={setPreferredPosition}
              onHome={() => setLobbyId(null)}
              error={draftError}
              setError={setDraftError}
              setLang={setLang as any}
              updateRoster={updateRoster}
              clearSubs={clearSubs}
              requestReset={requestReset}
              respondReset={respondReset}
              showBugModal={showBugModal}
              setShowBugModal={setShowBugModal}
            />
          )}

          <BugReportModal 
            isOpen={showBugModal} 
            onClose={() => setShowBugModal(false)} 
            t={t} 
            lobbyId={lobbyId || ''} 
          />

          <PatchNotesModal 
            isOpen={showPatchNotes}
            onClose={() => setShowPatchNotes(false)}
            t={t}
          />

          <Footer t={t} lang={lang} />
        </>
      )}
    </div>
  );
}
