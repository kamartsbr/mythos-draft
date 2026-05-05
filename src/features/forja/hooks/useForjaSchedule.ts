import { useState, useEffect } from 'react';
import { ForjaScheduleEntry } from '../types';
import { subscribeToForjaSchedule } from '../services/forjaService';

export function useForjaSchedule() {
  const [entries, setEntries] = useState<ForjaScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) {
      setTimeout(() => { setEntries([]); setLoading(false); }, 400);
      return;
    }
    const unsub = subscribeToForjaSchedule(
      data => { setEntries(data); setLoading(false); setError(null); },
      ()   => { setError('Erro ao carregar schedule.'); setLoading(false); }
    );
    return () => unsub();
  }, []);

  return { entries, loading, error };
}
