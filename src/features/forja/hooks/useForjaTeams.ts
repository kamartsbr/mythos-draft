import { useState, useEffect } from 'react';
import { ForjaTeam } from '../types';
import { subscribeToForjaTeams, getForjaTeamsOnce, cachedTeams } from '../services/forjaService';

export function useForjaTeams(isLive = false) {
  const [teams, setTeams]     = useState<ForjaTeam[]>(!isLive && cachedTeams ? cachedTeams : []);
  const [loading, setLoading] = useState(!(!isLive && cachedTeams));
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const IS_DEV = import.meta.env.VITE_VIBE_MODE === 'DEVELOPMENT';
    if (IS_DEV) {
      setTimeout(() => { setTeams([]); setLoading(false); }, 400);
      return;
    }

    if (isLive) {
      const unsub = subscribeToForjaTeams(
        data => { setTeams(data); setLoading(false); setError(null); },
        ()   => { setError('Erro ao carregar times.'); setLoading(false); }
      );
      return () => unsub();
    } else {
      if (cachedTeams) return;
      let isMounted = true;
      getForjaTeamsOnce().then(data => {
        if (isMounted) {
          setTeams(data);
          setLoading(false);
          setError(null);
        }
      }).catch(err => {
        if (isMounted) {
          setError('Erro ao carregar times.');
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [isLive]);

  return { teams, loading, error };
}
