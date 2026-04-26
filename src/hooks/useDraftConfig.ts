import { useState, useEffect, useCallback } from 'react';
import { LobbyConfig, SeriesType, TeamSize } from '../types';
import { MAPS, MAJOR_GODS, RANKED_MAP_POOL, CASCA_GROSSA_POOL, CASCA_GROSSA_GROUP_POOL, CASCA_GROSSA_PLAYOFF_POOL, MCL_ROUND_MAPS, MCL_MAP_POOL, getMCLMapPool } from '../constants';

export function useDraftConfig() {
  const [lobbyName, setLobbyName] = useState('');
  const [savedPresets, setSavedPresets] = useState<LobbyConfig[]>(() => {
    const saved = localStorage.getItem('mythos_presets');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((preset: LobbyConfig) => ({
        ...preset,
        allowedMaps: Array.isArray(preset.allowedMaps) 
          ? preset.allowedMaps.filter(id => MAPS.some(m => m.id === id))
          : MAPS.filter(m => m.isRanked).map(m => m.id),
        allowedPantheons: Array.isArray(preset.allowedPantheons)
          ? preset.allowedPantheons.filter(id => {
              const god = MAJOR_GODS.find(g => g.id === id);
              if (!god) return false;
              if (god.culture === 'Aztec') {
                return preset.preset === 'MCL' && (preset.mclRound || 1) >= 5;
              }
              return true;
            })
          : MAJOR_GODS.filter(g => {
              if (g.culture === 'Aztec') {
                return preset.preset === 'MCL' && (preset.mclRound || 1) >= 5;
              }
              return true;
            }).map(g => g.id)
      }));
    } catch (e) {
      console.error("Failed to parse presets", e);
      return [];
    }
  });

  const [config, setConfig] = useState<LobbyConfig>(() => {
    const last = localStorage.getItem('mythos_last_config');
    if (last) {
      try {
        const parsed = JSON.parse(last);
        if (parsed.preset === 'MCL') {
          parsed.mapTurnOrder = [];
        }
        return {
          ...parsed,
          allowedMaps: Array.isArray(parsed.allowedMaps) 
            ? parsed.allowedMaps.filter((id: string) => MAPS.some(m => m.id === id))
            : MAPS.filter(m => m.isRanked).map(m => m.id),
          allowedPantheons: Array.isArray(parsed.allowedPantheons)
            ? parsed.allowedPantheons.filter((id: string) => {
                const god = MAJOR_GODS.find(g => g.id === id);
                if (!god) return false;
                if (god.culture === 'Aztec') {
                  return parsed.preset === 'MCL' && (parsed.mclRound || 1) >= 5;
                }
                return true;
              })
            : MAJOR_GODS.filter(g => {
                if (g.culture === 'Aztec') {
                  return parsed.preset === 'MCL' && (parsed.mclRound || 1) >= 5;
                }
                return true;
              }).map(g => g.id)
        };
      } catch (e) {
        console.error("Failed to parse last config", e);
      }
    }
    return {
      teamSize: 1,
      hasBans: false,
      banCount: 0,
      isExclusive: true,
      isPrivate: false,
      allowedPantheons: MAJOR_GODS.map(g => g.id),
      allowedMaps: MAPS.filter(m => m.isRanked).map(m => m.id),
      pickType: 'alternated',
      seriesType: 'BO3',
      mapBanCount: 0,
      firstMapRandom: true,
      acePick: false,
      acePickHidden: true,
      mapTurnOrder: [],
      godTurnOrder: [],
      name: '',
      loserPicksNextMap: false,
      preset: 'CUSTOM',
      mclRound: 1,
      timerDuration: 60,
    };
  });

  useEffect(() => {
    localStorage.setItem('mythos_last_config', JSON.stringify(config));
  }, [config]);

  const applyPreset = useCallback((preset: string) => {
    setConfig(prev => {
      let newConfig = { ...prev, preset };
      
      if (preset === 'CUSTOM') {
        // Keeps current config but marks as custom
      } else if (preset.startsWith('custom_')) {
        // Handled by applyCustomPreset in UI, but here we just ensure preset ID is set
        newConfig.preset = preset;
      } else if (preset === 'RANKED') {
        newConfig.allowedMaps = RANKED_MAP_POOL;
        newConfig.allowedPantheons = MAJOR_GODS.map(g => g.id);
        newConfig.mapTurnOrder = [];
        newConfig.godTurnOrder = [];
      } else if (preset === 'MCL') {
        newConfig.mclRound = prev.mclRound || 1;
        newConfig.allowedMaps = getMCLMapPool(newConfig.mclRound);
        newConfig.allowedPantheons = MAJOR_GODS.filter(g => {
          if (g.culture === 'Aztec') {
            return newConfig.mclRound >= 5;
          }
          return true;
        }).map(g => g.id);
        newConfig.teamSize = 3;
        newConfig.seriesType = 'CUSTOM';
        newConfig.customGameCount = 3;
        newConfig.mapBanCount = 0;
        newConfig.banCount = 0;
        newConfig.acePick = false;
        newConfig.isExclusive = false;
        newConfig.pickType = 'alternated';
        newConfig.firstMapRandom = false;
        newConfig.loserPicksNextMap = false;
        newConfig.tournamentStage = 'GROUP';
        newConfig.timerDuration = 60;
        newConfig.mapTurnOrder = [];
        const roundMap = MCL_ROUND_MAPS[newConfig.mclRound];
        if (roundMap && !newConfig.allowedMaps.includes(roundMap)) {
          newConfig.allowedMaps = [...newConfig.allowedMaps, roundMap];
        }
      }
      
      return newConfig;
    });
  }, []);

  const isLocked = useCallback((field: string) => {
    // Manual selection fields
    const manualFields = ['allowedMaps', 'allowedPantheons'];
    if (manualFields.includes(field)) {
      if (config.preset === 'MCL') return true;
      if (config.preset === 'CASCA') return true;
      return false;
    }

    if (config.preset?.startsWith('custom_')) {
      return true;
    }

    if (config.preset === 'MCL') {
      const lockedFields = ['seriesType', 'customGameCount', 'mapBanCount', 'banCount', 'isExclusive', 'pickType', 'teamSize', 'mapTurnOrder', 'firstMapRandom', 'loserPicksNextMap', 'acePick', 'tournamentStage'];
      return lockedFields.includes(field);
    }
    if (config.preset === 'CASCA') {
      const lockedFields = [
        'teamSize', 'mapBanCount', 'banCount', 'isExclusive', 
        'pickType', 'acePick', 'allowedMaps', 'allowedPantheons', 'loserPicksNextMap', 'firstMapRandom'
      ];
      if (config.tournamentStage === 'GROUP') {
        lockedFields.push('seriesType');
      }
      return lockedFields.includes(field);
    }
    if (config.preset === 'RANKED') {
      return false; // Only manual selection is locked by the first check
    }
    return false;
  }, [config.preset, config.tournamentStage]);

  const savePreset = useCallback(() => {
    const newPreset = { ...config, name: lobbyName || `Preset ${savedPresets.length + 1}` };
    const newPresets = [...savedPresets, newPreset];
    setSavedPresets(newPresets);
    localStorage.setItem('mythos_presets', JSON.stringify(newPresets));
  }, [config, lobbyName, savedPresets]);

  return {
    config,
    setConfig,
    lobbyName,
    setLobbyName,
    savedPresets,
    applyPreset,
    isLocked,
    savePreset
  };
}
