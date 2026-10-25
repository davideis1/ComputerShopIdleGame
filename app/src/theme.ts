import { ImageStyle, Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

// Era themes, ported from style.css: win95 (1993-99), xp (2000-08), flat (2009-14), rgb (2015-26), holo (2027+, Near Future).
export type ThemeId = 'win95' | 'xp' | 'flat' | 'rgb' | 'holo';
export const THEME_IDS: ThemeId[] = ['win95', 'xp', 'flat', 'rgb', 'holo'];
export const THEME_LABELS: Record<ThemeId, string> = { win95: 'Windoze 95 (1993–99)', xp: 'Bliss (2000–08)', flat: 'Flat (2009–16)', rgb: 'RGB (2015–26)', holo: 'Holo (2027+)' };

type Palette = { bg: string; card: string; text: string; dim: string; onBg: string; onBgDim: string; inset: string; accent: string; onAccent: string; quiet: string; danger: string; good: string; warn: string; edge: string };
const PALETTES: Record<ThemeId, Palette> = {
  win95: { quiet: '#808080', onBg: '#ffffff', onBgDim: '#d8f0f0', inset: '#ffffff', bg: '#008080', card: '#c0c0c0', text: '#000000', dim: '#404040', accent: '#000080', onAccent: '#ffffff', danger: '#b00000', good: '#006400', warn: '#8a5a00', edge: '#000000' },
  xp: { quiet: '#6b88c8', onBg: '#ffffff', onBgDim: '#e0ecff', inset: '#ffffff', bg: '#4a86d8', card: '#ece9d8', text: '#000000', dim: '#4a4a4a', accent: '#0a4bd0', onAccent: '#ffffff', danger: '#c0262d', good: '#1e7a1e', warn: '#8a5a00', edge: '#0a4bd0' },
  flat: { quiet: '#64748b', onBg: '#1b2330', onBgDim: '#667085', inset: '#f3f5f8', bg: '#e9edf2', card: '#ffffff', text: '#1b2330', dim: '#667085', accent: '#2d7ff9', onAccent: '#ffffff', danger: '#dc2626', good: '#16a34a', warn: '#b45309', edge: '#e1e5ec' },
  holo: { quiet: '#8a84b8', onBg: '#1c1640', onBgDim: '#6a6390', inset: '#f1edff', bg: '#eef0ff', card: 'rgba(255,255,255,0.8)', text: '#1c1640', dim: '#6a6390', accent: '#7c5cff', onAccent: '#ffffff', danger: '#e0306a', good: '#0f9f74', warn: '#b26a00', edge: '#d9d2ff' },
  rgb: { quiet: '#2d3b52', onBg: '#e8eaf6', onBgDim: '#8b90b0', inset: '#0d0f1d', bg: '#090a12', card: '#14172a', text: '#e8eaf6', dim: '#8b90b0', accent: '#7a5cff', onAccent: '#ffffff', danger: '#ff5577', good: '#3dff9a', warn: '#ffc14d', edge: '#19f0c4' },
};
/** Sky / road / pavement colours behind the storefront, from style.css `--scene`. */
const SCENES: Record<ThemeId, [string, string, string]> = {
  win95: ['#87ceeb', '#9a9a9a', '#d8c9a0'], xp: ['#a6d8ff', '#8c8c8c', '#cfe8b0'], flat: ['#cfe5ff', '#c9ced6', '#f1ece0'], rgb: ['#171a40', '#22243a', '#15162a'], holo: ['#e8dcff', '#cfd6ea', '#eef3f8'],
};
/** Gradients (two or more stops). page = the screen background; bar = window title bars and the header (rgb: a thin rainbow rule);
 *  fill = progress bars; btn = the face of primary buttons. Ported from style.css (--bg, --title-bg) and extended. */
type Grads = { page: string[]; bar: string[]; barHorizontal: boolean; fill: string[]; btn: string[] };
const GRADS: Record<ThemeId, Grads> = {
  win95: { page: ['#008080', '#008080'], bar: ['#000080', '#1084d0'], barHorizontal: true, fill: ['#000080', '#1084d0'], btn: ['#000080', '#000080'] },
  xp: { page: ['#3a7bd5', '#8ec1f2', '#7cc46a', '#3a8a26'], bar: ['#3d95ff', '#0a5be0', '#0148c8'], barHorizontal: false, fill: ['#5ad15a', '#2a9e2a'], btn: ['#3d8bff', '#0a4bd0'] },
  flat: { page: ['#f1f4f8', '#e3e8ef'], bar: ['#ffffff', '#ffffff'], barHorizontal: false, fill: ['#5aa0ff', '#2d7ff9'], btn: ['#2d7ff9', '#2d7ff9'] },
  holo: { page: ['#f6e9ff', '#e3f3ff', '#e6fff6'], bar: ['#ff8ad8', '#b69cff', '#6fe3ff', '#8affc8'], barHorizontal: true, fill: ['#b69cff', '#6fe3ff'], btn: ['#8b6cff', '#26c6e0'] },
  rgb: { page: ['#14102e', '#0b0c18', '#090a12'], bar: ['#ff3d81', '#ffb02e', '#19f0c4', '#4d7cff'], barHorizontal: true, fill: ['#ff3d81', '#7a5cff', '#19f0c4'], btn: ['#8f6bff', '#6a4cf0'] },
};
/** Display font per era (iOS ships all of these; Android falls back to the system font). */
const FONTS: Record<ThemeId, { title?: string; mono?: string }> = {
  win95: { title: 'Verdana', mono: 'Courier New' },
  xp: { title: 'Trebuchet MS', mono: 'Courier New' },
  flat: { title: 'Avenir Next', mono: 'Menlo' },
  rgb: { title: 'Avenir Next', mono: 'Menlo' },
  holo: { title: 'Avenir Next', mono: 'Menlo' },
};
const RADIUS: Record<ThemeId, number> = { win95: 0, xp: 8, flat: 12, rgb: 12, holo: 18 };
export const LIGHT: Record<ThemeId, boolean> = { win95: true, xp: true, flat: true, rgb: false, holo: true };

/** Live colours. Mutated in place by `applyTheme`; the app root remounts when the theme changes. */
export const colors: Palette = { ...PALETTES.win95 };
/** Live shape: corner radius and the card "box" (win95 bevel, xp outline, flat shadow, rgb glow outline). */
export const theme: {
  id: ThemeId; radius: number; box: ViewStyle; btn: ViewStyle; quietBtn: ViewStyle; scene: [string, string, string];
  grad: Grads; titleFont?: string; monoFont?: string;
} = { id: 'win95', radius: 0, box: {}, btn: {}, quietBtn: {}, scene: SCENES.win95, grad: GRADS.win95 };

function boxFor(id: ThemeId, p: Palette): ViewStyle {
  const base: ViewStyle = { backgroundColor: p.card, borderRadius: RADIUS[id] };
  switch (id) {
    case 'win95': return { ...base, borderWidth: 2, borderTopColor: '#ffffff', borderLeftColor: '#ffffff', borderRightColor: '#404040', borderBottomColor: '#404040' };
    case 'xp': return { ...base, borderWidth: 2, borderColor: p.edge };
    case 'flat': return { ...base, shadowColor: '#101828', shadowOpacity: 0.14, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 };
    case 'rgb': return { ...base, borderWidth: 1, borderColor: '#2d3566' };
    case 'holo': return { ...base, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#5a46be', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 };
  }
}

export function applyTheme(id: ThemeId) {
  const p = PALETTES[id];
  Object.assign(colors, p);
  theme.id = id;
  theme.radius = RADIUS[id];
  theme.scene = SCENES[id];
  theme.box = boxFor(id, p);
  theme.grad = GRADS[id];
  const ios = Platform.OS === 'ios';
  theme.titleFont = ios ? FONTS[id].title : undefined;
  theme.monoFont = ios ? FONTS[id].mono : 'monospace';
  const bevel: ViewStyle = { borderRadius: 0, borderWidth: 2, borderTopColor: '#ffffff', borderLeftColor: '#ffffff', borderRightColor: '#404040', borderBottomColor: '#404040' };
  switch (id) {
    case 'win95': theme.btn = bevel; theme.quietBtn = bevel; break;
    case 'xp': // glossy, outlined, a soft drop shadow
      theme.btn = { borderRadius: 6, borderWidth: 1, borderColor: '#003c9e', shadowColor: '#002266', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } };
      theme.quietBtn = { borderRadius: 6, borderWidth: 1, borderColor: '#3d5a9e' };
      break;
    case 'flat': theme.btn = { borderRadius: 8 }; theme.quietBtn = { borderRadius: 8 }; break;
    case 'rgb': // neon: a glow in the accent colour
      theme.btn = { borderRadius: 8, borderWidth: 1, borderColor: '#b39dff', shadowColor: '#7a5cff', shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } };
      theme.quietBtn = { borderRadius: 8, borderWidth: 1, borderColor: '#3b4a6b' };
      break;
    case 'holo': // soft glass pill with a violet glow
      theme.btn = { borderRadius: 14, shadowColor: '#7c5cff', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } };
      theme.quietBtn = { borderRadius: 14 };
      break;
  }
}
applyTheme('win95');

type Style = ViewStyle | TextStyle | ImageStyle;
/** Like StyleSheet.create, but re-evaluated when the theme changes (styles read `colors`/`theme`). */
export function themed<T extends Record<string, Style>>(factory: () => T): T {
  let cache: T | null = null, at: ThemeId | null = null;
  return new Proxy({} as T, {
    get(_t, key: string) {
      if (!cache || at !== theme.id) { cache = StyleSheet.create(factory()) as T; at = theme.id; }
      return cache[key];
    },
  });
}

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
