import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Bar, Panel, Stat } from '@/components/ui';
import { useGame } from '@/GameProvider';
import { buildShopView, buyRec, recButtonLabel } from '@/shop';
import { E } from '@/game';
import { colors, money, num, theme, themed } from '@/theme';
import { Scene } from '@/components/Scene';
import { ServicePanel } from '@/components/ServicePanel';

/** "+$1.2K" that rises and fades over the Hustle button after a sale. */
function Floater({ text, good }: { text: string; good: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.floater, !good && styles.floaterDim, { opacity: a.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }, { scale: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.7, 1.1, 1] }) }] }]}
    >{text}</Animated.Text>
  );
}

export default function Shop() {
  const { game: s, frame, refresh, log, hustleResult, hustle, away, dismissAway } = useGame();
  const [advOpen, setAdvOpen] = useState(true);
  const [acted, setActed] = useState(0);

  // The heavy part (walking every item, the advisor's model) refreshes about once a second.
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(() => buildShopView(s, advOpen), [s, advOpen, Math.floor(sec / 2), acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  const cooling = s.hustleCd > 0;
  const cashPerMin = v.income;
  // a fresh floater per hustle result (the key restarts its animation)
  const [floats, setFloats] = useState<{ id: number; text: string; good: boolean }[]>([]);
  const lastResult = useRef<unknown>(null);
  useEffect(() => {
    if (!hustleResult || hustleResult === lastResult.current) return;
    lastResult.current = hustleResult;
    const sold = hustleResult.kind === 'sold';
    if (sold) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const f = { id: Date.now(), text: sold ? '+' + money(hustleResult.rev || 0) : hustleResult.text, good: sold };
    setFloats((cur) => [...cur.slice(-3), f]);
    const t = setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 1300);
    return () => clearTimeout(t);
  }, [hustleResult]);
  const doHustle = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); hustle(); };
  const yearPart = ((s.cal % 1) + 1) % 1;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.shopName} numberOfLines={1} adjustsFontSizeToFit>{s.name || 'Computer Shop'}</Text>
            <View style={styles.eraChip}><Text style={styles.eraText}>{v.era.name}</Text></View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.cash} numberOfLines={1}>{money(s.cash)}</Text>
            <Text style={styles.rate}>▲ {money(cashPerMin)}/min</Text>
          </View>
        </View>
        <View style={styles.yearRow}>
          <Text style={styles.heroSub}>{v.date}</Text>
          <Bar value={yearPart} height={6} style={{ flex: 1 }} />
          <Text style={styles.heroSub}>{Math.floor(1993 + s.cal) + 1}</Text>
        </View>
      </View>

      <Panel title="Storefront" icon="🏪" right={v.stockInfo}>
        <Scene shelves={v.shelves} />
      </Panel>

      <View>
        <Pressable onPress={doHustle} disabled={cooling} style={({ pressed }) => [styles.hustle, pressed && { transform: [{ scale: 0.98 }] }]}>
          <LinearGradient colors={(cooling ? [colors.quiet, colors.quiet] : theme.grad.btn) as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          {cooling && <View style={[styles.hbar, { width: `${100 * (1 - s.hustleCd / E.HUSTLE_CD)}%` }]} />}
          <Text style={styles.hustleText}>
            {(cooling ? '🤝 Hustling… ' + Math.ceil(s.hustleCd) + 's' : '🤝 Hustle a customer') + (E.hustleStreak(s) > 1 ? '  🔥' + E.hustleStreak(s) : '')}
          </Text>
        </Pressable>
        <View style={styles.floatLayer} pointerEvents="none">
          {floats.map((f) => <Floater key={f.id} text={f.text} good={f.good} />)}
        </View>
      </View>

      {v.alerts.map((a, i) => (
        <View key={i} style={[styles.alert, { borderLeftColor: a.lv === 'bad' ? colors.danger : colors.warn }]}>
          <Text style={styles.alertText}>{a.text}</Text>
        </View>
      ))}

      <Panel title="Advisor" icon="💡" onPressTitle={() => setAdvOpen((o) => !o)} right={<Text style={[styles.toggle, (theme.id === 'win95' || theme.id === 'xp') && { color: '#fff' }]}>{advOpen ? '▾' : '▸'}</Text>}>
        {advOpen && (
          <View style={{ gap: 10 }}>
            <Text style={styles.h}>Suggested next steps</Text>
            {v.recs.map((r) => (
              <View key={r.kind + r.id} style={styles.rec}>
                <Text style={styles.recIcon}>{r.icon}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.recName}>{r.name}</Text>
                  <Text style={styles.sub}>{r.why}</Text>
                  <Text style={styles.sub}>
                    {r.kind === 'tup' ? 'Permanent' : 'Pays back in ~' + v.fmtDur(r.payback)} · {r.max > 1 ? 'Lv ' + r.lvl + ' → ' + (r.lvl + 1) : 'One-off'}
                  </Text>
                  <Pressable
                    disabled={!r.afford}
                    onPress={() => act(() => buyRec(s, r))}
                    style={({ pressed }) => [styles.btn, !r.afford && styles.off, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.btnText}>{recButtonLabel(r, v.fmtDur)}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!v.recs.length && <Text style={styles.sub}>No upgrade stands out right now. Keep the shelves stocked and the sales will tell us more.</Text>}
            <Text style={styles.h}>Good to know</Text>
            {v.insights.map((i, k) => (
              <Text key={k} style={[styles.insight, i.lv === 'warn' && { color: colors.warn }, i.lv === 'bad' && { color: colors.danger }, i.lv === 'good' && { color: colors.good }]}>
                {i.icon}  {i.text}
              </Text>
            ))}
            {!v.insights.length && <Text style={styles.sub}>Nothing to report yet.</Text>}
            {v.more > 0 && <Text style={styles.sub}>+{v.more} lower-priority notes hidden</Text>}
          </View>
        )}
      </Panel>

      <Panel title="Shop Report" icon="📊">
        <View style={styles.grid}>
          {v.stats.map((st) => <Stat key={st.label} label={st.label} value={st.value} style={styles.mini} />)}
        </View>
      </Panel>

      <ServicePanel s={s} onChange={refresh} />

      <Panel title="Recent Sales" icon="🧾">
        {log.length ? log.map((l, i) => (
          <View key={l.id} style={[styles.logRow, i % 2 === 1 && styles.logAlt]}>
            <Text style={styles.logText} numberOfLines={1}>{l.text}</Text>
            <Text style={styles.logAmt}>{l.amt ? '+' + money(l.amt) : ''}</Text>
          </View>
        )) : <Text style={styles.sub}>No sales yet.</Text>}
      </Panel>

      <Panel title="The Times" icon="📰">
        <Text style={styles.recName}>{v.era.name} <Text style={styles.sub}>({v.era.from}+)</Text></Text>
        <Text style={styles.body}>{v.era.blurb}</Text>
        {v.events.map((e, i) => <Text key={i} style={[styles.body, { color: colors.warn }]}>📣 {e.name} — {e.text}</Text>)}
        {v.ended && <Text style={[styles.body, { color: colors.good }]}>🏁 You reached October 2035, the end of the roadmap! The calendar stops here — keep growing your empire, or open a new franchise.</Text>}
      </Panel>

      <Modal visible={!!away} transparent animationType="fade" onRequestClose={dismissAway}>
        <View style={styles.backdrop}>
          <Panel title="Welcome back!" icon="👋">
            {away && (
              <Text style={styles.body}>
                You were away {Math.round(away.elapsed / 60)} min{away.capped ? ' (offline limit reached)' : ''}.{'\n'}
                Cash {money(away.cash0)} → {money(away.cash1)}
              </Text>
            )}
            <Pressable style={styles.btn} onPress={dismissAway}><Text style={styles.btnText}>Back to the shop</Text></Pressable>
          </Panel>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = themed(() => {
  const id = theme.id;
  return {
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    hero: {
      ...theme.box, padding: 14, gap: 12,
      ...(id === 'rgb' ? { borderColor: '#3b2f7a', shadowColor: '#7a5cff', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } } : {}),
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    shopName: { color: colors.text, fontSize: 22, fontWeight: '800', fontFamily: theme.titleFont },
    eraChip: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: Math.min(10, theme.radius + 4), paddingHorizontal: 8, paddingVertical: 3 },
    eraText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
    cash: id === 'win95'
      ? { color: '#33ff33', backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 2, fontSize: 24, fontWeight: '700', fontFamily: theme.monoFont, overflow: 'hidden' }
      : id === 'rgb'
        ? { color: colors.good, fontSize: 26, fontWeight: '800', textShadowColor: 'rgba(61,255,154,.65)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }
        : { color: colors.good, fontSize: 26, fontWeight: '800', fontFamily: theme.titleFont },
    rate: { color: colors.good, fontSize: 12, fontWeight: '700' },
    yearRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroSub: { color: colors.dim, fontSize: 11, fontWeight: '600' },
    sub: { color: colors.dim, fontSize: 12 },
    body: { color: colors.dim, fontSize: 14, lineHeight: 20, marginTop: 4 },
    toggle: { color: colors.dim, fontSize: 18 },
    hustle: {
      borderRadius: Math.min(14, theme.radius + 2), paddingVertical: 18, alignItems: 'center', overflow: 'hidden', ...theme.btn,
      ...(id === 'rgb' ? { shadowColor: '#7a5cff', shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, overflow: 'visible' } : {}),
    },
    hbar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, opacity: 0.55 },
    hustleText: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: theme.titleFont, textShadowColor: 'rgba(0,0,0,.35)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
    floatLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    floater: { position: 'absolute', color: colors.good, fontSize: 22, fontWeight: '900', textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    floaterDim: { color: '#ffffff', fontSize: 16 },
    alert: { backgroundColor: colors.card, borderLeftWidth: 4, borderRadius: Math.min(10, theme.radius), padding: 12, ...(id === 'flat' ? { shadowColor: '#101828', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : {}) },
    alertText: { color: colors.text, fontSize: 13, lineHeight: 18 },
    h: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: theme.titleFont },
    rec: { flexDirection: 'row', gap: 10, backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 10 },
    recIcon: { fontSize: 28 },
    recName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    insight: { color: colors.dim, fontSize: 13, lineHeight: 18 },
    btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', marginTop: 4 },
    off: { opacity: 0.35 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    mini: { width: '48.5%' },
    logRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5, paddingHorizontal: 6, borderRadius: Math.min(6, theme.radius) },
    logAlt: { backgroundColor: colors.inset },
    logText: { color: colors.text, fontSize: 13, flex: 1 },
    logAmt: { color: colors.good, fontSize: 13, fontWeight: '700', fontFamily: theme.monoFont },
    backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  };
});
