/* Display names for games, publishers, consoles and console accessories.
   Loaded after consoles.js. Every name here is original: no real trademark, and no pun on one.

   IDs are NOT touched. Item ids (and so saved stock, targets, buyer plans) are built from the original names
   inside addons.js / consoles.js (slug of brand + name), so renaming those source strings would orphan existing saves.
   This file renames what players see, after the ids exist. tools/names-check.js verifies that no id changes and that
   no real brand (or the old puns) comes back. */
(function (g) {
  const CS = (g.CS = g.CS || {});
  if (!CS.ADDONS) return;

  /* ---------- publishers of PC games (old brand -> new) ---------- */
  const PUBLISHERS = {
    "Eye-D Software": "Gnarly Bits", "Broderband": "Pixelbarn", "Maxxis": "Urbanwright Games", "LucasArtz": "Dusty Ranch Arts",
    "Westwind": "Redtide Studios", "Origin-ish": "Starlance Software", "Core Designz": "Crypt Design", "Sad Meier": "Old Sage Interactive",
    "Squarefield": "Crystalline Arts", "Blizzardly": "Snowdrift Entertainment", "Valv": "Gasket Games", "Epik Gamez": "Saga Forge",
    "Rockstarr": "Marquee Mayhem", "Haylo Studios": "Aurora Ring Studios", "Activizion": "Brisk Vision Entertainment",
    "Bethezda": "Oakhaven Softworks", "Cry-Sys": "Prism Engine Works", "Left-Out Studios": "Orphan Table Studios",
    "Mojang-ish": "Blockyard AB", "Gearbox-ish": "Cogwheel Studios", "Irrational-ish": "Hypothesis Games", "FromSoftwear": "Ashen Loom",
    "CD Projekt-ish": "Silverblade Interactive", "Team Cupp": "Studio Teacup", "PUBG-ish": "Last Squad Co.",
    "Cyberpunk-ish": "Neon Ledger Games", "Larian-ish": "Dicehall Studios", "Playground-ish": "Pavement Games",
    "Avalanche-ish": "Snowslide Studios", "Game Science-ish": "Monkey Scroll Studio", "Arrowhead-ish": "Quiver Interactive",
    "Capcomm": "Cobalt Arcade Co.", "Spectrum-ish": "Big Hair Software", "Interplaid": "Crosswire Interactive",
    "Ubisofa": "Cozy Couch Interactive", "Ensemble-ish": "Dynasty Works", "Sega-ish": "Touchline Interactive",
    "EA-ish": "Stadium Arts", "Nintendo-ish": "Hayloft Games", "Hello-ish": "Starcast Indies",
  };

  /* ---------- accessory brands that were a real name (old brand -> new) ---------- */
  const ACC_BRANDS = {
    "USRobotics-ish": "Dialtone Robotics", "Blue Yeti-ish": "Icy Sasquatch", "Elgato-ish": "Stream Ferret",
    "Brother-ish": "Sibling Print", "Targus-ish": "Satchel & Co.", "Uplyft-ish": "Lofty Desk Co.", "Creative": "Soundcrest",
    "Xbux": "Obelisk", "PlayStatic": "Nimbus", // PC controllers made by the console brands
    "Logitec": "Lodestar", "Microsaft": "Panewright", "Cherrie": "Clackwell", "Corsiar": "Cutlass", "Rayzer": "Sabre Labs", "Keycrown": "Tallkey", "ViewSonik": "Vistara", "Samsong": "Sonata", "Dall": "Marlowe", "ASOS": "Aperture", "Acre": "Peakline", "Altec Lansink": "Lancer Acoustics", "Turtle Beech": "Tortoise Grove", "SteelSeres": "Forgesound", "HyperZ": "Overdrive", "Sunny": "Daybreak", "QuickShot": "Fastfire", "Thrustmasterz": "Thrustwell", "Ioomega": "Cartridge Bros", "Kingstun": "Stonekeep", "Eastern Digital": "Orient Data", "Hayez": "Modemco", "Linksis": "Linkwise", "Netgeer": "Netcrew", "Hewlitt": "Hartwell", "Epsom": "Inkwell", "Cannon": "Sidearm", "Oculous": "Visorium", "Valv": "Gasket", "Metta": "Horizon Labs",
  };

  /* ---------- accessory products that were a real product name (old name -> new) ---------- */
  const ACC_NAMES = {
    "Quest 3-ish VR Headset": "Nebula 3 VR Headset", "360 Controller for PC": "Monolith Elite Controller for PC",
    "One Controller": "Cairn Controller",
    "Copiloot Key Keyboard": "Assistant Key Keyboard", "IntelliMouse (with scroll wheel!)": "SmartMouse (with scroll wheel!)", "G15 Gaming Keyboard": "L15 Gaming Keyboard", "MX Mechanical Keyboard": "CX Mechanical Keyboard", "K70 RGB Keyboard": "C70 RGB Keyboard", "Huntsman Optical Keyboard": "Falconer Optical Keyboard", "DeathAdder Gaming Mouse": "Sandviper Gaming Mouse", "MX Masterful Mouse": "LX Masterful Mouse", "G Pro Wireless Mouse": "L Pro Wireless Mouse", "Viper Ultralight Mouse": "Gecko Ultralight Mouse", "SyncMaster 17\" LCD": "SyncPro 17\" LCD", "UltraSharp 22\" Widescreen": "CrispView 22\" Widescreen", "Predador 34\" Ultrawide": "Marauder 34\" Ultrawide", "Odyssee 4K 144Hz": "Voyager 4K 144Hz", "Sound Blister 16 Card": "Wave 16 Card", "Sound Blister Live! 5.1": "Wave Live! 5.1", "Z-5500 Surround Speakers": "S-5500 Surround Speakers", "Siberia Headset": "Tundra Headset", "Cloud II Headset": "Stratus II Headset", "Kraken Pro Headset": "Leviathan Pro Headset", "SideWinder Game Pad": "SideSlider Game Pad", "Rumblepad 2": "Quakepad 2", "G29 Racing Wheel": "L29 Racing Wheel", "QuickCam": "SnapCam", "QuickCam Pro 4000": "SnapCam Pro 4000", "Stream Dek": "Macro Pad", "DeskJot 500C": "DeskSpritz 500C", "PIXMA All-in-One": "PicMaker All-in-One", "EcoTank Ink-Tank Printer": "EcoFill Ink-Tank Printer", "Indexx VR Kit": "Pinnacle VR Kit", "Zipp 100 Drive": "Slab 100 Drive", "Passport 500GB External HDD": "Wayfarer 500GB External HDD", "5 DualSense Controller": "Five DualPulse Controller",
  };

  /* ---------- consoles (platform id -> [name, maker]) ---------- */
  const PLATFORMS = {
    genesys: ["Orbitron Nova", "Orbitron"], snes: ["Super Hanami", "Hanami Toys"], gboi: ["Hanami Pocket", "Hanami Toys"],
    jaguaar: ["Arkade Ocelot", "Arkade"], "3doh": ["Triplet Multiplayer", "Triplet Labs"], saturn: ["Orbitron Comet", "Orbitron"],
    ps1: ["Nimbus One", "Nimbus Systems"], n64: ["Hanami Titan", "Hanami Toys"], gbc: ["Hanami Pocket Color", "Hanami Toys"],
    dc: ["Orbitron Aurora", "Orbitron"], ps2: ["Nimbus Two", "Nimbus Systems"], gcn: ["Hanami Bento", "Hanami Toys"],
    xb: ["Obelisk Monolith", "Obelisk Digital"], gba: ["Hanami Pocket Advance", "Hanami Toys"], ds: ["Hanami Twin", "Hanami Toys"],
    psp: ["Nimbus Go", "Nimbus Systems"], x360: ["Obelisk Monolith Elite", "Obelisk Digital"], ps3: ["Nimbus Three", "Nimbus Systems"],
    wee: ["Hanami Wave", "Hanami Toys"], "3ds": ["Hanami Twin 3D", "Hanami Toys"], weeu: ["Hanami Wave Pad", "Hanami Toys"],
    ps4: ["Nimbus Four", "Nimbus Systems"], xone: ["Obelisk Cairn", "Obelisk Digital"], swatch: ["Hanami Hybrid", "Hanami Toys"],
    ps5: ["Nimbus Five", "Nimbus Systems"], xsx: ["Obelisk Cairn Max", "Obelisk Digital"], xss: ["Obelisk Cairn Mini", "Obelisk Digital"],
    swatch2: ["Hanami Hybrid 2", "Hanami Toys"],
    // Near Future: already original in consoles.js
    xspire: ["Obelisk Spire", "Obelisk Digital"], ps6: ["Nimbus Six", "Nimbus Systems"], visor: ["Orbitron Ring Visor", "Orbitron"], hybrid3: ["Hanami Hybrid 3", "Hanami Toys"],
  };
  // console revisions whose old name does not start with a platform name
  const REVISIONS = { "Game Boi Advanced SP": "Hanami Pocket Advance Flip", "Nintendough DS Lite": "Hanami Twin Lite" };
  // hand-named console accessories (everything else is "<platform name> Controller" etc. and follows the platform)
  const ACC_SPECIAL = {
    "Xbux Elite Controller": "Obelisk Elite Controller", "PlayStatic DualSense Edge": "Nimbus DualPulse Edge",
    "Swatch Pro Controller": "Hybrid Pro Controller", "Wee Motion Plus Add-On": "Wave Motion Plus Add-On",
    "Nintendough 64 Rumble Pak": "Hanami Titan Rumble Pack", "PlayStatic 5 NVMe Expansion 1TB": "Nimbus Five NVMe Expansion 1TB",
    "Xbux Storage Expansion Card 1TB": "Obelisk Storage Expansion Card 1TB", "PlayStatic VR Headset": "Nimbus VR Headset",
    "Swatch Dock & Travel Case Set": "Hybrid Dock & Travel Case Set", "PlayStatic Pulse 3D Headset": "Nimbus Pulse 3D Headset",
  };

  /* ---------- game titles, PC and console (old title -> new) ---------- */
  const TITLES = {
    // PC
    "Doomed": "Hellcrawl", "Doomed 3": "Hellcrawl 3", "Doomed (2016)": "Hellcrawl (2016)", "Doomed Eternal": "Hellcrawl: Endless",
    "Mist Island": "Fog Atoll", "SimTowne": "Metro Maker", "Day of the Tentacle-ish": "Night of the Mutant Mop",
    "Command & Conker": "Rally & Rule", "Wing Commandant IV": "Star Captain IV", "Quaked": "Frag Arena", "Tomb Raidar": "Relic Rogue",
    "Civilisation II": "Dawn of Nations II", "Final Fantasia VII": "Crystal Odyssey VII", "Diablow": "Dungeon Dread",
    "Diablow III": "Dungeon Dread III", "StarCrafty": "Galaxy Clash", "StarCrafty II": "Galaxy Clash II",
    "Half-Lifespan": "Sublab: Incident", "Half-Lifespan 2": "Sublab 2", "Half-Lifespan: Alyxx": "Sublab: Vera",
    "Half-Lifespan 3 (Confirmed!)": "Sublab 3 (Confirmed!)", "Unreel Tournament": "Deathbowl Championship", "The Simms": "Little Households",
    "Grand Theft Auto-mobile III": "Carjack City III", "Grand Theft Auto-mobile V": "Carjack City V", "Grand Theft Auto-mobile VI": "Carjack City VI",
    "Haylo: Combat Evolved": "Starhelm: Combat Awakened", "Warkraft III": "Warforge III", "World of Warkraft": "Realms of Eldoria Online",
    "Call of Duty-Free": "Battle Orders", "Modern Warfare-house 2": "Modern Front 2",
    "Elder Scrolls IV: Oblivious": "Ancient Tomes IV: Forgotten Gate", "Crisis (Can It Run?)": "Meltdown (Can It Run?)",
    "Fallout-ish 3": "Rubble Ranger 3", "Left 4 Dread": "Four Dead Ends", "Skyrimm": "Frostpeak", "Minecrafty": "Cubeland Builders",
    "Portel 2": "Hole Punch 2", "Borderlandz 2": "Looter Frontier 2", "BioShook Infinite": "Cloudcity Shock: Boundless",
    "Dork Souls II": "Gloom Trials II", "The Which-er 3": "The Hex-Hunter 3", "Overwatchful": "Hero Brigade", "Cup-Head": "Mug Mayhem",
    "Battlegrounds Royale": "Island Survivors", "Red Dead Redumption 2": "Outlaw Reckoning 2", "Cyberpunk 2078": "Neon Circuit 2078",
    "Balder's Gate 3": "Tavern's Gate 3", "Elden Rung": "Ashen Crown", "Forzza Horizon 5": "Tarmac Tour 5", "Starfeld": "Stardrift",
    "Hogwash Legacy": "Wandstead Academy", "Black Myth: Wuking": "Monkey Saga: Stone Sage", "Hellshufflers 2": "Trench Troopers 2",
    "Monster Hunter Wildz": "Creature Trackers: Wilds", "Duke Nuked 3D": "Count Kaboom 3D", "Descent into Madness": "Plunge into Madness",
    "Rayman-ish Rascals": "Rascal Squad", "Age of Empires-ish II": "Dawn of Dynasties II", "Counter-Strife": "Standoff Squad",
    "Gears of Warfare-ish": "Chainsaw Squad", "Max Paine 3": "Slow-Mo Sam 3", "Assassin's Screed": "Hooded Blade",
    "Football Manager 24/7": "Pitch Boss 24/7", "FIFO 18": "Kickoff 18", "Stardew-ish Valley": "Turnip Valley",
    "Rogue Legacy-ish 2": "Heirloom Dungeon 2", "No Man's Sky-ish": "Nobody's Galaxy", "Dota-ish 2 Battle Pass": "Arena Lords 2 Battle Pass",
    "Resident Evil-ish Village": "Manor of Horrors: Village",
    // console exclusives
    "Soniq the Hedgehog 2": "Dash the Armadillo 2", "Soniq Adventure": "Dash Adventure", "Streets of Rampage 2": "Alley Brawl 2",
    "Phantasy Star-ish IV": "Starlight Saga IV", "Super Maria World": "Super Dungaree World", "Super Maria Land": "Super Dungaree Land",
    "Super Maria 64": "Super Dungaree 64", "Super Maria Sunshine": "Super Dungaree Splash", "New Super Maria Bros.": "New Super Dungaree Bros.",
    "Super Maria Galaxy": "Super Dungaree Cosmos", "Super Maria 3D Land": "Super Dungaree 3D Land", "Super Maria 3D World": "Super Dungaree 3D World",
    "Super Maria Odyssee": "Super Dungaree Voyage", "Maria Kart": "Dungaree Karts", "Maria Kart 64": "Dungaree Karts 64",
    "Maria Kart: Super Circuit": "Dungaree Karts: Grand Circuit", "Maria Kart Wee": "Dungaree Karts Wave", "Maria Kart 8": "Dungaree Karts 8",
    "Maria Kart 9 World": "Dungaree Karts 9 World",
    "The Legend of Zalda: A Link to the Pasta": "Tale of the Green Cap: Lost Kingdom",
    "The Legend of Zalda: Ocarina of Thyme": "Tale of the Green Cap: Whistle of Eternity",
    "The Legend of Zalda: Link's Wakening": "Tale of the Green Cap: Island Dreams",
    "The Legend of Zalda: The Wind Waker-ish": "Tale of the Green Cap: Sea Sail",
    "The Legend of Zalda: Breath of the Mild": "Tale of the Green Cap: Breeze of the Wilds",
    "The Legend of Zalda: Echoes of Pasta": "Tale of the Green Cap: Echoes of Yore",
    "Donkey Kang Country": "Gorilla Gang Country", "Donkey Kang Bananza-ish": "Gorilla Gang Banana Blast",
    "Super Metroidal": "Starhunter Supreme", "Metroidal Prime": "Starhunter Prime", "Chrono Trigger Happy": "Clockwork Quest",
    "Tetrus": "Block Drop", "Pokemun Red & Blue": "Critter Tamers: Crimson & Cobalt", "Pokemun Gold & Silver": "Critter Tamers: Amber & Argent",
    "Pokemun Ruby & Sapphire": "Critter Tamers: Garnet & Topaz", "Pokemun Diamond & Pearl": "Critter Tamers: Quartz & Opal",
    "Pokemun X & Y": "Critter Tamers: Dawn & Dusk", "Pokemun Sword & Shield": "Critter Tamers: Lance & Buckler",
    "Pokemun Legends Z-A-ish": "Critter Tamers: Legends of Old", "Alien vs Predator-ish": "Xeno vs Hunter", "Tempest 2001-ish": "Vortex 2001",
    "Road Rashed": "Moto Mayhem", "Gex the Gecko": "Lenny the Lizard", "Virtua Fighters 2": "Polygon Fighters 2",
    "Nights into Dreamz": "Wings of Dreamland", "Panzer Dragoon Saga-ish": "Tank Wyrm Saga", "Crash Bandi-coot": "Tumble the Wombat",
    "Gran Turismoo": "Circuit Tourer", "Gran Turismoo 3": "Circuit Tourer 3", "Gran Turismoo Portable": "Circuit Tourer Portable",
    "Metal Gear Solidish": "Shadow Serpent", "Metal Gear Solidish 2": "Shadow Serpent 2", "Metal Gear Solidish 4": "Shadow Serpent 4",
    "Spyro the Dragoon": "Ember the Dragonling", "Resident Evile": "Manor of Horrors", "Resident Evile 2": "Manor of Horrors 2",
    "Resident Evile 4": "Manor of Horrors 4", "GoldenEye 700": "Agent Goldgaze", "Shenmoo": "Harbour Saga", "Crazy Cab": "Wild Cab Rush",
    "Final Fantasia X": "Crystal Odyssey X", "Final Fantasia XVI": "Crystal Odyssey XVI", "Kingdumb Hearts": "Crown of Hearts",
    "God of Warr": "Titan Slayer", "God of Warr: Chains": "Titan Slayer: Shackles", "God of Warr (2018)": "Titan Slayer (2018)",
    "God of Warr Ragnarok-ish": "Titan Slayer: Frostfall", "Haylo 2": "Starhelm 2", "Haylo 3": "Starhelm 3", "Haylo 5": "Starhelm 5",
    "Haylo Infinite": "Starhelm Limitless", "Fable-ish": "Folklore Hero", "Advance Wars-ish": "Tiny Tanks Tactics", "Nintendogz": "Puppy Pals Plus",
    "Brain Age-ish Training": "Mind Gym Training", "Monster Hunter Freedom-ish": "Creature Trackers: Liberty",
    "Gears of Warfare": "Chainsaw Squad", "Gears of Warfare 4": "Chainsaw Squad 4", "Forzza Motorsport 2": "Track Masters 2",
    "Forzza Motorsport (2023)": "Track Masters (2023)", "Forzza Horizon 3": "Tarmac Tour 3", "Unchartered": "Lost Treasure Trails",
    "The Last of Uz": "The Last Dozen", "Wee Sports": "Wave Sports", "Wee Fit-ish": "Wave Fit Plus",
    "Animal Crossing: New Leafy": "Critter Village: New Foliage", "Animal Crossing: New Horizons-ish": "Critter Village: Island Escape",
    "Splatoon-ish": "Ink Squad", "Bloodborn": "Crimson Hunt", "Horizon Zero Dusk": "Steel Herd", "Spider-Dude": "Webslinger Dan",
    "Spider-Dude 2": "Webslinger Dan 2", "Spider-Dude: Miles Moral-es": "Webslinger Dan: Rookie",
    "Super Smash Brawl Ultimate": "Mega Melee Brawl: Ultimate",
    // console multi-platform
    "Mortal Kombot": "Fatal Fisticuffs", "NBA Jamm": "Street Hoops Jam", "FIFO Soccer 96": "Kickoff Soccer 96", "FIFO 17": "Kickoff 17",
    "Maddon NFL 97": "Touchdown Titan 97", "Maddon NFL 2005": "Touchdown Titan 2005", "Tekkin 3": "Ironfist Tournament 3",
    "WWF War-Zone-ish": "Pro Wrestling Warzone", "Rayman-ish Rascals 2": "Rascal Squad 2", "Tony Hawke's Skate Pro 3": "Skate Legend Sam 3",
    "Grand Theft Auto-mobile: Vice Town": "Carjack City: Neon Town", "Grand Theft Auto-mobile: San Andreaz": "Carjack City: Westside",
    "Grand Theft Auto-mobile IV": "Carjack City IV", "Need for Speedy Underground": "Street Sprint Underground", "Burnout-ish 3": "Wreck Rush 3",
    "Call of Duty-Free: Modern Warfare-house": "Battle Orders: Modern Front", "Call of Duty-Free: Black Opps III": "Battle Orders: Shadow Ops III",
    "Call of Duty-Free: Modern Warfare-house III": "Battle Orders: Modern Front III", "Red Dead Redumption": "Outlaw Reckoning",
    "Guitar Hero-ish III": "Shred Master III", "Batman-ish: Arkham Asylum Seeker": "Night Vigilante: Ward 9", "Battlefield-ish 3": "Front Line Fury 3",
    "Assassin's Screed Odyssee": "Hooded Blade: Island Saga", "Baldur's Gate 3": "Tavern's Gate 3", "EA Sports FC 25": "Pro Pitch FC 25",
  };

  /* ---------- apply ---------- */
  const oldPlatforms = CS.PLATFORMS ? CS.PLATFORMS.map((p) => [p.name, PLATFORMS[p.id][0], p.maker, PLATFORMS[p.id][1]]) : [];
  const swap = oldPlatforms.slice().sort((a, b) => b[0].length - a[0].length); // longest first: "PlayStatic Portable" before "PlayStatic"
  const follow = (s) => { swap.forEach(([o, n]) => { if (s.indexOf(o) >= 0) s = s.split(o).join(n); }); return s; };
  /* ---------- PC makers (prebuilt catalogue rows are renamed in data.js; this is for saved buyer settings) ---------- */
  const PC_BRANDS = {"Compac": "Bytewell", "Packerd Bell": "Pickett Chime", "IBN": "Corvid", "Gatewhey": "Portico", "Dall": "Marlowe", "Ample": "Quince", "Sunny": "Daybreak", "eMachinez": "Pennybox", "Hewlitt-Pickard": "Hartwell-Pace", "Alienwear": "Outerworld", "Acre": "Peakline", "Azus": "Orion Tek", "Chromebooq": "Skyloop", "Microsaft": "Panewright", "Rayzer": "Sabre Labs", "MSY": "Maxxion", "Lenovoh": "Novaline", "Valv": "Gasket", "Envidia": "Verdant"};
  const makers = {}; oldPlatforms.forEach(([, , om, nm]) => (makers[om] = nm));

  CS.ADDONS.forEach((a) => {
    if (a.kind === 'game') { a.name = TITLES[a.name] || a.name; a.brand = PUBLISHERS[a.brand] || a.brand; }
    else { a.brand = ACC_BRANDS[a.brand] || a.brand; a.name = ACC_NAMES[a.name] || a.name; }
  });
  if (CS.PLATFORMS) {
    CS.CGAMES.forEach((x) => { x.name = TITLES[x.name] || x.name; });
    CS.CACCS.forEach((x) => { x.name = ACC_SPECIAL[x.name] || follow(x.name); });
    CS.CONSOLES.forEach((x) => { x.name = REVISIONS[x.name] || follow(x.name); });
    CS.GROUPS.forEach((x) => { if (x.kind === 'cgame') x.name = follow(x.name); });
    CS.EVENTS.forEach((e) => { if (e.launch) { e.name = follow(e.name); e.text = follow(e.text); } }); // "<console> launch" events
    CS.PLATFORMS.forEach((p) => { p.name = PLATFORMS[p.id][0]; p.maker = PLATFORMS[p.id][1]; });
  }

  /** Old saves keep buyers' "never buy from" lists as brand names: carry them over to the new names. */
  function migrate(s) {
    const by = { game: PUBLISHERS, acc: ACC_BRANDS, con: makers, pre: PC_BRANDS };
    Object.keys(s.mgrCfg || {}).forEach((cat) => {
      const cfg = s.mgrCfg[cat], map = by[cat];
      if (map && cfg && Array.isArray(cfg.blocked)) cfg.blocked = cfg.blocked.map((b) => map[b] || b);
    });
  }
  CS.Names = { migrate, PUBLISHERS, ACC_BRANDS, ACC_NAMES, TITLES, PLATFORMS, makers, PC_BRANDS };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
