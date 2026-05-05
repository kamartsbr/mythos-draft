import { useState, useEffect } from 'react';
import { ForjaDraftSession } from '../types';
import { subscribeToForjaDraftSession } from '../services/forjaService';

export function useForjaDraftSession() {
  const [session, setSession] = useState<ForjaDraftSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToForjaDraftSession(
      data => { setSession(data); setLoading(false); },
      ()   => { setLoading(false); }
    );
    return () => unsub();
  }, []);

  return { session, loading };
}
