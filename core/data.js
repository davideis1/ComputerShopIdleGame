/* Static game data: eras, products, parts, upgrades, events, achievements.
   All brand and product names are parodies. */
(function (g) {
  const CS = (g.CS = g.CS || {});

  CS.C = {
    START_YEAR: 1993,
    TODAY_CAL: 33.8, // "today" (Oct 2026): a milestone; the Near Future eras carry on from here
    END_CAL: 42.8, // the calendar stops in Oct 2035, the end of the roadmap
    YEAR_SECONDS: 420, // real seconds per in-game year while playing (~4 hours from 1993 to today, ~5 to 2035)
    OFFLINE_CAL_RATE: 0.05, // calendar speed while the shop is closed
    G: 1.28, // yearly tech improvement factor
    SALE_WINDOW: 6, // years a prebuilt can be re-ordered from distributors
    PART_WINDOW: 6, // years a part stays orderable
    START_CASH: 5000,
    SAVE_KEY: 'csig-save-v1',
    TOKEN_R0: 1e8, // run revenue at which Franchise Tokens start to accrue
    TOKEN_K: 4, // tokens = floor(K * sqrt(revenue / R0) - (K - 1)), so the first token arrives at R0
    VERSION: 1,
    // Head Start (HQ): later franchises open later in history. Level -> calendar start and extra starting cash.
    HEAD_STARTS: [{ cal: 0, cash: 0 }, { cal: 3, cash: 6e4 }, { cal: 7, cash: 4e5 }, { cal: 12, cash: 2.5e6 }],
    WARP_MAX: 10, // Time Warp levels (+15% calendar speed each)
    WARP_UNTIL: 22, // ...but only before 2015: the last decade is where a run earns most, so it isn't shortened
  };

  CS.ERAS = [
    { from: 1993, name: 'Dial-Up Dawn', theme: 'win95', blurb: 'Beige boxes, 486s and the screech of a modem.' },
    { from: 1996, name: 'Multimedia Madness', theme: 'win95', blurb: 'CD-ROMs, sound cards and 3D accelerators.' },
    { from: 2000, name: 'Dot-Com Daze', theme: 'xp', blurb: 'Gigahertz wars and translucent plastic.' },
    { from: 2005, name: 'Dual-Core Decade', theme: 'xp', blurb: 'Laptops outsell desktops. Netbooks appear.' },
    { from: 2009, name: 'Flat & Fast', theme: 'flat', blurb: 'SSDs, tablets and the app store boom.' },
    { from: 2015, name: 'RGB Everything', theme: 'rgb', blurb: 'Esports, tempered glass and glowing fans.' },
    { from: 2020, name: 'Pandemic & Beyond', theme: 'rgb', blurb: 'Remote work, chip shortages, custom silicon.' },
    { from: 2024, name: 'The AI Era', theme: 'rgb', blurb: 'Every PC is now an "AI PC".' },
    // Near Future: everything from here on is speculation
    { from: 2027, name: 'Spatial Shift', theme: 'holo', blurb: 'Smart glasses replace monitors, and everyone talks to their PC.' },
    { from: 2031, name: 'Quantum Curious', theme: 'holo', blurb: 'Quantum co-processors, holo-desks and screens the size of a wall.' },
  ];

  /* ---------- Parts ---------- */
  CS.SLOTS = [
    { id: 'case', name: 'Case & PSU', icon: '🧱', w: 0.05, base: 90, grow: 1.02 },
    { id: 'cpu', name: 'Processor', icon: '🧠', w: 0.3, base: 280, grow: 1.025 },
    { id: 'ram', name: 'Memory', icon: '📏', w: 0.15, base: 150, grow: 1.015 },
    { id: 'storage', name: 'Storage', icon: '💾', w: 0.15, base: 170, grow: 1.0 },
    { id: 'gpu', name: 'Graphics', icon: '🎮', w: 0.25, base: 110, grow: 1.055 },
    { id: 'os', name: 'Software', icon: '🪟', w: 0.1, base: 80, grow: 1.015 },
  ];

  // [slot, year, 'budget|standard|premium']
  const GENS = [
    ['cpu', 1993, 'Vortek 486 SLC-33|Silicor 486 DX2-66|Aurum A486 DX4-100'],
    ['cpu', 1995, 'Vortek Q8x86 P120+|Silicor Quintus 100|Silicor Quintus 133'],
    ['cpu', 1997, 'Aurum J6-200|Silicor Quintus MMX 233|Silicor Quintus II 300'],
    ['cpu', 1999, 'Silicor Cellero 466|Silicor Quintus III 600|Aurum Aethon 750'],
    ['cpu', 2001, 'Aurum Durano 1.0GHz|Silicor Quintus 4 1.8GHz|Aurum Aethon XP 2000+'],
    ['cpu', 2004, 'Silicor Cellero D 2.6|Silicor Quintus 4 Pinnacle 3.2|Aurum Aethon 64 VX-55'],
    ['cpu', 2006, 'Aurum Sempro 3200+|Silicor Kern 2 Duet E6600|Silicor Kern 2 Apex QX6700'],
    ['cpu', 2009, 'Aurum Hydra II X2|Silicor Kern k5-750|Silicor Kern k7-920'],
    ['cpu', 2012, 'Aurum VX-6300|Silicor Kern k5-3570K|Silicor Kern k7-3770K'],
    ['cpu', 2015, 'Silicor Quintus G4400|Silicor Kern k5-6600K|Silicor Kern k7-6700K'],
    ['cpu', 2017, 'Zephyr 3 1200|Zephyr 5 1600|Zephyr 7 1800X'],
    ['cpu', 2019, 'Zephyr 5 3600|Silicor Kern k7-9700K|Zephyr 9 3900X'],
    ['cpu', 2021, 'Silicor Kern k3-12100|Zephyr 5 5600X|Silicor Kern k9-12900K'],
    ['cpu', 2027, 'Zephyr 5 11600|Silicor Kern k7-17700|Zephyr 9 11950X'],
    ['cpu', 2030, 'Silicor Kern k5-21600 Neural|Zephyr 7 13800 NPU|Silicor Kern k9-21900 Neural'],
    ['cpu', 2033, 'Zephyr Qubit Q3 Hybrid|Silicor Kern Q7 Hybrid|Aurum Entangle Q9'],
    ['cpu', 2023, 'Zephyr 5 7600|Silicor Kern k7-14700K|Zephyr 9 7950V'],
    ['cpu', 2025, 'Zephyr 5 9600X|Silicor Kern Ultra 7 265K|Zephyr 9 9950V'],

    ['ram', 1993, 'Stonekeep 4MB SIMM|Stonekeep 8MB SIMM|Foundry 16MB SIMM'],
    ['ram', 1996, 'Stonekeep 16MB EDO|Foundry 32MB EDO|Foundry 64MB EDO'],
    ['ram', 1998, 'Stonekeep 64MB SDRAM|Foundry 128MB SDRAM|Cutlass 256MB SDRAM'],
    ['ram', 2002, 'Stonekeep 256MB DDR|Foundry 512MB DDR|Cutlass 1GB DDR'],
    ['ram', 2005, 'Stonekeep 512MB DDR2|Foundry 1GB DDR2|Cutlass 2GB DDR2'],
    ['ram', 2008, 'Stonekeep 2GB DDR3|Foundry 4GB DDR3|Cutlass 8GB DDR3'],
    ['ram', 2012, 'Stonekeep 4GB DDR3-1600|Foundry 8GB DDR3-1866|Cutlass 16GB Buccaneer'],
    ['ram', 2015, 'Stonekeep 8GB DDR4|Foundry 16GB DDR4|Cutlass 32GB DDR4'],
    ['ram', 2018, 'Stonekeep 8GB DDR4-3200|Foundry 16GB DDR4-3600|Cutlass 32GB RGB DDR4'],
    ['ram', 2021, 'Stonekeep 16GB DDR5|Foundry 32GB DDR5|Cutlass 64GB DDR5'],
    ['ram', 2024, 'Stonekeep 32GB DDR5-6000|Foundry 64GB DDR5-6400|Cutlass 96GB DDR5-7200'],
    ['ram', 2027, 'Stonekeep 64GB DDR6|Foundry 128GB DDR6|Cutlass 192GB DDR6'],
    ['ram', 2031, 'Stonekeep 128GB DDR6X|Foundry 256GB DDR6X|Cutlass 512GB Stacked'],

    ['storage', 1993, 'Albatross 120MB HDD|Albatross 340MB HDD|Orient Data 540MB HDD'],
    ['storage', 1996, 'Albatross 1.2GB HDD|Orient Data 2.5GB HDD|Quasar 4.3GB HDD'],
    ['storage', 1999, 'Albatross 8GB HDD|Orient Data 20GB 7200rpm|Quasar 40GB HDD'],
    ['storage', 2003, 'Albatross 80GB HDD|Orient Data 120GB HDD|Quasar 250GB HDD'],
    ['storage', 2006, 'Albatross 160GB SATA|Orient Data 320GB SATA|Albatross 500GB SATA'],
    ['storage', 2009, 'Orient Data 500GB|Albatross 1TB|Orient Data 2TB Black'],
    ['storage', 2011, 'Sonata 64GB SSD|Sonata 128GB SSD|Silicor 256GB SSD'],
    ['storage', 2014, 'Sonata 250GB SSD|Sonata 500GB SSD|Sonata 1TB SSD'],
    ['storage', 2017, 'Sonata 250GB NVMe|Sonata 500GB NVMe|Sonata 1TB NVMe'],
    ['storage', 2020, 'Sonata 500GB Gen4|Sonata 1TB Gen4|Sonata 2TB Gen4'],
    ['storage', 2023, 'Sonata 1TB Gen4|Sonata 2TB Gen4|Sonata 4TB Gen5'],
    ['storage', 2027, 'Sonata 4TB Gen6|Sonata 8TB Gen6|Sonata 16TB Gen6'],
    ['storage', 2031, 'Sonata 16TB Crystal|Sonata 32TB Crystal|Sonata 64TB Glass Platter'],

    ['gpu', 1993, 'Trifold VGA 1MB|Sable Trio 64 2MB|Mastix Millennial 2MB'],
    ['gpu', 1996, 'Sable Vortex 3D|Tri-Pixel Wizard 1|Mastix Mirage 220'],
    ['gpu', 1998, 'Arcadia Tempest Pro|Verdant Gale TNX|Tri-Pixel Wizard 2 Duo'],
    ['gpu', 1999, 'Arcadia Tempest 128|Verdant Gale 256|Verdant Gale 2 GX'],
    ['gpu', 2001, 'Arcadia Prism 7500|Verdant Gale 3|Arcadia Prism 8500'],
    ['gpu', 2004, 'Arcadia Prism 9600|Verdant Gale 6600 GX|Verdant Gale 6800 Ultra'],
    ['gpu', 2006, 'Verdant Gale 7600 GX|Arcadia Prism X1900|Verdant Gale 8800 GXT'],
    ['gpu', 2009, 'Arcadia Prism HD 5770|Verdant Gale GX 460|Arcadia Prism HD 5870'],
    ['gpu', 2012, 'Arcadia Prism HD 7770|Verdant Gale GX 660|Verdant Gale GX 680'],
    ['gpu', 2015, 'Verdant Gale GX 960|Verdant Gale GX 970|Verdant Gale GX 980 Tx'],
    ['gpu', 2017, 'Arcadia Prism R5 580|Verdant Gale GX 1070|Verdant Gale GX 1080 Tx'],
    ['gpu', 2019, 'Verdant Gale GX 1660 S|Verdant Gale GR 2070 S|Verdant Gale GR 2080 Tx'],
    ['gpu', 2021, 'Arcadia Prism R6 6600 X|Verdant Gale GR 3070|Verdant Gale GR 3090'],
    ['gpu', 2023, 'Verdant Gale GR 4060|Verdant Gale GR 4070 S|Verdant Gale GR 4090'],
    ['gpu', 2025, 'Arcadia Prism R9 9060 X|Verdant Gale GR 5070|Verdant Gale GR 5090'],
    ['gpu', 2027, 'Arcadia Prism R9 11060|Verdant Gale GR 6070|Verdant Gale GR 6090'],
    ['gpu', 2029, 'Verdant Gale GR 7060|Arcadia Prism R9 12800 XT|Verdant Gale GR 7090 Holo'],
    ['gpu', 2032, 'Verdant Lumen L60|Arcadia Lightfield LX 70|Verdant Lumen L90 Holo'],

    ['case', 1993, 'Beige Mini-Tower|Beige Mid-Tower|Big Beige Full Tower'],
    ['case', 1999, 'Plain Black Mid-Tower|Translucent Blue Mid-Tower|Aluminum Full Tower'],
    ['case', 2005, 'Budget Steel ATX|Windowed Mid-Tower|Aluminum Gaming Tower'],
    ['case', 2009, 'Basic ATX Tower|Black Mid-Tower w/ Window|Chill Master Tower'],
    ['case', 2012, 'Quiet Mid-Tower|Windowed Silent Tower|Full Tower w/ Fan Wall'],
    ['case', 2017, 'RGB Mesh Mid-Tower|Tempered Glass Mid-Tower|Dual-Chamber Showcase'],
    ['case', 2022, 'Airflow Mesh Mid-Tower|White Glass Mid-Tower|Fish Tank Mega-Case'],
    ['case', 2028, 'Glass Cube Mini|Wood-Panel Silent Tower|Liquid Showcase Aquarium'],
    ['case', 2033, 'Desk-Integrated Chassis|Holo-Frame Tower|Levitating Orb Chassis'],

    ['os', 1993, 'DOS-Lite 6.22 + Skylight 3.1|Skylight for Workgroups 3.11|Orbit/3 Hyperdrive'],
    ['os', 1995, 'Skylight 95 Lite|Skylight 95|Skylight 95 Plus!'],
    ['os', 1998, 'Skylight 98|Skylight 98 SE|Skylight Pro 4 Workstation'],
    ['os', 2001, 'Skylight Ember Home|Skylight Ember Pro|Skylight Ember Media Center'],
    ['os', 2007, 'Skylight Horizon Basic|Skylight Horizon Premium|Skylight Horizon Ultimate'],
    ['os', 2009, 'Skylight 7 Starter|Skylight 7 Home|Skylight 7 Ultimate'],
    ['os', 2015, 'Skylight 10 Home|Skylight 10 Pro|Skylight 10 Enterprise'],
    ['os', 2021, 'Skylight 11 Home|Skylight 11 Pro|Skylight 11 Pro for Workstations'],
    ['os', 2028, 'Skylight 12 Home|Skylight 12 Pro|Skylight 12 Pro Spatial'],
    ['os', 2033, 'Skylight Q Home|Skylight Q Pro|Skylight Q Studio'],
  ];

  const TIERS = [
    { label: 'Budget', q: 0.7 },
    { label: 'Standard', q: 1.0 },
    { label: 'Premium', q: 1.6 },
  ];

  CS.PARTS = [];
  GENS.forEach(([slot, year, names]) => {
    names.split('|').forEach((name, i) => {
      CS.PARTS.push({ id: slot + '_' + year + '_' + i, slot, year, name, tier: TIERS[i].label, q: TIERS[i].q });
    });
  });
  // Evergreen cheap options that always keep pace with the era
  CS.PARTS.push({ id: 'gpu_igp', slot: 'gpu', year: 1993, name: 'Integrated Graphics', tier: 'Onboard', q: 0.4, rolling: true });
  CS.PARTS.push({ id: 'os_free', slot: 'os', year: 1993, name: 'Penguinix (free, some assembly required)', tier: 'Free', q: 0.55, rolling: true, free: true });
  CS.PART_BY_ID = {};
  CS.PARTS.forEach((p) => (CS.PART_BY_ID[p.id] = p));
  CS.SLOT_BY_ID = {};
  CS.SLOTS.forEach((s) => (CS.SLOT_BY_ID[s.id] = s));

  /* ---------- Prebuilt products ---------- */
  // id, brand, name, year, launch price, retail margin, quality, icon
  const PRE = [
    ['compac_425', 'Bytewell', 'Presto 425', 1993, 1199, 0.13, 0.85, '🖥️'],
    ['pbell_leg', 'Pickett Chime', 'Legendary 486', 1993, 999, 0.1, 0.7, '🖥️'],
    ['ibn_vp', 'Corvid', 'ValueSpot 466', 1993, 1699, 0.18, 1.0, '🖥️'],
    ['gate_486', 'Portico', '2K 486DX2/66', 1993, 1899, 0.18, 1.15, '🖥️'],
    ['dall_466', 'Marlowe', 'Meridian 466V', 1993, 1599, 0.16, 1.0, '🖥️'],
    ['ample_q650', 'Quince', 'Quadro 650', 1993, 2599, 0.22, 1.2, '🖥️'],
    ['compac_lte', 'Bytewell', 'Featherlite Elite Notebook', 1994, 2299, 0.2, 0.7, '💻'],
    ['compac_p90', 'Bytewell', 'Presto 7100 Quintus', 1995, 1799, 0.14, 0.95, '🖥️'],
    ['ibn_apt', 'Corvid', 'Aptitude Quintus', 1995, 1899, 0.15, 1.0, '🖥️'],
    ['gate_p5', 'Portico', 'Q5-100 Big Heifer', 1995, 2099, 0.17, 1.1, '🖥️'],
    ['dall_xps100', 'Marlowe', 'Xtreme P100', 1995, 2299, 0.18, 1.15, '🖥️'],
    ['ample_pm', 'Quince', 'PowerBox 7500', 1995, 2499, 0.22, 1.1, '🖥️'],
    ['compac_pii', 'Bytewell', 'Presto 2200 Quintus II', 1997, 1499, 0.12, 0.95, '🖥️'],
    ['gate_g6', 'Portico', 'G6-266', 1997, 1999, 0.16, 1.1, '🖥️'],
    ['dall_d300', 'Marlowe', 'Xtreme D300', 1997, 2499, 0.17, 1.25, '🖥️'],
    ['sunny_505', 'Daybreak', 'Sunrise 505 Ultra-Slim', 1997, 1999, 0.24, 0.75, '💻'],
    ['emach_et', 'Pennybox', 'Penny Tower 266', 1998, 599, 0.08, 0.7, '🖥️'],
    ['ample_imack', 'Quince', 'QMac Candy Blue', 1998, 1299, 0.22, 1.0, '🖥️'],
    ['gate_sel', 'Portico', 'Select 600 Quintus III', 1999, 1899, 0.16, 1.1, '🖥️'],
    ['hp_pav', 'Hartwell-Pace', 'Pavilion Row 6700', 1999, 1299, 0.13, 0.95, '🖥️'],
    ['ample_g4', 'Quince', 'PowerBox G4', 1999, 1599, 0.22, 1.2, '🖥️'],
    ['ample_qube', 'Quince', 'Q4 Cube', 2000, 1799, 0.22, 0.9, '🖥️'],
    ['dall_4100', 'Marlowe', 'Meridian 4100', 2001, 1399, 0.15, 1.0, '🖥️'],
    ['ample_ibock', 'Quince', 'QBook Clamshell', 2001, 1299, 0.23, 0.9, '💻'],
    ['acre_asp', 'Peakline', 'Ascent Budget Tower', 2003, 699, 0.08, 0.8, '🖥️'],
    ['alien_a52', 'Outerworld', 'Zone-52', 2004, 2999, 0.25, 1.5, '👽'],
    ['ample_mbp', 'Quince', 'QuinceBook Pro 15"', 2006, 1999, 0.22, 1.1, '💻'],
    ['dall_xps710', 'Marlowe', 'Xtreme 710 Rocket', 2006, 2999, 0.2, 1.4, '🖥️'],
    ['alien_aur', 'Outerworld', 'Dawn ALX', 2006, 3999, 0.26, 1.6, '👽'],
    ['azus_eee', 'Orion Tek', 'Teeny PC Netbook', 2008, 399, 0.08, 0.5, '💻'],
    ['ample_air', 'Quince', 'QuinceBook Feather', 2008, 1799, 0.24, 0.9, '💻'],
    ['ample_iped', 'Quince', 'Quince Slate Tablet', 2010, 499, 0.25, 0.6, '📱'],
    ['chrome_q', 'Skyloop', 'Cloud-Only Laptop', 2011, 349, 0.1, 0.5, '💻'],
    ['ms_surf', 'Panewright', 'Skimmer RT', 2012, 499, 0.1, 0.5, '📱'],
    ['dall_xps13', 'Marlowe', 'Xtreme 13 Developer', 2014, 1299, 0.16, 1.0, '💻'],
    ['alien_a51', 'Outerworld', 'Zone-51 R2', 2014, 2199, 0.24, 1.4, '👽'],
    ['ms_book', 'Panewright', 'Skimmer Book', 2015, 1499, 0.2, 1.0, '💻'],
    ['rayzer_bs', 'Sabre Labs', 'Edge Stealth', 2016, 1799, 0.22, 1.2, '🐍'],
    ['msy_titan', 'Maxxion', 'Titan Gaming Laptop', 2016, 2499, 0.22, 1.4, '🎮'],
    ['leno_leg', 'Novaline', 'Legend Y540', 2019, 1099, 0.14, 1.0, '🎮'],
    ['ample_pro', 'Quince', 'Grater Pro Tower', 2019, 5999, 0.3, 2.0, '🧀'],
    ['ample_z1', 'Quince', 'QuinceBook Air Z1', 2020, 999, 0.22, 1.5, '💻'],
    ['alien_r13', 'Outerworld', 'Dawn R13', 2021, 2299, 0.24, 1.4, '👽'],
    ['ms_pro8', 'Panewright', 'Skimmer Pro 8', 2021, 1099, 0.2, 1.0, '📱'],
    ['valve_deck', 'Gasket', 'Vapor Deck Handheld', 2022, 399, 0.06, 0.6, '🕹️'],
    ['ample_mini', 'Quince', 'Quince Mini Pro', 2023, 1299, 0.22, 1.2, '📦'],
    ['ms_copi', 'Panewright', 'Assistant+ Skimmer Laptop', 2024, 999, 0.15, 1.1, '💻'],
    ['dall_pmp', 'Marlowe', 'Pro Max Plus Premium', 2025, 1899, 0.15, 1.2, '💻'],
    ['env_dgx', 'Verdant', 'Gale Sparkle AI Box', 2025, 2999, 0.25, 1.6, '🤖'],
    ['rayzer_b18', 'Sabre Labs', 'Edge 18 Pro', 2025, 3299, 0.24, 1.5, '🐍'],
    ['ample_studio', 'Quince', 'Quince Studio Ultra Max', 2025, 3999, 0.28, 1.8, '📦'],
    ['dall_8250', 'Marlowe', 'Meridian 8250', 2002, 1799, 0.18, 1.15, '🖥️'],
    ['gate_700', 'Portico', '700XL Heifer Edition', 2002, 1499, 0.14, 1.0, '🖥️'],
    ['hp_a350', 'Hartwell-Pace', 'Pavilion Row a350n', 2003, 999, 0.12, 0.95, '🖥️'],
    ['ample_g5', 'Quince', 'QMac G5', 2004, 1299, 0.22, 1.1, '🖥️'],
    ['dall_3000', 'Marlowe', 'Meridian 3000', 2004, 599, 0.09, 0.8, '🖥️'],
    ['gate_fx', 'Portico', 'FX 7000 Gamer', 2005, 2199, 0.2, 1.3, '🖥️'],
    ['compac_sr', 'Bytewell', 'Presto SR1000', 2005, 699, 0.09, 0.85, '🖥️'],
    ['ample_imac_al', 'Quince', 'QMac Aluminum', 2007, 1199, 0.22, 1.1, '🖥️'],
    ['dall_insp', 'Marlowe', 'Inspire 1525', 2007, 749, 0.1, 0.85, '💻'],
    ['dall_studio', 'Marlowe', 'Studio Xtreme 435', 2009, 1499, 0.16, 1.2, '🖥️'],
    ['alien_alx', 'Outerworld', 'Zone-51 ALX', 2010, 2799, 0.25, 1.5, '👽'],
    ['hp_envy', 'Hartwell-Pace', 'Envoy 14', 2010, 1199, 0.15, 1.0, '💻'],
    ['ample_ret', 'Quince', 'QuinceBook Pro Crisp', 2012, 2199, 0.24, 1.4, '💻'],
    ['acre_ultra', 'Peakline', 'Ascent S7 Ultrabook', 2012, 1199, 0.12, 0.9, '💻'],
    ['ample_imp', 'Quince', 'QMac Pro', 2017, 4999, 0.3, 1.9, '🖥️'],
    ['dall_g5', 'Marlowe', 'G5 Gaming', 2018, 1099, 0.14, 1.0, '🎮'],
    ['leno_tp', 'Novaline', 'ThoughtPad X1', 2018, 1599, 0.17, 1.1, '💻'],
    ['acre_pred', 'Peakline', 'Raptor Helios', 2018, 1499, 0.16, 1.2, '🎮'],
    ['ample_m2', 'Quince', 'QuinceBook Pro Q2', 2022, 1999, 0.24, 1.6, '💻'],
    ['rayzer_b15', 'Sabre Labs', 'Edge 15', 2022, 2499, 0.23, 1.4, '🐍'],
    ['hp_omen', 'Hartwell-Pace', 'Augur 40L', 2022, 1899, 0.17, 1.3, '🎮'],
    ['ample_m4', 'Quince', 'QuinceBook Pro Q4', 2024, 1599, 0.24, 1.5, '💻'],
    ['leno_go', 'Novaline', 'Legend Go Handheld', 2024, 699, 0.1, 0.8, '🕹️'],
    ['alien_r16', 'Outerworld', 'Dawn R16', 2024, 2499, 0.24, 1.5, '👽'],
    ['ample_neo', 'Quince', 'QuinceBook Neo', 2026, 699, 0.2, 1.0, '💻'],
    ['ms_lap8', 'Panewright', 'Skimmer Laptop 8', 2026, 1299, 0.16, 1.2, '💻'],
    // Near Future
    ['bw_halo', 'Bytewell', 'Presto Aura AI Desktop', 2027, 1299, 0.14, 1.1, '🖥️'],
    ['qn_vision', 'Quince', 'QMac Vision Desk', 2027, 2499, 0.26, 1.6, '🖥️'],
    ['nv_fold', 'Novaline', 'ThoughtPad Fold 2', 2028, 2199, 0.18, 1.3, '💻'],
    ['ow_holo', 'Outerworld', 'Zone-X Holo Rig', 2029, 3299, 0.26, 1.8, '👽'],
    ['pw_glass', 'Panewright', 'Skimmer Glass Studio', 2030, 1899, 0.17, 1.4, '💻'],
    ['sl_spectra', 'Sabre Labs', 'Edge Spectra 16', 2031, 2799, 0.23, 1.6, '🐍'],
    ['mx_puck', 'Maxxion', 'Puck Mini PC', 2031, 599, 0.12, 0.9, '📦'],
    ['qn_quantum', 'Quince', 'QuinceBook Quantum', 2033, 2999, 0.25, 1.9, '💻'],
    ['hp_cube', 'Hartwell-Pace', 'Augur Cube Q', 2033, 2299, 0.18, 1.5, '🎮'],
    ['pk_wear', 'Peakline', 'Ascent Wearable PC', 2034, 999, 0.15, 1.1, '⌚'],
  ];
  CS.PRODUCTS = PRE.map(([id, brand, name, year, price, m, q, icon]) => ({ id, brand, name, year, price, m, q, icon }));
  CS.PRODUCT_BY_ID = {};
  CS.PRODUCTS.forEach((p) => (CS.PRODUCT_BY_ID[p.id] = p));

  /* ---------- Upgrades ----------
     kind: effect key; per: effect per level; up: upkeep $/s per level (inflation scaled) */
  CS.UPGRADES = [
    // Shop
    { id: 'shelf', grp: 'Shop', name: 'Shop Floor Expansion', icon: '🏬', desc: '+8 units of shelf space', year: 1993, base: 500, grow: 1.35, max: 30, kind: 'cap', per: 8 },
    { id: 'depot', grp: 'Shop', name: 'Back-Room Depot', icon: '🏚️', desc: '+40 units of shelf space', year: 1999, base: 20000, grow: 1.35, max: 40, kind: 'cap', per: 40 },
    { id: 'dc', grp: 'Shop', name: 'Distribution Centre', icon: '🏢', desc: '+250 units of shelf space', year: 2008, base: 400000, grow: 1.35, max: 40, kind: 'cap', per: 250 },
    { id: 'mega', grp: 'Shop', name: 'Automated Mega-Warehouse', icon: '🏗️', desc: '+1,500 units of shelf space', year: 2018, base: 8e6, grow: 1.35, max: 40, kind: 'cap', per: 1500 },
    { id: 'supplier', grp: 'Shop', name: 'Distributor Account', icon: '🤝', desc: '-1% wholesale & parts cost', year: 1993, base: 1800, grow: 1.5, max: 10, kind: 'disc', per: 0.01 },
    { id: 'loyalty', grp: 'Shop', name: 'Loyalty Punch Cards', icon: '🎟️', desc: '+3% customers', year: 1994, base: 1200, grow: 1.6, max: 25, kind: 'loyal', per: 0.03 },
    { id: 'night', grp: 'Shop', name: 'Night Lock-Up & Cameras', icon: '🔒', desc: '+2h of offline earnings', year: 1993, base: 4000, grow: 3.2, max: 8, kind: 'night', per: 2 },
    // Product lines
    { id: 'aisle_acc', grp: 'Shop', name: 'Accessories Wall', icon: '🖱️', desc: 'Sell keyboards, mice, monitors, modems and more alongside your PCs. PC buyers are twice as likely to add on.', year: 1993, base: 1500, grow: 1, max: 1, kind: 'aisle_acc', per: 1, verb: 'Open' },
    { id: 'aisle_games', grp: 'Shop', name: 'Software Aisle', icon: '💿', desc: 'Sell PC games. Demanding new releases only sell if the PCs you sell can run them.', year: 1993, base: 3000, grow: 1, max: 1, kind: 'aisle_game', per: 1, verb: 'Open' },
    { id: 'aisle_console', grp: 'Shop', name: 'Console Corner', icon: '🎮', desc: 'Sell game consoles, console games and accessories. Console games sell to people who own that platform, so the consoles you sell build your game business.', year: 1993, base: 6000, grow: 1, max: 1, kind: 'aisle_console', per: 1, verb: 'Open' },
    { id: 'upsell', grp: 'Shop', name: 'Upsell Training', icon: '🗣️', desc: '"Would you like a mouse pad with that?" +6% game & accessory sales', year: 1993, base: 2000, grow: 1.45, max: 20, kind: 'attach', per: 0.06 },
    { id: 'purchasing', grp: 'Shop', name: 'Purchasing Office', icon: '👔', desc: 'Opens the Buyers tab: hire a purchasing manager for each product category to watch trends and manage your stock levels.', year: 1995, base: 15000, grow: 1, max: 1, kind: 'office', per: 1, verb: 'Open' },
    // Marketing
    { id: 'ads_news', grp: 'Marketing', name: 'Classified Ads', icon: '📰', desc: '+0.03 customers/s', year: 1993, base: 250, grow: 1.22, max: 60, kind: 'lambda', per: 0.03 },
    { id: 'ads_tv', grp: 'Marketing', name: 'Late-Night Infomercials', icon: '📺', desc: '+0.07 customers/s', year: 1994, base: 2000, grow: 1.22, max: 60, kind: 'lambda', per: 0.07 },
    { id: 'ads_web', grp: 'Marketing', name: 'Free Homepage Hosting', icon: '🌐', desc: '+0.15 customers/s', year: 1996, base: 8000, grow: 1.22, max: 60, kind: 'lambda', per: 0.15 },
    { id: 'ads_ecom', grp: 'Marketing', name: 'E-Commerce Checkout', icon: '🛒', desc: '+0.35 customers/s', year: 1999, base: 25000, grow: 1.22, max: 60, kind: 'lambda', per: 0.35 },
    { id: 'ads_seo', grp: 'Marketing', name: 'Search Engine Optimization', icon: '🔎', desc: '+0.9 customers/s', year: 2003, base: 80000, grow: 1.22, max: 60, kind: 'lambda', per: 0.9 },
    { id: 'ads_social', grp: 'Marketing', name: 'Social Media Presence', icon: '👍', desc: '+2.2 customers/s', year: 2009, base: 350000, grow: 1.22, max: 60, kind: 'lambda', per: 2.2 },
    { id: 'ads_influ', grp: 'Marketing', name: 'Influencer Sponsorships', icon: '🤳', desc: '+5.5 customers/s', year: 2015, base: 1.6e6, grow: 1.22, max: 60, kind: 'lambda', per: 5.5 },
    { id: 'ads_ai', grp: 'Marketing', name: 'AI Sales Chatbot', icon: '🤖', desc: '+14 customers/s', year: 2023, base: 8.0e6, grow: 1.22, max: 60, kind: 'lambda', per: 14 },
    // Checkout
    { id: 'sales', grp: 'Checkout', name: 'Sales Associate', icon: '🧑‍💼', desc: 'Serves +0.12 customers/s (paid wage)', year: 1993, base: 600, grow: 1.38, max: 80, kind: 'serve', per: 0.12, up: 0.35 },
    { id: 'training', grp: 'Checkout', name: 'Sales Training Seminar', icon: '🎓', desc: '+10% checkout speed', year: 1994, base: 2500, grow: 1.7, max: 20, kind: 'serveMult', per: 0.1 },
    { id: 'barcode', grp: 'Checkout', name: 'Barcode Scanners', icon: '🏷️', desc: 'Serves +0.4 customers/s', year: 1994, base: 2500, grow: 1.22, max: 50, kind: 'serve', per: 0.4 },
    { id: 'pos', grp: 'Checkout', name: 'POS Terminals', icon: '🧾', desc: 'Serves +1.2 customers/s', year: 1999, base: 22000, grow: 1.22, max: 50, kind: 'serve', per: 1.2 },
    { id: 'selfcheck', grp: 'Checkout', name: 'Self-Checkout Kiosks', icon: '🖲️', desc: 'Serves +4 customers/s', year: 2007, base: 90000, grow: 1.22, max: 50, kind: 'serve', per: 4 },
    { id: 'tap', grp: 'Checkout', name: 'Tap-to-Pay Everywhere', icon: '📲', desc: 'Serves +14 customers/s', year: 2014, base: 370000, grow: 1.22, max: 50, kind: 'serve', per: 14 },
    { id: 'autocheck', grp: 'Checkout', name: 'Just-Walk-Out Cameras', icon: '📷', desc: 'Serves +50 customers/s', year: 2022, base: 1.6e6, grow: 1.22, max: 50, kind: 'serve', per: 50 },
    // Stock handling
    { id: 'clerk', grp: 'Stock', name: 'Stock Clerk (auto-restock)', icon: '📦', desc: 'Restocks +0.3 units/s toward your targets', year: 1993, base: 450, grow: 1.5, max: 40, kind: 'restock', per: 0.3, up: 0.5 },
    { id: 'warehouse', grp: 'Stock', name: 'Warehouse Forklift Crew', icon: '🚜', desc: 'Restocks +2 units/s', year: 2000, base: 38000, grow: 1.3, max: 40, kind: 'restock', per: 2, up: 2 },
    { id: 'robot', grp: 'Stock', name: 'Robotic Fulfilment', icon: '🦾', desc: 'Restocks +12 units/s', year: 2015, base: 330000, grow: 1.3, max: 40, kind: 'restock', per: 12, up: 10 },
    // Workshop
    { id: 'workshop', grp: 'Workshop', name: 'Build Workshop', icon: '🛠️', desc: 'Unlocks custom PC building. Buy parts, design blueprints, sell your own machines.', year: 1996, base: 12000, grow: 1, max: 1, kind: 'workshop', per: 1 },
    { id: 'techs', grp: 'Workshop', name: 'Build Technician', icon: '👷', desc: 'Builds 1 PC per 40s (paid wage)', year: 1996, base: 1200, grow: 1.35, max: 80, kind: 'build', per: 0.025, up: 0.8, req: 'workshop' },
    { id: 'tools', grp: 'Workshop', name: 'Anti-Static Mats & Better Tools', icon: '🧰', desc: '+12% build speed', year: 1996, base: 3500, grow: 1.6, max: 25, kind: 'buildMult', per: 0.12, req: 'workshop' },
    { id: 'bench', grp: 'Workshop', name: 'Design Bench', icon: '📐', desc: '+1 blueprint slot', year: 1996, base: 6000, grow: 2.2, max: 12, kind: 'bench', per: 1, req: 'workshop' },
    { id: 'cnc', grp: 'Workshop', name: 'Assembly Line', icon: '🏭', desc: 'Builds +0.4 PCs/s', year: 2005, base: 12000, grow: 1.3, max: 40, kind: 'build', per: 0.4, up: 6, req: 'workshop' },
    { id: 'roboline', grp: 'Workshop', name: 'Robotic Build Cells', icon: '🤖', desc: 'Builds +3 PCs/s', year: 2018, base: 100000, grow: 1.3, max: 40, kind: 'build', per: 3, up: 40, req: 'workshop' },
    // Service: repairs and warranties (see CS.SERVICES); no stock, no shelf space
    { id: 'svc_desk', grp: 'Service', name: 'Service Desk', icon: '🛎️', desc: 'Open a repair counter: walk-in repair jobs, plus extended warranties on every PC you sell. Takes no shelf space.', year: 1994, base: 5000, grow: 1, max: 1, kind: 'svc_desk', per: 1, verb: 'Open' },
    { id: 'svc_tech', grp: 'Service', name: 'Repair Technician', icon: '🧑‍🔧', desc: 'Handles +0.03 repair jobs/s (paid wage)', year: 1994, base: 900, grow: 1.35, max: 80, kind: 'svc', per: 0.03, up: 0.5, req: 'svc_desk' },
    { id: 'warranty', grp: 'Service', name: 'Warranty Pitch', icon: '📜', desc: '+3% of PC buyers add an extended warranty', year: 1994, base: 3000, grow: 1.6, max: 8, kind: 'warranty', per: 0.03, req: 'svc_desk' },
    { id: 'svc_bench', grp: 'Service', name: 'Diagnostic Bench', icon: '🩺', desc: 'Handles +0.3 repair jobs/s', year: 1998, base: 15000, grow: 1.25, max: 50, kind: 'svc', per: 0.3, up: 2, req: 'svc_desk' },
    { id: 'svc_remote', grp: 'Service', name: 'Remote Support Line', icon: '🎧', desc: 'Handles +3 repair jobs/s', year: 2008, base: 200000, grow: 1.25, max: 50, kind: 'svc', per: 3, up: 15, req: 'svc_desk' },
    { id: 'svc_ai', grp: 'Service', name: 'AI Triage', icon: '🤖', desc: 'Handles +25 repair jobs/s', year: 2022, base: 2e6, grow: 1.25, max: 50, kind: 'svc', per: 25, up: 80, req: 'svc_desk' },
  ];
  CS.UP_BY_ID = {};
  CS.UPGRADES.forEach((u) => (CS.UP_BY_ID[u.id] = u));

  /* ---------- Franchise HQ (permanent upgrades bought with Franchise Tokens) ---------- */
  CS.TOKEN_UPGRADES = [
    { id: 't_income', name: 'Brand Legacy', icon: '🏆', desc: '+10% customers, every run', base: 1, grow: 1.55, max: 40, per: 0.1 },
    { id: 't_profit', name: 'Premium Margins', icon: '💎', desc: '+3% revenue on every sale', base: 2, grow: 1.6, max: 30, per: 0.03 },
    { id: 't_cash', name: "Founder's Fund", icon: '💰', desc: '+$7,500 starting cash', base: 1, grow: 1.5, max: 10, per: 7500 },
    { id: 't_kit', name: 'Starter Kit', icon: '🧰', desc: 'Start with a Stock Clerk, ads, shelves and a sales associate (+1 level each, ads +2)', base: 2, grow: 2.0, max: 5, per: 1 },
    { id: 't_supply', name: 'Bulk Deals', icon: '📦', desc: '-1% wholesale & parts cost', base: 3, grow: 1.6, max: 15, per: 0.01 },
    { id: 't_cap', name: 'Mega Shelves', icon: '🏬', desc: '+10% shelf space', base: 2, grow: 1.6, max: 15, per: 0.1 },
    { id: 't_build', name: 'Master Builder', icon: '🔧', desc: '+5% custom PC quality', base: 3, grow: 1.7, max: 12, per: 0.05 },
    { id: 't_night', name: 'Night Shift Franchise', icon: '🌙', desc: '+2h of offline earnings', base: 3, grow: 2.0, max: 6, per: 2 },
    { id: 't_mgr', grp: 'Buyers', name: 'Head Hunter', icon: '🎯', desc: 'Your purchasing managers get +1 to every skill', base: 4, grow: 2.0, max: 5, per: 1 },
    { id: 't_mgr_deal', grp: 'Buyers', name: 'Bulk Contracts', icon: '📑', desc: 'Buyers get an extra -0.5% on purchase costs, stacking with their negotiation', base: 3, grow: 1.7, max: 10, per: 0.005 },
    { id: 't_mgr_wage', grp: 'Buyers', name: 'Loyalty Bonuses', icon: '🤗', desc: '-8% buyer wages', base: 2, grow: 1.6, max: 5, per: 0.08 },
    { id: 't_mgr_recruit', grp: 'Buyers', name: 'Recruiter Network', icon: '📇', desc: '-15% signing bonuses and candidate searches', base: 2, grow: 1.7, max: 4, per: 0.15 },
    { id: 't_mgr_academy', grp: 'Buyers', name: 'Corporate Academy', icon: '🎓', desc: '-10% buyer training costs', base: 2, grow: 1.6, max: 6, per: 0.1 },
    { id: 't_mgr_speed', grp: 'Buyers', name: 'Overnight Logistics', icon: '🚛', desc: '+15% buyer order speed', base: 2, grow: 1.6, max: 6, per: 0.15 },
    { id: 't_mgr_wide', grp: 'Buyers', name: 'Wider Aisles', icon: '🗂️', desc: 'Each buyer can stock +2 more products at once', base: 3, grow: 1.8, max: 5, per: 2 },
    { id: 't_mgr_free', grp: 'Buyers', name: 'Succession Plan', icon: '🪪', desc: 'The first hires of every new franchise have no signing bonus (1 per level)', base: 3, grow: 2.0, max: 4, per: 1 },
    { id: 't_mgr_office', grp: 'Buyers', name: 'Corner Office', icon: '🏢', desc: 'Every new franchise starts with the Purchasing Office already open (even before 1995)', base: 4, grow: 1, max: 1, per: 1 },
    { id: 't_warp', name: 'Time Warp', icon: '⏩', desc: '+15% calendar speed until 2015: the early decades fly by (the last ten years, where the money is, run at normal speed)', base: 2, grow: 1.6, max: 10, per: 0.15 },
    { id: 't_head', name: 'Head Start', icon: '🚀', desc: 'New franchises open later in history with cash to match: 1996, then 2000, then 2005', base: 4, grow: 2.2, max: 3, per: 1 },
    { id: 't_token', name: 'Franchise Consultant', icon: '🎫', desc: '+8% Franchise Tokens when you reset', base: 5, grow: 1.8, max: 20, per: 0.08 },
  ];
  CS.TUP_BY_ID = {};
  CS.TOKEN_UPGRADES.forEach((u) => (CS.TUP_BY_ID[u.id] = u));

  /* ---------- Events (calendar-driven, so they work offline) ---------- */
  CS.EVENTS = [
    { id: 'win95', from: 1995.6, to: 1996.4, name: 'Skylight 95 Launch Frenzy', demand: 1.35, text: 'Skylight 95 launches at midnight — customers are lining up around the block!' },
    { id: 'y2k', from: 1999.3, to: 2000.0, name: 'Y2K Panic Buying', demand: 1.5, text: 'Y2K panic! Everyone suddenly needs a "compliant" computer.' },
    { id: 'bust', from: 2000.3, to: 2002.0, name: 'Dot-Com Bust', demand: 0.8, text: 'The dot-com bubble bursts. Wallets snap shut.' },
    { id: 'xp', from: 2001.8, to: 2002.5, name: 'Skylight Ember Launch', demand: 1.2, text: 'Skylight Ember is out — upgraders are flooding in.' },
    { id: 'recession', from: 2008.7, to: 2010.0, name: 'Great Recession', demand: 0.75, text: 'Recession bites. Shoppers are only buying essentials.' },
    { id: 'crypto', from: 2017.5, to: 2018.8, name: 'Crypto Mining Craze', gpuCost: 2.4, text: 'Crypto miners are hoarding every graphics card on Earth!' },
    { id: 'lockdown', from: 2020.2, to: 2021.3, name: 'Work-From-Home Boom', demand: 1.6, text: 'Everyone is working from home and needs a computer. Yesterday.' },
    { id: 'shortage', from: 2021.0, to: 2022.8, name: 'Global Chip Shortage', partCost: 1.4, preCost: 1.2, text: 'Chip shortage! Wholesale prices are through the roof.' },
    { id: 'ai', from: 2023.4, to: 2026.9, name: 'AI Gold Rush', gpuCost: 1.6, demand: 1.15, text: 'The AI boom is draining GPU stock — and boosting interest in new PCs.' },
    { id: 'glasses', from: 2027.3, to: 2028.2, name: 'Smart-Glasses Craze', demand: 1.25, text: 'Everyone wants a PC that can drive their new smart glasses.' },
    { id: 'aiwinter', from: 2029.2, to: 2029.9, name: 'AI Winter', demand: 0.88, text: 'The AI hype cools off. Shoppers decide last year\'s PC is fine after all.' },
    { id: 'solar', from: 2030.6, to: 2031.1, name: 'Solar Storm Shortage', partCost: 1.3, gpuCost: 1.2, text: 'A solar storm knocks out two chip fabs. Parts are scarce and pricey.' },
    { id: 'quantum', from: 2032.1, to: 2033.3, name: 'Quantum Hype Bubble', demand: 1.35, text: 'Quantum computing is on every magazine cover. Nobody knows what it does; everybody wants one.' },
  ];

  /* ---------- Services (Service Desk) ----------
     Walk-in repair jobs: price in 1993 dollars (inflated by year), w = how common it is while offered. */
  CS.SERVICES = [
    { id: 'virus', name: 'Virus Removal', icon: '🦠', from: 1993, to: 2099, price: 79, w: 1.0 },
    { id: 'ram', name: 'Memory Upgrade, Fitted', icon: '📏', from: 1993, to: 2099, price: 59, w: 0.8 },
    { id: 'dialup', name: 'Dial-Up Internet Setup', icon: '📞', from: 1993, to: 2003, price: 49, w: 1.2 },
    { id: 'tuneup', name: 'Tune-Up & Defrag', icon: '🧹', from: 1995, to: 2012, price: 49, w: 0.8 },
    { id: 'data', name: 'Data Recovery', icon: '💾', from: 1997, to: 2099, price: 249, w: 0.4 },
    { id: 'y2k', name: 'Y2K Compliance Check', icon: '🐛', from: 1998.5, to: 2000.05, price: 39, w: 2.0 },
    { id: 'gpu', name: 'Graphics Card Install & Drivers', icon: '🎮', from: 2000, to: 2099, price: 69, w: 0.6 },
    { id: 'wifi', name: 'Wi-Fi Setup', icon: '📶', from: 2003, to: 2099, price: 69, w: 0.9 },
    { id: 'screen', name: 'Cracked Screen Repair', icon: '📱', from: 2010, to: 2099, price: 129, w: 1.2 },
    { id: 'aipc', name: 'AI PC Setup', icon: '🤖', from: 2024, to: 2099, price: 99, w: 0.9 },
    { id: 'glasses', name: 'Smart-Glasses Pairing', icon: '🥽', from: 2027, to: 2099, price: 79, w: 0.8 },
    { id: 'quantum', name: 'Quantum Driver Exorcism', icon: '⚛️', from: 2031, to: 2099, price: 149, w: 0.6 },
  ];

  /* ---------- Retail seasons (every year; from/to are fractions of the year) ----------
     demand multiplies all shoppers; kinds multiplies how often shoppers pick up that kind of item
     (game, acc, console, cgame, cacc). They behave like events: buyers forecast them, the Advisor warns ahead. */
  CS.SEASONS = [
    { id: 'lull', from: 0.0, to: 0.1, name: 'January Lull', demand: 0.85, text: 'January lull: everyone spent it all over the holidays.' },
    { id: 'summer', from: 0.48, to: 0.55, name: 'Summer Game Sale', kinds: { game: 1.8, cgame: 1.5 }, text: 'Summer Game Sale! School is out and the bargain bins are full of games.' },
    { id: 'school', from: 0.59, to: 0.7, name: 'Back to School', demand: 1.15, kinds: { acc: 1.4 }, text: 'Back to school: students need a computer, a printer and a bag to carry it all.' },
    { id: 'bfriday', from: 0.893, to: 0.915, name: 'Black Friday', demand: 1.7, text: 'Black Friday doorbusters! The queue started at 4 a.m.' },
    { id: 'holiday', from: 0.915, to: 0.98, name: 'Holiday Rush', demand: 1.3, kinds: { game: 1.5, acc: 1.2, console: 1.6, cgame: 1.5, cacc: 1.4 }, text: 'Holiday rush: consoles and games are top of every wish list.' },
  ];

  CS.HEADLINES = {
    win95: [
      'Local teen claims he can "surf the information superhighway" from his bedroom',
      'Modem prices dropping — 28.8k is the new 14.4k',
      'Pet rock sales slump as virtual pets take off',
      'Experts: 8MB of RAM "should be enough for anybody"',
      'Customer asks if the computer comes with the Internet included',
    ],
    xp: [
      'Burning CDs is now "the" way to share music, says everybody',
      'Customer asks which button is the "any" key',
      'Flat-panel monitors now only cost a kidney',
      'Wireless networking promises to end cable clutter forever',
      'Local man still running Skylight 98 "because it works"',
    ],
    flat: [
      'Everything is rounded rectangles now',
      'Customers keep asking if we sell phones',
      'Cloud storage: someone else\'s computer, but expensive',
      'Local gamer insists SSD "changed his life"',
      'Tablet sales rising; desktop sales declared dead for the 12th time',
    ],
    rgb: [
      'Customer demands RGB on the RGB',
      'Case with four glass panels "just feels right" says streamer',
      'Everyone\'s PC now has a cooling fan on the cooling fan',
      'Teen builds first PC thanks to a video tutorial',
      'Cable management declared an art form',
      'Local shop owner still not sure what "the cloud" is',
    ],
    holo: [
      'Customer returns smart glasses: "kept seeing my inbox in the clouds"',
      'Holo-desk owners report record levels of waving at nothing',
      'Quantum PC finishes the task before you start it, mostly',
      'Local grandparent asks the PC to "turn itself off and on again", PC complies',
      'Storage now so cheap people have forgotten what deleting is',
      'Retro collectors pay fortunes for beige 1990s towers',
    ],
  };

  /* ---------- Achievements ---------- */
  // ok = earned; p = rough progress (0..1, may pass 1) for Game Center's progress rings.
  CS.ACH = [
    { id: 'a_first', name: 'Open for Business', desc: 'Sell your first computer', ok: (s) => s.stats.sold >= 1, p: (s) => s.stats.sold / 1 },
    { id: 'a_s100', name: 'Brisk Trade', desc: 'Sell 100 computers', ok: (s) => s.stats.sold >= 100, p: (s) => s.stats.sold / 100 },
    { id: 'a_s1k', name: 'Local Legend', desc: 'Sell 1,000 computers', ok: (s) => s.stats.sold >= 1000, p: (s) => s.stats.sold / 1000 },
    { id: 'a_s10k', name: 'Regional Chain', desc: 'Sell 10,000 computers', ok: (s) => s.stats.sold >= 10000, p: (s) => s.stats.sold / 10000 },
    { id: 'a_s100k', name: 'Household Name', desc: 'Sell 100,000 computers', ok: (s) => s.stats.sold >= 100000, p: (s) => s.stats.sold / 100000 },
    { id: 'a_s1m', name: 'Computer Empire', desc: 'Sell 1,000,000 computers', ok: (s) => s.stats.sold >= 1e6, p: (s) => s.stats.sold / 1e6 },
    { id: 'a_c10k', name: 'Five Figures', desc: 'Hold $10,000', ok: (s) => s.cash >= 1e4, p: (s) => s.cash / 1e4 },
    { id: 'a_c1m', name: 'Millionaire', desc: 'Hold $1,000,000', ok: (s) => s.cash >= 1e6, p: (s) => s.cash / 1e6 },
    { id: 'a_c1b', name: 'Billionaire', desc: 'Hold $1,000,000,000', ok: (s) => s.cash >= 1e9, p: (s) => s.cash / 1e9 },
    { id: 'a_c1t', name: 'Trillionaire', desc: 'Hold $1,000,000,000,000', ok: (s) => s.cash >= 1e12, p: (s) => s.cash / 1e12 },
    { id: 'a_y1996', name: 'Multimedia Pioneer', desc: 'Reach 1996', ok: (s) => s.cal >= 3, p: (s) => s.cal / 3 },
    { id: 'a_y2000', name: 'Survived Y2K', desc: 'Reach 2000', ok: (s) => s.cal >= 7, p: (s) => s.cal / 7 },
    { id: 'a_y2010', name: 'Flat Earth Society', desc: 'Reach 2010', ok: (s) => s.cal >= 17, p: (s) => s.cal / 17 },
    { id: 'a_y2020', name: 'Stay-At-Home', desc: 'Reach 2020', ok: (s) => s.cal >= 27, p: (s) => s.cal / 27 },
    { id: 'a_today', name: 'Back to the Present', desc: 'Reach today', ok: (s) => s.cal >= 33.79, p: (s) => s.cal / 33.79 },
    { id: 'a_y2030', name: 'Future Proof', desc: 'Reach 2030', ok: (s) => s.cal >= 37, p: (s) => s.cal / 37 },
    { id: 'a_end', name: 'End of the Roadmap', desc: 'Reach October 2035', ok: (s) => s.cal >= 42.79, p: (s) => s.cal / 42.79 },
    { id: 'a_b1', name: 'Home Brew', desc: 'Build your first PC', ok: (s) => s.stats.built >= 1, p: (s) => s.stats.built / 1 },
    { id: 'a_b100', name: 'Screwdriver Wizard', desc: 'Build 100 PCs', ok: (s) => s.stats.built >= 100, p: (s) => s.stats.built / 100 },
    { id: 'a_b3', name: 'Product Line', desc: 'Have 3 blueprints at once', ok: (s) => s.bps.length >= 3, p: (s) => s.bps.length / 3 },
    { id: 'a_game100', name: 'Game Night', desc: 'Sell 100 PC games', ok: (s) => (s.stats.soldGames || 0) >= 100, p: (s) => (s.stats.soldGames || 0) / 100 },
    { id: 'a_acc100', name: 'Accessorised', desc: 'Sell 100 accessories', ok: (s) => (s.stats.soldAcc || 0) >= 100, p: (s) => (s.stats.soldAcc || 0) / 100 },
    { id: 'a_mgr1', name: 'Delegation', desc: 'Hire your first purchasing manager', ok: (s) => !!s.mgr && Object.values(s.mgr).some(Boolean), p: (s) => (s.mgr ? Object.values(s.mgr).filter(Boolean).length : 0) / 1 },
    { id: 'a_mgr4', name: 'Full Buying Team', desc: 'Employ buyers in four categories at once', ok: (s) => !!s.mgr && Object.values(s.mgr).filter(Boolean).length >= 4, p: (s) => (s.mgr ? Object.values(s.mgr).filter(Boolean).length : 0) / 4 },
    { id: 'a_con100', name: 'Player Two', desc: 'Sell 100 consoles', ok: (s) => (s.stats.soldConsoles || 0) >= 100, p: (s) => (s.stats.soldConsoles || 0) / 100 },
    { id: 'a_con1k', name: 'Console Wars', desc: 'Sell 1,000 consoles', ok: (s) => (s.stats.soldConsoles || 0) >= 1000, p: (s) => (s.stats.soldConsoles || 0) / 1000 },
    { id: 'a_cg1k', name: 'Backlog Builder', desc: 'Sell 1,000 console games', ok: (s) => (s.stats.soldCGames || 0) >= 1000, p: (s) => (s.stats.soldCGames || 0) / 1000 },
    { id: 'a_fix1k', name: 'Have You Tried Turning It Off?', desc: 'Complete 1,000 repair jobs', ok: (s) => (s.stats.repairs || 0) >= 1000, p: (s) => (s.stats.repairs || 0) / 1000 },
    { id: 'a_warr1k', name: 'Peace of Mind', desc: 'Sell 1,000 extended warranties', ok: (s) => (s.stats.warranties || 0) >= 1000, p: (s) => (s.stats.warranties || 0) / 1000 },
    { id: 'a_hustle', name: 'Door-to-Door', desc: 'Hustle 100 times', ok: (s) => s.stats.hustles >= 100, p: (s) => s.stats.hustles / 100 },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
