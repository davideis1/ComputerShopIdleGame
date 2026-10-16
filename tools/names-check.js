/* Guards the display names:  node tools/names-check.js
   1. Item ids are frozen (saves store stock, targets and buyer plans under them): compares every id list with
      tools/names-ids.json. Regenerate that file only when ids are meant to change.
   2. No real trademark and none of the retired puns may appear in anything a player can read.
   3. No "-ish" markers, and no two items in one group with the same name.
   PC hardware brand puns (Microsaft, Dall, Intal...) are allowed by design. */
const fs = require('fs');
const path = require('path');
const CS = require('../core');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// 1. ids
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'names-ids.json'), 'utf8'));
const now = { ADDONS: CS.ADDONS, CGAMES: CS.CGAMES, CACCS: CS.CACCS, CONSOLES: CS.CONSOLES, PLATFORMS: CS.PLATFORMS, GROUPS: CS.GROUPS, PRODUCTS: CS.PRODUCTS, PARTS: CS.PARTS };
Object.entries(gold).forEach(([k, ids]) => {
  const cur = now[k].map((x) => x.id);
  const same = cur.length === ids.length && cur.every((id, i) => id === ids[i]);
  ok(same, `ids unchanged: ${k} (${ids.length})` + (same ? '' : ' <- DIFFERENT, saved games would lose items'));
});

// every string a player can see
const strings = new Set();
(function walk(o, d) {
  if (d > 6 || o == null) return;
  if (typeof o === 'string') { if (o.length > 1 && !/^[a-z0-9_.]+$/.test(o)) strings.add(o); return; } // skip internal ids
  if (typeof o === 'function') return;
  if (Array.isArray(o)) return o.forEach((x) => walk(x, d + 1));
  if (typeof o === 'object') Object.values(o).forEach((x) => walk(x, d + 1));
})([CS.PRODUCTS, CS.PARTS, CS.UPGRADES, CS.TOKEN_UPGRADES, CS.EVENTS, CS.HEADLINES, CS.ACH, CS.ADDONS, CS.PLATFORMS, CS.CONSOLES, CS.CGAMES, CS.CACCS, CS.GROUPS, CS.ERAS], 0);

// 2. forbidden: real marks, and the retired puns
const REAL = ['Compaq', 'Gateway', 'Dell', 'Apple', 'Macintosh', 'MacBook', 'iMac', 'Microsoft', 'Windows', 'Intel', 'Pentium', 'Nvidia', 'GeForce', 'Radeon', 'Ryzen', 'Athlon', 'Kingston', 'Samsung', 'Logitech', 'Corsair', 'Seagate', 'Lenovo', 'Razer', 'Hewlett', 'Alienware', 'Surface', 'Nintendo', 'Sega', 'Sony', 'PlayStation', 'Xbox', 'Atari', 'Rockstar', 'Blizzard', 'Valve', 'Bethesda', 'Activision', 'Ubisoft', 'Capcom',
  'Konami', 'Namco', 'Mojang', 'Minecraft', 'Doom', 'Quake', 'Zelda', 'Mario', 'Metroid', 'Pokemon', 'Pokémon', 'Sonic', 'Tetris', 'Half-Life', 'Warcraft',
  'StarCraft', 'Diablo', 'Overwatch', 'Fallout', 'Skyrim', 'Elder Scrolls', 'Grand Theft Auto', 'Call of Duty', 'Halo', 'Forza', 'Gears of War', 'God of War',
  'Final Fantasy', 'Kingdom Hearts', 'Resident Evil', 'Metal Gear', "Assassin's Creed", 'Red Dead', 'Witcher', 'Cyberpunk 2077', 'Elden Ring', 'Dark Souls',
  'Bloodborne', 'Borderlands', 'BioShock', 'Left 4 Dead', 'Counter-Strike', 'Dota', 'Madden', 'FIFA', 'Tekken', 'Mortal Kombat', 'Smash Bros', 'Animal Crossing',
  'Splatoon', 'Donkey Kong', 'Crash Bandicoot', 'Spyro', 'Tomb Raider', 'SimCity', 'The Sims', 'Myst', 'Command & Conquer', 'Wing Commander', 'Civilization',
  'Uncharted', 'Last of Us', 'Spider-Man', 'Batman', 'Geocities', 'Stardew', 'Wukong', 'Hogwarts', 'Pac-Man', 'Kirby', 'Shenmue', 'Crazy Taxi', 'Gran Turismo',
  'Need for Speed', 'Guitar Hero', 'Battlefield', 'Burnout', 'Hitman', 'Advance Wars', 'Nintendogs', 'Brain Age', 'Monster Hunter', 'Phantasy Star',
  'Panzer Dragoon', 'Virtua Fighter', 'NiGHTS', 'Chrono Trigger', 'Alien vs Predator', 'Duke Nukem', 'Rayman', 'Age of Empires', "Baldur's Gate", 'Cuphead',
  'Dreamcast', 'GameCube', 'Game Boy', 'DualSense', 'Mega Drive', 'No Man', 'Rogue Legacy', 'Hello Games', 'Blue Yeti', 'Elgato', 'Targus', 'USRobotics'];
const LEGACY = ['Compac', 'Packerd', 'Gatewhey', 'Dall', 'Ample', 'Macintoss', 'MacBuck', 'iMack', 'Microsaft', 'Windoze', 'Intal', 'Pentum', 'Envidia', 'GoForce', 'Radian', 'Rizen', 'Athalon', 'Kingstun', 'Samsong', 'Logitec', 'Corsiar', 'Seagull', 'Linucks', 'Lenovoh', 'Rayzer', 'Hewlitt', 'Chromebooq', 'eMachinez', 'Alienwear', 'Surfaced', 'Pavillion', 'Cyrex', 'Matroxx', 'Voodude', 'Tridant', 'DeathAdder', 'Sound Blister', 'Quantam', 'Crucible', 'Netgeer', 'Linksis', 'Epsom', 'Cannon', 'Oculous', 'Thrustmasterz', 'SteelSeres', 'ViewSonik', 'Ioomega', 'Altec Lansink', 'Turtle Beech', 'HyperZ', 'Nintendough', 'PlayStatic', 'Xbux', 'Seegah', 'Atarri', '3DOh', 'Game Boi', 'Pokemun', 'Soniq', 'Maria', 'Zalda', 'Haylo', 'Warkraft', 'Doomed',
  'Quaked', 'Diablow', 'Lifespan', 'Skyrimm', 'Minecrafty', 'Overwatchful', 'Starfeld', 'Forzza', 'Kingdumb', 'Metroidal', 'Tekkin', 'Tetrus', 'Unchartered',
  'Bloodborn', 'Turismoo', 'Auto-mobile', 'Duty-Free', 'Warfare-house', 'Evile', 'Solidish', 'Redumption', 'Screed', 'Counter-Strife', 'Dork Souls', 'Elden Rung',
  'Soni\\b', 'Swatch', 'Wee\\b', 'Fantasia', 'Brawl Ultimate', 'Kombot', 'Jamm', 'FIFO', 'Maddon'];
const rx = (list) => new RegExp('(?<![A-Za-z])(' + list.map((w) => (w.endsWith('\\b') ? w : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('|') + ')(?![a-z])', 'i');
const realRx = rx(REAL), legacyRx = rx(LEGACY);
const hit = (re) => [...strings].filter((s) => re.test(s));
const real = hit(realRx), legacy = hit(legacyRx), ish = [...strings].filter((s) => /-ish\b/i.test(s));
ok(real.length === 0, `no real trademarks in ${strings.size} player-visible strings` + (real.length ? ': ' + real.slice(0, 8).join(' | ') : ''));
ok(legacy.length === 0, 'none of the retired puns come back' + (legacy.length ? ': ' + legacy.slice(0, 8).join(' | ') : ''));
ok(ish.length === 0, 'no "-ish" markers' + (ish.length ? ': ' + ish.slice(0, 8).join(' | ') : ''));

// 3. duplicates within a group (ids are unique, but identical names would confuse players)
const dupes = [];
const seen = {};
[...CS.ADDONS.map((a) => [a.group, a.brand + ' ' + a.name]), ...CS.CGAMES.map((g) => [g.group, g.name + ' ' + g.year]), ...CS.CACCS.map((a) => [a.plat + a.type, a.name + ' ' + a.year])]
  .forEach(([grp, label]) => { const k = grp + '|' + label; if (seen[k]) dupes.push(label); seen[k] = 1; });
ok(dupes.length === 0, 'no two items in a group share a name' + (dupes.length ? ': ' + dupes.slice(0, 5).join(' | ') : ''));

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
