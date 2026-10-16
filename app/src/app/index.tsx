import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { buildShopView, buyRec, recButtonLabel } from '@/shop';
import { colors, money, num } from '@/theme';

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName}>{s.name || 'Computer Shop'}</Text>
          <Text style={styles.sub}>{v.date} · {v.era.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cash}>{money(s.cash)}</Text>
          <Text style={styles.sub}>{money(cashPerMin)}/min</Text>
        </View>
      </View>

      <Panel title="Storefront" right={<Text style={styles.sub}>{v.stockInfo}</Text>}>
        <Text style={styles.shelves}>{v.shelves || 'The shelves are empty…'}</Text>
      </Panel>

      <Pressable onPress={hustle} disabled={cooling} style={({ pressed }) => [styles.hustle, cooling && styles.hustleOff, pressed && { opacity: 0.8 }]}>
        <View style={[styles.hbar, { width: `${cooling ? 100 * (1 - s.hustleCd / 3) : 0}%` }]} />
        <Text style={styles.hustleText}>
          {cooling ? '🤝 Hustling… ' + Math.ceil(s.hustleCd) + 's' : '🤝 Hustle a customer'}
        </Text>
      </Pressable>
      {!!hustleResult && (
        <Text style={[styles.result, hustleResult.kind === 'sold' && { color: colors.good }]}>
          {hustleResult.kind === 'sold' ? '+' + money(hustleResult.rev || 0) : hustleResult.text}
        </Text>
      )}

      {v.alerts.map((a, i) => (
        <View key={i} style={[styles.alert, a.lv === 'bad' && styles.alertBad]}>
          <Text style={styles.alertText}>{a.text}</Text>
        </View>
      ))}

      <Panel title="💡 Advisor" right={<Pressable onPress={() => setAdvOpen((o) => !o)} hitSlop={12}><Text style={styles.toggle}>{advOpen ? '▾' : '▸'}</Text></Pressable>}>
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
              <Text key={k} style={[styles.insight, i.lv === 'warn' && { color: '#e8b04a' }, i.lv === 'bad' && { color: colors.danger }, i.lv === 'good' && { color: colors.good }]}>
                {i.icon}  {i.text}
              </Text>
            ))}
            {!v.insights.length && <Text style={styles.sub}>Nothing to report yet.</Text>}
            {v.more > 0 && <Text style={styles.sub}>+{v.more} lower-priority notes hidden</Text>}
          </View>
        )}
      </Panel>

      <Panel title="Shop Report">
        <View style={styles.grid}>
          {v.stats.map((st) => (
            <View key={st.label} style={styles.mini}>
              <Text style={styles.sub}>{st.label}</Text>
              <Text style={styles.miniVal}>{st.value}</Text>
            </View>
          ))}
        </View>
      </Panel>

      <Panel title="Recent Sales">
        {log.length ? log.map((l) => (
          <View key={l.id} style={styles.logRow}>
            <Text style={styles.logText} numberOfLines={1}>{l.text}</Text>
            <Text style={styles.logAmt}>{l.amt ? '+' + money(l.amt) : ''}</Text>
          </View>
        )) : <Text style={styles.sub}>No sales yet.</Text>}
      </Panel>

      <Panel title="The Times">
        <Text style={styles.recName}>{v.era.name} <Text style={styles.sub}>({v.era.from}+)</Text></Text>
        <Text style={styles.body}>{v.era.blurb}</Text>
        {v.events.map((e, i) => <Text key={i} style={[styles.body, { color: '#e8b04a' }]}>📣 {e.name} — {e.text}</Text>)}
        {v.ended && <Text style={[styles.body, { color: colors.good }]}>🎉 You made it to today! The calendar stops here — keep growing your empire.</Text>}
      </Panel>

      <Modal visible={!!away} transparent animationType="fade" onRequestClose={dismissAway}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.shopName}>Welcome back!</Text>
            {away && (
              <Text style={styles.body}>
                You were away {Math.round(away.elapsed / 60)} min{away.capped ? ' (offline limit reached)' : ''}.{'\n'}
                Cash {money(away.cash0)} → {money(away.cash1)}
              </Text>
            )}
            <Pressable style={styles.btn} onPress={dismissAway}><Text style={styles.btnText}>Back to the shop</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopName: { color: colors.text, fontSize: 22, fontWeight: '700' },
  cash: { color: colors.good, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 12 },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20, marginTop: 4 },
  panel: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  toggle: { color: colors.dim, fontSize: 18 },
  shelves: { fontSize: 22, lineHeight: 30, color: colors.text },
  hustle: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', overflow: 'hidden' },
  hustleOff: { backgroundColor: '#2d3b52' },
  hbar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, opacity: 0.6 },
  hustleText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  result: { color: colors.dim, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  alert: { backgroundColor: '#3a2f16', borderRadius: 10, padding: 12 },
  alertBad: { backgroundColor: '#3d1b1d' },
  alertText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  h: { color: colors.text, fontSize: 13, fontWeight: '700' },
  rec: { flexDirection: 'row', gap: 10, backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  recIcon: { fontSize: 26 },
  recName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  insight: { color: colors.dim, fontSize: 13, lineHeight: 18 },
  btn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', marginTop: 4 },
  off: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, width: '48.5%' },
  miniVal: { color: colors.text, fontSize: 18, fontWeight: '700' },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  logText: { color: colors.dim, fontSize: 13, flex: 1 },
  logAmt: { color: colors.good, fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.card, borderRadius: 14, padding: 20, gap: 8 },
});
