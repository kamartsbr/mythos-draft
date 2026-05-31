import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Trophy, Map as MapIcon, RotateCcw, Download, Home } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby } from '../../types';
import { MAJOR_GODS, MAPS } from '../../constants';
import { MapVisualizer } from '../MapVisualizer';
import { DraftResultCard } from './DraftResultCard';
import { toPng } from 'html-to-image';

interface EndScreenProps {
  lobby: Lobby;
  t: any;
  onHome: () => void;
  onShowReplay?: () => void;
}

export function EndScreen({ lobby, t, onHome, onShowReplay }: EndScreenProps) {
  const [selectedGameIndex, setSelectedGameIndex] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const isTie = lobby.scoreA === lobby.scoreB;
  const isFinished = lobby.status === 'finished';
  const winner = lobby.scoreA > lobby.scoreB ? 'A' : 'B';
  const winnerName = isTie ? t.draw : (winner === 'A' ? ((lobby.teamAName || lobby.captain1Name) || t.teamA) : ((lobby.teamBName || lobby.captain2Name) || t.teamB));

  const exportImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    
    // Wait for images to potentially load and layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
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
      link.download = `mythos-draft-final-${lobby.id.slice(0, 6)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-6 overflow-y-auto custom-scrollbar relative pb-16">
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
        <DraftResultCard lobby={lobby} t={t} cardRef={cardRef} />
      </div>
      
      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
        <img 
          src="https://static.wikia.nocookie.net/ageofempires/images/d/d3/AoMR_OM_cover_portrait.jpg/revision/latest" 
          alt="" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl space-y-6"
      >
        {/* Compact Result Summary Card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-4 md:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0",
              isTie ? "bg-slate-700 shadow-slate-900/20" : "bg-amber-500 shadow-amber-500/20"
            )}>
              {isTie ? <MapIcon className="w-6 h-6 text-slate-400" /> : <Trophy className="w-6 h-6 text-slate-950" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-black text-white uppercase italic truncate">
                {winnerName} {!isTie && t.victory}
              </h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] leading-none mt-1">
                {t.seriesConcluded}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/60 px-4 py-2 rounded-2xl border border-slate-800 shrink-0 select-none">
            <span className="text-xs font-black text-slate-400 truncate max-w-[100px]">
              {(lobby.teamAName || lobby.captain1Name) || t.teamA}
            </span>
            <span className="text-2xl font-black text-white italic">{lobby.scoreA}</span>
            <span className="text-[10px] font-black text-slate-600">VS</span>
            <span className="text-2xl font-black text-white italic">{lobby.scoreB}</span>
            <span className="text-xs font-black text-slate-400 truncate max-w-[100px]">
              {(lobby.teamBName || lobby.captain2Name) || t.teamB}
            </span>
          </div>
        </div>

        {/* Dashboard Grid Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Main Column: Strategy Board */}
          <div className="lg:col-span-8 flex flex-col items-center gap-4 bg-slate-900/30 border border-slate-800 p-6 rounded-3xl shadow-xl relative">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] self-start select-none">
              {selectedGameIndex !== null ? `${t.game} ${selectedGameIndex + 1} ${t.history}` : "Strategy Board"}
            </h3>
            
            <div className="w-full max-w-[480px] mx-auto bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-xl relative group">
              <MapVisualizer 
                lobby={lobby} 
                isVisible={() => true} 
                game={selectedGameIndex !== null ? lobby.history[selectedGameIndex] : undefined}
                t={t}
              />
              {selectedGameIndex !== null && (
                <button 
                  onClick={() => setSelectedGameIndex(null)}
                  className="absolute top-6 right-6 p-2 bg-slate-950/80 rounded-full border border-slate-800 text-slate-400 hover:text-white transition-colors z-20 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedGameIndex === null && (
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest animate-pulse mt-2 select-none">
                Click on a game card to view tactical map
              </p>
            )}
          </div>

          {/* Right / Side Column: Map History Cards & Action Buttons */}
          <div className="lg:col-span-4 space-y-6">
            {/* Map/Game Cards Stack */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {lobby.history.map((game, idx) => {
                const map = MAPS.find(m => m.id === game.mapId);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => setSelectedGameIndex(idx)}
                    className={cn(
                      "bg-slate-900/50 border rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all group/card",
                      selectedGameIndex === idx ? "border-amber-500 ring-1 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]" : "border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="relative h-20">
                      <img 
                        src={map?.image} 
                        alt={map?.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                      <div className="absolute bottom-2 left-3">
                        <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">{t.game} {idx + 1}</div>
                        <div className="text-xs font-bold text-white uppercase tracking-tight leading-none">{t.mapNames?.[game.mapId] || map?.name}</div>
                      </div>
                      <div className={cn(
                        "absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none",
                        game.winner === 'A' ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {game.winner === 'A' ? ((lobby.teamAName || lobby.captain1Name) || t.teamA) : ((lobby.teamBName || lobby.captain2Name) || t.teamB)} {t.win}
                      </div>
                    </div>
                    
                    <div className="p-3 flex items-center justify-between gap-4 select-none">
                      <div className="flex -space-x-1.5">
                        {game.picksA.map((godId, gIdx) => (
                          <div 
                            key={gIdx} 
                            className="w-8 h-8 rounded border overflow-hidden bg-slate-950"
                            style={{ borderColor: game.colorsA?.[gIdx] || '#3b82f6' }}
                          >
                            <img src={MAJOR_GODS.find(g => g.id === godId)?.image} alt="God" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                      <div className="text-[9px] font-black text-slate-700 italic uppercase">VS</div>
                      <div className="flex -space-x-1.5 flex-row-reverse">
                        {game.picksB.map((godId, gIdx) => (
                          <div 
                            key={gIdx} 
                            className="w-8 h-8 rounded border overflow-hidden bg-slate-950"
                            style={{ borderColor: game.colorsB?.[gIdx] || '#ef4444' }}
                          >
                            <img src={MAJOR_GODS.find(g => g.id === godId)?.image} alt="God" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Compact Action Buttons Capsule */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-xl">
              <button
                onClick={exportImage}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase tracking-widest text-[10px] transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] disabled:opacity-50 cursor-pointer"
              >
                <Download className={cn("w-3.5 h-3.5", isExporting && "animate-pulse")} />
                {isExporting ? (t.exporting || 'EXPORTING...') : t.exportCard}
              </button>

              <div className="grid grid-cols-2 gap-3">
                {onShowReplay && (
                  <button
                    onClick={onShowReplay}
                    className="flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl uppercase tracking-wider text-[9px] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t.draftReplay}
                  </button>
                )}
                <button
                  onClick={onHome}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl uppercase tracking-wider text-[9px] transition-all cursor-pointer",
                    !onShowReplay && "col-span-2"
                  )}
                >
                  <Home className="w-3 h-3" />
                  {t.backToHome}
                </button>
              </div>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
