import { useState, useEffect } from 'react';
import { ForjaScheduleEntry } from '../types';
import { getForjaScheduleOnce, cachedSchedule } from '../services/forjaService';

export function useForjaSchedule() {
  const [entries, setEntries] = useState<ForjaScheduleEntry[]>(cachedSchedule || []);
  const [loading, setLoading] = useState(!cachedSchedule);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) {
      setTimeout(() => { setEntries([]); setLoading(false); }, 400);
      return;
    }
    
    if (cachedSchedule) return;

    let isMounted = true;
    getForjaScheduleOnce().then(data => {
      if (isMounted) {
        setEntries(data);
        setLoading(false);
      }
    }).catch(err => {
      if (isMounted) {
        setError('Erro ao carregar schedule.');
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  return { entries, loading, error };
}
