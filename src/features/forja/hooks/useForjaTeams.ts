import { useState, useEffect } from 'react';
import { ForjaTeam } from '../types';
import { subscribeToForjaTeams } from '../services/forjaService';

export function useForjaTeams() {
  const [teams, setTeams]   = useState<ForjaTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) {
      setTimeout(() => { setTeams([]); setLoading(false); }, 400);
      return;
    }
    const unsub = subscribeToForjaTeams(
      data => { setTeams(data); setLoading(false); setError(null); },
      ()   => { setError('Erro ao carregar times.'); setLoading(false); }
    );
    return () => unsub();
  }, []);

  return { teams, loading, error };
}
