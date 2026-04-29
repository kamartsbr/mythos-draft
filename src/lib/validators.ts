// src/lib/validators.ts
import { Lobby } from '../types';

export function validateLobby(data: any): Lobby | null {
  if (!data || typeof data !== 'object') return null;

  return {
    ...data,
    id: String(data.id ?? ''),
    // Garante que spectators SEMPRE seja um Array, mesmo que venha como Objeto do Firebase
    spectators: Array.isArray(data.spectators) 
      ? data.spectators 
      : Object.values(data.spectators ?? {}),
    // Adicione outras correções de campos críticos aqui se necessário
  };
}