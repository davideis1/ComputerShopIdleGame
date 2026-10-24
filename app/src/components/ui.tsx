// Shared themed building blocks: a window-style Panel, a gradient progress Bar, and the page background.
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, theme, themed } from '@/theme';

type G = readonly [string, string, ...string[]];
const g = (a: string[]) => a as unknown as G;

/** The whole screen behind the content: Win95 teal, the Bliss sky over a green hill, Flat grey, RGB night. */
export function PageBackground() {
  return <LinearGradient colors={g(theme.grad.page)} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

/** Fake window buttons for the Win95 title bar (decoration only). */
function WinButtons() {
  return (
    <View style={styles.winBtns} pointerEvents="none">
      {['_', '□', '×'].map((c) => <View key={c} style={styles.winBtn}><Text style={styles.winBtnText}>{c}</Text></View>)}
    </View>
  );
}

/**
 * A panel drawn as a window of the era: Win95 navy title bar with window buttons, XP glossy blue bar, Flat clean
 * heading, RGB heading over a rainbow rule. `right` sits at the end of the title row; `onPressTitle` makes it a toggle.
 */
export function Panel({ title, icon, right, children, onPressTitle, style, bodyStyle }: {
  title: string; icon?: string; right?: ReactNode; children?: ReactNode; onPressTitle?: () => void; style?: ViewStyle; bodyStyle?: ViewStyle;
}) {
  const id = theme.id;
  const barred = id === 'win95' || id === 'xp';
  const label = (
    <Text style={[styles.title, barred && styles.titleOnBar]} numberOfLines={1}>
      {icon ? icon + '  ' : ''}{title}
    </Text>
  );
  const rightNode = typeof right === 'string' ? <Text style={[styles.right, barred && styles.rightOnBar]}>{right}</Text> : right;
  const head = barred ? (
    <LinearGradient colors={g(theme.grad.bar)} start={theme.grad.barHorizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }} end={theme.grad.barHorizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }} style={styles.bar}>
      {label}
      <View style={styles.headRight}>{rightNode}{id === 'win95' && !onPressTitle && <WinButtons />}</View>
    </LinearGradient>
  ) : (
    <View>
      <View style={styles.plainHead}>
        {label}
        <View style={styles.headRight}>{rightNode}</View>
      </View>
      {id === 'rgb' ? <LinearGradient colors={g(theme.grad.bar)} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.rule} /> : <View style={styles.flatRule} />}
    </View>
  );
  return (
    <View style={[styles.panel, style]}>
      {onPressTitle ? <Pressable onPress={onPressTitle} hitSlop={6}>{head}</Pressable> : head}
      {children != null && <View style={[styles.body, bodyStyle]}>{children}</View>}
    </View>
  );
}

/** A progress bar with a gradient fill (0..1). */
export function Bar({ value, height = 8, style }: { value: number; height?: number; style?: ViewStyle }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={[styles.track, { height, borderRadius: Math.min(height / 2, theme.radius + 2) }, style]}>
      {v > 0 && <LinearGradient colors={g(theme.grad.fill)} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: `${v * 100}%`, height: '100%' }} />}
    </View>
  );
}

/** A small stat tile: big value, small label. */
export function Stat({ label, value, tone, style }: { label: string; value: string; tone?: 'good' | 'bad'; style?: ViewStyle }) {
  return (
    <View style={[styles.stat, style]}>
      <Text style={[styles.statValue, tone === 'good' && { color: colors.good }, tone === 'bad' && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = themed(() => {
  const id = theme.id;
  return {
    panel: { ...theme.box, overflow: 'hidden' },
    bar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      paddingHorizontal: 10, paddingVertical: id === 'win95' ? 5 : 8,
      margin: id === 'win95' ? 2 : 0,
      borderTopLeftRadius: id === 'xp' ? 6 : 0, borderTopRightRadius: id === 'xp' ? 6 : 0,
    },
    plainHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
    rule: { height: 2, marginHorizontal: 14 },
    flatRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.edge, marginHorizontal: 14 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: theme.titleFont, flexShrink: 1 },
    titleOnBar: { color: '#ffffff', fontSize: id === 'win95' ? 14 : 15, textShadowColor: 'rgba(0,0,0,.45)', textShadowRadius: id === 'xp' ? 2 : 0, textShadowOffset: { width: 1, height: 1 } },
    headRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    right: { color: colors.dim, fontSize: 12 },
    rightOnBar: { color: '#e6efff' },
    body: { padding: 14, paddingTop: 12, gap: 10 },
    winBtns: { flexDirection: 'row', gap: 2 },
    winBtn: { width: 18, height: 16, backgroundColor: '#c0c0c0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderTopColor: '#ffffff', borderLeftColor: '#ffffff', borderRightColor: '#404040', borderBottomColor: '#404040' },
    winBtnText: { color: '#000', fontSize: 10, fontWeight: '700', lineHeight: 12 },
    track: { backgroundColor: colors.inset, overflow: 'hidden', borderWidth: id === 'win95' ? 1 : 0, borderColor: '#808080' },
    stat: { backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 10, ...(id === 'win95' ? { borderWidth: 1, borderTopColor: '#808080', borderLeftColor: '#808080', borderRightColor: '#ffffff', borderBottomColor: '#ffffff' } : {}) },
    statValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontFamily: theme.titleFont },
    statLabel: { color: colors.dim, fontSize: 11, marginTop: 2 },
  };
});
