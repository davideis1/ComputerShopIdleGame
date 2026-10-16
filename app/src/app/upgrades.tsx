import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { buildUpgradesView, buyMax, buyOne, UP_FILTERS, UpFilter, UpRow } from '@/upgrades';
import { colors } from '@/theme';

function UpgradeCard({ row, onBuy, onMax }: { row: UpRow; onBuy: () => void; onMax: () => void }) {
  const { u } = row;
  const off = !row.canBuy;
  return (
    <View style={[styles.card, !row.unlocked && styles.locked]}>
      <Text style={styles.icon}>{u.icon}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{u.name}{row.lv ? <Text style={styles.sub}>  {row.lv}</Text> : null}</Text>
        <Text style={styles.sub}>{u.desc}</Text>
        {!!row.now && <Text style={styles.now}>{row.now}</Text>}
        {!!row.req && <Text style={styles.sub}>{row.req}</Text>}
        <View style={styles.btnRow}>
          <Pressable disabled={off} onPress={onBuy} style={({ pressed }) => [styles.btn, styles.buy, off && styles.off, pressed && styles.down]}>
            <Text style={styles.btnText}>{row.buyLabel}</Text>
          </Pressable>
          {u.max !== 1 && (
            <Pressable disabled={off} onPress={onMax} style={({ pressed }) => [styles.btn, off && styles.off, pressed && styles.down]}>
              <Text style={styles.btnText}>Max</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function Upgrades() {
  const { game: s, frame, refresh } = useGame();
  const [filter, setFilter] = useState<UpFilter>('all');
  const [acted, setActed] = useState(0);

  // Same cadence as the Stock tab: rebuild about once a second, and right after a purchase.
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => buildUpgradesView(s, filter), [s, filter, sec, acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  const header = (
    <View style={styles.header}>
      <View style={styles.stats}>
        {view.stats.map((st) => (
          <View key={st.label} style={styles.stat}>
            <Text style={styles.sub}>{st.label}</Text>
            <Text style={styles.statVal}>{st.value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>{view.hint}</Text>
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
      sections={view.sections}
      keyExtractor={(r: UpRow) => r.u.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>Nothing matches this filter.</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }: { item: UpRow }) => (
        <UpgradeCard row={item} onBuy={() => act(() => buyOne(s, item.u.id))} onMax={() => act(() => buyMax(s, item.u.id))} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { backgroundColor: colors.card, borderRadius: 10, padding: 10, width: '48%' },
  statVal: { color: colors.text, fontSize: 20, fontWeight: '700' },
  hint: { color: colors.dim, fontSize: 13, lineHeight: 18 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  locked: { opacity: 0.6 },
  icon: { fontSize: 28 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 12, fontWeight: '400' },
  now: { color: colors.good, fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { backgroundColor: '#2d3b52', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  buy: { backgroundColor: colors.accent, flex: 1 },
  off: { opacity: 0.35 },
  down: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: colors.dim, textAlign: 'center', marginTop: 24 },
});
