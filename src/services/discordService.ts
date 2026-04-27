import { Lobby } from '../types';
import { MAJOR_GODS, MAPS } from '../constants';

export const discordService = {
  async updateLobbyWebhook(lobby: Lobby) {
    if (!lobby.discordWebhookUrl) return;

    try {
      const payload = this.generateEmbed(lobby);
      
      let response;
      if (lobby.discordMessageId) {
        // Update existing message
        // PATCH /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}
        // We need to parse webhook URL for ID and token
        const { baseUrl, token } = this.parseWebhookUrl(lobby.discordWebhookUrl);
        if (!baseUrl || !token) return;

        response = await fetch(`${baseUrl}/messages/${lobby.discordMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new message
        // POST /webhooks/{webhook.id}/{webhook.token}?wait=true
        const url = new URL(lobby.discordWebhookUrl);
        url.searchParams.set('wait', 'true');

        response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.id) {
            // Store message ID back in Firestore
            const { lobbyService } = await import('./lobbyService');
            await lobbyService.updateLobby(lobby.id, { discordMessageId: data.id });
          }
        }
      }

      if (!response.ok) {
        console.error('Discord Webhook failed:', await response.text());
      }
    } catch (error) {
      console.error('Discord Webhook error:', error);
    }
  },

  parseWebhookUrl(url: string) {
    // Expected format: https://discord.com/api/webhooks/ID/TOKEN
    const match = url.match(/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)/);
    if (!match) return { baseUrl: null, token: null };
    
    return {
      baseUrl: `https://discord.com/api/webhooks/${match[1]}/${match[2]}`,
      token: match[2]
    };
  },

  generateEmbed(lobby: Lobby) {
    const isFinished = lobby.status === 'finished' || lobby.phase === 'finished';
    const isMCL = lobby.config.preset === 'MCL';
    const phaseText = lobby.phase.replace('_', ' ').toUpperCase();
    
    // Team Names
    const teamAName = lobby.captain1Name || 'Host';
    const teamBName = lobby.captain2Name || 'Guest';
    
    // Score Format: Team A name (X) - (Y) Team B name
    const scoreText = `${teamAName} (${lobby.scoreA}) - (${lobby.scoreB}) ${teamBName}`;
    
    const embed: any = {
      title: isMCL ? `🏆 MCL: ${lobby.config.name}` : `🏆 ${lobby.config.name}`,
      description: `**Status:** ${isFinished ? '✅ DRAFT FINISHED' : '⚔️ ' + phaseText}\n**Score:** ${scoreText}`,
      color: isFinished ? 0x22c55e : 0xf59e0b, 
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: isMCL ? 'Mythic Clan League • Administrative Broadcast' : 'Mythos Draft Tool • Administrative Broadcast',
        icon_url: isMCL 
          ? 'https://liquipedia.net/commons/images/c/c0/Mythic_Clan_League_allmode.png'
          : 'https://static.wikia.nocookie.net/ageofempires/images/8/89/AoMR_Hades_icon.png'
      },
      thumbnail: {
        url: isMCL ? 'https://liquipedia.net/commons/images/c/c0/Mythic_Clan_League_allmode.png' : null
      },
      image: {
        url: isMCL 
          ? 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest'
          : 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest'
      }
    };

    // Players Info
    const playersA = (lobby.teamAPlayers || []).map(p => p.name).join(', ') || teamAName;
    const playersB = (lobby.teamBPlayers || []).map(p => p.name).join(', ') || teamBName;

    // Team A: Red icon (🔴), Team B: Blue icon (🔵)
    embed.fields.push(
      { name: `🔴 ${teamAName.toUpperCase()}`, value: playersA, inline: true },
      { name: `🔵 ${teamBName.toUpperCase()}`, value: playersB, inline: true },
      { name: '\u200b', value: '\u200b', inline: false }
    );

    // Map Info
    if (lobby.selectedMap) {
      const mapName = MAPS.find(m => m.id === lobby.selectedMap)?.name || lobby.selectedMap;
      embed.fields.push({ name: '📍 SELECTED MAP', value: `**${mapName}**`, inline: false });
    } else if (lobby.seriesMaps && lobby.seriesMaps[lobby.currentGame - 1]) {
        const mapName = MAPS.find(m => m.id === lobby.seriesMaps[lobby.currentGame - 1])?.name || lobby.seriesMaps[lobby.currentGame - 1];
        embed.fields.push({ name: '📍 SELECTED MAP', value: `**${mapName}**`, inline: false });
    }

    // Picks
    const picksA = lobby.picks
      .filter(p => p.team === 'A' && p.godId)
      .map(p => {
        const god = MAJOR_GODS.find(g => g.id === p.godId);
        return `${god?.name || p.godId}${p.isRandom ? ' (🎲)' : ''}`;
      })
      .join('\n') || 'None';

    const picksB = lobby.picks
      .filter(p => p.team === 'B' && p.godId)
      .map(p => {
        const god = MAJOR_GODS.find(g => g.id === p.godId);
        return `${god?.name || p.godId}${p.isRandom ? ' (🎲)' : ''}`;
      })
      .join('\n') || 'None';

    embed.fields.push(
      { name: 'Picks A', value: picksA, inline: true },
      { name: 'Picks B', value: picksB, inline: true }
    );

    // Link
    const baseUrl = window.location.origin.includes('ais-dev-') 
      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
      : window.location.origin;
    const lobbyUrl = `${baseUrl}/?lobby=${lobby.id}`;
    embed.description += `\n\n[**JOIN DRAFT LOBBY**](${lobbyUrl})`;

    return {
      embeds: [embed]
    };
  }
};
