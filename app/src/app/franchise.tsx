import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { buildFranchiseView, buyTokenUpgrade, claimSummary, TupRow } from '@/franchise';
import { UP_FILTERS, UpFilter } from '@/upgrades';
import { colors } from '@/theme';

function TupCard({ row, onBuy }: { row: TupRow; onBuy: () => void }) {
  const { u } = row;
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{u.icon}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{u.name}  <Text style={styles.sub}>{row.lv}</Text></Text>
        <Text style={styles.sub}>{u.desc}</Text>
        {!!row.now && <Text style={styles.now}>{row.now}</Text>}
        <Pressable disabled={!row.canBuy} onPress={onBuy} style={({ pressed }) => [styles.btn, !row.canBuy && styles.off, pressed && { opacity: 0.7 }]}>
          <Text style={styles.btnText}>{row.buyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Franchise() {
  const { game: s, frame, refresh, prestige } = useGame();
  const [filter, setFilter] = useState<UpFilter>('all');
  const [acted, setActed] = useState(0);
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(() => buildFranchiseView(s, filter), [s, filter, sec, acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  const confirmClaim = () => {
    const c = claimSummary(s);
    Alert.alert(c.title, c.body, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Sell up & restart', style: 'destructive', onPress: () => { prestige(); setActed((n) => n + 1); } },
    ]);
  };

  const header = (
    <View style={{ gap: 12 }}>
      <View style={styles.panel}>
        <View style={styles.head}>
          <Text style={styles.panelTitle}>Franchise HQ</Text>
          <Text style={styles.tokens}>{v.tokens}</Text>
        </View>
        <Text style={styles.body}>
          Once your shop is a big business it earns Franchise Tokens from its lifetime sales. Cash them in by selling up and opening a brand-new franchise back in 1993. Tokens buy permanent HQ upgrades below.
        </Text>
        <View style={styles.grid}>
          {v.stats.map((st) => (
            <View key={st.label} style={styles.mini}>
              <Text style={styles.sub}>{st.label}</Text>
              <Text style={styles.miniVal}>{st.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${v.barPct}%` }]} /></View>
        <Text style={styles.sub}>{v.nextText}</Text>
        <Pressable disabled={!v.canClaim} onPress={confirmClaim} style={({ pressed }) => [styles.btn, !v.canClaim && styles.off, pressed && { opacity: 0.7 }]}>
          <Text style={styles.btnText}>{v.claimLabel}</Text>
        </Pressable>
        <Text style={styles.sub}>
          Kept: tokens, HQ upgrades, trophies, shop name, stats. Reset: cash, upgrades, stock, blueprints and the calendar.
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {UP_FILTERS.map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, filter === f.id && styles.chipOn]}>
            <Text style={[styles.chipText, filter === f.id && { color: '#fff' }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SectionList
      sections={v.sections}
      keyExtractor={(r: TupRow) => r.u.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>Nothing matches this filter.</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }: { item: TupRow }) => <TupCard row={item} onBuy={() => act(() => buyTokenUpgrade(s, item.u.id))} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  panel: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  tokens: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  sub: { color: colors.dim, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, width: '48.5%' },
  miniVal: { color: colors.text, fontSize: 17, fontWeight: '700' },
  track: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  icon: { fontSize: 28 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  now: { color: colors.good, fontSize: 12 },
  btn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', marginTop: 6 },
  off: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: colors.dim, textAlign: 'center', marginTop: 24 },
});
