/* Bumps the build number in version.json and stamps any "next" entry in changelog.json with it.
   Run automatically by .githooks/pre-commit (enable once per clone: git config core.hooksPath .githooks),
   or by hand before a deploy:  node tools/bump-version.js
   Also syncs the app's release info (tools/sync-release.js). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const vf = path.join(root, 'version.json'), cf = path.join(root, 'changelog.json');
const v = JSON.parse(fs.readFileSync(vf, 'utf8'));
v.build++;
v.date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(vf, JSON.stringify(v) + '\n');
const log = JSON.parse(fs.readFileSync(cf, 'utf8'));
let stamped = false;
log.forEach((e) => { if (e.build === 'next') { e.build = v.build; e.date = v.date; stamped = true; } });
if (stamped) fs.writeFileSync(cf, '[\n' + log.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n');
require('./sync-release.js'); // app/src/release.json + app/app.json follow
console.log('version ' + v.major + '.' + v.minor + '.' + v.build + (stamped ? ' (changelog entry stamped)' : ''));
