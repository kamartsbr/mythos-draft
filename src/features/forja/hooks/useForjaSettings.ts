/**
 * useForjaSettings — Hook de configurações do torneio em tempo real (Cacheado).
 * Retorna as settings do Firestore com fallback para defaults.
 * Faz fetch apenas 1x (Cold Fetch) por sessão.
 */

import { useState, useEffect } from 'react';
import { ForjaSettings, ForjaTierMode } from '../types';
import { getForjaSettingsOnce, cachedSettings } from '../services/forjaService';
import { getTierCutoffs } from '../forjaUtils';

const DEFAULT_MAX_PARTICIPANTS = 48;

export function useForjaSettings() {
  const [settings, setSettings] = useState<ForjaSettings | null>(cachedSettings);
  const [loading, setLoading]   = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) return;

    let isMounted = true;
    getForjaSettingsOnce().then(data => {
      if (isMounted) {
        setSettings(data);
        setLoading(false);
      }
    }).catch(err => {
      console.error('[useForjaSettings]', err);
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  const maxParticipants    = settings?.max_participants ?? DEFAULT_MAX_PARTICIPANTS;
  const { tierASize, tierBSize, tierCSize, tierMode } = getTierCutoffs(settings ?? undefined);
  const isRegistrationOpen = settings?.registration_open ?? true;
  const deadlineMs         = settings?.registration_deadline_ms ?? null;
  
  const now = Date.now();
  const registrationOpen = settings?.registration_open && settings?.registration_deadline_ms ? now < settings.registration_deadline_ms : true;
  const msToDeadline = settings?.registration_deadline_ms ? settings.registration_deadline_ms - now : 0;
  const msToSnapshot = settings?.elo_snapshot_ms ? settings.elo_snapshot_ms - now : 0;
  const msToDraft = settings?.draft_start_ms ? settings.draft_start_ms - now : 0;

  return { 
    settings, loading, maxParticipants, tierASize, tierBSize, tierCSize, tierMode, isRegistrationOpen, deadlineMs,
    // Alias retro-compatibilidade para views antigas
    data: settings, registrationOpen, msToDeadline, msToSnapshot, msToDraft 
  };
}
