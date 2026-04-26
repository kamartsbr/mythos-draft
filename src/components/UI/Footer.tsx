import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Coffee, ExternalLink, Copy, Check } from 'lucide-react';

interface FooterProps {
  t: any;
  lang: string;
}

export const Footer: React.FC<FooterProps> = ({ t, lang }) => {
  const [copied, setCopied] = useState(false);
  const pixKey = "41345391889";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="mt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mb-12" />
        
        <div className="grid lg:grid-cols-2 gap-8 items-center bg-slate-900/40 backdrop-blur-sm border border-amber-500/10 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/5 blur-[80px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-700" />
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Heart className="w-5 h-5 fill-amber-500/20" />
              </div>
              <h3 className="text-xl font-bold tracking-tight uppercase">{t.supportProject}</h3>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base max-w-sm">
              {t.supportDesc}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end items-center">
            {lang === 'pt' && (
              <div className="flex items-center gap-3 bg-slate-950/40 p-2 pr-5 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-colors">
                <button 
                  onClick={handleCopyPix}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-amber-500 rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                      >
                        <Check className="w-4 h-4 text-green-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                      >
                        <Copy className="w-4 h-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] text-amber-500/60 uppercase font-black tracking-wider leading-none mb-1">{t.pixKeyLabel}</span>
                  <span className="text-xs font-mono text-slate-300 select-all tracking-tighter">{pixKey}</span>
                </div>
              </div>
            )}

            <motion.a
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=joaocarfan@hotmail.com&currency_code=USD"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black rounded-xl shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 transition-all uppercase tracking-wider text-xs whitespace-nowrap"
            >
              <Coffee className="w-4 h-4" />
              {t.donateBtn}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </motion.a>
          </div>
        </div>

        <div className="mt-12 text-center space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] opacity-50">
            Mythos Draft &copy; {new Date().getFullYear()} • Age of Mythology: Retold Fan Project
          </p>
          <div className="flex justify-center gap-6 opacity-30 hover:opacity-100 transition-opacity duration-500">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
          </div>
        </div>
      </div>
    </footer>
  );
};
