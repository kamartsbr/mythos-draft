import { useEffect } from 'react';
import { lobbyService } from '../services/lobbyService';

export function WipeHistory() {
  useEffect(() => {
    lobbyService.clearAllLobbies().then(() => console.log("History wiped."));
  }, []);
  return null;
}
