import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { ChevronDown, Globe } from 'lucide-react';

interface LanguageToggleProps {
  lang: string;
  setLang: (lang: string) => void;
}

const LANGUAGES = [
  { id: 'pt', label: 'Português', flag: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg' },
  { id: 'en', label: 'English', flag: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Flag_of_the_United_States.svg' },
  { id: 'es', label: 'Español', flag: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Spain.svg' },
  { id: 'fr', label: 'Français', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/1280px-Flag_of_France.svg.png' },
  { id: 'de', label: 'Deutsch', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/1280px-Flag_of_Germany.svg.png' },
  { id: 'ru', label: 'Русский', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/1280px-Flag_of_Russia.svg.png' },
  { id: 'da', label: 'Dansk', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Flag_of_Denmark.svg/250px-Flag_of_Denmark.svg.png' },
  { id: 'it', label: 'Italiano', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Flag_of_Italy.svg/330px-Flag_of_Italy.svg.png' },
  { id: 'mx', label: 'Español (MX)', flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Flag_of_Mexico.svg/1920px-Flag_of_Mexico.svg.png' }
] as const;

export function LanguageToggle({ lang, setLang }: LanguageToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = LANGUAGES.find(l => l.id === lang) || LANGUAGES[1];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-white transition-all shadow-lg backdrop-blur-sm"
      >
        <div className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-black/20">
          <img 
            src={currentLang.flag} 
            alt={currentLang.label} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider">{currentLang.id}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-48 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              <div className="p-1.5 grid gap-1">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLang(l.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left",
                      lang === l.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <div className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-black/20">
                      <img 
                        src={l.flag} 
                        alt={l.label} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{l.label}</span>
                      <span className="text-[10px] opacity-50 uppercase">{l.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
