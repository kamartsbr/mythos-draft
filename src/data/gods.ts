import { God } from '../types';

export const MAJOR_GODS: God[] = [
  // Greek
  { id: 'zeus', name: 'Zeus', culture: 'Greek', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/38/AoMR_Zeus_icon.png/revision/latest?cb=20240908095029', focus: 'Infantry & Heroes', powers: ['Bolt'], minorGods: ['Athena', 'Hermes', 'Apollo', 'Dionysus', 'Hephaestus', 'Hera'] },
  { id: 'poseidon', name: 'Poseidon', culture: 'Greek', image: 'https://static.wikia.nocookie.net/ageofempires/images/e/ef/AoMR_Poseidon_icon.png/revision/latest?cb=20240908094542', focus: 'Cavalry & Navy', powers: ['Lure'], minorGods: ['Ares', 'Hermes', 'Aphrodite', 'Dionysus', 'Artemis', 'Hephaestus'] },
  { id: 'hades', name: 'Hades', culture: 'Greek', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/89/AoMR_Hades_icon.png/revision/latest?cb=20240908093748', focus: 'Archers & Buildings', powers: ['Sentinel'], minorGods: ['Ares', 'Athena', 'Apollo', 'Aphrodite', 'Artemis', 'Hephaestus'] },
  { id: 'demeter', name: 'Demeter', culture: 'Greek', image: 'https://static.wikia.nocookie.net/ageofempires/images/a/a7/AoMR_Demeter_icon.png/revision/latest?cb=20251218193840', focus: 'Economy & Growth', powers: ['Harvest'], minorGods: ['Persephone', 'Hermes', 'Apollo', 'Dionysus', 'Artemis', 'Hera'] },
  
  // Egyptian
  { id: 'ra', name: 'Ra', culture: 'Egyptian', image: 'https://static.wikia.nocookie.net/ageofempires/images/c/cd/AoMR_Ra_icon.png/revision/latest?cb=20240908100415', focus: 'Camelry & Monuments', powers: ['Rain'], minorGods: ['Bast', 'Ptah', 'Hathor', 'Sekhmet', 'Osiris', 'Horus'] },
  { id: 'isis', name: 'Isis', culture: 'Egyptian', image: 'https://static.wikia.nocookie.net/ageofempires/images/e/e8/AoMR_Isis_icon.png/revision/latest?cb=20240908102153', focus: 'Economy & Magic', powers: ['Prosperity'], minorGods: ['Bast', 'Anubis', 'Hathor', 'Nephthys', 'Osiris', 'Thoth'] },
  { id: 'set', name: 'Set', culture: 'Egyptian', image: 'https://static.wikia.nocookie.net/ageofempires/images/4/40/AoMR_Set_icon.png/revision/latest?cb=20240908100650', focus: 'Archers & Animals', powers: ['Vision'], minorGods: ['Anubis', 'Ptah', 'Nephthys', 'Sekhmet', 'Horus', 'Thoth'] },
  
  // Norse
  { id: 'odin', name: 'Odin', culture: 'Norse', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/34/AoMR_Odin_icon.png/revision/latest?cb=20240908085053', focus: 'Human Units & Ravens', powers: ['Great Hunt'], minorGods: ['Freyja', 'Heimdall', 'Njord', 'Skadi', 'Baldr', 'Tyr'] },
  { id: 'thor', name: 'Thor', culture: 'Norse', image: 'https://static.wikia.nocookie.net/ageofempires/images/d/dc/AoMR_Thor_icon.png/revision/latest?cb=20240828165910', focus: 'Dwarves & Armory', powers: ['Dwarven Mine'], minorGods: ['Forseti', 'Freyja', 'Bragi', 'Skadi', 'Baldr', 'Tyr'] },
  { id: 'loki', name: 'Loki', culture: 'Norse', image: 'https://static.wikia.nocookie.net/ageofempires/images/1/1f/AoMR_Loki_icon.png/revision/latest?cb=20240908085202', focus: 'Myth Units & Hersirs', powers: ['Spy'], minorGods: ['Forseti', 'Heimdall', 'Bragi', 'Njord', 'Hel', 'Tyr'] },
  { id: 'freyr', name: 'Freyr', culture: 'Norse', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/32/AoMR_Freyr_icon.png/revision/latest?cb=20240828165910', focus: 'Defenses & Magic', powers: ['Gullinbursti'], minorGods: ['Freyja', 'Heimdall', 'Njord', 'Skadi', 'Baldr', 'Ullr'] },

  // Atlantean
  { id: 'kronos', name: 'Kronos', culture: 'Atlantean', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/32/AoMR_Kronos_icon.png/revision/latest?cb=20240908104654', focus: 'Siege & Myth Units', powers: ['Deconstruction'], minorGods: ['Leto', 'Prometheus', 'Hyperion', 'Oceanus', 'Helios', 'Atlas'] },
  { id: 'oranos', name: 'Oranos', culture: 'Atlantean', image: 'https://static.wikia.nocookie.net/ageofempires/images/8/81/AoMR_Oranos_icon.png/revision/latest?cb=20240908104946', focus: 'Speed & Sky Passages', powers: ['Shockwave'], minorGods: ['Prometheus', 'Oceanus', 'Hyperion', 'Theia', 'Helios', 'Hecate'] },
  { id: 'gaia', name: 'Gaia', culture: 'Atlantean', image: 'https://static.wikia.nocookie.net/ageofempires/images/e/e6/AoMR_Gaia_icon.png/revision/latest?cb=20240908104337', focus: 'Economy & Lush', powers: ['Gaia Forest'], minorGods: ['Leto', 'Oceanus', 'Theia', 'Rheia', 'Atlas', 'Hecate'] },

  // Japanese
  { id: 'amaterasu', name: 'Amaterasu', culture: 'Japanese', image: 'https://static.wikia.nocookie.net/ageofempires/images/f/f7/AoMR_Amaterasu_icon.png/revision/latest?cb=20251014162703', focus: 'Sun & Samurai', powers: ['Sun Strike'], minorGods: ['Inari', 'Raijin', 'Fujin', 'Hachiman', 'Ryujin'] },
  { id: 'susanoo', name: 'Susanoo', culture: 'Japanese', image: 'https://static.wikia.nocookie.net/ageofempires/images/2/2b/AoMR_Susanoo_icon.png/revision/latest?cb=20251014162801', focus: 'Storms & Navy', powers: ['Typhoon'], minorGods: ['Raijin', 'Ebisu', 'Fujin', 'Bishamonten', 'Kagutsuchi'] },
  { id: 'tsukuyomi', name: 'Tsukuyomi', culture: 'Japanese', image: 'https://static.wikia.nocookie.net/ageofempires/images/9/9e/AoMR_Tsukuyomi_icon.png/revision/latest?cb=20251014162817', focus: 'Moon & Shadows', powers: ['Eclipse'], minorGods: ['Inari', 'Ebisu', 'Hachiman', 'Bishamonten', 'Izanami'] },

  // Chinese
  { id: 'fuxi', name: 'Fuxi', culture: 'Chinese', image: 'https://static.wikia.nocookie.net/ageofempires/images/1/13/AoMR_Fuxi_icon.png/revision/latest?cb=20250227215250', focus: 'Creation & Infantry', powers: ['Year of the Dragon'], minorGods: ['Sun Wukong', 'Zhong Kui', 'Chongli', 'Dabo Gong'] },
  { id: 'nuwa', name: 'Nuwa', culture: 'Chinese', image: 'https://static.wikia.nocookie.net/ageofempires/images/d/db/AoMR_Nuwa_icon.png/revision/latest?cb=20250227215252', focus: 'Harmony & Economy', powers: ['Recreation'], minorGods: ['Chang e', 'He Bo', 'Dabo Gong', 'Zhong Kui'] },
  { id: 'shennong', name: 'Shennong', culture: 'Chinese', image: 'https://static.wikia.nocookie.net/ageofempires/images/6/6b/AoMR_Shennong_icon.png/revision/latest?cb=20250227215249', focus: 'Agriculture & Siege', powers: ['Great Harvest'], minorGods: ['He Bo', 'Sun Wukong', 'Chongli', 'Chang e'] },

  // Aztec
  { id: 'quetzalcoatl', name: 'Quetzalcoatl', culture: 'Aztec', image: 'https://static.wikia.nocookie.net/ageofempires/images/5/5c/Quetzalcoatl_artwork_AoMR.webp/revision/latest?cb=20260407174032', focus: 'Wind & Wisdom', powers: ['Feathered Serpent'], minorGods: ['Tlaloc', 'Xipe Totec', 'Chalchiuhtlicue'] },
  { id: 'tezcatlipoca', name: 'Tezcatlipoca', culture: 'Aztec', image: 'https://static.wikia.nocookie.net/ageofempires/images/0/01/Tezcatlipoca_artwork_AoMR.webp/revision/latest?cb=20260407174030', focus: 'Night & Conflict', powers: ['Smoking Mirror'], minorGods: ['Mictlantecuhtli', 'Xipe Totec', 'Tonatiuh'] },
  { id: 'huitzilopochtli', name: 'Huitzilopochtli', culture: 'Aztec', image: 'https://static.wikia.nocookie.net/ageofempires/images/3/3e/Huitzilopochtli_artwork_AoMR.webp/revision/latest?cb=20260407174035', focus: 'Sun & War', powers: ['Blood Sacrifice'], minorGods: ['Tlaloc', 'Mictlantecuhtli', 'Tonatiuh'] },
];

export const MAJOR_GODS_BY_ID: Record<string, God> = MAJOR_GODS.reduce<Record<string, God>>((acc, god) => {
  acc[god.id] = god;
  return acc;
}, {});

const MAJOR_GODS_BY_LOWER_ID: Record<string, God> = MAJOR_GODS.reduce<Record<string, God>>((acc, god) => {
  acc[god.id.toLowerCase()] = god;
  return acc;
}, {});

export function getMajorGodById(godId: string | null | undefined): God | undefined {
  if (!godId) return undefined;
  return MAJOR_GODS_BY_ID[godId] ?? MAJOR_GODS_BY_LOWER_ID[godId.toLowerCase()];
}
