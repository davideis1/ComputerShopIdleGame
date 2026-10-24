import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, SectionList, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { buildFranchiseView, buyTokenUpgrade, claimSummary, TupRow } from '@/franchise';
import { UP_FILTERS, UpFilter } from '@/upgrades';
import { colors, theme, themed } from '@/theme';
import { Bar, Panel, Stat } from '@/components/ui';

function TupCard({ row, onBuy }: { row: TupRow; onBuy: () => void }) {
  const { u } = row;
  return (
    <View style={styles.card}>
      <View style={styles.iconTile}><Text style={styles.icon}>{u.icon}</Text></View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
          {!!row.lv && <Text style={styles.lvl}>{row.lv}</Text>}
        </View>
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
      <Panel title="Franchise HQ" icon="🏢" right={<Text style={styles.tokens}>{v.tokens}</Text>}>
        <Text style={styles.body}>
          Once your shop is a big business it earns Franchise Tokens from its lifetime sales. Cash them in by selling up and opening a brand-new franchise back in 1993. Tokens buy permanent HQ upgrades below.
        </Text>
        <View style={styles.grid}>
          {v.stats.map((st) => <Stat key={st.label} label={st.label} value={st.value} style={styles.mini} />)}
        </View>
        <Bar value={v.barPct / 100} height={12} />
        <Text style={styles.sub}>{v.nextText}</Text>
        <Pressable disabled={!v.canClaim} onPress={confirmClaim} style={({ pressed }) => [styles.btn, !v.canClaim && styles.off, pressed && { opacity: 0.7 }]}>
          <Text style={styles.btnText}>{v.claimLabel}</Text>
        </Pressable>
        <Text style={styles.sub}>
          Kept: tokens, HQ upgrades, trophies, shop name, stats. Reset: cash, upgrades, stock, blueprints and the calendar.
        </Text>
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
      sections={v.sections}
      keyExtractor={(r: TupRow) => r.u.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>Nothing matches this filter.</Text>}
      renderSectionHeader={({ section }) => <View style={styles.sectionRow}><Text style={styles.section}>{section.title}</Text><View style={styles.sectionRule} /></View>}
      renderItem={({ item }: { item: TupRow }) => <TupCard row={item} onBuy={() => act(() => buyTokenUpgrade(s, item.u.id))} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 40 },
  tokens: { color: theme.id === 'win95' || theme.id === 'xp' ? '#ffffff' : colors.text, fontSize: 16, fontWeight: '800' },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  sub: { color: colors.dim, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { width: '48.5%' },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: Math.min(16, theme.radius), paddingHorizontal: 12, paddingVertical: 7, ...(theme.id === 'win95' ? theme.quietBtn : {}) },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 },
  section: { color: colors.onBg, fontSize: 18, fontWeight: '800', fontFamily: theme.titleFont },
  sectionRule: { flex: 1, height: 2, backgroundColor: colors.onBgDim, opacity: 0.35 },
  card: { flexDirection: 'row', gap: 12, ...theme.box, padding: 14 },
  iconTile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inset, borderRadius: Math.min(12, theme.radius + 2) },
  icon: { fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: theme.titleFont, flexShrink: 1 },
  lvl: { color: colors.onAccent, backgroundColor: colors.accent, fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Math.min(8, theme.radius + 2), overflow: 'hidden' },
  now: { color: colors.good, fontSize: 12, fontWeight: '600' },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', marginTop: 6 },
  off: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: colors.onBgDim, textAlign: 'center', marginTop: 24 },
}));
