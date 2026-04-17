import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Trophy, Map as MapIcon, ChevronRight, Home, Sword, Shield, Users, RotateCcw, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Lobby, GameResult } from '../../types';
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
  const winnerName = isTie ? t.draw : (winner === 'A' ? (lobby.captain1Name || t.teamA) : (lobby.captain2Name || t.teamB));

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
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto custom-scrollbar relative pb-24">
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl space-y-12"
      >

        {/* Victory Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-2xl",
              isTie ? "bg-slate-700 shadow-slate-900/20" : "bg-amber-500 shadow-amber-500/20"
            )}
          >
            {isTie ? <MapIcon className="w-12 h-12 text-slate-400" /> : <Trophy className="w-12 h-12 text-slate-950" />}
          </motion.div>
          <div>
            <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter italic">
              {winnerName} {!isTie && t.victory}
            </h1>
            <p className="text-amber-500 font-bold uppercase tracking-[0.3em] text-sm">
              {t.seriesConcluded}
            </p>
          </div>
        </div>

        {/* Final Score */}
        <div className="flex items-center justify-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="text-sm font-black text-blue-500 uppercase tracking-widest mb-2">{lobby.captain1Name || t.teamA}</div>
            <div className="text-7xl md:text-9xl font-black text-white italic tracking-tighter">{lobby.scoreA}</div>
          </div>
          <div className="text-4xl md:text-6xl font-black text-slate-800 italic">VS</div>
          <div className="text-center">
            <div className="text-sm font-black text-red-500 uppercase tracking-widest mb-2">{lobby.captain2Name || t.teamB}</div>
            <div className="text-7xl md:text-9xl font-black text-white italic tracking-tighter">{lobby.scoreB}</div>
          </div>
        </div>

        {/* Map Visualization for Strategy Discussion */}
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">
            {selectedGameIndex !== null ? `${t.game} ${selectedGameIndex + 1} ${t.history}` : "Strategy Board"}
          </h3>
          <div className="w-full max-w-md bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-2xl relative group">
            <MapVisualizer 
              lobby={lobby} 
              isVisible={() => true} 
              game={selectedGameIndex !== null ? lobby.history[selectedGameIndex] : undefined}
              t={t}
            />
            {selectedGameIndex !== null && (
              <div className="absolute inset-x-0 -bottom-24 flex justify-between gap-4 px-2">
                <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow-xl">
                  <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-2">
                    <Shield className="w-3 h-3" /> {lobby.captain1Name || t.teamA}
                  </div>
                  {lobby.history[selectedGameIndex].rosterA?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">{p.playerName || `Player ${i+1}`}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase">{t[p.position] || p.position}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow-xl">
                  <div className="text-[9px] font-black text-red-500 uppercase tracking-widest border-b border-slate-800 pb-1 flex items-center gap-2 justify-end">
                    {lobby.captain2Name || t.teamB} <Sword className="w-3 h-3" />
                  </div>
                  {lobby.history[selectedGameIndex].rosterB?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 flex-row-reverse">
                      <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">{p.playerName || `Player ${i+1}`}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase">{t[p.position] || p.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedGameIndex !== null && (
              <button 
                onClick={() => setSelectedGameIndex(null)}
                className="absolute top-6 right-6 p-2 bg-slate-950/80 rounded-full border border-slate-800 text-slate-400 hover:text-white transition-colors z-20"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
          {selectedGameIndex === null && (
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest animate-pulse">
              Click on a game below to view tactical map
            </p>
          )}
        </div>

        {/* Match History Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lobby.history.map((game, idx) => {
            const map = MAPS.find(m => m.id === game.mapId);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setSelectedGameIndex(idx)}
                className={cn(
                  "bg-slate-900/50 border rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all group/card",
                  selectedGameIndex === idx ? "border-amber-500 ring-1 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-slate-800 hover:border-slate-600"
                )}
              >
                <div className="relative h-32">
                  <img 
                    src={map?.image} 
                    alt={map?.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                  <div className="absolute bottom-2 left-3">
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t.game} {idx + 1}</div>
                    <div className="text-sm font-bold text-white uppercase tracking-tight">{t.mapNames?.[game.mapId] || map?.name}</div>
                  </div>
                  <div className={cn(
                    "absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                    game.winner === 'A' ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                  )}>
                    {game.winner === 'A' ? (lobby.captain1Name || t.teamA) : (lobby.captain2Name || t.teamB)} {t.win}
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex -space-x-2">
                    {game.picksA.map((godId, gIdx) => (
                      <div 
                        key={gIdx} 
                        className="w-10 h-10 rounded-lg border-2 overflow-hidden bg-slate-950"
                        style={{ borderColor: game.colorsA?.[gIdx] || '#3b82f6' }}
                      >
                        <img src={MAJOR_GODS.find(g => g.id === godId)?.image} alt="God" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-black text-slate-700 italic uppercase">VS</div>
                  <div className="flex -space-x-2 flex-row-reverse">
                    {game.picksB.map((godId, gIdx) => (
                      <div 
                        key={gIdx} 
                        className="w-10 h-10 rounded-lg border-2 overflow-hidden bg-slate-950"
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

        {/* Actions */}
        <div className="flex flex-col items-center justify-center gap-8 pt-12 border-t border-slate-900/50">
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] animate-pulse">
              {t.shareResultMsg}
            </p>
            <button
              onClick={exportImage}
              disabled={isExporting}
              className="flex items-center gap-4 px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase tracking-[0.2em] transition-all group shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_50px_rgba(37,99,235,0.5)] disabled:opacity-50 scale-110"
            >
              <Download className={cn("w-6 h-6", isExporting && "animate-pulse")} />
              {isExporting ? t.exporting || 'EXPORTING...' : t.exportCard}
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {onShowReplay && (
              <button
                onClick={onShowReplay}
                className="flex items-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl uppercase tracking-widest transition-all group shadow-lg shadow-amber-500/20"
              >
                <RotateCcw className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" />
                {t.draftReplay}
              </button>
            )}
            <button
              onClick={onHome}
              className="flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all group"
            >
              <Home className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              {t.backToHome}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
