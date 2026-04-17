import { motion, AnimatePresence } from 'motion/react';
import { X, Scroll, Sparkles, Shield, Clock, Image as ImageIcon, Map as MapIcon, History } from 'lucide-react';

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
}

const getPatchNotes = (t: any) => [
  {
    version: 'v1.0.1',
    date: '2026-04-16',
    title: t.patchNotes_v1_0_1_title || 'Global Optimization Update',
    items: [
      {
        icon: <ImageIcon className="w-4 h-4 text-cyan-400" />,
        text: t.patch_v1_0_1_item1
      },
      {
        icon: <Shield className="w-4 h-4 text-emerald-400" />,
        text: t.patch_v1_0_1_item2
      },
      {
        icon: <Clock className="w-4 h-4 text-amber-400" />,
        text: t.patch_v1_0_1_item3
      },
      {
        icon: <Sparkles className="w-4 h-4 text-purple-400" />,
        text: t.patch_v1_0_1_item4
      },
      {
        icon: <MapIcon className="w-4 h-4 text-blue-400" />,
        text: t.patch_v1_0_1_item5
      },
      {
        icon: <Shield className="w-4 h-4 text-green-400" />,
        text: t.patch_v1_0_1_item6
      },
      {
        icon: <History className="w-4 h-4 text-indigo-400" />,
        text: t.patch_v1_0_1_item7
      },
      {
        icon: <ImageIcon className="w-4 h-4 text-rose-400" />,
        text: t.patch_v1_0_1_item8
      },
      {
        icon: <Scroll className="w-4 h-4 text-slate-400" />,
        text: t.patch_v1_0_1_item9
      }
    ]
  }
];

export function PatchNotesModal({ isOpen, onClose, t }: PatchNotesModalProps) {
  const patchNotes = getPatchNotes(t);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Scroll className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{t.patchNotesTitle}</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.latestUpdates}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
              {patchNotes.map((patch, idx) => (
                <div key={patch.version} className="relative">
                  {idx !== patchNotes.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-[-40px] w-px bg-slate-800" />
                  )}
                  
                  <div className="flex items-start gap-6">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                          {patch.version}
                          <span className="text-[10px] font-bold text-amber-500/50 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            {patch.title}
                          </span>
                        </h3>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {patch.date}
                        </span>
                      </div>
                      
                      <ul className="space-y-3">
                        {patch.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed group">
                            <div className="mt-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                              {item.icon}
                            </div>
                            <span className="group-hover:text-slate-200 transition-colors">
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                {t.patchNotesFooter}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
