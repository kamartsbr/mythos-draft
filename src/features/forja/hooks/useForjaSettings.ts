/**
 * useForjaSettings — Hook de configurações do torneio em tempo real.
 * Retorna as settings do Firestore com fallback para defaults.
 */

import { useState, useEffect } from 'react';
import { ForjaSettings } from '../types';
import { subscribeToForjaSettings } from '../services/forjaService';
import { getTierCutoffs } from '../forjaUtils';

const DEFAULT_MAX_PARTICIPANTS = 48;

export function useForjaSettings(): {
  settings: ForjaSettings | null;
  loading: boolean;
  maxParticipants: number;
  tierASize: number;
  tierBSize: number;
  tierCSize: number;
  isRegistrationOpen: boolean;
  deadlineMs: number | null;
} {
  const [settings, setSettings] = useState<ForjaSettings | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = subscribeToForjaSettings(
      (data) => { setSettings(data); setLoading(false); },
      (err)  => { console.error('[useForjaSettings]', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const maxParticipants    = settings?.max_participants ?? DEFAULT_MAX_PARTICIPANTS;
  const { tierASize, tierBSize, tierCSize } = getTierCutoffs(settings ?? undefined);
  const isRegistrationOpen = settings?.registration_open ?? true;
  const deadlineMs         = settings?.registration_deadline_ms ?? null;

  return { settings, loading, maxParticipants, tierASize, tierBSize, tierCSize, isRegistrationOpen, deadlineMs };
}
