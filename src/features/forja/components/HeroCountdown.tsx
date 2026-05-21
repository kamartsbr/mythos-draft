import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Trophy, ExternalLink, Play } from 'lucide-react';
import { useForjaTeams } from '../hooks/useForjaTeams';

export function HeroCountdown() {
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);
  const { teams } = useForjaTeams(false); // Fetch once
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextMatch = async () => {
      // 🚨 CACHE DE SESSÃO: Evita leituras repetidas ao navegar entre abas
      const CACHE_KEY = 'forja_next_match_cache';
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
      
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { match, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          // Restore Timestamp objects from cached plain objects
          if (match?.config?.scheduledDate && typeof match.config.scheduledDate === 'object' && 'seconds' in match.config.scheduledDate) {
            match.config.scheduledDate = new Timestamp(match.config.scheduledDate.seconds, match.config.scheduledDate.nanoseconds || 0);
          }
          setNextMatch(match);
          setLoading(false);
          return;
        }
      }

      try {
        const now = Timestamp.fromMillis(Date.now());
        const q = query(
          collection(db, 'lobbies'),
          where('config.preset', '==', 'FORJA'),
          where('status', '==', 'waiting'),
          where('config.scheduledDate', '>=', now),
          orderBy('config.scheduledDate', 'asc'),
          limit(3)
        );

        const snap = await getDocs(q);
        const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Find the first match (already filtered by query)
        const futureMatch = matches[0] || null;

        if (futureMatch) {
          setNextMatch(futureMatch);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ 
            match: futureMatch, 
            timestamp: Date.now() 
          }));
        }
      } catch (err) {
        console.error("Error fetching next match:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNextMatch();
  }, []);

  useEffect(() => {
    if (!nextMatch) return;

    const timer = setInterval(() => {
      const target = nextMatch.config.scheduledDate;
      const targetMs = target instanceof Timestamp ? target.toMillis() : new Date(target).getTime();
      const now = new Date().getTime();
      const diff = targetMs - now;

      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextMatch]);

  if (loading || !nextMatch || !timeLeft) return null;

  const teamA = teams.find(t => t.id === nextMatch.config.forjaTeamA);
  const teamB = teams.find(t => t.id === nextMatch.config.forjaTeamB);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full max-w-4xl mx-auto mb-12"
    >
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[2.5rem] p-8 md:p-12 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full" />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Left: Match Info */}
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
              <Trophy className="w-3 h-3" />
              Próximo Jogo Oficial
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-tight">
              {nextMatch.config.name}
            </h2>
            <div className="flex items-center justify-center md:justify-start gap-4 text-slate-500 font-bold uppercase tracking-widest text-xs">
              <span>{nextMatch.config.scheduledTime} BRT</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>{nextMatch.config.seriesType} Series</span>
            </div>
          </div>

          {/* Center: Countdown */}
          <div className="flex items-center gap-4">
            {[
              { label: 'D', value: timeLeft.d },
              { label: 'H', value: timeLeft.h },
              { label: 'M', value: timeLeft.m },
              { label: 'S', value: timeLeft.s }
            ].map((unit, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black text-white shadow-inner">
                  {unit.value.toString().padStart(2, '0')}
                </div>
                <span className="mt-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">{unit.label}</span>
              </div>
            ))}
          </div>

          {/* Right: Teams & Call to Action */}
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex items-center gap-4">
               {teamA?.image_url && <img src={teamA.image_url} className="w-12 h-12 rounded-xl border border-slate-800 shadow-lg" alt="" />}
               <span className="text-xl font-black text-white italic uppercase tracking-tighter">VS</span>
               {teamB?.image_url && <img src={teamB.image_url} className="w-12 h-12 rounded-xl border border-slate-800 shadow-lg" alt="" />}
            </div>
            <a 
              href={`/lobby/${nextMatch.id}`}
              className="group flex items-center gap-3 px-8 py-4 bg-white hover:bg-amber-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:shadow-amber-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Acompanhar
              <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
