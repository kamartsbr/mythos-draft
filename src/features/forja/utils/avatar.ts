export function getDiscordDefaultAvatarUrl(seed?: string | number | null): string {
  const seedText = seed === null || seed === undefined ? '' : String(seed);
  const numericSeed = parseInt(seedText.slice(-1), 10);
  const defaultIndex = Number.isFinite(numericSeed) ? numericSeed % 6 : 0;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

export function getDiscordAvatarUrl(user: { id: string; avatar?: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  return getDiscordDefaultAvatarUrl(user.id);
}

export function getForjaAvatarUrl(primaryUrl: string | null | undefined, discordId?: string | number | null): string {
  return primaryUrl || getDiscordDefaultAvatarUrl(discordId);
}
