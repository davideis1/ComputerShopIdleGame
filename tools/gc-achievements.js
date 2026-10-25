#!/usr/bin/env node
// Game Center achievements: the App Store Connect side of the game's trophies (CS.ACH).
//   node tools/gc-achievements.js           check every trophy has a row and Apple's limits hold
//   node tools/gc-achievements.js --write   also rewrite docs/store/game-center.md and the badge images
// Badges are drawn as SVG and turned into 1024x1024 PNGs with `sharp` when it can be loaded
// (e.g. `npm i --no-save sharp` in a scratch folder and run with NODE_PATH pointing at its node_modules).
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('../core');

// id -> [points, badge label, badge caption, earned description]. Apple: <= 100 points each, <= 1000 in total.
const GC = {
  a_first: [5, '1', 'SOLD', 'You sold your very first computer.'],
  a_s100: [10, '100', 'SOLD', 'You sold 100 computers.'],
  a_s1k: [25, '1K', 'SOLD', 'You sold 1,000 computers.'],
  a_s10k: [50, '10K', 'SOLD', 'You sold 10,000 computers.'],
  a_s100k: [75, '100K', 'SOLD', 'You sold 100,000 computers.'],
  a_s1m: [100, '1M', 'SOLD', 'You sold a million computers.'],
  a_c10k: [10, '$10K', 'CASH', 'You had $10,000 in the till.'],
  a_c1m: [25, '$1M', 'CASH', 'You had a million dollars in the bank.'],
  a_c1b: [75, '$1B', 'CASH', 'You had a billion dollars in the bank.'],
  a_c1t: [100, '$1T', 'CASH', 'You had a trillion dollars in the bank.'],
  a_y1996: [10, '1996', 'YEAR', 'Your shop made it to 1996.'],
  a_y2000: [20, 'Y2K', 'YEAR', 'Your shop survived the year 2000.'],
  a_y2010: [30, '2010', 'YEAR', 'Your shop made it to 2010.'],
  a_y2020: [50, '2020', 'YEAR', 'Your shop made it to 2020.'],
  a_today: [75, 'NOW', 'YEAR', 'Your shop made it all the way to today.'],
  a_b1: [10, '1', 'BUILT', 'You built your first PC.'],
  a_b100: [30, '100', 'BUILT', 'You built 100 PCs.'],
  a_b3: [20, '3', 'DESIGNS', 'You had three PC designs on sale at once.'],
  a_game100: [15, '100', 'GAMES', 'You sold 100 PC games.'],
  a_acc100: [15, '100', 'GEAR', 'You sold 100 accessories.'],
  a_mgr1: [15, '1', 'BUYERS', 'You hired your first purchasing manager.'],
  a_mgr4: [40, '4', 'BUYERS', 'You had buyers in four categories at once.'],
  a_con100: [20, '100', 'CONSOLES', 'You sold 100 consoles.'],
  a_con1k: [40, '1K', 'CONSOLES', 'You sold 1,000 consoles.'],
  a_cg1k: [40, '1K', 'CONSOLE GAMES', 'You sold 1,000 console games.'],
  a_hustle: [15, '100', 'HUSTLES', 'You hustled 100 customers.'],
};

const problems = [];
const ids = CS.ACH.map((a) => a.id);
ids.forEach((id) => { if (!GC[id]) problems.push('no Game Center row for trophy ' + id); });
Object.keys(GC).forEach((id) => { if (!ids.includes(id)) problems.push('Game Center row for unknown trophy ' + id); });
let total = 0;
CS.ACH.forEach((a) => {
  const row = GC[a.id];
  if (!row) return;
  const [pts, , , earned] = row;
  total += pts;
  if (!Number.isInteger(pts) || pts < 1 || pts > 100) problems.push(a.id + ': points must be 1-100');
  if (!/^[A-Za-z0-9._]+$/.test(a.id)) problems.push(a.id + ': id may only use letters, digits, . and _');
  if (a.name.length > 30) problems.push(a.id + ': title over 30 characters');
  if (a.desc.length > 255 || earned.length > 255) problems.push(a.id + ': description over 255 characters');
  if (typeof a.p !== 'function') problems.push(a.id + ': no progress function (p) in core/data.js');
});
if (total > 1000) problems.push('points total ' + total + ' is over Apple\'s 1000');
if (CS.ACH.length > 100) problems.push('more than 100 achievements');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Game Center: ' + CS.ACH.length + ' achievements, ' + total + ' / 1000 points');

if (!process.argv.includes('--write')) return;

const root = path.join(__dirname, '..');
const dir = path.join(root, 'docs/store/game-center');
fs.mkdirSync(dir, { recursive: true });

// Medal colour by points: bronze, silver, gold, platinum.
const tier = (p) => (p >= 100 ? ['#cfe8ff', '#6f8fb3', '#22324a'] : p >= 50 ? ['#ffe27a', '#c8901a', '#4a3000'] : p >= 20 ? ['#f2f4f7', '#8d97a5', '#2b3340'] : ['#f5c69a', '#a8642e', '#3d1f08']);
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function badge(label, caption, pts) {
  const [hi, lo, ink] = tier(pts);
  const fs1 = label.length <= 2 ? 420 : label.length <= 3 ? 280 : label.length <= 4 ? 225 : 190;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d5f8a"/><stop offset="1" stop-color="#062a45"/></linearGradient>
    <radialGradient id="m" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="430" fill="${lo}" opacity=".55"/>
  <circle cx="512" cy="512" r="400" fill="url(#m)"/>
  <circle cx="512" cy="512" r="340" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="10" stroke-dasharray="4 26"/>
  <text x="512" y="${560 + fs1 * 0.12}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${fs1}" fill="${ink}">${esc(label)}</text>
  <text x="512" y="790" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="${caption.length > 9 ? 52 : 78}" letter-spacing="6" fill="${ink}" fill-opacity=".8">${esc(caption)}</text>
</svg>`;
}

let sharp = null;
try { sharp = require('sharp'); } catch { console.log('sharp not found: writing SVG badges only'); }
(async () => {
  for (const a of CS.ACH) {
    const [pts, label, caption] = GC[a.id];
    const svg = badge(label, caption, pts);
    if (sharp) await sharp(Buffer.from(svg)).flatten({ background: '#062a45' }).png().toFile(path.join(dir, a.id + '.png'));
    else fs.writeFileSync(path.join(dir, a.id + '.svg'), svg);
  }

  const rows = CS.ACH.map((a) => {
    const [pts, , , earned] = GC[a.id];
    return `| \`${a.id}\` | ${a.name} | ${pts} | ${a.desc} | ${earned} | [png](game-center/${a.id}.png) |`;
  });
  const md = `# Game Center achievements

Generated by \`node tools/gc-achievements.js --write\` from the game's trophies (\`CS.ACH\` in \`core/data.js\`). Don't edit by hand.

The app reports each trophy to Game Center under its game id (the **Achievement ID** column), with progress rings for the ones not yet earned. App Store Connect must use exactly these ids, or Game Center ignores the reports.

**${CS.ACH.length} achievements, ${total} of 1000 points.** None are hidden; none can be earned more than once.

## Setting it up in App Store Connect

1. Apple Developer → Identifiers → \`com.davideis.computershopidle\`: make sure **Game Center** is ticked (it usually is by default). The app already asks for the \`com.apple.developer.game-center\` entitlement (\`app/app.json\`).
2. App Store Connect → the app → **Services → Game Center**: turn Game Center on (choose a single-game setup, not a group).
3. Under **Achievements**, add one per row below: Reference Name = the title, Achievement ID = the id, Point Value, Hidden = No, Achievable More Than Once = No. Add an **English (U.S.)** localisation with the title, the pre-earned and earned descriptions, and the badge image (1024 × 1024 PNG from \`docs/store/game-center/\`).
4. On the app version page, tick the Game Center section so the achievements go out with that build (they're reviewed with the app).
5. To test before release: sign in to Game Center on a device or simulator with a Sandbox tester (Settings → Game Center), then run a TestFlight or development build.

## Achievements

| Achievement ID | Title | Points | Pre-earned description | Earned description | Badge |
|---|---|---|---|---|---|
${rows.join('\n')}
`;
  fs.writeFileSync(path.join(root, 'docs/store/game-center.md'), md);
  console.log('wrote docs/store/game-center.md and ' + CS.ACH.length + ' badges' + (sharp ? ' (png)' : ' (svg only)'));
})();
