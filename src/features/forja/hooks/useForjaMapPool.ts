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
import { subscribeToForjaMapPool } from '../services/forjaService';
import type { MapInfo } from '../../../types';

export interface UseForjaMapPoolResult {
  /** Pool bruta do Firestore (null = não inicializada ainda) */
  poolDoc: ForjaMapPool | null;
  /** IDs dos mapas ativos (com fallback local) */
  activeMapIds: string[];
  /** Objetos MapInfo completos dos mapas ativos, na ordem definida */
  activeMaps: MapInfo[];
  /** Tamanho máximo da pool (default 10 se não inicializado) */
  poolSize: number;
  loading: boolean;
  error: string | null;
}

const DEFAULT_POOL_SIZE = 10;

export function useForjaMapPool(): UseForjaMapPoolResult {
  const [poolDoc, setPoolDoc] = useState<ForjaMapPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToForjaMapPool(
      (data) => { setPoolDoc(data); setLoading(false); },
      (err)   => { setError(err.message); setLoading(false); }
    );
    return unsub;
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
