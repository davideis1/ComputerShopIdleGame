import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { buildUpgradesView, buyMax, buyOne, UP_FILTERS, UpFilter, UpRow } from '@/upgrades';
import { colors, theme, themed } from '@/theme';
import * as Haptics from 'expo-haptics';
import { Bar, Panel, Stat } from '@/components/ui';

function UpgradeCard({ row, onBuy, onMax }: { row: UpRow; onBuy: () => void; onMax: () => void }) {
  const { u } = row;
  const off = !row.canBuy;
  const m = /Lv (\d+)\/(\d+)/.exec(row.lv || '');
  const tap = (fn: () => void) => () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); fn(); };
  return (
    <View style={[styles.card, !row.unlocked && styles.locked]}>
      <View style={styles.iconTile}><Text style={styles.icon}>{row.unlocked ? u.icon : '🔒'}</Text></View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
          {!!row.lv && <Text style={[styles.lvl, row.lv === '✔' && styles.lvlDone]}>{row.lv}</Text>}
        </View>
        {m && <Bar value={Number(m[1]) / Number(m[2])} height={5} />}
        <Text style={styles.sub}>{u.desc}</Text>
        {!!row.now && <Text style={styles.now}>{row.now}</Text>}
        {!!row.req && <Text style={styles.sub}>{row.req}</Text>}
        <View style={styles.btnRow}>
          <Pressable disabled={off} onPress={tap(onBuy)} style={({ pressed }) => [styles.btn, styles.buy, off && styles.off, pressed && styles.down]}>
            <Text style={styles.btnText}>{row.buyLabel}</Text>
          </Pressable>
          {u.max !== 1 && (
            <Pressable disabled={off} onPress={tap(onMax)} style={({ pressed }) => [styles.btn, off && styles.off, pressed && styles.down]}>
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
      <Panel title="Upgrades" icon="📈">
        <View style={styles.stats}>
          {view.stats.map((st) => <Stat key={st.label} label={st.label} value={st.value} style={styles.stat} />)}
        </View>
        <Text style={styles.hint}>{view.hint}</Text>
      </Panel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {UP_FILTERS.map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, filter === f.id && styles.chipOn]}>
            <Text style={[styles.chipText, filter === f.id && { color: colors.onAccent }]}>{f.label}</Text>
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
      renderSectionHeader={({ section }) => <View style={styles.sectionRow}><Text style={styles.section}>{section.title}</Text><View style={styles.sectionRule} /></View>}
      renderItem={({ item }: { item: UpRow }) => (
        <UpgradeCard row={item} onBuy={() => act(() => buyOne(s, item.u.id))} onMax={() => act(() => buyMax(s, item.u.id))} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48.5%' },
  hint: { color: colors.dim, fontSize: 13, lineHeight: 18 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: Math.min(16, theme.radius), paddingHorizontal: 12, paddingVertical: 7, ...(theme.id === 'win95' ? theme.quietBtn : {}) },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 },
  section: { color: colors.onBg, fontSize: 18, fontWeight: '800', fontFamily: theme.titleFont, textShadowColor: theme.id === 'win95' || theme.id === 'xp' ? 'rgba(0,0,0,.35)' : 'transparent', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  sectionRule: { flex: 1, height: 2, backgroundColor: colors.onBgDim, opacity: 0.35 },
  card: { flexDirection: 'row', gap: 12, ...theme.box, padding: 14 },
  locked: { opacity: 0.55 },
  iconTile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inset, borderRadius: Math.min(12, theme.radius + 2) },
  icon: { fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: theme.titleFont, flexShrink: 1 },
  lvl: { color: colors.onAccent, backgroundColor: colors.accent, fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Math.min(8, theme.radius + 2), overflow: 'hidden' },
  lvlDone: { backgroundColor: colors.good },
  sub: { color: colors.dim, fontSize: 12, fontWeight: '400' },
  now: { color: colors.good, fontSize: 12, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { backgroundColor: colors.quiet, ...theme.quietBtn, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  buy: { backgroundColor: colors.accent, ...theme.btn, flex: 1 },
  off: { opacity: 0.35 },
  down: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: colors.onBgDim, textAlign: 'center', marginTop: 24 },
}));
