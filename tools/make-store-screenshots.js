/* Turns raw simulator captures into store-ready screenshots.
     npm i --no-save sharp   (once)   then   node tools/make-store-screenshots.js <dir with raw PNGs>
   Reads shop.png, buyers.png, upgrades.png, hq.png, menu.png, stock.png, workshop.png from <dir> and writes
     docs/store/screenshots/ios-6.9in/NN-name.png   1320x2868, opaque (App Store 6.9" iPhone)
     docs/store/screenshots/android-phone/NN-name.png   1080x2160 (Play: aspect ratio must not exceed 2:1, so the
                                                         app screen is scaled to fit and padded with the app's background colour) */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/make-store-screenshots.js <dir with raw PNGs>'); process.exit(1); }
// Recommended upload order: screens with the fewest parody brand names first (see docs/store/RELEASE.md, "parody names").
const ORDER = ['shop', 'buyers', 'upgrades', 'hq', 'menu', 'stock', 'workshop'];
const BG = '#10151c';
const ios = path.join(__dirname, '../docs/store/screenshots/ios-6.9in');
const play = path.join(__dirname, '../docs/store/screenshots/android-phone');
fs.mkdirSync(ios, { recursive: true });
fs.mkdirSync(play, { recursive: true });

(async () => {
  for (let i = 0; i < ORDER.length; i++) {
    const name = ORDER[i], file = `${String(i + 1).padStart(2, '0')}-${name}.png`;
    const raw = sharp(path.join(dir, name + '.png')).flatten({ background: BG });
    const meta = await raw.metadata();
    if (meta.width !== 1320 || meta.height !== 2868) throw new Error(`${name}.png is ${meta.width}x${meta.height}, expected 1320x2868 (iPhone 17 Pro Max)`);
    await raw.clone().png({ compressionLevel: 9 }).toFile(path.join(ios, file));
    const fitted = await raw.clone().resize({ height: 2160 }).png().toBuffer(); // 994x2160
    await sharp({ create: { width: 1080, height: 2160, channels: 3, background: BG } })
      .composite([{ input: fitted, gravity: 'centre' }]).removeAlpha().png({ compressionLevel: 9 }).toFile(path.join(play, file));
    console.log('wrote', file);
  }
})();
