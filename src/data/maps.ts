import { MapInfo, MapPosition } from '../types';

export const PANTHEONS = ['Japanese', 'Chinese', 'Greek', 'Egyptian', 'Norse', 'Atlantean', 'Aztec'];

const DEFAULT_POSITIONS: MapPosition[] = [
  { playerId: 1, x: 20, y: 20 }, // Team A - Corner (faces P2)
  { playerId: 5, x: 50, y: 20 }, // Team A - Middle (faces P6)
  { playerId: 4, x: 80, y: 20 }, // Team A - Corner (faces P3)
  { playerId: 2, x: 20, y: 80 }, // Team B - Corner (faces P1)
  { playerId: 6, x: 50, y: 80 }, // Team B - Middle (faces P5)
  { playerId: 3, x: 80, y: 80 }, // Team B - Corner (faces P4)
];

const SNAKE_DANCE_POSITIONS: MapPosition[] = [
  { playerId: 1, x: 20, y: 20 }, // Red (faces Blue)
  { playerId: 5, x: 50, y: 20 }, // Yellow (faces Cyan)
  { playerId: 4, x: 80, y: 20 }, // Orange (faces Pink)
  { playerId: 3, x: 20, y: 80 }, // Blue (faces Red)
  { playerId: 6, x: 50, y: 80 }, // Cyan (faces Yellow)
  { playerId: 2, x: 80, y: 80 }, // Pink (faces Orange)
];

const KERLAUGAR_POSITIONS: MapPosition[] = [
  { playerId: 1, x: 50, y: 20 }, // Red (Middle, faces Blue)
  { playerId: 5, x: 80, y: 20 }, // Yellow (faces Pink)
  { playerId: 4, x: 20, y: 20 }, // Orange (faces Cyan)
  { playerId: 3, x: 50, y: 80 }, // Blue (Middle, faces Red)
  { playerId: 2, x: 80, y: 80 }, // Pink (faces Yellow)
  { playerId: 6, x: 20, y: 80 }, // Cyan (faces Orange)
];

export const MAPS: MapInfo[] = [
  { id: 'alfheim', name: 'Alfheim', image: 'https://static.wikia.nocookie.net/ageofempires/images/c/c4/AoMR_Alfheim_map_icon.png/revision/latest?cb=20240920074941', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'anatolia', name: 'Anatolia', image: 'https://static.wikia.nocookie.net/ageofempires/images/1/15/AoMR_Anatolia_map_icon.png/revision/latest?cb=20240920074942', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'arena', name: 'Arena', image: 'https://static.wikia.nocookie.net/ageofempires/images/a/a2/AoMR_Arena_map_icon.png/revision/latest?cb=20240721083223', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'blue_lagoon', name: 'Blue Lagoon', image: 'https://static.wikia.nocookie.net/ageofempires/images/4/4c/AoMR_Blue_Lagoon_map_icon.png/revision/latest?cb=20240920074945', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'elysium', name: 'Elysium', image: 'https://static.wikia.nocookie.net/ageofempires/images/d/dc/AoMR_Elysium_map_icon.png/revision/latest?cb=20240716202120', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'erebus', name: 'Erebus', image: 'https://static.wikia.nocookie.net/ageofempires/images/5/5f/AoMR_Erebus_map_icon.png/revision/latest?cb=20240920074946', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'ghost_lake', name: 'Ghost Lake', image: 'https://static.wikia.nocookie.net/ageofempires/images/5/55/AoMR_Ghost_Lake_map_icon.png/revision/latest?cb=20240920074948', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'giza', name: 'Giza', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/33/AoMR_Giza_map_icon.png/revision/latest?cb=20240716202124', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'gold_rush', name: 'Gold Rush', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/3a/AoMR_Gold_Rush_map_icon.png/revision/latest?cb=20240906191715', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'kerlaugar', name: 'Kerlaugar', image: 'https://static.wikia.nocookie.net/ageofempires/images/1/10/AoMR_Kerlaugar_map_icon.png/revision/latest?cb=20240721082853', isRanked: true, positions: KERLAUGAR_POSITIONS },
  { id: 'kii', name: 'Kii', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/80/Kii_icon_AoMR.png/revision/latest?cb=20251004175035', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'marsh', name: 'Marsh', image: 'https://static.wikia.nocookie.net/ageofempires/images/a/ac/AoMR_Marsh_map_icon.png/revision/latest?cb=20240920074958', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'mediterranean', name: 'Mediterranean', image: 'https://static.wikia.nocookie.net/ageofempires/images/4/4e/AoMR_Mediterranean_map_icon.png/revision/latest?cb=20240920075001', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'megalopolis', name: 'Megalopolis', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/8f/AoMR_Megalopolis_map_icon.png/revision/latest?cb=20240920075003', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'midgard', name: 'Midgard', image: 'https://static.wikia.nocookie.net/ageofempires/images/f/ff/AoMR_Midgard_map_icon.png/revision/latest?cb=20240920075322', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'mirage', name: 'Mirage', image: 'https://static.wikia.nocookie.net/ageofempires/images/a/af/AoMR_Mirage_map_icon.png/revision/latest?cb=20240721082851', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'nile_shallows', name: 'Nile Shallows', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/82/AoMR_Nile_Shallows_map_icon.png/revision/latest?cb=20240716202129', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'oasis', name: 'Oasis', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/30/AoMR_Oasis_map_icon.png/revision/latest?cb=20240920075325', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'okuchichibu', name: 'Okuchichibu', image: 'https://static.wikia.nocookie.net/ageofempires/images/6/60/Okuchichibu_icon_AoMR.png/revision/latest?cb=20251004175037', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'qinghai_lake', name: 'Qinghai Lake', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/85/AoMR_Qinghai_Lake.png/revision/latest?cb=20250303105325', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'savannah', name: 'Savannah', image: 'https://static.wikia.nocookie.net/ageofempires/images/4/49/AoMR_Savannah_map_icon.png/revision/latest?cb=20240920075331', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'silk_road', name: 'Silk Road', image: 'https://static.wikia.nocookie.net/ageofempires/images/7/7e/AoMR_Silk_Road_map.png/revision/latest?cb=20250303105325', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'snake_dance', name: 'Snake Dance', image: 'https://static.wikia.nocookie.net/ageofempires/images/5/50/Snake_Dance_icon_AoMR.png/revision/latest?cb=20251004175032', isRanked: true, positions: SNAKE_DANCE_POSITIONS },
  { id: 'steppe', name: 'Steppe', image: 'https://static.wikia.nocookie.net/ageofempires/images/b/ba/AoMR_Steppe.png/revision/latest?cb=20250303105325', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'team_migration', name: 'Team Migration', image: 'https://static.wikia.nocookie.net/ageofempires/images/7/78/AoMR_Team_Migration_map_icon.png/revision/latest?cb=20240920075335', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'tundra', name: 'Tundra', image: 'https://static.wikia.nocookie.net/ageofempires/images/d/d7/AoMR_Tundra_map_icon.png/revision/latest?cb=20240920075339', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'valley_of_kings', name: 'Valley of Kings', image: 'https://static.wikia.nocookie.net/ageofempires/images/0/01/AoMR_Valley_of_Kings_map_icon.png/revision/latest?cb=20240920075341', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'watering_hole', name: 'Watering Hole', image: 'https://static.wikia.nocookie.net/ageofempires/images/0/01/AoMR_Watering_Hole_map_icon.png/revision/latest?cb=20240920075345', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'yellow_river', name: 'Yellow River', image: 'https://static.wikia.nocookie.net/ageofempires/images/5/58/AoMR_Yellow_River.png/revision/latest?cb=20250303105325', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'obsidian_ridge', name: 'Obsidian Ridge', image: '/Obsidian_Ridge.webp', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'cloud_forest', name: 'Cloud Forest', image: '/Cloud_Forest.webp', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'blood_river_crossing', name: 'Blood River Crossing', image: '/Blood_River_Crossing_minimap_48989y94-396x396.webp', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'valley_of_the_sun_serpent', name: 'Valley of the Sun Serpent', image: '/Valley_of_the_sun_serpent_minimap_357357-396x396.webp', isRanked: true, positions: DEFAULT_POSITIONS },
  { id: 'temple_of_the_jaguar_moon', name: 'Temple of the Jaguar Moon', image: '/Temple_of_the_Jaguar_Moon_minimap_89237-396x396.webp', isRanked: true, positions: DEFAULT_POSITIONS },
];

export const RANKED_MAP_POOL = [
  'alfheim', 'anatolia', 'snake_dance', 'elysium', 'steppe', 'giza', 'kii', 
  'ghost_lake', 'blue_lagoon', 'megalopolis', 'midgard', 'oasis', 'okuchichibu', 
  'marsh', 'savannah', 'tundra', 'valley_of_kings', 'nile_shallows'
];

export const CASCA_GROSSA_POOL = [
  'alfheim', 'anatolia', 'arena', 'watering_hole', 'gold_rush', 'steppe', 'giza', 
  'ghost_lake', 'qinghai_lake', 'blue_lagoon', 'mediterranean', 'midgard', 
  'mirage', 'oasis', 'marsh', 'yellow_river', 'savannah', 'tundra', 
  'nile_shallows', 'erebus'
];

export const CASCA_GROSSA_GROUP_POOL = [
  'alfheim', 'anatolia', 'watering_hole', 'elysium', 'steppe', 'giza', 'ghost_lake', 
  'blue_lagoon', 'megalopolis', 'oasis', 'marsh', 'savannah', 'tundra', 
  'nile_shallows'
];

export const CASCA_GROSSA_PLAYOFF_POOL = [
  'alfheim', 'anatolia', 'arena', 'watering_hole', 'gold_rush', 'steppe', 'giza', 
  'ghost_lake', 'qinghai_lake', 'blue_lagoon', 'mediterranean', 'midgard', 
  'mirage', 'oasis', 'marsh', 'yellow_river', 'savannah', 'tundra', 
  'nile_shallows', 'erebus'
];

export const MCL_MAP_POOL = [
  ...RANKED_MAP_POOL,
  'yellow_river', 'team_migration', 'mediterranean', 'silk_road', 'gold_rush', 
  'kerlaugar', 'watering_hole'
];

export function getMCLMapPool(round: number) {
  if (round >= 5) {
    // Remove: Anatolia, Blue Lagoon, Megalopolis, Snake Dance
    // Add: Mirage, Obsidian Ridge, Watering Hole, Cloud Forest
    const toRemove = ['anatolia', 'blue_lagoon', 'megalopolis', 'snake_dance'];
    const toAdd = ['mirage', 'obsidian_ridge', 'watering_hole', 'cloud_forest'];
    const base = MCL_MAP_POOL.filter(id => !toRemove.includes(id));
    return [...new Set([...base, ...toAdd])];
  }
  return MCL_MAP_POOL;
}

export const MCL_ROUND_MAPS: Record<number, string> = {
  1: 'yellow_river',
  2: 'team_migration',
  3: 'mediterranean',
  4: 'silk_road',
  5: 'gold_rush',
  6: 'kerlaugar',
  7: 'watering_hole'
};

