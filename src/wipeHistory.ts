import { lobbyService } from './services/lobbyService.js';

async function wipeHistory() {
  console.log("Wiping history...");
  await lobbyService.clearAllLobbies();
  console.log("History wiped.");
}

wipeHistory();
