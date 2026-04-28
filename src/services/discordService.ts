import { Lobby } from '../types';
import { MAJOR_GODS, MAPS } from '../constants';

const GOD_EMOJIS: Record<string, string> = {
  zeus: '⚡', poseidon: '🌊', hades: '💀', demeter: '🌾',
  ra: '☀️', isis: '🪄', set: '🦂',
  odin: '🦅', thor: '🔨', loki: '🐍', freyr: '🐗',
  kronos: '⏳', oranos: '🌌', gaia: '🌍',
  amaterasu: '⛩️', susanoo: '🗡️', tsukuyomi: '🌙',
  fuxi: '☯️', nuwa: '🌸', shennong: '🌿',
  quetzalcoatl: '🪶', tezcatlipoca: '🐆', huitzilopochtli: '🩸'
};

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
    const scoreText = `**${lobby.scoreA}** - **${lobby.scoreB}**`;
    
    // Determine Map Image
    const fallbackImage = isMCL 
      ? 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest'
      : 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest';
    
    let mapImage = fallbackImage;

    let currentMapId = lobby.selectedMap;
    if (!currentMapId && lobby.seriesMaps && lobby.seriesMaps[lobby.currentGame - 1]) {
      currentMapId = lobby.seriesMaps[lobby.currentGame - 1];
    }
    
    if (currentMapId) {
      const foundMap = MAPS.find(m => m.id === currentMapId);
      if (foundMap && foundMap.image) {
        mapImage = foundMap.image;
      }
    }

    const cleanValue = (val: any) => {
      const s = String(val || '').trim();
      return s.length > 0 ? s : '\u200b';
    };

    const getAbsoluteUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      const baseUrl = window.location.origin.includes('ais-dev-') 
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : window.location.origin;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const embed: any = {
      title: (isMCL ? `🏆 MCL: ${lobby.config.name}` : `🏆 ${lobby.config.name}`) || 'Mythos Draft Update',
      description: `*Age of Mythology Draft*`,
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
        url: getAbsoluteUrl(mapImage)
      },
      image: {
        url: getAbsoluteUrl(isMCL 
          ? 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest'
          : 'https://static.wikia.nocookie.net/ageofempires/images/2/2f/AoMR_IP_HS_triptych.jpeg/revision/latest')
      }
    };

    // Add Status and Score as inline fields
    embed.fields.push(
      { name: '📊 STATUS', value: cleanValue(isFinished ? '✅ FINAL RESULT' : `⚔️ ${phaseText}`), inline: true },
      { name: '🎯 SCORE', value: cleanValue(scoreText), inline: true },
      { name: '\u200b', value: '\u200b', inline: false }
    );

    // Players Info
    const tAPlayers = Array.isArray(lobby.teamAPlayers) ? lobby.teamAPlayers : Object.values(lobby.teamAPlayers || {});
    const tBPlayers = Array.isArray(lobby.teamBPlayers) ? lobby.teamBPlayers : Object.values(lobby.teamBPlayers || {});
    
    const playersA = cleanValue(tAPlayers.map(p => (p as any).name).join(', ') || teamAName);
    const playersB = cleanValue(tBPlayers.map(p => (p as any).name).join(', ') || teamBName);

    embed.fields.push(
      { name: `🔴 ${cleanValue(teamAName).toUpperCase()}`, value: playersA, inline: true },
      { name: `🔵 ${cleanValue(teamBName).toUpperCase()}`, value: playersB, inline: true },
      { name: '\u200b', value: '\u200b', inline: false }
    );

    // Map Info
    if (currentMapId) {
      const mapName = MAPS.find(m => m.id === currentMapId)?.name || currentMapId;
      embed.fields.push({ name: '📍 SELECTED MAP', value: cleanValue(`**${mapName}**`), inline: false });
    }

    // Picks
    const formatPicks = (team: 'A' | 'B') => {
      const teamPicks = lobby.picks.filter(p => p.team === team && p.godId);
      const teamBans = (lobby.replayLog || [])
        .filter(step => step.action === 'BAN' && step.target === 'GOD' && step.player === team && step.gameNumber === lobby.currentGame)
        .map(step => step.id);

      let text = '';
      if (teamBans.length > 0) {
        text += '🚫 ' + teamBans.map(id => GOD_EMOJIS[id.toLowerCase()] || '✨').join(' ') + '\n\n';
      }

      if (teamPicks.length === 0) {
        text += '*Draft in Progress...*';
        return text;
      }
      
      text += teamPicks.map(p => {
        const godId = p.godId || '';
        const god = MAJOR_GODS.find(g => g.id === godId);
        const emoji = godId ? GOD_EMOJIS[godId.toLowerCase()] || '✨' : '✨';
        return `${emoji} **${god?.name || godId}**${p.isRandom ? ' (🎲)' : ''}`;
      }).join('\n');

      return cleanValue(text);
    };

    embed.fields.push(
      { name: 'Picks A', value: formatPicks('A'), inline: true },
      { name: 'Picks B', value: formatPicks('B'), inline: true }
    );

    // Link
    const baseUrl = window.location.origin.includes('ais-dev-') 
      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
      : window.location.origin;
    const lobbyUrl = `${baseUrl}/?lobby=${lobby.id}`;

    return {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: '📺 WATCH LIVE',
              url: lobbyUrl
            }
          ]
        }
      ]
    };
  }
};
