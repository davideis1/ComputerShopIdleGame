/* The server's save limits must fit what the game can produce:  node tools/limits-check.js   Exits 1 on failure.
   (A server limit left behind when the calendar grew made every save past Oct 2026 fail with "out_of_range".) */
const fs = require('fs');
const path = require('path');
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const php = fs.readFileSync(path.join(__dirname, '../inc/bootstrap.php'), 'utf8');
const num = (name) => { const m = php.match(new RegExp('const ' + name + '\\s*=\\s*([0-9._]+)\\s*;')); return m ? +m[1].replace(/_/g, '') : NaN; };

const endCal = num('GAME_END_CAL'), maxBytes = num('MAX_STATE_BYTES');
ok(endCal === CS.C.END_CAL, `GAME_END_CAL in inc/bootstrap.php (${endCal}) equals the game's END_CAL (${CS.C.END_CAL})`);

// a shop at the very end of the calendar, with every system in play, must serialize under the byte limit
const s = E.newState();
s.cash = 5e7; s.cal = CS.C.END_CAL;
Object.assign(s.up, { clerk: 20, sales: 30, barcode: 20, pos: 10, ads_news: 30, ads_tv: 30, shelf: 25, depot: 10, aisle_acc: 1, aisle_games: 1, aisle_console: 1, purchasing: 1, workshop: 1, techs: 10, svc_desk: 1, svc_tech: 10 });
['pre', 'game', 'acc', 'con', 'svc'].forEach((c) => CS.M.hire(s, c, 0));
for (let i = 0; i < 1200; i++) E.step(s, 1, 1);
const bytes = E.serialize(s).length;
ok(s.cal <= endCal + 0.001, `a shop at the end of the calendar (cal ${s.cal.toFixed(2)}) passes the server's range check`);
ok(bytes < maxBytes * 0.5, `its save is ${Math.round(bytes / 1000)} KB, under half of the ${Math.round(maxBytes / 1000)} KB limit`);

console.log(fails ? `\n${fails} check(s) failed` : '\nall limit checks passed');
process.exit(fails ? 1 : 0);
