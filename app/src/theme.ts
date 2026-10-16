export const colors = {
  bg: '#10151c',
  card: '#1b2330',
  text: '#ffffff',
  dim: '#8da0b8',
  accent: '#4da3ff',
  danger: '#e5484d',
  good: '#46c37b',
};

// Number formatting ported from js/ui.js so the app and the web build read the same.
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
export function num(n: number): string {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1000) return a < 10 && n % 1 ? n.toFixed(2) : a < 100 && n % 1 ? n.toFixed(1) : Math.round(n).toString();
  let i = Math.min(SUF.length - 1, Math.floor(Math.log10(a) / 3));
  let v = n / Math.pow(10, i * 3);
  let s = v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0);
  if (Math.abs(parseFloat(s)) >= 1000 && i < SUF.length - 1) { i++; v = n / Math.pow(10, i * 3); s = v.toFixed(2); } // 999.9K -> 1.00M
  return s + SUF[i];
}
export const money = (n: number) => (n < 0 ? '-$' : '$') + num(Math.abs(n) < 1000 ? Math.round(Math.abs(n)) : Math.abs(n));

/** Seconds as "1h 5m" / "3m 20s" / "45s" (ported from js/ui.js). */
export function dur(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h) return h + 'h ' + m + 'm';
  if (m) return m + 'm ' + (sec % 60) + 's';
  return sec + 's';
}
