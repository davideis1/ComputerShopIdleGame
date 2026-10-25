#!/usr/bin/env node
// Google Play Games achievements: the Play Console side of the game's trophies (CS.ACH).
//   node tools/pg-achievements.js                 check every trophy fits the Play Console's import rules
//   node tools/pg-achievements.js --write         also write docs/store/play-games/ (CSVs + 512 px icons + the import zip)
//                                                 and docs/store/play-games.md  (needs `sharp` and the `zip` command)
//   node tools/pg-achievements.js --ids <file>    turn the Play Console's "Get resources" XML (the achievement ids it
//                                                 generated) into app/src/playgames-ids.json ({ trophyId: playId })
// Play Console import rules (developer.android.com/games/pgs/integrate-achievements): CSVs without a header row; Name <= 100
// characters, unique, no commas; Description <= 500, no commas; points a multiple of 5 from 5 to 200; icons 512x512.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CS = require('../core');
const ROWS = require('./trophy-rows');

const root = path.join(__dirname, '..');
const problems = [];

// Play Console descriptions can't hold commas: "Sell 1,000 computers" -> "Sell 1000 computers"
const noCommas = (s) => s.replace(/(\d),(?=\d)/g, '$1').replace(/,/g, ' ');
/** The resource name the Play Console generates for an achievement ("Open for Business" -> achievement_open_for_business). */
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const resourceName = (name) => 'achievement_' + normalize(name);

const names = new Set();
CS.ACH.forEach((a, i) => {
  const row = ROWS[a.id];
  if (!row) { problems.push('no row in tools/trophy-rows.js for ' + a.id); return; }
  const [pts, , , earned] = row;
  if (a.name.length > 100) problems.push(a.id + ': name over 100 characters');
  if (/,/.test(a.name)) problems.push(a.id + ': name has a comma');
  if (names.has(a.name)) problems.push(a.id + ': duplicate name ' + a.name);
  names.add(a.name);
  if (noCommas(a.desc).length > 500 || earned.length > 500) problems.push(a.id + ': description over 500 characters');
  if (!Number.isInteger(pts) || pts % 5 !== 0 || pts < 5 || pts > 200) problems.push(a.id + ': points must be a multiple of 5 from 5 to 200 (got ' + pts + ')');
  if (typeof a.p !== 'function') problems.push(a.id + ': no progress function (p) in core/data.js');
});
const resNames = CS.ACH.map((a) => resourceName(a.name));
if (new Set(resNames).size !== resNames.length) problems.push('two trophy names give the same Play Console resource name');
Object.keys(ROWS).forEach((id) => { if (!CS.ACH.some((a) => a.id === id)) problems.push('row for unknown trophy ' + id); });

/** XML from the Play Console ("Get resources"): <string name="achievement_x">CgkI...</string>  ->  { trophyId: playId } */
function idsFromXml(xml) {
  const byRes = {};
  for (const m of xml.matchAll(/<string\s+name="(achievement_[^"]+)"[^>]*>\s*([^<\s]+)\s*<\/string>/g)) byRes[m[1]] = m[2];
  const out = {}, missing = [];
  CS.ACH.forEach((a) => { const id = byRes[resourceName(a.name)]; if (id) out[a.id] = id; else missing.push(a.name); });
  const known = new Set(resNames);
  const extra = Object.keys(byRes).filter((k) => !known.has(k));
  return { out, missing, extra };
}
module.exports = { idsFromXml, resourceName, noCommas };

if (require.main !== module) return;

// ---- self-test of the id mapper with a pretend "Get resources" file
{
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_id" translatable="false">123456789</string>\n'
    + CS.ACH.map((a, i) => `  <string name="${resourceName(a.name)}" translatable="false">CgkIFAKE${String(i).padStart(4, '0')}AQ</string>`).join('\n') + '\n</resources>\n';
  const r = idsFromXml(xml);
  if (Object.keys(r.out).length !== CS.ACH.length || r.missing.length) problems.push('the id mapper lost trophies: ' + r.missing.join(', '));
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
const total = CS.ACH.reduce((a, t) => a + ROWS[t.id][0], 0);
console.log('Play Games: ' + CS.ACH.length + ' achievements, ' + total + ' points (import rules OK)');

const arg = process.argv.slice(2);
const dir = path.join(root, 'docs/store/play-games');

if (arg[0] === '--ids') {
  if (!arg[1]) { console.error('usage: node tools/pg-achievements.js --ids <resources.xml>'); process.exit(2); }
  const r = idsFromXml(fs.readFileSync(arg[1], 'utf8'));
  fs.writeFileSync(path.join(root, 'app/src/playgames-ids.json'), JSON.stringify(r.out, null, 1) + '\n');
  console.log('wrote app/src/playgames-ids.json with ' + Object.keys(r.out).length + ' ids');
  if (r.missing.length) { console.error('NOT FOUND in the file (is the achievement imported?): ' + r.missing.join(', ')); process.exit(1); }
  if (r.extra.length) console.log('ignored (not ours): ' + r.extra.join(', '));
  process.exit(0);
}
if (!arg.includes('--write')) process.exit(0);

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  // metadata: Name,Description,Incremental value,Steps Needed,Initial State,Points,List Order — every trophy is incremental
  // with 100 steps, so the app can show progress as a percentage and 100 steps unlocks it
  const meta = CS.ACH.map((a, i) => [a.name, noCommas(a.desc), 'True', 100, 'Revealed', ROWS[a.id][0], i + 1].join(',')).join('\n') + '\n';
  const icons = CS.ACH.map((a) => [a.name, a.id + '.png'].join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'AchievementsMetadata.csv'), meta);
  fs.writeFileSync(path.join(dir, 'AchievementsIconsMappings.csv'), icons);
  let sharp = null;
  try { sharp = require('sharp'); } catch { console.log('sharp not found: icons and the zip are skipped'); }
  if (sharp) {
    for (const a of CS.ACH) {
      const src = path.join(root, 'docs/store/game-center', a.id + '.png');
      await sharp(src).resize(512, 512).png().toFile(path.join(dir, a.id + '.png'));
    }
    const zip = path.join(dir, 'play-games-achievements.zip');
    if (fs.existsSync(zip)) fs.unlinkSync(zip);
    const files = ['AchievementsMetadata.csv', 'AchievementsIconsMappings.csv'].concat(CS.ACH.map((a) => a.id + '.png'));
    execFileSync('zip', ['-q', '-j', zip, ...files.map((f) => path.join(dir, f))]); // flat: no subdirectories
    CS.ACH.forEach((a) => fs.unlinkSync(path.join(dir, a.id + '.png'))); // the zip is the deliverable; the PNGs are rebuilt on demand
    console.log('wrote ' + path.relative(root, zip) + ' (' + Math.round(fs.statSync(zip).size / 1000) + ' KB)');
  }

  const rows = CS.ACH.map((a) => `| ${a.name} | ${ROWS[a.id][0]} | ${noCommas(a.desc)} | \`${resourceName(a.name)}\` |`);
  fs.writeFileSync(path.join(root, 'docs/store/play-games.md'), `# Google Play Games achievements

Generated by \`node tools/pg-achievements.js --write\` from the game's trophies (\`CS.ACH\` in \`core/data.js\`) and \`tools/trophy-rows.js\`. Don't edit by hand.

The app reports each trophy to Play Games as an **incremental achievement with 100 steps** (so the progress ring shows the percentage and 100 steps unlocks it). The Play Console gives every achievement its own id; \`app/src/playgames-ids.json\` maps each trophy to it, and until it has ids the app reports nothing (everything else keeps working).

**${CS.ACH.length} achievements, ${total} points** (the Play Console allows 5 to 200 each; all are multiples of 5).

## Setting it up (needs the Google Play Console, a one-off 25 USD developer account)

1. **Create the app** in the Play Console (package \`com.davideis.computershopidle\`).
2. **Play Games Services → Setup and management → Configuration:** create the Game Services project; note its **Project ID** (digits). Put it in \`app/app.json\`: \`["./plugins/withPlayGames", { "projectId": "<digits>" }]\`.
3. **Credentials** (same page → Add credential):
   - *Android*: the app's package name and the **SHA-1** of the key that signs the build (Play App Signing's key once the app is uploaded; your debug key for local testing).
   - *Game server*: type **Web** (an OAuth client in the linked Google Cloud project). Its **Client ID** goes in \`app/app.json\` → \`extra.playGamesWebClientId\`; its **Client secret** (and the id) go in the server-only \`inc/config.php\` as \`pg_client_id\` and \`pg_client_secret\`.
4. **Achievements → Import:** upload \`docs/store/play-games/play-games-achievements.zip\` (flat zip: the two CSVs and 30 icons at 512×512).
5. **Get the ids:** Achievements → *Get resources* → Android: save the XML, then run \`node tools/pg-achievements.js --ids resources.xml\`. It rewrites \`app/src/playgames-ids.json\`; commit it.
6. **Testers:** add your Google account under Testers (Play Games Services → Setup → Testers) so unpublished achievements work on your phone; **publish** Play Games Services when ready (the achievements go live with it).
7. Rebuild the app (\`cd app && npx expo prebuild --clean --platform android\`, or an EAS build) and test: the achievements screen (Menu → Trophies → Play Games), progress rings, and *Continue with Google Play Games* in Menu → Account.

## Achievements

| Name | Points | Description | Resource name in the Play Console |
|---|---|---|---|
${rows.join('\n')}
`);
  console.log('wrote docs/store/play-games.md and docs/store/play-games/*.csv');
})();
