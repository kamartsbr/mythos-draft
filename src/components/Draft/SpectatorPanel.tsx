import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Eye, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpectatorPanelProps {
  spectators: { id: string; name: string }[];
  onClose: () => void;
  t: any;
}

export function SpectatorPanel({ spectators, onClose, t }: SpectatorPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-tight">{t.spectators}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {spectators.length} {t.watching}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
          {spectators.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 text-sm font-medium">{t.noSpectators}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {spectators.map((spec, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={spec.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4 group hover:border-blue-500/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                    <User className="w-5 h-5 text-slate-600 group-hover:text-blue-500" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{spec.name}</span>
                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">{spec.id.substring(0, 8)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 text-center leading-relaxed font-medium uppercase tracking-widest">
            {t.spectatorInfo}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
