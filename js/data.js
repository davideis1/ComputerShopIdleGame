/* Static game data: eras, products, parts, upgrades, events, achievements.
   All brand and product names are parodies. */
(function (g) {
  const CS = (g.CS = g.CS || {});

  CS.C = {
    START_YEAR: 1993,
    END_CAL: 33.8, // calendar stops at "today" (Oct 2026)
    YEAR_SECONDS: 300, // real seconds per in-game year while playing
    OFFLINE_CAL_RATE: 0.25, // calendar speed while the shop is closed
    G: 1.28, // yearly tech improvement factor
    SALE_WINDOW: 6, // years a prebuilt can be re-ordered from distributors
    PART_WINDOW: 6, // years a part stays orderable
    START_CASH: 5000,
    SAVE_KEY: 'csig-save-v1',
    VERSION: 1,
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
  ];

  /* ---------- Parts ---------- */
  CS.SLOTS = [
    { id: 'case', name: 'Case & PSU', icon: '🧱', w: 0.05, base: 90, grow: 1.025 },
    { id: 'cpu', name: 'Processor', icon: '🧠', w: 0.3, base: 280, grow: 1.032 },
    { id: 'ram', name: 'Memory', icon: '📏', w: 0.15, base: 150, grow: 1.018 },
    { id: 'storage', name: 'Storage', icon: '💾', w: 0.15, base: 170, grow: 1.0 },
    { id: 'gpu', name: 'Graphics', icon: '🎮', w: 0.25, base: 110, grow: 1.075 },
    { id: 'os', name: 'Software', icon: '🪟', w: 0.1, base: 80, grow: 1.02 },
  ];

  // [slot, year, 'budget|standard|premium']
  const GENS = [
    ['cpu', 1993, 'Cyrex 486 SLC-33|Intal 486 DX2-66|AMB Am486 DX4-100'],
    ['cpu', 1995, 'Cyrex 6x86 P120+|Intal Pentum 100|Intal Pentum 133'],
    ['cpu', 1997, 'AMB K6-200|Intal Pentum MMX 233|Intal Pentum II 300'],
    ['cpu', 1999, 'Intal Celerone 466|Intal Pentum III 600|AMB Athalon 750'],
    ['cpu', 2001, 'AMB Duran 1.0GHz|Intal Pentum 4 1.8GHz|AMB Athalon XP 2000+'],
    ['cpu', 2004, 'Intal Celerone D 2.6|Intal Pentum 4 Prescot 3.2|AMB Athalon 64 FX-55'],
    ['cpu', 2006, 'AMB Sempran 3200+|Intal Core 2 Duo E6600|Intal Core 2 Extremo QX6700'],
    ['cpu', 2009, 'AMB Phenom II X2|Intal Core i5-750|Intal Core i7-920'],
    ['cpu', 2012, 'AMB FX-6300|Intal Core i5-3570K|Intal Core i7-3770K'],
    ['cpu', 2015, 'Intal Pentum G4400|Intal Core i5-6600K|Intal Core i7-6700K'],
    ['cpu', 2017, 'Rizen 3 1200|Rizen 5 1600|Rizen 7 1800X'],
    ['cpu', 2019, 'Rizen 5 3600|Intal Core i7-9700K|Rizen 9 3900X'],
    ['cpu', 2021, 'Intal Core i3-12100|Rizen 5 5600X|Intal Core i9-12900K'],
    ['cpu', 2023, 'Rizen 5 7600|Intal Core i7-14700K|Rizen 9 7950X3D'],
    ['cpu', 2025, 'Rizen 5 9600X|Intal Core Ultra 7 265K|Rizen 9 9950X3D'],

    ['ram', 1993, 'Kingstun 4MB SIMM|Kingstun 8MB SIMM|Crucible 16MB SIMM'],
    ['ram', 1996, 'Kingstun 16MB EDO|Crucible 32MB EDO|Crucible 64MB EDO'],
    ['ram', 1998, 'Kingstun 64MB SDRAM|Crucible 128MB SDRAM|Corsiar 256MB SDRAM'],
    ['ram', 2002, 'Kingstun 256MB DDR|Crucible 512MB DDR|Corsiar 1GB DDR'],
    ['ram', 2005, 'Kingstun 512MB DDR2|Crucible 1GB DDR2|Corsiar 2GB DDR2'],
    ['ram', 2008, 'Kingstun 2GB DDR3|Crucible 4GB DDR3|Corsiar 8GB DDR3'],
    ['ram', 2012, 'Kingstun 4GB DDR3-1600|Crucible 8GB DDR3-1866|Corsiar 16GB Vengeance'],
    ['ram', 2015, 'Kingstun 8GB DDR4|Crucible 16GB DDR4|Corsiar 32GB DDR4'],
    ['ram', 2018, 'Kingstun 8GB DDR4-3200|Crucible 16GB DDR4-3600|Corsiar 32GB RGB DDR4'],
    ['ram', 2021, 'Kingstun 16GB DDR5|Crucible 32GB DDR5|Corsiar 64GB DDR5'],
    ['ram', 2024, 'Kingstun 32GB DDR5-6000|Crucible 64GB DDR5-6400|Corsiar 96GB DDR5-7200'],

    ['storage', 1993, 'Seagull 120MB HDD|Seagull 340MB HDD|Eastern Digital 540MB HDD'],
    ['storage', 1996, 'Seagull 1.2GB HDD|Eastern Digital 2.5GB HDD|Quantam 4.3GB HDD'],
    ['storage', 1999, 'Seagull 8GB HDD|Eastern Digital 20GB 7200rpm|Quantam 40GB HDD'],
    ['storage', 2003, 'Seagull 80GB HDD|Eastern Digital 120GB HDD|Quantam 250GB HDD'],
    ['storage', 2006, 'Seagull 160GB SATA|Eastern Digital 320GB SATA|Seagull 500GB SATA'],
    ['storage', 2009, 'Eastern Digital 500GB|Seagull 1TB|Eastern Digital 2TB Black'],
    ['storage', 2011, 'Samsong 64GB SSD|Samsong 128GB SSD|Intal 256GB SSD'],
    ['storage', 2014, 'Samsong 250GB SSD|Samsong 500GB SSD|Samsong 1TB SSD'],
    ['storage', 2017, 'Samsong 250GB NVMe|Samsong 500GB NVMe|Samsong 1TB NVMe'],
    ['storage', 2020, 'Samsong 500GB Gen4|Samsong 1TB Gen4|Samsong 2TB Gen4'],
    ['storage', 2023, 'Samsong 1TB Gen4|Samsong 2TB Gen4|Samsong 4TB Gen5'],

    ['gpu', 1993, 'Tridant VGA 1MB|S4 Trio 64 2MB|Matroxx Millenium 2MB'],
    ['gpu', 1996, 'S4 ViRGE 3D|3dfax Voodude 1|Matroxx Mystique 220'],
    ['gpu', 1998, 'ATE Rage Pro|Envidia Riva TNT|3dfax Voodude 2 SLI'],
    ['gpu', 1999, 'ATE Rage 128|Envidia GoForce 256|Envidia GoForce 2 GTS'],
    ['gpu', 2001, 'ATE Radian 7500|Envidia GoForce 3|ATE Radian 8500'],
    ['gpu', 2004, 'ATE Radian 9600|Envidia GoForce 6600 GT|Envidia GoForce 6800 Ultra'],
    ['gpu', 2006, 'Envidia GoForce 7600 GT|ATE Radian X1900|Envidia GoForce 8800 GTX'],
    ['gpu', 2009, 'ATE Radian HD 5770|Envidia GoForce GTX 460|ATE Radian HD 5870'],
    ['gpu', 2012, 'ATE Radian HD 7770|Envidia GoForce GTX 660|Envidia GoForce GTX 680'],
    ['gpu', 2015, 'Envidia GoForce GTX 960|Envidia GoForce GTX 970|Envidia GoForce GTX 980 Ti'],
    ['gpu', 2017, 'Radian RX 580|Envidia GoForce GTX 1070|Envidia GoForce GTX 1080 Ti'],
    ['gpu', 2019, 'Envidia GoForce GTX 1660 S|Envidia GoForce RTX 2070 S|Envidia GoForce RTX 2080 Ti'],
    ['gpu', 2021, 'Radian RX 6600 XT|Envidia GoForce RTX 3070|Envidia GoForce RTX 3090'],
    ['gpu', 2023, 'Envidia GoForce RTX 4060|Envidia GoForce RTX 4070 S|Envidia GoForce RTX 4090'],
    ['gpu', 2025, 'Radian RX 9060 XT|Envidia GoForce RTX 5070|Envidia GoForce RTX 5090'],

    ['case', 1993, 'Beige Mini-Tower|Beige Mid-Tower|Big Beige Full Tower'],
    ['case', 1999, 'Plain Black Mid-Tower|Translucent Blue Mid-Tower|Aluminum Full Tower'],
    ['case', 2005, 'Budget Steel ATX|Windowed Mid-Tower|Aluminum Gaming Tower'],
    ['case', 2009, 'Basic ATX Tower|Black Mid-Tower w/ Window|Cooler Master-Race Tower'],
    ['case', 2012, 'Quiet Mid-Tower|Windowed Silent Tower|Full Tower w/ Fan Wall'],
    ['case', 2017, 'RGB Mesh Mid-Tower|Tempered Glass Mid-Tower|Dual-Chamber Showcase'],
    ['case', 2022, 'Airflow Mesh Mid-Tower|White Glass Mid-Tower|Fish Tank Mega-Case'],

    ['os', 1993, 'MS-DOS 6.22 + Windoze 3.1|Windoze for Workgroups 3.11|OS/3 Warp'],
    ['os', 1995, 'Windoze 95 Lite|Windoze 95|Windoze 95 Plus!'],
    ['os', 1998, 'Windoze 98|Windoze 98 SE|Windoze NT 4 Workstation'],
    ['os', 2001, 'Windoze XP Home|Windoze XP Pro|Windoze XP Media Center'],
    ['os', 2007, 'Windoze Vista Basic|Windoze Vista Premium|Windoze Vista Ultimate'],
    ['os', 2009, 'Windoze 7 Starter|Windoze 7 Home|Windoze 7 Ultimate'],
    ['os', 2015, 'Windoze 10 Home|Windoze 10 Pro|Windoze 10 Enterprise'],
    ['os', 2021, 'Windoze 11 Home|Windoze 11 Pro|Windoze 11 Pro for Workstations'],
  ];

  const TIERS = [
    { label: 'Budget', q: 0.7 },
    { label: 'Standard', q: 1.0 },
    { label: 'Premium', q: 1.45 },
  ];

  CS.PARTS = [];
  GENS.forEach(([slot, year, names]) => {
    names.split('|').forEach((name, i) => {
      CS.PARTS.push({ id: slot + '_' + year + '_' + i, slot, year, name, tier: TIERS[i].label, q: TIERS[i].q });
    });
  });
  // Evergreen cheap options that always keep pace with the era
  CS.PARTS.push({ id: 'gpu_igp', slot: 'gpu', year: 1993, name: 'Integrated Graphics', tier: 'Onboard', q: 0.4, rolling: true });
  CS.PARTS.push({ id: 'os_free', slot: 'os', year: 1993, name: 'Linucks (free, some assembly required)', tier: 'Free', q: 0.55, rolling: true, free: true });
  CS.PART_BY_ID = {};
  CS.PARTS.forEach((p) => (CS.PART_BY_ID[p.id] = p));
  CS.SLOT_BY_ID = {};
  CS.SLOTS.forEach((s) => (CS.SLOT_BY_ID[s.id] = s));

  /* ---------- Prebuilt products ---------- */
  // id, brand, name, year, launch price, retail margin, quality, icon
  const PRE = [
    ['compac_425', 'Compac', 'Pressario 425', 1993, 1199, 0.13, 0.85, '🖥️'],
    ['pbell_leg', 'Packerd Bell', 'Legendary 486', 1993, 999, 0.1, 0.7, '🖥️'],
    ['ibn_vp', 'IBN', 'ValuePoint 466', 1993, 1699, 0.18, 1.0, '🖥️'],
    ['gate_486', 'Gatewhey', '2K 486DX2/66', 1993, 1899, 0.18, 1.15, '🖥️'],
    ['dall_466', 'Dall', 'Dimension 466V', 1993, 1599, 0.16, 1.0, '🖥️'],
    ['ample_q650', 'Ample', 'Macintoss Quadro 650', 1993, 2599, 0.22, 1.2, '🖥️'],
    ['compac_lte', 'Compac', 'LTE Elite Notebook', 1994, 2299, 0.2, 0.7, '💻'],
    ['compac_p90', 'Compac', 'Pressario 7100 Pentum', 1995, 1799, 0.14, 0.95, '🖥️'],
    ['ibn_apt', 'IBN', 'Aptiva Pentum', 1995, 1899, 0.15, 1.0, '🖥️'],
    ['gate_p5', 'Gatewhey', 'P5-100 Big Cow', 1995, 2099, 0.17, 1.1, '🖥️'],
    ['dall_xps100', 'Dall', 'XPS P100', 1995, 2299, 0.18, 1.15, '🖥️'],
    ['ample_pm', 'Ample', 'Power Macintoss 7500', 1995, 2499, 0.22, 1.1, '🖥️'],
    ['compac_pii', 'Compac', 'Pressario 2200 Pentum II', 1997, 1499, 0.12, 0.95, '🖥️'],
    ['gate_g6', 'Gatewhey', 'G6-266', 1997, 1999, 0.16, 1.1, '🖥️'],
    ['dall_d300', 'Dall', 'XPS D300', 1997, 2499, 0.17, 1.25, '🖥️'],
    ['sunny_505', 'Sunny', 'Vaya 505 Ultra-Slim', 1997, 1999, 0.24, 0.75, '💻'],
    ['emach_et', 'eMachinez', 'eTowel 266', 1998, 599, 0.08, 0.7, '🖥️'],
    ['ample_imack', 'Ample', 'iMack Bondi Blue', 1998, 1299, 0.22, 1.0, '🖥️'],
    ['gate_sel', 'Gatewhey', 'Select 600 Pentum III', 1999, 1899, 0.16, 1.1, '🖥️'],
    ['hp_pav', 'Hewlitt-Pickard', 'Pavillion 6700', 1999, 1299, 0.13, 0.95, '🖥️'],
    ['ample_g4', 'Ample', 'Power Mack G4', 1999, 1599, 0.22, 1.2, '🖥️'],
    ['ample_qube', 'Ample', 'G4 Qube', 2000, 1799, 0.22, 0.9, '🖥️'],
    ['dall_4100', 'Dall', 'Dimension 4100', 2001, 1399, 0.15, 1.0, '🖥️'],
    ['ample_ibock', 'Ample', 'iBock Clamshell', 2001, 1299, 0.23, 0.9, '💻'],
    ['acre_asp', 'Acre', 'Aspyre Budget Tower', 2003, 699, 0.08, 0.8, '🖥️'],
    ['alien_a52', 'Alienwear', 'Area-52', 2004, 2999, 0.25, 1.5, '👽'],
    ['ample_mbp', 'Ample', 'MacBuck Pro 15"', 2006, 1999, 0.22, 1.1, '💻'],
    ['dall_xps710', 'Dall', 'XPS 710 Rocket', 2006, 2999, 0.2, 1.4, '🖥️'],
    ['alien_aur', 'Alienwear', 'Aurora ALX', 2006, 3999, 0.26, 1.6, '👽'],
    ['azus_eee', 'Azus', 'Eee-Eee PC Netbook', 2008, 399, 0.08, 0.5, '💻'],
    ['ample_air', 'Ample', 'MacBuck Aire', 2008, 1799, 0.24, 0.9, '💻'],
    ['ample_iped', 'Ample', 'iPed Tablet', 2010, 499, 0.25, 0.6, '📱'],
    ['chrome_q', 'Chromebooq', 'Cloud-Only Laptop', 2011, 349, 0.1, 0.5, '💻'],
    ['ms_surf', 'Microsaft', 'Surfaced RT', 2012, 499, 0.1, 0.5, '📱'],
    ['dall_xps13', 'Dall', 'XPS 13 Developer', 2014, 1299, 0.16, 1.0, '💻'],
    ['alien_a51', 'Alienwear', 'Area-51 R2', 2014, 2199, 0.24, 1.4, '👽'],
    ['ms_book', 'Microsaft', 'Surfaced Book', 2015, 1499, 0.2, 1.0, '💻'],
    ['rayzer_bs', 'Rayzer', 'Blayde Stealth', 2016, 1799, 0.22, 1.2, '🐍'],
    ['msy_titan', 'MSY', 'Titan Gaming Laptop', 2016, 2499, 0.22, 1.4, '🎮'],
    ['leno_leg', 'Lenovoh', 'Legion Y540', 2019, 1099, 0.14, 1.0, '🎮'],
    ['ample_pro', 'Ample', 'Mac Pro Cheese Grater', 2019, 5999, 0.3, 2.0, '🧀'],
    ['ample_z1', 'Ample', 'MacBuck Air Z1', 2020, 999, 0.22, 1.5, '💻'],
    ['alien_r13', 'Alienwear', 'Aurora R13', 2021, 2299, 0.24, 1.4, '👽'],
    ['ms_pro8', 'Microsaft', 'Surfaced Pro 8', 2021, 1099, 0.2, 1.0, '📱'],
    ['valve_deck', 'Valv', 'Steem Deck Handheld', 2022, 399, 0.06, 0.6, '🕹️'],
    ['ample_mini', 'Ample', 'Mac Mini Pro', 2023, 1299, 0.22, 1.2, '📦'],
    ['ms_copi', 'Microsaft', 'Copiloot+ Surfaced Laptop', 2024, 999, 0.15, 1.1, '💻'],
    ['dall_pmp', 'Dall', 'Pro Max Plus Premium', 2025, 1899, 0.15, 1.2, '💻'],
    ['env_dgx', 'Envidia', 'DGX Sparkle AI Box', 2025, 2999, 0.25, 1.6, '🤖'],
    ['rayzer_b18', 'Rayzer', 'Blayde 18 Pro', 2025, 3299, 0.24, 1.5, '🐍'],
    ['ample_studio', 'Ample', 'Mac Studio Ultra Max', 2025, 3999, 0.28, 1.8, '📦'],
  ];
  CS.PRODUCTS = PRE.map(([id, brand, name, year, price, m, q, icon]) => ({ id, brand, name, year, price, m, q, icon }));
  CS.PRODUCT_BY_ID = {};
  CS.PRODUCTS.forEach((p) => (CS.PRODUCT_BY_ID[p.id] = p));

  /* ---------- Upgrades ----------
     kind: effect key; per: effect per level; up: upkeep $/s per level (inflation scaled) */
  CS.UPGRADES = [
    // Shop
    { id: 'shelf', grp: 'Shop', name: 'Shop Floor Expansion', icon: '🏬', desc: '+8 units of shelf space', year: 1993, base: 500, grow: 1.5, max: 30, kind: 'cap', per: 8 },
    { id: 'supplier', grp: 'Shop', name: 'Distributor Account', icon: '🤝', desc: '-1.5% wholesale & parts cost', year: 1993, base: 1800, grow: 1.5, max: 20, kind: 'disc', per: 0.015 },
    { id: 'loyalty', grp: 'Shop', name: 'Loyalty Punch Cards', icon: '🎟️', desc: '+3% customers', year: 1994, base: 1200, grow: 1.6, max: 25, kind: 'loyal', per: 0.03 },
    { id: 'night', grp: 'Shop', name: 'Night Lock-Up & Cameras', icon: '🔒', desc: '+2h of offline earnings', year: 1993, base: 4000, grow: 3.2, max: 8, kind: 'night', per: 2 },
    // Marketing
    { id: 'ads_news', grp: 'Marketing', name: 'Classified Ads', icon: '📰', desc: '+0.03 customers/s', year: 1993, base: 250, grow: 1.28, max: 60, kind: 'lambda', per: 0.03 },
    { id: 'ads_tv', grp: 'Marketing', name: 'Late-Night Infomercials', icon: '📺', desc: '+0.07 customers/s', year: 1994, base: 1800, grow: 1.3, max: 60, kind: 'lambda', per: 0.07 },
    { id: 'ads_web', grp: 'Marketing', name: 'Geocities Web Page', icon: '🌐', desc: '+0.15 customers/s', year: 1996, base: 8000, grow: 1.3, max: 60, kind: 'lambda', per: 0.15 },
    { id: 'ads_ecom', grp: 'Marketing', name: 'E-Commerce Checkout', icon: '🛒', desc: '+0.35 customers/s', year: 1999, base: 40000, grow: 1.3, max: 60, kind: 'lambda', per: 0.35 },
    { id: 'ads_seo', grp: 'Marketing', name: 'Search Engine Optimization', icon: '🔎', desc: '+0.9 customers/s', year: 2003, base: 220000, grow: 1.3, max: 60, kind: 'lambda', per: 0.9 },
    { id: 'ads_social', grp: 'Marketing', name: 'Social Media Presence', icon: '👍', desc: '+2.2 customers/s', year: 2009, base: 1.2e6, grow: 1.3, max: 60, kind: 'lambda', per: 2.2 },
    { id: 'ads_influ', grp: 'Marketing', name: 'Influencer Sponsorships', icon: '🤳', desc: '+5.5 customers/s', year: 2015, base: 7e6, grow: 1.3, max: 60, kind: 'lambda', per: 5.5 },
    { id: 'ads_ai', grp: 'Marketing', name: 'AI Sales Chatbot', icon: '🤖', desc: '+14 customers/s', year: 2023, base: 4e7, grow: 1.3, max: 60, kind: 'lambda', per: 14 },
    // Checkout
    { id: 'sales', grp: 'Checkout', name: 'Sales Associate', icon: '🧑‍💼', desc: 'Serves +0.12 customers/s (paid wage)', year: 1993, base: 600, grow: 1.38, max: 80, kind: 'serve', per: 0.12, up: 0.35 },
    { id: 'training', grp: 'Checkout', name: 'Sales Training Seminar', icon: '🎓', desc: '+10% checkout speed', year: 1994, base: 2500, grow: 1.7, max: 20, kind: 'serveMult', per: 0.1 },
    { id: 'barcode', grp: 'Checkout', name: 'Barcode Scanners', icon: '🏷️', desc: 'Serves +0.4 customers/s', year: 1994, base: 3000, grow: 1.4, max: 50, kind: 'serve', per: 0.4 },
    { id: 'pos', grp: 'Checkout', name: 'POS Terminals', icon: '🧾', desc: 'Serves +1.2 customers/s', year: 1999, base: 25000, grow: 1.4, max: 50, kind: 'serve', per: 1.2 },
    { id: 'selfcheck', grp: 'Checkout', name: 'Self-Checkout Kiosks', icon: '🖲️', desc: 'Serves +4 customers/s', year: 2007, base: 300000, grow: 1.4, max: 50, kind: 'serve', per: 4 },
    { id: 'tap', grp: 'Checkout', name: 'Tap-to-Pay Everywhere', icon: '📲', desc: 'Serves +14 customers/s', year: 2014, base: 3e6, grow: 1.4, max: 50, kind: 'serve', per: 14 },
    { id: 'autocheck', grp: 'Checkout', name: 'Just-Walk-Out Cameras', icon: '📷', desc: 'Serves +50 customers/s', year: 2022, base: 3e7, grow: 1.4, max: 50, kind: 'serve', per: 50 },
    // Stock handling
    { id: 'clerk', grp: 'Stock', name: 'Stock Clerk (auto-restock)', icon: '📦', desc: 'Restocks +0.3 units/s toward your targets', year: 1993, base: 450, grow: 1.7, max: 40, kind: 'restock', per: 0.3, up: 0.5 },
    { id: 'warehouse', grp: 'Stock', name: 'Warehouse Forklift Crew', icon: '🚜', desc: 'Restocks +2 units/s', year: 2000, base: 60000, grow: 1.5, max: 40, kind: 'restock', per: 2, up: 2 },
    { id: 'robot', grp: 'Stock', name: 'Robotic Fulfilment', icon: '🦾', desc: 'Restocks +12 units/s', year: 2015, base: 4e6, grow: 1.5, max: 40, kind: 'restock', per: 12, up: 10 },
    // Workshop
    { id: 'workshop', grp: 'Workshop', name: 'Build Workshop', icon: '🛠️', desc: 'Unlocks custom PC building. Buy parts, design blueprints, sell your own machines.', year: 1996, base: 12000, grow: 1, max: 1, kind: 'workshop', per: 1 },
    { id: 'techs', grp: 'Workshop', name: 'Build Technician', icon: '👷', desc: 'Builds 1 PC per 40s (paid wage)', year: 1996, base: 1500, grow: 1.45, max: 80, kind: 'build', per: 0.025, up: 0.8, req: 'workshop' },
    { id: 'tools', grp: 'Workshop', name: 'Anti-Static Mats & Better Tools', icon: '🧰', desc: '+12% build speed', year: 1996, base: 3500, grow: 1.6, max: 25, kind: 'buildMult', per: 0.12, req: 'workshop' },
    { id: 'bench', grp: 'Workshop', name: 'Design Bench', icon: '📐', desc: '+1 blueprint slot', year: 1996, base: 6000, grow: 2.2, max: 12, kind: 'bench', per: 1, req: 'workshop' },
    { id: 'cnc', grp: 'Workshop', name: 'Assembly Line', icon: '🏭', desc: 'Builds +0.4 PCs/s', year: 2005, base: 400000, grow: 1.5, max: 40, kind: 'build', per: 0.4, up: 6, req: 'workshop' },
    { id: 'roboline', grp: 'Workshop', name: 'Robotic Build Cells', icon: '🤖', desc: 'Builds +3 PCs/s', year: 2018, base: 2.5e7, grow: 1.5, max: 40, kind: 'build', per: 3, up: 40, req: 'workshop' },
  ];
  CS.UP_BY_ID = {};
  CS.UPGRADES.forEach((u) => (CS.UP_BY_ID[u.id] = u));

  /* ---------- Events (calendar-driven, so they work offline) ---------- */
  CS.EVENTS = [
    { id: 'win95', from: 1995.6, to: 1996.4, name: 'Windoze 95 Launch Frenzy', demand: 1.35, text: 'Windoze 95 launches at midnight — customers are lining up around the block!' },
    { id: 'y2k', from: 1999.3, to: 2000.0, name: 'Y2K Panic Buying', demand: 1.5, text: 'Y2K panic! Everyone suddenly needs a "compliant" computer.' },
    { id: 'bust', from: 2000.3, to: 2002.0, name: 'Dot-Com Bust', demand: 0.8, text: 'The dot-com bubble bursts. Wallets snap shut.' },
    { id: 'xp', from: 2001.8, to: 2002.5, name: 'Windoze XP Launch', demand: 1.2, text: 'Windoze XP is out — upgraders are flooding in.' },
    { id: 'recession', from: 2008.7, to: 2010.0, name: 'Great Recession', demand: 0.75, text: 'Recession bites. Shoppers are only buying essentials.' },
    { id: 'crypto', from: 2017.5, to: 2018.8, name: 'Crypto Mining Craze', gpuCost: 2.4, text: 'Crypto miners are hoarding every graphics card on Earth!' },
    { id: 'lockdown', from: 2020.2, to: 2021.3, name: 'Work-From-Home Boom', demand: 1.6, text: 'Everyone is working from home and needs a computer. Yesterday.' },
    { id: 'shortage', from: 2021.0, to: 2022.8, name: 'Global Chip Shortage', partCost: 1.4, preCost: 1.2, text: 'Chip shortage! Wholesale prices are through the roof.' },
    { id: 'ai', from: 2023.4, to: 2026.9, name: 'AI Gold Rush', gpuCost: 1.6, demand: 1.15, text: 'The AI boom is draining GPU stock — and boosting interest in new PCs.' },
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
      'Local man still running Windoze 98 "because it works"',
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
  };

  /* ---------- Achievements ---------- */
  CS.ACH = [
    { id: 'a_first', name: 'Open for Business', desc: 'Sell your first computer', ok: (s) => s.stats.sold >= 1 },
    { id: 'a_s100', name: 'Brisk Trade', desc: 'Sell 100 computers', ok: (s) => s.stats.sold >= 100 },
    { id: 'a_s1k', name: 'Local Legend', desc: 'Sell 1,000 computers', ok: (s) => s.stats.sold >= 1000 },
    { id: 'a_s10k', name: 'Regional Chain', desc: 'Sell 10,000 computers', ok: (s) => s.stats.sold >= 10000 },
    { id: 'a_s100k', name: 'Household Name', desc: 'Sell 100,000 computers', ok: (s) => s.stats.sold >= 100000 },
    { id: 'a_s1m', name: 'Computer Empire', desc: 'Sell 1,000,000 computers', ok: (s) => s.stats.sold >= 1e6 },
    { id: 'a_c10k', name: 'Five Figures', desc: 'Hold $10,000', ok: (s) => s.cash >= 1e4 },
    { id: 'a_c1m', name: 'Millionaire', desc: 'Hold $1,000,000', ok: (s) => s.cash >= 1e6 },
    { id: 'a_c1b', name: 'Billionaire', desc: 'Hold $1,000,000,000', ok: (s) => s.cash >= 1e9 },
    { id: 'a_c1t', name: 'Trillionaire', desc: 'Hold $1,000,000,000,000', ok: (s) => s.cash >= 1e12 },
    { id: 'a_y1996', name: 'Multimedia Pioneer', desc: 'Reach 1996', ok: (s) => s.cal >= 3 },
    { id: 'a_y2000', name: 'Survived Y2K', desc: 'Reach 2000', ok: (s) => s.cal >= 7 },
    { id: 'a_y2010', name: 'Flat Earth Society', desc: 'Reach 2010', ok: (s) => s.cal >= 17 },
    { id: 'a_y2020', name: 'Stay-At-Home', desc: 'Reach 2020', ok: (s) => s.cal >= 27 },
    { id: 'a_today', name: 'Back to the Present', desc: 'Reach today', ok: (s) => s.cal >= 33.79 },
    { id: 'a_b1', name: 'Home Brew', desc: 'Build your first PC', ok: (s) => s.stats.built >= 1 },
    { id: 'a_b100', name: 'Screwdriver Wizard', desc: 'Build 100 PCs', ok: (s) => s.stats.built >= 100 },
    { id: 'a_b3', name: 'Product Line', desc: 'Have 3 blueprints at once', ok: (s) => s.bps.length >= 3 },
    { id: 'a_hustle', name: 'Door-to-Door', desc: 'Hustle 100 times', ok: (s) => s.stats.hustles >= 100 },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
