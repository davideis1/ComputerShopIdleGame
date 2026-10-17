// Tiny bridge between the simulation (GameProvider) and the storefront scene: sales ask for a customer who buys,
// browsing hustles / arrivals ask for one who walks past. The scene drains the counters every frame.
let buys = 0;
let browsers = 0;
export const noteBuy = (n = 1) => { buys = Math.min(buys + n, 8); };
export const noteBrowse = (n = 1) => { browsers = Math.min(browsers + n, 8); };
export function takeWalkers() {
  const r = { buys, browsers };
  buys = 0; browsers = 0;
  return r;
}
