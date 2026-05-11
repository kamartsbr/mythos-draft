import { useState, useEffect } from 'react';
import { ForjaContentDoc, ForjaPrizeConfig, ForjaSettings } from '../types';
import { subscribeToForjaContent, ForjaContentId } from '../services/forjaService';

export function useForjaContent(docId: ForjaContentId) {
  const [data, setData]       = useState<ForjaContentDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToForjaContent<ForjaContentDoc>(docId,
      d => { setData(d); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [docId]);

  return { data, loading };
}

export function useForjaPrizes() {
  const [data, setData]       = useState<ForjaPrizeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToForjaContent<ForjaPrizeConfig>('prizes',
      d => { setData(d); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return { data, loading };
}

export function useForjaSettings() {
  // Defaults hardcoded como fallback enquanto o Firestore carrega
  const DEFAULT: ForjaSettings = {
    registration_open: true,
    registration_deadline_ms: new Date('2026-05-10T16:59:00Z').getTime(),
    elo_snapshot_ms:          new Date('2026-05-10T17:00:00Z').getTime(),
    draft_start_ms:           new Date('2026-05-10T18:00:00Z').getTime(),
    updated_at: null,
  };

  const [data, setData]       = useState<ForjaSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToForjaContent<ForjaSettings>('settings',
      d => { if (d) setData(d); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const now = Date.now();
  const registrationOpen = data.registration_open && now < data.registration_deadline_ms;
  const msToDeadline     = data.registration_deadline_ms - now;
  const msToSnapshot     = data.elo_snapshot_ms - now;
  const msToDraft        = data.draft_start_ms - now;

  return { data, loading, registrationOpen, msToDeadline, msToSnapshot, msToDraft };
}
