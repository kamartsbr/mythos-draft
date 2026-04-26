import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Save, X, Settings2, ListOrdered, Map as MapIcon, Sword } from 'lucide-react';
import { LobbyConfig, DraftTurn } from '../../types';
import { cn } from '../../lib/utils';

interface PresetBuilderProps {
  onSave: (name: string, config: LobbyConfig) => void;
  onClose: () => void;
  t: any;
}

export function PresetBuilder({ onSave, onClose, t }: PresetBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<LobbyConfig>({
    seriesType: 'BO3',
    mapBanCount: 2,
    banCount: 2,
    teamSize: 1,
    isExclusive: true,
    allowedPantheons: [],
    allowedMaps: [],
    mapTurnOrder: [],
    godTurnOrder: [],
    hasBans: true,
    isPrivate: false,
    pickType: 'alternated',
    firstMapRandom: true,
    acePick: false,
    acePickHidden: false,
    name: '',
    loserPicksNextMap: true,
    timerDuration: 60
  });

  const [customTurnOrder, setCustomTurnOrder] = useState<DraftTurn[]>([]);

  const addStep = (action: any, target: any, player: 'A' | 'B' | 'BOTH') => {
    setCustomTurnOrder([...customTurnOrder, { 
      action, 
      target, 
      player, 
      modifier: 'GLOBAL', 
      execution: 'NORMAL' 
    }]);
  };

  const removeStep = (idx: number) => {
    setCustomTurnOrder(customTurnOrder.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name) return;
    onSave(name, { 
      ...config, 
      godTurnOrder: customTurnOrder.filter(t => t.target === 'GOD'),
      mapTurnOrder: customTurnOrder.filter(t => t.target === 'MAP')
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{t.presetBuilder}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Basic Settings */}
            <div className="space-y-8">
              <section>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                  {t.presetName}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.lobbyNamePlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
                />
              </section>

              <div className="grid grid-cols-2 gap-6">
                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.seriesType}
                  </label>
                  <select
                    value={config.seriesType}
                    onChange={(e) => setConfig({ ...config, seriesType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="BO1">BO1</option>
                    <option value="BO3">BO3</option>
                    <option value="BO5">BO5</option>
                    <option value="BO7">BO7</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </section>

                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.timer}
                  </label>
                  <input
                    type="number"
                    value={config.timerDuration}
                    onChange={(e) => setConfig({ ...config, timerDuration: parseInt(e.target.value) || 60 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </section>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.mapBans}
                  </label>
                  <input
                    type="number"
                    value={config.mapBanCount}
                    onChange={(e) => setConfig({ ...config, mapBanCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </section>
                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.godBans}
                  </label>
                  <input
                    type="number"
                    value={config.banCount}
                    onChange={(e) => setConfig({ ...config, banCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </section>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.teamSize}
                  </label>
                  <select
                    value={config.teamSize}
                    onChange={(e) => setConfig({ ...config, teamSize: parseInt(e.target.value) as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={1}>1v1</option>
                    <option value={2}>2v2</option>
                    <option value={3}>3v3</option>
                  </select>
                </section>
                <section>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                    {t.pickType}
                  </label>
                  <select
                    value={config.pickType}
                    onChange={(e) => setConfig({ ...config, pickType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="alternated">{t.alternated}</option>
                    <option value="blind">{t.blind}</option>
                    <option value="snake">{t.snake}</option>
                  </select>
                </section>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={config.isExclusive}
                      onChange={(e) => setConfig({ ...config, isExclusive: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-colors",
                      config.isExclusive ? "bg-amber-500" : "bg-slate-800"
                    )} />
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                      config.isExclusive ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t.isExclusive}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={config.hasBans}
                      onChange={(e) => setConfig({ ...config, hasBans: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-colors",
                      config.hasBans ? "bg-amber-500" : "bg-slate-800"
                    )} />
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                      config.hasBans ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t.hasBans}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={config.loserPicksNextMap}
                      onChange={(e) => setConfig({ ...config, loserPicksNextMap: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-colors",
                      config.loserPicksNextMap ? "bg-amber-500" : "bg-slate-800"
                    )} />
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                      config.loserPicksNextMap ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t.loserPicksNextMap}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={config.firstMapRandom}
                      onChange={(e) => setConfig({ ...config, firstMapRandom: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-colors",
                      config.firstMapRandom ? "bg-amber-500" : "bg-slate-800"
                    )} />
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                      config.firstMapRandom ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t.firstMapRandom}</span>
                </label>
              </div>
            </div>

            {/* Turn Order Builder */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block">
                  {t.customTurnOrder}
                </label>
                <span className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest">
                  {customTurnOrder.length} {t.steps}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 min-h-[300px] flex flex-col gap-2 overflow-y-auto max-h-[400px] custom-scrollbar">
                {customTurnOrder.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                    <ListOrdered className="w-8 h-8 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">{t.noCustomSteps}</p>
                    <p className="text-[10px] text-center max-w-[200px] leading-relaxed">
                      {t.customStepsDesc}
                    </p>
                  </div>
                ) : (
                  customTurnOrder.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-3 rounded-xl group">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {idx + 1}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          {step.action === 'BAN' ? t.banned : t.picked} {step.target === 'MAP' ? t.mapPhase : t.godPickPhase}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter",
                          step.player === 'A' ? "text-blue-500" : step.player === 'B' ? "text-red-500" : "text-amber-500"
                        )}>
                          {step.player === 'A' ? t.roleHost : step.player === 'B' ? t.roleGuest : t.bothTeams}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeStep(idx)}
                        className="p-2 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => addStep('BAN', 'MAP', 'A')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapIcon className="w-3 h-3" /> {t.hostBanMap}
                </button>
                <button 
                  onClick={() => addStep('BAN', 'MAP', 'B')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapIcon className="w-3 h-3" /> {t.guestBanMap}
                </button>
                <button 
                  onClick={() => addStep('BAN', 'GOD', 'A')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Sword className="w-3 h-3" /> {t.hostBanGod}
                </button>
                <button 
                  onClick={() => addStep('BAN', 'GOD', 'B')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Sword className="w-3 h-3" /> {t.guestBanGod}
                </button>
                <button 
                  onClick={() => addStep('PICK', 'MAP', 'A')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapIcon className="w-3 h-3" /> {t.hostPickMap}
                </button>
                <button 
                  onClick={() => addStep('PICK', 'MAP', 'B')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <MapIcon className="w-3 h-3" /> {t.guestPickMap}
                </button>
                <button 
                  onClick={() => addStep('PICK', 'GOD', 'A')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Sword className="w-3 h-3" /> {t.hostPickGod}
                </button>
                <button 
                  onClick={() => addStep('PICK', 'GOD', 'B')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Sword className="w-3 h-3" /> {t.guestPickGod}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:text-white transition-all"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!name}
            className="px-12 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-amber-500/10"
          >
            {t.savePreset}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
