/* Keeps the app's release info in step with the website's:  node tools/sync-release.js [--check]
   version.json + changelog.json (the website reads these) -> app/src/release.json (the app's What's new + About) and
   expo.version in app/app.json ("major.minor.build", so the website and the app show the same number).
   Run by tools/bump-version.js (and so by .githooks/pre-commit); `--check` only compares and exits 1 on drift (CI). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const v = read('version.json');
const release = { version: v, changelog: read('changelog.json') };
const releaseText = JSON.stringify(release, null, 1) + '\n';
const appJsonPath = path.join(root, 'app/app.json');
const appText = fs.readFileSync(appJsonPath, 'utf8');
const app = JSON.parse(appText);
const want = v.major + '.' + v.minor + '.' + v.build;
const releasePath = path.join(root, 'app/src/release.json');
const haveRelease = fs.existsSync(releasePath) ? fs.readFileSync(releasePath, 'utf8') : '';

if (process.argv.includes('--check')) {
  const bad = [];
  if (haveRelease !== releaseText) bad.push('app/src/release.json is out of date');
  if (app.expo.version !== want) bad.push('app/app.json version is ' + app.expo.version + ', version.json says ' + want);
  if (bad.length) { console.error(bad.join('\n') + '\nRun: node tools/sync-release.js'); process.exit(1); }
  console.log('release info in sync (' + want + ')');
} else {
  fs.writeFileSync(releasePath, releaseText);
  if (app.expo.version !== want) {
    app.expo.version = want;
    fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');
  }
  console.log('app release info synced (' + want + ')');
}
