import { StyleSheet, ImageStyle, TextStyle, ViewStyle } from 'react-native';

// Era themes, ported from style.css: win95 (1993-99), xp (2000-08), flat (2009-16), rgb (2017+).
export type ThemeId = 'win95' | 'xp' | 'flat' | 'rgb';
export const THEME_IDS: ThemeId[] = ['win95', 'xp', 'flat', 'rgb'];
export const THEME_LABELS: Record<ThemeId, string> = { win95: 'Windoze 95 (1993–99)', xp: 'Bliss (2000–08)', flat: 'Flat (2009–16)', rgb: 'RGB (2017+)' };

type Palette = { bg: string; card: string; text: string; dim: string; onBg: string; onBgDim: string; inset: string; accent: string; onAccent: string; danger: string; good: string; warn: string; edge: string };
const PALETTES: Record<ThemeId, Palette> = {
  win95: { onBg: '#ffffff', onBgDim: '#d8f0f0', inset: '#ffffff', bg: '#008080', card: '#c0c0c0', text: '#000000', dim: '#404040', accent: '#000080', onAccent: '#ffffff', danger: '#b00000', good: '#006400', warn: '#8a5a00', edge: '#000000' },
  xp: { onBg: '#ffffff', onBgDim: '#e0ecff', inset: '#ffffff', bg: '#4a86d8', card: '#ece9d8', text: '#000000', dim: '#4a4a4a', accent: '#0a4bd0', onAccent: '#ffffff', danger: '#c0262d', good: '#1e7a1e', warn: '#8a5a00', edge: '#0a4bd0' },
  flat: { onBg: '#1b2330', onBgDim: '#667085', inset: '#f3f5f8', bg: '#e9edf2', card: '#ffffff', text: '#1b2330', dim: '#667085', accent: '#2d7ff9', onAccent: '#ffffff', danger: '#dc2626', good: '#16a34a', warn: '#b45309', edge: '#e1e5ec' },
  rgb: { onBg: '#e8eaf6', onBgDim: '#8b90b0', inset: '#0d0f1d', bg: '#090a12', card: '#14172a', text: '#e8eaf6', dim: '#8b90b0', accent: '#7a5cff', onAccent: '#ffffff', danger: '#ff5577', good: '#3dff9a', warn: '#ffc14d', edge: '#19f0c4' },
};
const RADIUS: Record<ThemeId, number> = { win95: 0, xp: 8, flat: 12, rgb: 12 };
export const LIGHT: Record<ThemeId, boolean> = { win95: true, xp: true, flat: true, rgb: false };

/** Live colours. Mutated in place by `applyTheme`; the app root remounts when the theme changes. */
export const colors: Palette = { ...PALETTES.win95 };
/** Live shape: corner radius and the card "box" (win95 bevel, xp outline, flat shadow, rgb glow outline). */
export const theme: { id: ThemeId; radius: number; box: ViewStyle; btn: ViewStyle } = { id: 'win95', radius: 0, box: {}, btn: {} };

function boxFor(id: ThemeId, p: Palette): ViewStyle {
  const base: ViewStyle = { backgroundColor: p.card, borderRadius: RADIUS[id] };
  switch (id) {
    case 'win95': return { ...base, borderWidth: 2, borderTopColor: '#ffffff', borderLeftColor: '#ffffff', borderRightColor: '#404040', borderBottomColor: '#404040' };
    case 'xp': return { ...base, borderWidth: 2, borderColor: p.edge };
    case 'flat': return { ...base, shadowColor: '#101828', shadowOpacity: 0.14, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 };
    case 'rgb': return { ...base, borderWidth: 1, borderColor: '#2d3566' };
  }
}

export function applyTheme(id: ThemeId) {
  const p = PALETTES[id];
  Object.assign(colors, p);
  theme.id = id;
  theme.radius = RADIUS[id];
  theme.box = boxFor(id, p);
  theme.btn = id === 'win95' ? { borderRadius: 0, borderWidth: 2, borderTopColor: '#ffffff', borderLeftColor: '#ffffff', borderRightColor: '#404040', borderBottomColor: '#404040' } : { borderRadius: Math.min(RADIUS[id], 8) };
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
