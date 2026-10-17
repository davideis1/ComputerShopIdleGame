/* Renders the app icon, Android adaptive icon layers, splash image and favicon from the SVG sources in app/assets/src.
     npm i --no-save sharp   (once, from the repo root)   then   node tools/make-app-icons.js
   The prompt glyphs in the SVGs are drawn as shapes, so the output does not depend on installed fonts. */
const path = require('path');
const sharp = require('sharp');
const src = (f) => path.join(__dirname, '../app/assets/src', f);
const out = (f) => path.join(__dirname, '../app/assets', f);

(async () => {
  const jobs = [
    ['icon.svg', 'icon.png', 1024, true],                           // iOS: opaque, no rounded corners (the OS masks it)
    ['android-foreground.svg', 'android-icon-foreground.png', 1024], // adaptive icon foreground (transparent)
    ['android-monochrome.svg', 'android-icon-monochrome.png', 1024], // themed icon (alpha is the mask)
    ['splash.svg', 'splash-icon.png', 1024],
    ['icon.svg', 'favicon.png', 48, true],
  ];
  for (const [from, to, size, flat] of jobs) {
    let img = sharp(src(from), { density: 288 }).resize(size, size);
    if (flat) img = img.flatten({ background: '#008080' }); // guarantees no alpha channel on the store icon
    await img.png({ compressionLevel: 9 }).toFile(out(to));
    console.log('wrote app/assets/' + to + ' (' + size + 'px' + (flat ? ', opaque' : '') + ')');
  }
})();
