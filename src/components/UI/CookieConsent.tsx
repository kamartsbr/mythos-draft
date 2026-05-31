import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface Props {
  t?: any; // Making it optional just in case it renders outside context momentarily
}

export function CookieConsent({ t }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const l = t?.legal;

  useEffect(() => {
    // Only show if the user hasn't consented yet
    const consent = localStorage.getItem('mythos_cookie_consent');
    if (!consent) {
      // Slight delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('mythos_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible || !l) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-6 pointer-events-auto">
        <div className="flex items-start md:items-center gap-4 flex-1">
          <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <ShieldAlert className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-widest">{l.consentTitle}</h4>
            <p className="text-slate-400 text-xs leading-relaxed">{l.consentDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <a 
            href="/cookies"
            className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors text-center"
          >
            {l.consentLearnMore}
          </a>
          <button
            onClick={handleAccept}
            className="flex-1 md:flex-none px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-widest transition-colors"
          >
            {l.consentAccept}
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
