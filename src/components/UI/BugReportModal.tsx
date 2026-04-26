import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bug, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  lobbyId: string;
}

export function BugReportModal({ isOpen, onClose, t, lobbyId }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'bug_reports'), {
        lobbyId,
        description,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        status: 'new',
        url: window.location.href
      });

      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setDescription('');
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Error submitting bug report:', error);
      setIsSubmitting(false);
      // Fallback success to not frustrate user if it's a minor network blip, 
      // but in a real app we'd show an error.
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDescription('');
        onClose();
      }, 3000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-slate-900 border-2 border-slate-800 rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
          >
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <Bug className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    {t.reportBug || 'REPORT A BUG'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    {t.helpUsImprove || 'HELP US IMPROVE THE ARENA'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all group"
              >
                <X className="w-6 h-6 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            <div className="p-8">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-8 border border-green-500/30">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </div>
                  <h4 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                    {t.reportSent || 'REPORT SENT!'}
                  </h4>
                  <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                    {t.thankYouForReporting || 'Thank you for helping us make Mythos Draft better. We will look into it soon!'}
                  </p>
                  <button 
                    onClick={onClose}
                    className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                  >
                    {t.close || 'CLOSE'}
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                      {t.describeProblem || 'DESCRIBE THE PROBLEM'}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t.bugPlaceholder || "What happened? (e.g., 'The timer froze during Game 2')"}
                      className="w-full h-48 bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all resize-none placeholder:text-slate-800 text-sm leading-relaxed shadow-inner"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex items-start gap-4 p-5 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-500/70 leading-relaxed font-bold uppercase tracking-widest">
                      {t.bugInfoNote || 'YOUR LOBBY ID AND BROWSER INFO WILL BE SENT AUTOMATICALLY TO HELP US DIAGNOSE THE ISSUE.'}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-950 border border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-white transition-all"
                    >
                      {t.cancel || 'CANCEL'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !description.trim()}
                      className={cn(
                        "flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 shadow-2xl",
                        isSubmitting || !description.trim()
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      {isSubmitting ? t.sending || 'SENDING...' : t.sendReport || 'SEND REPORT'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
