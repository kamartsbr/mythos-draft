import { motion } from 'motion/react';
import { Check, Map as MapIcon, Users, Trophy, Sword, Shield, Download } from 'lucide-react';
import { Lobby, GameResult } from '../../types';
import { MAPS, MAJOR_GODS } from '../../constants';
import { cn } from '../../lib/utils';
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { DraftResultCard } from './DraftResultCard';

interface SpectatorSummaryProps {
  lobby: Lobby;
  t: any;
  lang: string;
  onViewGame: (idx: number) => void;
}

export function SpectatorSummary({ lobby, t, lang, onViewGame }: SpectatorSummaryProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    
    // Wait for images to potentially load and layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const isFinished = lobby.status === 'finished';
      const width = isFinished ? 1200 : 800;
      const gameRows = Math.ceil(lobby.history.length / 3);
      const height = isFinished ? (500 + (gameRows * 350)) : 600;

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#020617',
        skipFonts: true,
        fontEmbedCSS: '',
        width,
        height,
        style: {
          opacity: '1',
          visibility: 'visible',
          transform: 'none'
        }
      });
      const link = document.createElement('a');
      link.download = `mythos-draft-${lobby.id.slice(0, 6)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const seriesLength = lobby.config.seriesType === 'CUSTOM' 
    ? (lobby.config.customGameCount || 1) 
    : parseInt(lobby.config.seriesType.replace('BO', '')) || 1;

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar bg-slate-950/50">
      {/* Header: Series Status */}
      <div className="max-w-6xl mx-auto w-full mb-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-slate-900/40 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-500/5 via-transparent to-red-500/5" />
          
          <div className="flex flex-col items-center md:items-start gap-2 flex-1">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">
              {lobby.config.teamSize === 1 ? t.roleHost : t.teamA}
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter truncate max-w-[250px] md:max-w-[350px]">
              {lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}
            </h2>
          </div>

          <div className="flex flex-col items-center gap-4 z-10">
            <div className="flex items-center gap-8">
              <div className="text-6xl md:text-8xl font-black text-blue-500 tabular-nums drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                {lobby.scoreA}
              </div>
              <div className="text-2xl md:text-4xl font-black text-slate-800 italic uppercase">VS</div>
              <div className="text-6xl md:text-8xl font-black text-red-500 tabular-nums drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                {lobby.scoreB}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="px-4 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full">
                <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span>{lobby.config.seriesType} {t.series}</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  <span className={cn(lobby.status === 'finished' ? "text-green-500" : "text-amber-500")}>
                    {lobby.status === 'finished' ? t.finished : t.inProgress}
                  </span>
                </span>
              </div>
              {lobby.status === 'finished' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                    {t.shareResultMsg}
                  </p>
                  <button
                    onClick={exportImage}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 font-black text-[10px] uppercase tracking-widest"
                  >
                    <Download className={cn("w-4 h-4", isExporting && "animate-bounce")} />
                    {isExporting ? t.exporting || '...' : t.exportCard}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
            <DraftResultCard lobby={lobby} t={t} cardRef={cardRef} />
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 flex-1">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">
              {lobby.config.teamSize === 1 ? t.roleGuest : t.teamB}
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter truncate max-w-[250px] md:max-w-[350px]">
              {lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}
            </h2>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: seriesLength }).map((_, idx) => {
          const game = lobby.history[idx];
          const isCurrent = idx === lobby.currentGame - 1 && lobby.status !== 'finished';
          const isFuture = idx >= lobby.currentGame && lobby.status !== 'finished';
          const map = game ? MAPS.find(m => m.id === game.mapId) : (isCurrent ? MAPS.find(m => m.id === lobby.selectedMap) : null);

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => game && onViewGame(idx)}
              className={cn(
                "group relative flex flex-col bg-slate-900/40 border-2 rounded-3xl overflow-hidden transition-all duration-500",
                game ? "border-slate-800 hover:border-amber-500/50 cursor-pointer" :
                isCurrent ? "border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)]" :
                "border-slate-900/50 opacity-40"
              )}
            >
              {/* Map Header */}
              <div className="relative aspect-[21/9] w-full overflow-hidden">
                {map ? (
                  <img 
                    src={map.image} 
                    alt={map.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                    <MapIcon className="w-8 h-8 text-slate-800" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">G{idx + 1}</span>
                  </div>
                  {isCurrent && (
                    <div className="px-2.5 py-1 bg-amber-500 rounded-lg flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-950 uppercase tracking-widest">LIVE</span>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-4 left-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {map ? (t.mapNames?.[map.id] || map.name) : t.tbd}
                  </h3>
                </div>

                {game && (
                  <div className="absolute top-4 right-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-md border-2",
                      game.winner === 'A' ? "bg-blue-500/20 border-blue-500 text-blue-500" : "bg-red-500/20 border-red-500 text-red-500"
                    )}>
                      <Trophy className="w-5 h-5" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>

              {/* Game Content */}
              <div className="p-6 flex flex-col gap-6">
                {/* Team A Picks */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sword className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {lobby.captain1Name || (lobby.config.teamSize === 1 ? t.roleHost : t.teamA)}
                      </span>
                    </div>
                    {game?.winner === 'A' && <Check className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(game ? (game.rosterA || []) : (isCurrent ? lobby.picks.filter(p => p.team === 'A') : [])).map((pickOrGodId, gIdx) => {
                      const godId = typeof pickOrGodId === 'string' ? pickOrGodId : pickOrGodId.godId;
                      const playerName = typeof pickOrGodId === 'string' ? null : pickOrGodId.playerName;
                      const god = MAJOR_GODS.find(g => g.id === godId);
                      return (
                        <div key={gIdx} className="flex flex-col gap-1">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group/god">
                            {god ? (
                              <>
                                <img src={god.image} alt={god.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-blue-500/10" />
                                <div className="absolute inset-0 opacity-0 group-hover/god:opacity-100 bg-slate-950/80 transition-opacity flex items-center justify-center p-1">
                                  <span className="text-[6px] font-black text-white text-center uppercase leading-tight">{god.name}</span>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full border border-slate-800 border-t-blue-500 animate-spin" />
                              </div>
                            )}
                          </div>
                          {playerName && (
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[48px] text-center">
                              {playerName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {(!game && !isCurrent) && Array.from({ length: lobby.config.teamSize }).map((_, i) => (
                      <div key={i} className="w-12 h-12 rounded-xl border border-dashed border-slate-800 bg-slate-950/20" />
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-800/50 w-full" />

                {/* Team B Picks */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {lobby.captain2Name || (lobby.config.teamSize === 1 ? t.roleGuest : t.teamB)}
                      </span>
                    </div>
                    {game?.winner === 'B' && <Check className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(game ? (game.rosterB || []) : (isCurrent ? lobby.picks.filter(p => p.team === 'B') : [])).map((pickOrGodId, gIdx) => {
                      const godId = typeof pickOrGodId === 'string' ? pickOrGodId : pickOrGodId.godId;
                      const playerName = typeof pickOrGodId === 'string' ? null : pickOrGodId.playerName;
                      const god = MAJOR_GODS.find(g => g.id === godId);
                      return (
                        <div key={gIdx} className="flex flex-col gap-1">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group/god">
                            {god ? (
                              <>
                                <img src={god.image} alt={god.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-red-500/10" />
                                <div className="absolute inset-0 opacity-0 group-hover/god:opacity-100 bg-slate-950/80 transition-opacity flex items-center justify-center p-1">
                                  <span className="text-[6px] font-black text-white text-center uppercase leading-tight">{god.name}</span>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full border border-slate-800 border-t-red-500 animate-spin" />
                              </div>
                            )}
                          </div>
                          {playerName && (
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[48px] text-center">
                              {playerName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {(!game && !isCurrent) && Array.from({ length: lobby.config.teamSize }).map((_, i) => (
                      <div key={i} className="w-12 h-12 rounded-xl border border-dashed border-slate-800 bg-slate-950/20" />
                    ))}
                  </div>
                </div>
              </div>

              {game && (
                <div className="mt-auto p-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-center">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] group-hover:scale-110 transition-transform">
                    {t.viewDraftHistory || 'VIEW DRAFT HISTORY'}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
