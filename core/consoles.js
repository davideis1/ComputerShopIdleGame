/* Console gaming: parody platforms and generations, consoles, console games and accessories.
   Loaded after engine.js; the engine and managers call into CS.Con at a few hook points.
   Every platform, title and brand is a parody. */
(function (g) {
  const CS = (g.CS = g.CS || {});
  const E = CS.E;
  const C = CS.C;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);

  /* ---------- platforms ----------
     year: launch (US); end: last year it is manufactured; size: relative market weight;
     hype: launch-frenzy demand boost; short: years of limited supply after launch */
  const PL = [
    // generation 4
    ['genesys', 'Seegah Genesys', 'Seegah', 1989, 1996, 0.8, 149, 0, 0.3, 0],
    ['snes', 'Super Nintendough', 'Nintendough', 1991, 1997, 1.0, 199, 0, 0.3, 0],
    ['gboi', 'Game Boi', 'Nintendough', 1989, 1998, 0.9, 89, 1, 0.3, 0],
    ['jaguaar', 'Atarri Jaguaar', 'Atarri', 1993, 1996, 0.15, 249, 0, 0.8, 0.3],
    ['3doh', '3DOh! Interactive Multiplayer', '3DOh!', 1993, 1995, 0.08, 699, 0, 0.6, 0.3],
    // generation 5
    ['saturn', 'Seegah Saturn', 'Seegah', 1995, 1998, 0.5, 399, 0, 1.2, 0.3],
    ['ps1', 'PlayStatic', 'Soni', 1995, 2005, 1.3, 299, 0, 1.6, 0.4],
    ['n64', 'Nintendough 64', 'Nintendough', 1996, 2002, 0.9, 199, 0, 1.8, 0.4],
    ['gbc', 'Game Boi Color', 'Nintendough', 1998, 2003, 0.8, 79, 1, 0.8, 0],
    // generation 6
    ['dc', 'Seegah Dreamcatcher', 'Seegah', 1999, 2001, 0.4, 199, 0, 1.5, 0.3],
    ['ps2', 'PlayStatic 2', 'Soni', 2000, 2012, 1.6, 299, 0, 2.5, 0.8],
    ['gcn', 'Nintendough GameBlock', 'Nintendough', 2001, 2007, 0.7, 199, 0, 1.0, 0.3],
    ['xb', 'Xbux', 'Microsaft', 2001, 2006, 0.8, 299, 0, 1.4, 0.4],
    ['gba', 'Game Boi Advanced', 'Nintendough', 2001, 2008, 0.9, 99, 1, 0.8, 0],
    // generation 7
    ['ds', 'Nintendough DoubleScreen', 'Nintendough', 2004, 2013, 1.1, 149, 1, 1.0, 0.2],
    ['psp', 'PlayStatic Portable', 'Soni', 2005, 2014, 0.6, 249, 1, 0.9, 0.2],
    ['x360', 'Xbux 360', 'Microsaft', 2005, 2016, 1.3, 299, 0, 2.0, 0.6],
    ['ps3', 'PlayStatic 3', 'Soni', 2006, 2017, 1.2, 499, 0, 2.2, 0.7],
    ['wee', 'Nintendough Wee', 'Nintendough', 2006, 2013, 1.3, 249, 0, 3.0, 1.0],
    // generation 8
    ['3ds', 'Nintendough 3DX', 'Nintendough', 2011, 2020, 0.7, 249, 1, 0.8, 0.2],
    ['weeu', 'Nintendough Wee-U', 'Nintendough', 2012, 2017, 0.3, 299, 0, 0.8, 0.2],
    ['ps4', 'PlayStatic 4', 'Soni', 2013, 2024, 1.3, 399, 0, 2.0, 0.6],
    ['xone', 'Xbux One', 'Microsaft', 2013, 2020, 0.9, 499, 0, 1.4, 0.4],
    ['swatch', 'Nintendough Swatch', 'Nintendough', 2017, 2025, 1.5, 299, 1, 2.5, 0.8],
    // generation 9
    ['ps5', 'PlayStatic 5', 'Soni', 2020, 2032, 1.3, 499, 0, 3.0, 1.2],
    ['xsx', 'Xbux Series X', 'Microsaft', 2020, 2032, 0.9, 499, 0, 1.8, 0.8],
    ['xss', 'Xbux Series S', 'Microsaft', 2020, 2032, 0.6, 299, 0, 1.5, 0.6],
    ['swatch2', 'Nintendough Swatch 2', 'Nintendough', 2025, 2035, 1.5, 449, 1, 3.0, 0.8],
    // generation 10 (Near Future; already final names, see names.js)
    ['xspire', 'Obelisk Spire', 'Obelisk Digital', 2027, 2037, 0.9, 649, 0, 1.8, 0.8],
    ['ps6', 'Nimbus Six', 'Nimbus Systems', 2028, 2038, 1.3, 599, 0, 3.0, 1.2],
    ['visor', 'Orbitron Ring Visor', 'Orbitron', 2030, 2037, 0.5, 399, 1, 1.6, 0.4],
    ['hybrid3', 'Hanami Hybrid 3', 'Hanami Toys', 2032, 2040, 1.5, 499, 1, 3.0, 0.8],
  ];
  CS.PLATFORMS = PL.map(([id, name, maker, year, end, size, price, hand, hype, short]) => ({ id, name, maker, year, end, size, price, hand: !!hand, hype, short }));
  CS.PLAT_BY_ID = {};
  CS.PLATFORMS.forEach((p) => (CS.PLAT_BY_ID[p.id] = p));

  // hardware revisions: platform, name, year, price
  const REV = [
    ['ps2', 'PlayStatic 2 Slim', 2004, 149], ['gba', 'Game Boi Advanced SP', 2003, 99], ['ds', 'Nintendough DS Lite', 2006, 129],
    ['ps3', 'PlayStatic 3 Slim', 2009, 299], ['x360', 'Xbux 360 S', 2010, 199], ['ps4', 'PlayStatic 4 Slim', 2016, 299],
    ['ps4', 'PlayStatic 4 Pro', 2016, 399], ['xone', 'Xbux One X', 2017, 499], ['swatch', 'Nintendough Swatch OLED', 2021, 349],
    ['ps5', 'PlayStatic 5 Slim', 2023, 449], ['ps5', 'PlayStatic 5 Pro', 2024, 699],
    ['ps6', 'Nimbus Six Slim', 2032, 499], ['xspire', 'Obelisk Spire Lite', 2031, 449],
  ];
  CS.CONSOLES = CS.PLATFORMS.map((p) => ({ id: p.id, plat: p.id, name: p.name, year: p.year, price: p.price, m: p.hand ? 0.12 : 0.08, q: 1, icon: p.hand ? '🕹️' : '🎮' }))
    .concat(REV.map(([plat, name, year, price]) => ({ id: plat + '_' + slug(name), plat, name, year, price, m: 0.09, q: 1.05, icon: CS.PLAT_BY_ID[plat].hand ? '🕹️' : '🎮' })));

  /* ---------- games ---------- */
  // platform, title, year, price, quality
  const EXCL = [
    ['genesys', 'Soniq the Hedgehog 2', 1992, 50, 1.1], ['genesys', 'Streets of Rampage 2', 1993, 50, 1.0], ['genesys', 'Phantasy Star-ish IV', 1993, 70, 1.0],
    ['snes', 'Super Maria World', 1991, 55, 1.4], ['snes', 'The Legend of Zalda: A Link to the Pasta', 1992, 60, 1.3], ['snes', 'Donkey Kang Country', 1994, 60, 1.2],
    ['snes', 'Super Metroidal', 1994, 60, 1.1], ['snes', 'Chrono Trigger Happy', 1995, 70, 1.2], ['snes', 'Maria Kart', 1992, 55, 1.2],
    ['gboi', 'Tetrus', 1989, 30, 1.2], ['gboi', 'Pokemun Red & Blue', 1998, 35, 1.5], ['gboi', 'Super Maria Land', 1989, 30, 1.0],
    ['jaguaar', 'Alien vs Predator-ish', 1994, 60, 0.9], ['jaguaar', 'Tempest 2001-ish', 1994, 55, 0.8],
    ['3doh', 'Road Rashed', 1994, 60, 0.9], ['3doh', 'Gex the Gecko', 1994, 55, 0.8],
    ['saturn', 'Virtua Fighters 2', 1995, 60, 1.1], ['saturn', 'Nights into Dreamz', 1996, 60, 1.0], ['saturn', 'Panzer Dragoon Saga-ish', 1998, 70, 0.9],
    ['ps1', 'Crash Bandi-coot', 1996, 50, 1.2], ['ps1', 'Gran Turismoo', 1998, 50, 1.3], ['ps1', 'Final Fantasia VII', 1997, 60, 1.5],
    ['ps1', 'Metal Gear Solidish', 1998, 50, 1.3], ['ps1', 'Spyro the Dragoon', 1998, 40, 1.1], ['ps1', 'Resident Evile', 1996, 50, 1.2],
    ['n64', 'Super Maria 64', 1996, 60, 1.5], ['n64', 'GoldenEye 700', 1997, 60, 1.3], ['n64', 'The Legend of Zalda: Ocarina of Thyme', 1998, 60, 1.6], ['n64', 'Maria Kart 64', 1997, 60, 1.3],
    ['gbc', 'Pokemun Gold & Silver', 2000, 35, 1.4], ['gbc', 'The Legend of Zalda: Link\'s Wakening', 1998, 30, 1.1],
    ['dc', 'Soniq Adventure', 1999, 50, 1.2], ['dc', 'Shenmoo', 1999, 60, 1.2], ['dc', 'Crazy Cab', 2000, 40, 1.1],
    ['ps2', 'Gran Turismoo 3', 2001, 50, 1.4], ['ps2', 'Metal Gear Solidish 2', 2001, 50, 1.3], ['ps2', 'Final Fantasia X', 2001, 50, 1.4], ['ps2', 'Kingdumb Hearts', 2002, 50, 1.3], ['ps2', 'God of Warr', 2005, 50, 1.5],
    ['gcn', 'Super Maria Sunshine', 2002, 50, 1.2], ['gcn', 'Metroidal Prime', 2002, 50, 1.3], ['gcn', 'The Legend of Zalda: The Wind Waker-ish', 2003, 50, 1.3],
    ['xb', 'Haylo: Combat Evolved', 2001, 50, 1.5], ['xb', 'Haylo 2', 2004, 50, 1.5], ['xb', 'Fable-ish', 2004, 50, 1.2],
    ['gba', 'Pokemun Ruby & Sapphire', 2003, 35, 1.3], ['gba', 'Maria Kart: Super Circuit', 2001, 35, 1.0], ['gba', 'Advance Wars-ish', 2001, 35, 1.0],
    ['ds', 'New Super Maria Bros.', 2006, 35, 1.4], ['ds', 'Nintendogz', 2005, 30, 1.2], ['ds', 'Brain Age-ish Training', 2006, 30, 1.1], ['ds', 'Pokemun Diamond & Pearl', 2006, 35, 1.3],
    ['psp', 'Monster Hunter Freedom-ish', 2005, 40, 1.1], ['psp', 'God of Warr: Chains', 2008, 40, 1.1], ['psp', 'Gran Turismoo Portable', 2009, 40, 1.0],
    ['x360', 'Gears of Warfare', 2006, 60, 1.4], ['x360', 'Haylo 3', 2007, 60, 1.5], ['x360', 'Forzza Motorsport 2', 2007, 60, 1.2],
    ['ps3', 'Unchartered', 2007, 60, 1.3], ['ps3', 'Metal Gear Solidish 4', 2008, 60, 1.3], ['ps3', 'The Last of Uz', 2013, 60, 1.6],
    ['wee', 'Wee Sports', 2006, 40, 1.2], ['wee', 'Super Maria Galaxy', 2007, 50, 1.5], ['wee', 'Maria Kart Wee', 2008, 50, 1.4], ['wee', 'Wee Fit-ish', 2008, 90, 1.0],
    ['3ds', 'Animal Crossing: New Leafy', 2012, 40, 1.3], ['3ds', 'Pokemun X & Y', 2013, 40, 1.4], ['3ds', 'Super Maria 3D Land', 2011, 40, 1.1],
    ['weeu', 'Super Maria 3D World', 2013, 60, 1.3], ['weeu', 'Maria Kart 8', 2014, 60, 1.3], ['weeu', 'Splatoon-ish', 2015, 60, 1.2],
    ['ps4', 'Bloodborn', 2015, 60, 1.4], ['ps4', 'Horizon Zero Dusk', 2017, 60, 1.4], ['ps4', 'God of Warr (2018)', 2018, 60, 1.6], ['ps4', 'Spider-Dude', 2018, 60, 1.5],
    ['xone', 'Haylo 5', 2015, 60, 1.3], ['xone', 'Forzza Horizon 3', 2016, 60, 1.3], ['xone', 'Gears of Warfare 4', 2016, 60, 1.2],
    ['swatch', 'The Legend of Zalda: Breath of the Mild', 2017, 60, 1.8], ['swatch', 'Super Maria Odyssee', 2017, 60, 1.6], ['swatch', 'Super Smash Brawl Ultimate', 2018, 60, 1.5],
    ['swatch', 'Pokemun Sword & Shield', 2019, 60, 1.3], ['swatch', 'Animal Crossing: New Horizons-ish', 2020, 60, 1.7],
    ['ps5', 'Astro-Bot Playroom', 2020, 0.01, 0], ['ps5', 'Spider-Dude: Miles Moral-es', 2020, 50, 1.3], ['ps5', 'God of Warr Ragnarok-ish', 2022, 70, 1.6], ['ps5', 'Final Fantasia XVI', 2023, 70, 1.3], ['ps5', 'Spider-Dude 2', 2023, 70, 1.5],
    ['xsx', 'Haylo Infinite', 2021, 60, 1.2], ['xsx', 'Forzza Horizon 5', 2021, 60, 1.4], ['xsx', 'Starfeld', 2023, 70, 1.3], ['xsx', 'Forzza Motorsport (2023)', 2023, 70, 1.2],
    ['xss', 'Haylo Infinite', 2021, 60, 1.2], ['xss', 'Forzza Horizon 5', 2021, 60, 1.4],
    ['xspire', 'Starhelm: Reclaim', 2027, 70, 1.4], ['xspire', 'Velocity Circuit', 2029, 70, 1.3],
    ['ps6', 'Starfall Saga', 2028, 80, 1.5], ['ps6', 'Ronin Tide', 2029, 80, 1.4], ['ps6', 'Gearhound', 2031, 70, 1.3],
    ['visor', 'Hoverboard Hero', 2030, 50, 1.2], ['visor', 'Ghost Signal', 2031, 50, 1.2],
    ['hybrid3', 'Super Petal Quest', 2032, 70, 1.6], ['hybrid3', 'Kart Kingdoms', 2032, 70, 1.5], ['hybrid3', 'Pocket Critters: Nebula', 2033, 60, 1.4],
    ['swatch2', 'Maria Kart 9 World', 2025, 80, 1.7], ['swatch2', 'The Legend of Zalda: Echoes of Pasta', 2025, 70, 1.5], ['swatch2', 'Donkey Kang Bananza-ish', 2025, 70, 1.4], ['swatch2', 'Pokemun Legends Z-A-ish', 2025, 60, 1.3],
  ].filter((r) => r[3] >= 1);

  // title, year, platforms, price, quality: one franchise release across several platforms
  const MULTI = [
    ['Mortal Kombot', 1993, ['genesys', 'snes'], 60, 1.3], ['NBA Jamm', 1994, ['genesys', 'snes'], 60, 1.1], ['FIFO Soccer 96', 1995, ['genesys', 'snes', 'saturn', 'ps1'], 50, 1.0],
    ['Maddon NFL 97', 1996, ['genesys', 'snes', 'ps1', 'saturn'], 50, 1.0], ['Tomb Raidar', 1996, ['saturn', 'ps1'], 55, 1.2], ['Tekkin 3', 1998, ['ps1'], 50, 1.3],
    ['WWF War-Zone-ish', 1998, ['n64', 'ps1'], 55, 1.0], ['Rayman-ish Rascals 2', 1999, ['dc', 'ps1', 'n64'], 45, 1.0], ['Resident Evile 2', 1998, ['ps1', 'n64'], 55, 1.3],
    ['Tony Hawke\'s Skate Pro 3', 2001, ['ps1', 'dc', 'ps2', 'xb', 'gcn'], 50, 1.2], ['Grand Theft Auto-mobile III', 2001, ['ps2'], 50, 1.6], ['Grand Theft Auto-mobile: Vice Town', 2002, ['ps2', 'xb'], 50, 1.5],
    ['Grand Theft Auto-mobile: San Andreaz', 2004, ['ps2', 'xb'], 50, 1.6], ['Call of Duty-Free', 2003, ['ps2', 'xb', 'gcn'], 50, 1.2], ['Need for Speedy Underground', 2003, ['ps2', 'xb', 'gcn', 'gba'], 50, 1.2],
    ['Maddon NFL 2005', 2004, ['ps2', 'xb', 'gcn'], 50, 1.1], ['Resident Evile 4', 2005, ['gcn', 'ps2', 'wee'], 50, 1.5], ['Burnout-ish 3', 2004, ['ps2', 'xb'], 40, 1.1],
    ['Call of Duty-Free: Modern Warfare-house', 2007, ['x360', 'ps3'], 60, 1.6], ['Grand Theft Auto-mobile IV', 2008, ['x360', 'ps3'], 60, 1.6], ['Assassin\'s Screed', 2007, ['x360', 'ps3'], 60, 1.2],
    ['Fallout-ish 3', 2008, ['x360', 'ps3'], 60, 1.3], ['Red Dead Redumption', 2010, ['x360', 'ps3'], 60, 1.5], ['Skyrimm', 2011, ['x360', 'ps3'], 60, 1.6], ['Minecrafty', 2012, ['x360', 'ps3'], 20, 1.3],
    ['Guitar Hero-ish III', 2007, ['x360', 'ps3', 'wee', 'ps2'], 100, 1.1], ['Batman-ish: Arkham Asylum Seeker', 2009, ['x360', 'ps3'], 60, 1.3], ['Battlefield-ish 3', 2011, ['x360', 'ps3'], 60, 1.2],
    ['Grand Theft Auto-mobile V', 2013, ['x360', 'ps3'], 60, 1.7], ['Grand Theft Auto-mobile V', 2014, ['ps4', 'xone'], 60, 1.7], ['Call of Duty-Free: Black Opps III', 2015, ['ps4', 'xone'], 60, 1.3],
    ['The Which-er 3', 2015, ['ps4', 'xone'], 60, 1.6], ['FIFO 17', 2016, ['ps4', 'xone'], 60, 1.1], ['Overwatchful', 2016, ['ps4', 'xone'], 40, 1.2], ['Minecrafty', 2014, ['ps4', 'xone'], 20, 1.3],
    ['Red Dead Redumption 2', 2018, ['ps4', 'xone'], 60, 1.8], ['Assassin\'s Screed Odyssee', 2018, ['ps4', 'xone'], 60, 1.3], ['Cyberpunk 2078', 2020, ['ps4', 'xone'], 60, 0.9],
    ['Minecrafty', 2018, ['swatch'], 30, 1.3], ['Doomed Eternal', 2020, ['ps4', 'xone', 'swatch'], 60, 1.4],
    ['Call of Duty-Free: Modern Warfare-house III', 2023, ['ps5', 'xsx', 'xss'], 70, 1.2], ['Elden Rung', 2022, ['ps5', 'xsx', 'xss'], 60, 1.7], ['Hogwash Legacy', 2023, ['ps5', 'xsx', 'swatch'], 70, 1.3],
    ['Black Myth: Wuking', 2024, ['ps5'], 60, 1.5], ['Monster Hunter Wildz', 2025, ['ps5', 'xsx'], 70, 1.4], ['Grand Theft Auto-mobile VI', 2026, ['ps5', 'xsx'], 80, 2.0],
    ['Chromecity 2091', 2027, ['ps5', 'xsx', 'xspire'], 70, 1.3], ['Pro Pitch FC 29', 2028, ['ps6', 'xspire', 'ps5', 'swatch2'], 70, 1.1], ['Pale Throne', 2028, ['ps6', 'xspire'], 70, 1.6],
    ['Carjack City VII', 2032, ['ps6', 'xspire'], 90, 1.9], ['Holo Arena Live', 2031, ['ps6', 'xspire', 'visor'], 40, 1.3],
    ['Cyberpunk 2078', 2020, ['ps5', 'xsx'], 60, 1.0], ['Baldur\'s Gate 3', 2023, ['ps5', 'xsx'], 60, 1.7], ['EA Sports FC 25', 2024, ['ps5', 'xsx', 'xss', 'ps4'], 70, 1.1],
  ];
  CS.CGAMES = [];
  const seen = {};
  const addGame = (plat, title, year, price, q) => {
    const id = plat + '_' + slug(title) + year;
    if (seen[id]) return;
    seen[id] = 1;
    CS.CGAMES.push({ id, plat, group: 'cg_' + plat, name: title, year, price, m: 0.27, q, icon: '💿' });
  };
  EXCL.forEach(([plat, title, year, price, q]) => addGame(plat, title, year, price, q));
  MULTI.forEach(([title, year, plats, price, q]) => plats.forEach((p) => addGame(p, title, year, price, q)));
  CS.CGAME_BY_ID = {};
  CS.CGAMES.forEach((x) => (CS.CGAME_BY_ID[x.id] = x));

  /* ---------- console accessories ---------- */
  CS.CACCS = [];
  const addAcc = (type, plat, name, year, price, m, q, icon) => CS.CACCS.push({ id: plat + '_' + slug(name) + year, type, group: type, plat, name, year, price, m, q, icon });
  CS.PLATFORMS.forEach((p) => {
    const gen = p.year;
    addAcc('cctrl', p.id, p.name + ' Controller', p.year, p.hand ? 25 : gen < 2000 ? 30 : gen < 2012 ? 45 : 60, 0.38, 1, '🎛️');
    if (p.year >= 1995 && p.year <= 2005 && !p.hand) addAcc('cmem', p.id, p.name + ' Memory Card', p.year, 20, 0.5, 1, '💾');
    if (p.hand) addAcc('caud', p.id, p.name + ' Carry Case & Screen Guard', p.year, 15, 0.55, 1, '👜');
    if (p.year >= 2005 && !p.hand) addAcc('caud', p.id, p.name + ' Headset', p.year + 0.2, 60, 0.4, 1.1, '🎧');
    if (p.year >= 2013 && !p.hand) addAcc('cmem', p.id, p.name + ' Extra Storage Drive', p.year + 1, 90, 0.3, 1.2, '💽');
  });
  [
    ['cctrl', 'xone', 'Xbux Elite Controller', 2015, 150, 0.35, 1.5, '🎛️'], ['cctrl', 'ps5', 'PlayStatic DualSense Edge', 2023, 200, 0.35, 1.7, '🎛️'],
    ['cctrl', 'swatch', 'Swatch Pro Controller', 2017, 70, 0.35, 1.4, '🎛️'], ['cctrl', 'wee', 'Wee Motion Plus Add-On', 2009, 20, 0.45, 1.0, '🎛️'],
    ['cctrl', 'n64', 'Nintendough 64 Rumble Pak', 1997, 20, 0.5, 1.1, '🎛️'], ['cmem', 'ps5', 'PlayStatic 5 NVMe Expansion 1TB', 2022, 130, 0.3, 1.5, '💽'],
    ['cmem', 'xsx', 'Xbux Storage Expansion Card 1TB', 2020, 220, 0.25, 1.4, '💽'], ['caud', 'ps4', 'PlayStatic VR Headset', 2016, 300, 0.2, 1.3, '🥽'],
    ['caud', 'swatch', 'Swatch Dock & Travel Case Set', 2018, 40, 0.5, 1.2, '👜'], ['caud', 'ps5', 'PlayStatic Pulse 3D Headset', 2020, 100, 0.4, 1.5, '🎧'],
  ].forEach((r) => addAcc(...r));
  CS.CACC_BY_ID = {};
  CS.CACCS.forEach((x) => (CS.CACC_BY_ID[x.id] = x));

  /* ---------- groups (so the add-on machinery can treat them like other groups) ---------- */
  const G = [];
  CS.PLATFORMS.forEach((p) => G.push({ id: 'cg_' + p.id, kind: 'cgame', plat: p.id, name: p.name + ' games', icon: '💿', A: 1.6, ref: 45, grow: 1.01, decay: 1.3, size: 0.04, pack: 10, window: 5 }));
  G.push({ id: 'cctrl', kind: 'cacc', name: 'Controllers', icon: '🎛️', A: 0.9, ref: 45, grow: 1.01, decay: 1.1, size: 0.1, pack: 6, window: 10 });
  G.push({ id: 'cmem', kind: 'cacc', name: 'Memory & storage', icon: '💾', A: 0.5, ref: 40, grow: 1.01, decay: 1.1, size: 0.05, pack: 8, window: 10 });
  G.push({ id: 'caud', kind: 'cacc', name: 'Headsets & gear', icon: '🎧', A: 0.45, ref: 50, grow: 1.01, decay: 1.1, size: 0.1, pack: 6, window: 10 });
  G.forEach((x) => { CS.GROUPS.push(x); CS.GROUP_BY_ID[x.id] = x; });

  /* ---------- market model ---------- */
  const A_HW = 0.2; // share of shoppers wanting a console at all (before price/appeal)
  const consoleRef = (y) => 300 * Math.pow(1.012, y - 1993);
  const SIZE = { c: 0.4, x: 0.04, y: 0.1 };
  let mcache = { k: -1, v: null };
  /** Share of shoppers who own each platform at year y (sums to the console-owning fraction of the population). */
  function marketShares(y) {
    const k = Math.round(y * 100);
    if (mcache.k === k) return mcache.v;
    const raw = {};
    let sum = 0;
    CS.PLATFORMS.forEach((p) => {
      const age = y - p.year;
      if (age < 0) { raw[p.id] = 0; return; }
      const v = p.size * (1 - Math.exp(-age / 1.3)) * (y <= p.end ? 1 : Math.exp(-(y - p.end) / 2.5));
      raw[p.id] = v; sum += v;
    });
    const own = clamp(0.22 + 0.015 * (y - 1993), 0.22, 0.68);
    const out = {};
    CS.PLATFORMS.forEach((p) => (out[p.id] = sum > 0 ? (own * raw[p.id]) / sum : 0));
    mcache = { k, v: out };
    return out;
  }
  const loyalty = (s, plat, served) => {
    const ib = (s.ib && s.ib[plat]) || 0;
    return ib / (ib + 8 + 30 * served);
  };
  const ownerEff = (s, d, plat, served, shares) => shares[plat] * (0.5 + 1.5 * loyalty(s, plat, served));

  function status(p, y) {
    if (y < p.year) return 'upcoming';
    if (y - p.year < 0.6) return 'launching';
    if (y <= p.end - 2) return 'peak';
    if (y <= p.end) return 'fading';
    return 'legacy';
  }

  /* ---------- engine hooks ---------- */
  function addItems(s, d, out) {
    const served = Math.min(d.lambda, d.serve);
    const shares = marketShares(d.y);
    const open = d.aisleConsole;
    CS.CONSOLES.forEach((c) => {
      if (c.year > d.y) return;
      const pl = CS.PLAT_BY_ID[c.plat];
      const key = 'c:' + c.id;
      const stock = s.stock[key] || 0;
      const buyable = open && d.y <= pl.end + 1.5;
      if (!buyable && !stock) return;
      const age = d.y - c.year, pAge = d.y - pl.year;
      const base = c.price * Math.max(0.35, Math.pow(0.88, age));
      const fade = d.y <= pl.end ? 1 : Math.exp(-(d.y - pl.end) / 2.5);
      const hype = pAge < 2 ? pl.hype * Math.exp(-pAge / 0.5) : 0;
      const it = {
        key, kind: 'console', id: c.id, def: c, name: c.name, brand: pl.maker, icon: c.icon, plat: c.plat, group: null,
        size: SIZE.c, pack: 1, age, rel: c.q * Math.pow(1.12, -age) * (0.6 + 0.4 * fade), hype,
        price: base * (1 + s.priceAdj), cost: base * (1 - c.m) * (1 - d.disc), stock, buyable, target: s.target[key] || 0, capF: 1, ref: consoleRef(d.y),
      };
      if (pAge >= 0 && pAge < pl.short) { // launch allocation: retailers can only hold so many, and pay a premium
        it.allocCap = Math.ceil((4 + served * 150) * (0.15 + (0.85 * pAge) / pl.short));
        it.cost *= 1.05;
        it.limited = true;
      }
      out.push(it);
    });
    CS.CGAMES.forEach((gm) => {
      if (gm.year > d.y) return;
      const pl = CS.PLAT_BY_ID[gm.plat];
      const key = 'x:' + gm.id;
      const stock = s.stock[key] || 0;
      const age = d.y - gm.year;
      const buyable = open && age <= 5 && d.y <= pl.end + 3;
      if (!buyable && !stock) return;
      const base = gm.price * Math.max(0.3, Math.pow(0.8, age));
      out.push({
        key, kind: 'cgame', id: gm.id, def: gm, name: gm.name, brand: pl.name, icon: gm.icon, plat: gm.plat, group: gm.group,
        size: SIZE.x, pack: 10, age, rel: gm.q * Math.pow(1.3, -age), price: base * (1 + s.priceAdj),
        cost: base * (1 - gm.m) * (1 - d.disc), stock, buyable, target: s.target[key] || 0, capF: ownerEff(s, d, gm.plat, served, shares), owners: shares[gm.plat],
      });
    });
    CS.CACCS.forEach((a) => {
      if (a.year > d.y) return;
      const pl = CS.PLAT_BY_ID[a.plat];
      const key = 'y:' + a.id;
      const stock = s.stock[key] || 0;
      const age = d.y - a.year;
      const buyable = open && age <= 10 && d.y <= pl.end + 4;
      if (!buyable && !stock) return;
      const base = a.price * Math.max(0.4, Math.pow(0.9, age));
      out.push({
        key, kind: 'cacc', id: a.id, def: a, name: a.name, brand: pl.name, icon: a.icon, plat: a.plat, group: a.group,
        size: SIZE.y, pack: 6, age, rel: a.q * Math.pow(1.1, -age), price: base * (1 + s.priceAdj),
        cost: base * (1 - a.m) * (1 - d.disc), stock, buyable, target: s.target[key] || 0, capF: ownerEff(s, d, a.plat, served, shares), owners: shares[a.plat],
      });
    });
  }

  function size(key) {
    return SIZE[key[0]] || 1;
  }

  function stat(s, it, k, rev) {
    if (it.kind === 'console') { s.stats.soldConsoles = (s.stats.soldConsoles || 0) + k; s.stats.consoleRevenue = (s.stats.consoleRevenue || 0) + rev; }
    else if (it.kind === 'cgame') { s.stats.soldCGames = (s.stats.soldCGames || 0) + k; s.stats.addonRevenue += rev; }
    else { s.stats.soldCAcc = (s.stats.soldCAcc || 0) + k; s.stats.addonRevenue += rev; }
  }
  function noteSale(s, it, k) {
    if (it.kind === 'console') {
      s.ib = s.ib || {};
      s.ib[it.plat] = (s.ib[it.plat] || 0) + k;
    }
  }
  function tick(s, dt) {
    if (!s.ib) return;
    const f = Math.exp(-dt / (C.YEAR_SECONDS * 8)); // an installed base fades over years as people move on
    for (const k in s.ib) { s.ib[k] *= f; if (s.ib[k] < 1e-3) delete s.ib[k]; }
  }

  /** Expected units per second of consoles, console games and console accessories if exactly `set` were stocked. */
  function rates(set, d, served, pcShare, s) {
    const out = {};
    const SEG = E.SEG, K = E.K;
    const shares = marketShares(d.y);
    const hw = set.filter((i) => i.kind === 'console');
    let cRate = 0;
    if (hw.length) {
      const ex = new Array(hw.length).fill(0);
      SEG.forEach((seg) => {
        const ws = hw.map((i) => E.itemWeight(seg, i.rel * (1 + i.hype), i.price, d.y, i.ref));
        const tot = ws.reduce((a, b) => a + b, 0);
        if (tot <= 0) return;
        const p = Math.min(0.95, 1 - Math.exp(-tot / K));
        for (let i = 0; i < hw.length; i++) ex[i] += (served * seg.share * p * ws[i]) / tot * A_HW * E.kindBoost(d, 'console');
      });
      hw.forEach((i, k) => { out[i.key] = ex[k]; cRate += ex[k]; });
    }
    const cShare = served > 0 ? clamp(cRate / served, 0, 1) : 0;
    const attach = (1 + Math.min(1, pcShare + cShare)) * (1 + d.upsell) * E.ADDON_SCALE;
    CS.GROUPS.forEach((grp) => {
      if (grp.kind !== 'cgame' && grp.kind !== 'cacc') return;
      const gi = set.filter((i) => i.group === grp.id);
      if (!gi.length) return;
      const ref = grp.ref * Math.pow(grp.grow, d.y - 1993);
      const ex = new Array(gi.length).fill(0);
      SEG.forEach((seg) => {
        const ws = gi.map((i) => E.itemWeight(seg, i.rel, i.price, d.y, ref) * i.capF);
        const tot = ws.reduce((a, b) => a + b, 0);
        if (tot <= 0) return;
        const p = Math.min(0.95, 1 - Math.exp(-tot / K));
        for (let i = 0; i < gi.length; i++) ex[i] += ((served * seg.share * p * ws[i]) / tot) * grp.A * attach * E.kindBoost(d, grp.kind);
      });
      gi.forEach((i, k) => (out[i.key] = ex[k]));
    });
    return { rates: out, consoleShare: cShare };
  }

  /** Called from the engine's step(): sells consoles, console games and accessories. Returns revenue. */
  function sell(s, d, items, served, pcShare, dt, rep, events) {
    if (!d.aisleConsole || served <= 0) return 0;
    const live = items.filter((i) => (i.kind === 'console' || i.kind === 'cgame' || i.kind === 'cacc') && i.stock > 0);
    if (!live.length) return 0;
    const r = rates(live, d, served, pcShare, s);
    let revenue = 0;
    live.forEach((it) => {
      const acc = (s.acc[it.key] || 0) + (r.rates[it.key] || 0) * dt;
      const whole = Math.floor(acc);
      const k = Math.min(whole, it.stock);
      s.acc[it.key] = acc - whole;
      if (k > 0) revenue += E.sellUnits(s, it, k, rep, events, d.profit);
    });
    return revenue;
  }

  /** For the Stock tab: each platform's share of console owners, your installed base and where it is in its life. */
  function market(s, d) {
    const served = Math.min(d.lambda, d.serve);
    const shares = marketShares(d.y);
    return CS.PLATFORMS.filter((p) => p.year <= d.y + 0.01 && d.y <= p.end + 3).map((p) => ({
      plat: p, share: shares[p.id], base: (s.ib && s.ib[p.id]) || 0, loyalty: loyalty(s, p.id, served), status: status(p, d.y),
    })).sort((a, b) => b.share - a.share);
  }
  function upcoming(y, within) {
    return CS.PLATFORMS.filter((p) => p.year > y && p.year - y <= within).sort((a, b) => a.year - b.year);
  }

  // platform launches show up as news events
  CS.PLATFORMS.filter((p) => p.year >= 1993).forEach((p) => {
    CS.EVENTS.push({ id: 'launch_' + p.id, from: p.year, to: p.year + 0.5, name: p.name + ' launch', text: p.name + ' hits shelves. Queues round the block, and stock is limited.', launch: p.id });
  });

  CS.Con = { addItems, size, stat, noteSale, tick, rates, sell, market, upcoming, marketShares, loyalty, ownerEff, status, A_HW, consoleRef };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
