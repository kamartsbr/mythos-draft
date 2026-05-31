import { motion } from 'motion/react';
import { X, Palette, Eye } from 'lucide-react';
import { useTheme, Theme, ColorblindMode } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';

interface SettingsModalProps {
  onClose: () => void;
  t: any;
}

export function SettingsModal({ onClose, t }: SettingsModalProps) {
  const { theme, setTheme, colorblind, setColorblind } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Palette className="w-4 h-4 text-amber-500" />
          </div>
          {t.settings || "Settings"}
        </h2>

        <div className="space-y-6">
          {/* Theme Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Palette className="w-3 h-3" />
              Pantheon Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['greek', 'norse', 'egyptian', 'atlantean', 'chinese', 'japanese', 'aztec'] as Theme[]).map((tOpt) => (
                <button
                  key={tOpt}
                  onClick={() => setTheme(tOpt)}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all",
                    theme === tOpt 
                      ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  )}
                >
                  {tOpt}
                </button>
              ))}
            </div>
          </div>

          {/* Colorblind Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Eye className="w-3 h-3" />
              Colorblind Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(['none', 'protanopia', 'tritanopia'] as ColorblindMode[]).map((cbOpt) => (
                <button
                  key={cbOpt}
                  onClick={() => setColorblind(cbOpt)}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all text-left flex items-center gap-3",
                    colorblind === cbOpt 
                      ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  )}
                >
                  <span className="flex-1">
                    {cbOpt === 'none' ? 'Standard (Red/Blue)' : 
                     cbOpt === 'protanopia' ? 'Protanopia (Orange/Blue)' : 
                     'Tritanopia (Crimson/Cyan)'}
                  </span>
                  {colorblind === cbOpt && (
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
