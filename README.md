# Mega Byte Computers — an idle computer-shop game

Run a computer shop from **1993 to today**. Start by reselling parody-branded prebuilts (Compac, Dall, Gatewhey, Ample…), then open a workshop and sell PCs you design yourself from parody parts (Intal, AMB, Envidia, Radian…).

Plain HTML/CSS/JS — no build step, no dependencies. Works on desktop and mobile, installable as a PWA.

## Run
```
python3 -m http.server 8000   # then open http://localhost:8000
```

## Features
- Calendar advances ~1 year per 5 minutes; the UI theme changes by era (Win95 → XP → Flat → RGB).
- Prebuilt catalog (~50 models) that age, get cheaper and fall out of fashion; custom PC blueprints from ~130 parts.
- Three customer segments (budget / mainstream / enthusiast) weigh performance against price.
- Marketing, checkout, stock and workshop upgrades per era; timeline events (Y2K, dot-com bust, crypto craze, chip shortage…).
- **Saving**: localStorage autosave (+ backup), export/import codes, reset.
- **Offline progress**: the same simulation is run in bulk on return (capped at 4h, upgradeable; the calendar moves at 1/20 speed while away) with a "welcome back" report.

## Dev
`node tools/sim.js [minutes]` runs the engine headless with a simple bot for balance checks; `node tools/custom-check.js` compares custom rigs against the best prebuilts per year.
All brand/product names are parodies and not affiliated with any real company.
