import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Plus, ChevronRight, RefreshCw, Map as MapIcon, Trophy, Lock, Eye, Globe, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LobbyConfig, SeriesType, TeamSize } from '../../types';
import { MAPS, MAJOR_GODS, PANTHEONS, MCL_ROUND_MAPS, CASCA_GROSSA_GROUP_POOL, CASCA_GROSSA_PLAYOFF_POOL, getMCLMapPool } from '../../constants';
import { PresetBuilder } from './PresetBuilder';
import { lobbyService } from '../../services/lobbyService';
import { useEffect } from 'react';

interface LobbyCreationProps {
  t: any;
  lang: string;
  lobbyName: string;
  setLobbyName: (val: string) => void;
  config: LobbyConfig;
  setConfig: (val: any) => void;
  isLocked: (field: string) => boolean;
  applyPreset: (preset: string) => void;
  createLobby: () => void;
  generateStandardTurnOrder: (cfg: LobbyConfig) => any;
}

export function LobbyCreation({
  t,
  lang,
  lobbyName,
  setLobbyName,
  config,
  setConfig,
  isLocked,
  applyPreset,
  createLobby,
  generateStandardTurnOrder
}: LobbyCreationProps) {
  const [showManualMaps, setShowManualMaps] = useState(false);
  const [showManualPantheons, setShowManualPantheons] = useState(false);
  const [showPresetBuilder, setShowPresetBuilder] = useState(false);
  const [communityPresets, setCommunityPresets] = useState<any[]>([]);

  useEffect(() => {
    const unsub = lobbyService.subscribeToPresets(setCommunityPresets);
    return () => unsub();
  }, []);

  const handleSaveCustomPreset = async (name: string, customConfig: LobbyConfig) => {
    try {
      const id = await lobbyService.savePreset(name, customConfig);
      setConfig({ ...customConfig, preset: `custom_${id}` });
      setShowPresetBuilder(false);
    } catch (err) {
      console.error('Failed to save preset:', err);
    }
  };

  const applyCustomPreset = (preset: any) => {
    setConfig({ ...preset.config, preset: `custom_${preset.id}` });
  };

  const toggleMap = (mapId: string) => {
    setConfig((prev: any) => {
      const allowedMaps = prev.allowedMaps.includes(mapId)
        ? prev.allowedMaps.filter((id: string) => id !== mapId)
        : [...prev.allowedMaps, mapId];
      return { ...prev, allowedMaps, preset: 'CUSTOM' };
    });
  };

  const togglePantheon = (godId: string) => {
    const god = MAJOR_GODS.find(g => g.id === godId);
    if (god?.culture === 'Aztec') {
      if (config.preset === 'MCL' && (config.mclRound || 1) < 5) return;
    }

    setConfig((prev: any) => {
      const allowedPantheons = prev.allowedPantheons.includes(godId)
        ? prev.allowedPantheons.filter((id: string) => id !== godId)
        : [...prev.allowedPantheons, godId];
      return { ...prev, allowedPantheons, preset: 'CUSTOM' };
    });
  };

  const enableAllMaps = () => {
    setConfig((prev: any) => ({ ...prev, allowedMaps: MAPS.map(m => m.id), preset: 'CUSTOM' }));
  };

  const disableAllMaps = () => {
    setConfig((prev: any) => ({ ...prev, allowedMaps: [], preset: 'CUSTOM' }));
  };

  const enableAllPantheons = () => {
    setConfig((prev: any) => {
      const isMCLRoundLocked = prev.preset === 'MCL' && (prev.mclRound || 1) < 5;
      
      return { 
        ...prev, 
        allowedPantheons: MAJOR_GODS.filter(g => {
          if (g.culture === 'Aztec' && isMCLRoundLocked) return false;
          return true;
        }).map(g => g.id), 
        preset: 'CUSTOM' 
      };
    });
  };

  const disableAllPantheons = () => {
    setConfig((prev: any) => ({ ...prev, allowedPantheons: [], preset: 'CUSTOM' }));
  };

  const togglePantheonGroup = (culture: string) => {
    if (culture === 'Aztec' && config.preset === 'MCL' && (config.mclRound || 1) < 5) return;
    const godsInPantheon = MAJOR_GODS.filter(g => g.culture === culture).map(g => g.id);
    const allSelected = godsInPantheon.every(id => config.allowedPantheons.includes(id));

    setConfig((prev: any) => {
      let newAllowed;
      if (allSelected) {
        newAllowed = prev.allowedPantheons.filter((id: string) => !godsInPantheon.includes(id));
      } else {
        const otherPantheons = prev.allowedPantheons.filter((id: string) => !godsInPantheon.includes(id));
        newAllowed = [...otherPantheons, ...godsInPantheon];
      }

      // Re-apply Aztec restriction if needed
      if (prev.preset === 'MCL' && (prev.mclRound || 1) < 5) {
        newAllowed = newAllowed.filter((id: string) => {
          const god = MAJOR_GODS.find(g => g.id === id);
          return god?.culture !== 'Aztec';
        });
      }

      return { ...prev, allowedPantheons: newAllowed, preset: prev.preset === 'MCL' ? 'MCL' : 'CUSTOM' };
    });
  };

  return (
    <div className="mythic-card overflow-hidden">
      {/* Hero Banner */}
      <div className="h-32 md:h-40 relative overflow-hidden">
        <img 
          src="https://static.wikia.nocookie.net/ageofempires/images/d/d3/AoMR_OM_cover_portrait.jpg/revision/latest" 
          alt="Age of Mythology Banner" 
          className="w-full h-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute bottom-4 left-8">
          <h2 className="text-2xl font-black mythic-text flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 backdrop-blur-sm">
              <Plus className="w-5 h-5 text-amber-500" />
            </div>
            {t.createLobby}
          </h2>
        </div>
      </div>

      <div className="p-8 pt-4">
        <AnimatePresence>
          {showPresetBuilder && (
            <PresetBuilder 
              t={t} 
              onClose={() => setShowPresetBuilder(false)} 
              onSave={handleSaveCustomPreset} 
            />
          )}
        </AnimatePresence>
      
      <div className="space-y-6">
        {/* Draft Name */}
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{t.lobbyName}</label>
          <input 
            type="text" 
            maxLength={30}
            value={lobbyName}
            placeholder={t.lobbyNamePlaceholder}
            onChange={(e) => setLobbyName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 transition-all"
          />
        </div>

        {/* Presets */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block">{t.presets}</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'CUSTOM', label: t.custom },
              { id: 'RANKED', label: t.rankedPool },
              { 
                id: 'MCL', 
                label: t.mclTournament,
                icon: "https://liquipedia.net/commons/images/c/c0/Mythic_Clan_League_allmode.png"
              }
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  "py-2 px-1 rounded-lg border text-xs font-bold transition-all uppercase tracking-tighter text-center flex items-center justify-center gap-2",
                  config.preset === preset.id 
                    ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                )}
              >
                {preset.icon && (
                  <img 
                    src={preset.icon} 
                    alt="" 
                    className="w-4 h-4 object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                {preset.label}
              </button>
            ))}
          </div>
          
          <AnimatePresence mode="popLayout">
            {config.preset === 'CASCA' && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                    {t.selectStage}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'GROUP', label: t.cascaGrossaGroup },
                      { id: 'PLAYOFFS', label: t.cascaGrossaPlayoffs }
                    ].map(stage => (
                      <button
                        key={stage.id}
                        onClick={() => {
                          setConfig((prev: any) => {
                            const newConfig = { ...prev, tournamentStage: stage.id as 'GROUP' | 'PLAYOFFS' };
                            // Re-apply preset logic for the new stage
                            newConfig.acePick = false;
                            if (stage.id === 'GROUP') {
                              newConfig.seriesType = 'BO1';
                              newConfig.allowedMaps = CASCA_GROSSA_GROUP_POOL;
                              newConfig.firstMapRandom = true;
                              newConfig.mapBanCount = 0;
                              newConfig.banCount = 0;
                              newConfig.hasBans = false;
                            } else {
                              newConfig.seriesType = 'BO3';
                              newConfig.allowedMaps = CASCA_GROSSA_PLAYOFF_POOL;
                              newConfig.firstMapRandom = true;
                              newConfig.mapBanCount = 2;
                              newConfig.banCount = 2;
                              newConfig.hasBans = true;
                            }
                            return newConfig;
                          });
                        }}
                        className={cn(
                          "py-2 rounded-lg border text-sm font-bold transition-all",
                          config.tournamentStage === stage.id 
                            ? "bg-amber-500 border-amber-500 text-slate-950" 
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        )}
                      >
                        {stage.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {config.preset === 'MCL' && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                  <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed text-center px-2">
                    {t.mclTournamentDesc}
                  </p>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                      {t.selectStage}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfig((prev: any) => ({ ...prev, tournamentStage: 'GROUP' }))}
                        className={cn(
                          "py-2 rounded-lg border text-sm font-bold transition-all",
                          config.tournamentStage === 'GROUP' 
                            ? "bg-amber-500 border-amber-500 text-slate-950" 
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        )}
                      >
                        {t.mclGroupStage}
                      </button>
                      <div className="relative group">
                        <button
                          disabled
                          className="w-full py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-600 text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <Lock className="w-4 h-4" />
                          {t.mclPlayoffs}
                        </button>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none border border-slate-700">
                          {t.mclPlayoffsLocked}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                      {t.tournamentRound}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map(round => (
                        <button
                          key={round}
                          onClick={() => setConfig((prev: any) => {
                            const newPantheons = round >= 5 
                              ? MAJOR_GODS.map(g => g.id) // All gods
                              : prev.allowedPantheons.filter((id: string) => {
                                  const god = MAJOR_GODS.find(g => g.id === id);
                                  return god?.culture !== 'Aztec';
                                });
                            
                            const newMaps = getMCLMapPool(round);
                            const roundMap = MCL_ROUND_MAPS[round];
                            const finalMaps = roundMap && !newMaps.includes(roundMap) 
                              ? [...newMaps, roundMap] 
                              : newMaps;

                            return { 
                              ...prev, 
                              mclRound: round,
                              allowedMaps: finalMaps,
                              allowedPantheons: newPantheons
                            };
                          })}
                          className={cn(
                            "py-2 rounded-lg border text-sm font-bold transition-all",
                            config.mclRound === round 
                              ? "bg-amber-500 border-amber-500 text-slate-950" 
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                          )}
                        >
                          {round}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-800/50">
                    <div className="w-10 h-10 rounded overflow-hidden bg-slate-800 flex-shrink-0">
                      <img 
                        src={MAPS.find(m => m.id === MCL_ROUND_MAPS[config.mclRound || 1])?.image} 
                        alt="Round Map" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-tighter">
                        {t.predeterminedMap}
                      </div>
                      <div className="text-sm font-bold text-amber-500">
                        {t.mapNames?.[MCL_ROUND_MAPS[config.mclRound || 1]] || MAPS.find(m => m.id === MCL_ROUND_MAPS[config.mclRound || 1])?.name}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 space-y-4">
            {config.preset !== 'MCL' && (
              <button
                onClick={() => setShowPresetBuilder(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-widest hover:border-amber-500/50 hover:text-amber-500 transition-all group"
              >
                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                {t.createCustomPreset}
              </button>
            )}

            {communityPresets.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">{t.communityPresets}</label>
                <div className="grid grid-cols-2 gap-2">
                  {communityPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyCustomPreset(preset)}
                      className={cn(
                        "px-4 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-tight transition-all text-left truncate",
                        config.preset === `custom_${preset.id}` ? "bg-blue-500 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {config.preset?.startsWith('custom_') && (
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('preset', config.preset!);
                  navigator.clipboard.writeText(url.toString());
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all"
              >
                <Globe className="w-3 h-3" />
                {lang === 'en' ? "Share Preset Link" : "Compartilhar Link do Preset"}
              </button>
            )}
          </div>
        </div>

        {/* Series Type */}
        {config.preset !== 'MCL' && (
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              {t.seriesType}
              {isLocked('seriesType') && <Lock className="w-3 h-3 text-amber-500/50" />}
            </label>
              <div className="grid grid-cols-6 gap-2 mb-3">
                {['BO1', 'BO3', 'BO5', 'BO7', 'BO9', 'CUSTOM'].map(type => (
                  <button
                    key={type}
                    disabled={isLocked('seriesType')}
                    onClick={() => setConfig((prev: any) => {
                      const newConfig = { ...prev, seriesType: type as SeriesType };
                      if (type !== 'CUSTOM') {
                        const games = parseInt(type.replace('BO', ''));
                        newConfig.customGameCount = games;
                      }
                      return newConfig;
                    })}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all",
                      config.seriesType === type 
                        ? "bg-amber-500 border-amber-500 text-slate-950" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700",
                      isLocked('seriesType') && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {type === 'CUSTOM' ? t.custom : (lang === 'pt' ? type.replace('BO', 'MD') : type)}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="popLayout">
                {config.seriesType === 'CUSTOM' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t.gameCount}</span>
                      <input 
                        type="number"
                        min={1}
                        max={21}
                        step={2}
                        disabled={isLocked('customGameCount')}
                        value={config.customGameCount || 3}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          // Ensure odd number
                          const oddVal = val % 2 === 0 ? val + 1 : val;
                          setConfig((prev: any) => ({ ...prev, customGameCount: oddVal }));
                        }}
                        className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-base focus:outline-none focus:border-amber-500 disabled:opacity-50"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        )}

        {/* Map Bans & Random First Map */}
        {config.preset !== 'MCL' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                {t.mapBanCount}
                {isLocked('mapBanCount') && <Lock className="w-3 h-3 text-amber-500/50" />}
              </label>
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    type="number"
                    min={0}
                    max={Math.max(0, config.allowedMaps.length - 1)}
                    disabled={isLocked('mapBanCount')}
                    value={config.mapBanCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const maxBans = Math.max(0, config.allowedMaps.length - 1);
                      setConfig((prev: any) => ({ ...prev, mapBanCount: Math.min(val, maxBans) }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-base focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  {t.firstMapRandom}
                  {isLocked('firstMapRandom') && <Lock className="w-3 h-3 text-amber-500/50" />}
                </label>
                <button
                  disabled={isLocked('firstMapRandom')}
                  onClick={() => setConfig((prev: any) => ({ ...prev, firstMapRandom: !prev.firstMapRandom }))}
                  className={cn(
                    "w-full py-2 rounded-lg border text-base font-bold transition-all flex items-center justify-center gap-2",
                    config.firstMapRandom 
                      ? "bg-amber-500 border-amber-500 text-slate-950" 
                      : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700",
                    isLocked('firstMapRandom') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {config.firstMapRandom ? <RefreshCw className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                  {config.firstMapRandom ? (lang === 'en' ? 'Random' : 'Aleatório') : (lang === 'en' ? 'Pick' : 'Escolher')}
                </button>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  {t.loserPicks}
                  {isLocked('loserPicksNextMap') && <Lock className="w-3 h-3 text-amber-500/50" />}
                </label>
                <button
                  disabled={isLocked('loserPicksNextMap')}
                  onClick={() => setConfig((prev: any) => ({ ...prev, loserPicksNextMap: !prev.loserPicksNextMap }))}
                  className={cn(
                    "w-full py-2 rounded-lg border text-base font-bold transition-all flex items-center justify-center gap-2",
                    config.loserPicksNextMap 
                      ? "bg-amber-500 border-amber-500 text-slate-950" 
                      : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700",
                    isLocked('loserPicksNextMap') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {config.loserPicksNextMap ? <Trophy className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                  {config.loserPicksNextMap ? (lang === 'en' ? 'Enabled' : 'Habilitado') : (lang === 'en' ? 'Disabled' : 'Desabilitado')}
                </button>
              </div>
            </div>
        )}

        {/* Ace Pick */}
        <AnimatePresence mode="popLayout">
          {(config.banCount > 0 || config.mapBanCount > 0) && config.preset !== 'CASCA' && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden space-y-4"
            >
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  {t.acePick}
                  {isLocked('acePick') && <Lock className="w-3 h-3 text-amber-500/50" />}
                </label>
                <button
                  disabled={isLocked('acePick')}
                  onClick={() => setConfig((prev: any) => ({ ...prev, acePick: !prev.acePick }))}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between group",
                    config.acePick ? "bg-amber-500/10 border-amber-500" : "bg-slate-950 border-slate-800 hover:border-slate-700",
                    isLocked('acePick') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div>
                    <div className={cn("text-base font-bold mb-1", config.acePick ? "text-amber-500" : "text-slate-300")}>{t.acePick}</div>
                    <div className="text-sm text-slate-500">{t.acePickDesc}</div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    config.acePick ? "border-amber-500 bg-amber-500" : "border-slate-800"
                  )}>
                    {config.acePick && <Check className="w-4 h-4 text-slate-950" />}
                  </div>
                </button>
              </div>

              {config.acePick && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfig((prev: any) => ({ ...prev, acePickHidden: true }))}
                    className={cn(
                      "p-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                      config.acePickHidden 
                        ? "bg-amber-500 border-amber-500 text-slate-950" 
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                    )}
                  >
                    <Lock className="w-4 h-4" />
                    {t.acePickHidden}
                  </button>
                  <button
                    onClick={() => setConfig((prev: any) => ({ ...prev, acePickHidden: false }))}
                    className={cn(
                      "p-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                      !config.acePickHidden 
                        ? "bg-amber-500 border-amber-500 text-slate-950" 
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                    )}
                  >
                    <Eye className="w-4 h-4" />
                    {t.acePickVisible}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team Size */}
        {config.preset !== 'MCL' && (
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              {t.teamSize}
              {isLocked('teamSize') && <Lock className="w-3 h-3 text-amber-500/50" />}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(size => (
                <button
                  key={size}
                  disabled={isLocked('teamSize')}
                  onClick={() => setConfig((prev: any) => ({ ...prev, teamSize: size as TeamSize }))}
                  className={cn(
                    "py-3 rounded-xl border font-bold transition-all",
                    config.teamSize === size 
                      ? "bg-amber-500 border-amber-500 text-slate-950" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700",
                    isLocked('teamSize') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {size}v{size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* God Bans */}
        {config.preset !== 'MCL' && (
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              {t.bans}
              {isLocked('banCount') && <Lock className="w-3 h-3 text-amber-500/50" />}
            </label>
            <div className="flex items-center gap-2 mb-3">
              <input 
                type="number"
                min={0}
                max={Math.max(0, MAJOR_GODS.length - 1)}
                disabled={isLocked('banCount')}
                value={config.hasBans ? config.banCount : 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const maxBans = Math.max(0, MAJOR_GODS.length - 1);
                  const clampedVal = Math.min(val, maxBans);
                  setConfig((prev: any) => ({ 
                    ...prev, 
                    hasBans: clampedVal > 0, 
                    banCount: clampedVal 
                  }));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-base focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* Exclusivity & Privacy */}
        <div className="grid grid-cols-2 gap-6">
          {config.preset !== 'MCL' && (
            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                {t.picks}
                {isLocked('isExclusive') && <Lock className="w-3 h-3 text-amber-500/50" />}
              </label>
              <button
                disabled={isLocked('isExclusive')}
                onClick={() => setConfig((prev: any) => ({ ...prev, isExclusive: !prev.isExclusive }))}
                className={cn(
                  "w-full py-2 rounded-lg border text-base font-bold transition-all flex items-center justify-center gap-2",
                  config.isExclusive 
                    ? "bg-amber-500 border-amber-500 text-slate-950" 
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700",
                  isLocked('isExclusive') && "opacity-50 cursor-not-allowed"
                )}
              >
                {config.isExclusive ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                {config.isExclusive ? t.exclusive : t.nonExclusive}
              </button>
            </div>
          )}
          <div className={cn(config.preset === 'MCL' && "col-span-2")}>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 block">{t.visibility}</label>
            <button
              onClick={() => setConfig((prev: any) => ({ ...prev, isPrivate: !prev.isPrivate }))}
              className={cn(
                "w-full py-2 rounded-lg border text-base font-bold transition-all flex items-center justify-center gap-2",
                config.isPrivate 
                  ? "bg-amber-500 border-amber-500 text-slate-950" 
                  : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
              )}
            >
              {config.isPrivate ? <Eye className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              {config.isPrivate ? t.private : t.public}
            </button>
          </div>
        </div>

        {/* Pick Type */}
        {config.preset !== 'MCL' && (
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              {t.pickType}
              {isLocked('pickType') && <Lock className="w-3 h-3 text-amber-500/50" />}
            </label>
            <div className="flex gap-2">
              <button
                disabled={isLocked('pickType')}
                onClick={() => setConfig((prev: any) => ({ ...prev, pickType: 'alternated' }))}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-base font-bold transition-all",
                  config.pickType === 'alternated' 
                    ? "bg-amber-500 border-amber-500 text-slate-950" 
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700",
                  isLocked('pickType') && "opacity-50 cursor-not-allowed"
                )}
              >
                {t.alternated}
              </button>
              <button
                disabled={isLocked('pickType')}
                onClick={() => setConfig((prev: any) => ({ ...prev, pickType: 'blind' }))}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-base font-bold transition-all",
                  config.pickType === 'blind' 
                    ? "bg-amber-500 border-amber-500 text-slate-950" 
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700",
                  isLocked('pickType') && "opacity-50 cursor-not-allowed"
                )}
              >
                {t.blind}
              </button>
            </div>
            <p className="text-xs text-slate-500 italic">
              {config.pickType === 'alternated' ? t.standardDraftDesc : t.snakeDraftDesc}
            </p>
          </div>
        )}

        {/* Manual Map Selection */}
        <div className="space-y-2">
          <button
            onClick={() => setShowManualMaps(!showManualMaps)}
            className="w-full flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center gap-3">
              <MapIcon className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {t.manualMaps} ({config.allowedMaps.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLocked('allowedMaps') && <Lock className="w-3 h-3 text-slate-600" />}
              {showManualMaps ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
            </div>
          </button>

          <AnimatePresence>
            {showManualMaps && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                  {isLocked('allowedMaps') && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider leading-tight">
                        {t.presetActiveWarning}
                      </p>
                    </div>
                  )}
                  {!isLocked('allowedMaps') && (
                    <div className="flex justify-end gap-2">
                      <button onClick={enableAllMaps} className="text-xs font-bold text-amber-500 hover:text-amber-400 uppercase">{t.enableAll}</button>
                      <span className="text-slate-800">|</span>
                      <button onClick={disableAllMaps} className="text-xs font-bold text-slate-500 hover:text-slate-400 uppercase">{t.disableAll}</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {[...MAPS].sort((a, b) => {
                      const nameA = (t.mapNames?.[a.id] || a.name).toLowerCase();
                      const nameB = (t.mapNames?.[b.id] || b.name).toLowerCase();
                      return nameA.localeCompare(nameB, lang);
                    }).map(map => (
                      <button
                        key={map.id}
                        disabled={isLocked('allowedMaps')}
                        onClick={() => toggleMap(map.id)}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-all text-left relative overflow-hidden",
                          config.allowedMaps.includes(map.id)
                            ? "bg-amber-500/10 border-amber-500/50"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700",
                          isLocked('allowedMaps') && "cursor-not-allowed"
                        )}
                      >
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-800 flex-shrink-0">
                          <img src={map.image} alt={map.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className={cn(
                          "text-xs font-bold truncate",
                          config.allowedMaps.includes(map.id) ? "text-amber-500" : "text-slate-400"
                        )}>
                          {t.mapNames?.[map.id] || map.name}
                        </span>
                        {isLocked('allowedMaps') && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 backdrop-blur-[0.5px]">
                            <Lock className="w-4 h-4 text-amber-500/50" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Manual Pantheon Selection */}
        <div className="space-y-2">
          <button
            onClick={() => setShowManualPantheons(!showManualPantheons)}
            className="w-full flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Sword className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {t.manualPantheons || 'Manual Pantheon Selection'} ({config.allowedPantheons.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLocked('allowedPantheons') && <Lock className="w-3 h-3 text-slate-600" />}
              {showManualPantheons ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
            </div>
          </button>

          <AnimatePresence>
            {showManualPantheons && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                  {isLocked('allowedPantheons') && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider leading-tight">
                        {t.presetActiveWarning}
                      </p>
                    </div>
                  )}
                  {!isLocked('allowedPantheons') && (
                    <div className="flex justify-end gap-2">
                      <button onClick={enableAllPantheons} className="text-xs font-bold text-amber-500 hover:text-amber-400 uppercase">{t.enableAll}</button>
                      <span className="text-slate-800">|</span>
                      <button onClick={disableAllPantheons} className="text-xs font-bold text-slate-500 hover:text-slate-400 uppercase">{t.disableAll}</button>
                    </div>
                  )}

                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {PANTHEONS.map(culture => {
                      const godsInPantheon = MAJOR_GODS.filter(g => g.culture === culture);
                      const selectedInPantheon = godsInPantheon.filter(g => config.allowedPantheons.includes(g.id));
                      const isAllSelected = selectedInPantheon.length === godsInPantheon.length;
                      const isSomeSelected = selectedInPantheon.length > 0 && !isAllSelected;
                      const isAztecLocked = culture === 'Aztec' && config.preset === 'MCL' && (config.mclRound || 1) < 5;

                      return (
                        <div key={culture} className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className={cn(
                              "text-xs font-black uppercase tracking-widest flex items-center gap-2",
                              isAztecLocked ? "text-slate-600" : "text-slate-500"
                            )}>
                              {t.pantheonNames?.[culture] || culture} ({selectedInPantheon.length}/{godsInPantheon.length})
                              {isAztecLocked && <Lock className="w-3 h-3 text-amber-500/50" />}
                            </span>
                            {!isLocked('allowedPantheons') && !isAztecLocked && (
                              <button
                                onClick={() => togglePantheonGroup(culture)}
                                className={cn(
                                  "text-xs font-bold px-2 py-1 rounded transition-all uppercase",
                                  isAllSelected 
                                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                    : isSomeSelected
                                      ? "bg-amber-500/5 text-amber-400 border border-amber-500/10"
                                      : "bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700"
                                )}
                              >
                                {isAllSelected ? t.disableAll : t.enableAll}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {godsInPantheon.map(god => {
                              const isGodLocked = (god.culture === 'Aztec' && config.preset === 'MCL' && (config.mclRound || 1) < 5);
                              const isFullyLocked = isLocked('allowedPantheons') || isGodLocked;
                              
                              return (
                                <button
                                  key={god.id}
                                  disabled={isFullyLocked}
                                  onClick={() => togglePantheon(god.id)}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg border transition-all text-left relative overflow-hidden",
                                    config.allowedPantheons.includes(god.id)
                                      ? "bg-amber-500/10 border-amber-500/50"
                                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700",
                                    isFullyLocked && "cursor-not-allowed"
                                  )}
                                >
                                  <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-800 flex-shrink-0">
                                    <img 
                                      src={god.image} 
                                      alt={god.name} 
                                      className={cn("w-full h-full object-cover", isGodLocked && "grayscale")} 
                                      referrerPolicy="no-referrer" 
                                    />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className={cn(
                                      "text-xs font-bold truncate",
                                      config.allowedPantheons.includes(god.id) ? "text-amber-500" : "text-slate-300"
                                    )}>
                                      {god.name}
                                    </span>
                                  </div>
                                  {isFullyLocked && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 backdrop-blur-[0.5px]">
                                      <Lock className={cn("w-4 h-4", isGodLocked ? "text-amber-500" : "text-amber-500/50")} />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        <button
          onClick={createLobby}
          className="w-full py-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black mythic-text text-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-3 group active:scale-[0.98]"
        >
          {t.createBtn}
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  </div>
);
}

function Check({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
