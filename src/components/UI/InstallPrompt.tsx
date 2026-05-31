import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      
      // Only show if the user hasn't explicitly dismissed it recently
      const dismissed = sessionStorage.getItem('mythos_pwa_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('mythos_pwa_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 md:hidden pointer-events-none">
      <div className="bg-slate-900 border border-amber-500/30 p-3 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto shadow-amber-500/10">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-slate-950" />
        </div>
        <div className="flex-1">
          <h4 className="text-white font-black text-xs uppercase tracking-widest leading-tight">Install App</h4>
          <p className="text-slate-400 text-[10px] leading-tight mt-1">Add Mythos Draft to your home screen</p>
        </div>
        <button
          onClick={handleInstallClick}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-colors shrink-0"
        >
          Install
        </button>
        <button 
          onClick={handleDismiss}
          className="p-1 text-slate-500 hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
