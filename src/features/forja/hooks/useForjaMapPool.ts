/**
 * useForjaMapPool — Hook reativo para a Pool de Mapas do Torneio.
 *
 * Escuta em tempo real o documento `forja_content/map_pool`.
 * Fallback: se o documento não existir no Firestore, usa o FORJA_MAP_POOL local
 * (estático em src/data/maps.ts) para não quebrar a UI durante o primeiro acesso.
 */
import { useState, useEffect } from 'react';
import { ForjaMapPool } from '../types';
import { MAPS, FORJA_MAP_POOL } from '../../../data/maps';
import { getForjaMapPoolOnce, cachedMapPool } from '../services/forjaService';
import type { MapInfo } from '../../../types';

export interface UseForjaMapPoolResult {
  poolDoc: ForjaMapPool | null;
  activeMapIds: string[];
  activeMaps: MapInfo[];
  poolSize: number;
  loading: boolean;
  error: string | null;
}

const DEFAULT_POOL_SIZE = 10;

export function useForjaMapPool(): UseForjaMapPoolResult {
  const [poolDoc, setPoolDoc] = useState<ForjaMapPool | null>(cachedMapPool);
  const [loading, setLoading] = useState(!cachedMapPool);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (cachedMapPool) return;
    
    let isMounted = true;
    getForjaMapPoolOnce().then(data => {
      if (isMounted) {
        setPoolDoc(data);
        setLoading(false);
      }
    }).catch(err => {
      if (isMounted) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  // Se ainda não existe documento no Firestore, usa o pool local como fallback
  const activeMapIds = poolDoc ? poolDoc.active_map_ids : FORJA_MAP_POOL;
  const poolSize     = poolDoc ? poolDoc.pool_size : DEFAULT_POOL_SIZE;

  // Garante a ordem dos mapas conforme o array de IDs
  const activeMaps = activeMapIds
    .map(id => MAPS.find(m => m.id === id))
    .filter((m): m is MapInfo => m !== undefined);

  return { poolDoc, activeMapIds, activeMaps, poolSize, loading, error };
}
