import { Lobby, ChatMessage } from '../types';

/**
 * Sanitiza texto para evitar injeção de markdown e mentions indevidas no Discord.
 */
function sanitizeForDiscord(text: string): string {
  if (!text) return '';
  return text
    .replace(/[`*_~|]/g, '\\$&') // Escape markdown simples
    .replace(/@(everyone|here)/gi, '@\u200b$1') // Prevenir mentions globais
    .slice(0, 2000); // Limite de caracteres do Discord
}

export const discordService = {
  async updateLobbyWebhook(lobby: Lobby) {
    if (!lobby.discordWebhookUrl) return;

    try {
      const embed = this.generateEmbed(lobby);
      let response;

      if (lobby.discordMessageId) {
        // Update existing message
        const { baseUrl } = this.parseWebhookUrl(lobby.discordWebhookUrl);
        if (!baseUrl) return;

        response = await fetch(`${baseUrl}/messages/${lobby.discordMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] })
        });
      } else {
        // Create new message
        const url = new URL(lobby.discordWebhookUrl);
        url.searchParams.set('wait', 'true');

        response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.id) {
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
    const statusMap: Record<string, string> = {
      waiting: '⌛ Aguardando',
      drafting: '⚔️ Em Draft',
      finished: '🏁 Finalizado'
    };

    return {
      title: `Draft Lobby: ${sanitizeForDiscord(lobby.id)}`,
      description: `**Status:** ${statusMap[lobby.status] || lobby.status}\n**Fase:** ${sanitizeForDiscord(lobby.phase || 'N/A')}`,
      color: lobby.status === 'drafting' ? 0x00ff00 : (lobby.status === 'finished' ? 0xff0000 : 0xffff00),
      fields: [
        { name: 'Capitão A', value: sanitizeForDiscord(lobby.captain1Name || lobby.captain1 || 'Vago'), inline: true },
        { name: 'Capitão B', value: sanitizeForDiscord(lobby.captain2Name || lobby.captain2 || 'Vago'), inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Mythos Draft System' }
    };
  }
};
