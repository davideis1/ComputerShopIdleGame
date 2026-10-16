import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ItemCard } from '@/components/ItemCard';
import { useGame } from '@/GameProvider';
import { E } from '@/game';
import { Age, buildStockView, canBuy, Cat, CATS, Filters, Item, Shelf, SORTS, SortId, stepTarget } from '@/stock';
import { colors, money } from '@/theme';

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.chip, value === o.id && styles.chipOn]}>
          <Text style={[styles.chipText, value === o.id && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const AGES: { id: Age; label: string }[] = [{ id: 'all', label: 'All ages' }, { id: 'current', label: 'Current' }, { id: 'old', label: 'Older' }];
const SHELVES: { id: Shelf; label: string }[] = [{ id: 'all', label: 'All shelves' }, { id: 'stocked', label: 'In stock' }, { id: 'empty', label: 'Not stocked' }];

export default function Stock() {
  const { game: s, frame, refresh } = useGame();
  const [cat, setCat] = useState<Cat>('pre');
  const [age, setAge] = useState<Age>('all');
  const [shelf, setShelf] = useState<Shelf>('all');
  const [sort, setSort] = useState<SortId>('new');
  const [q, setQ] = useState('');
  const [acted, setActed] = useState(0); // bumps after a tap so the list recomputes immediately

  // Rebuilding the list walks every product, so do it about once a second (plus right after a tap).
  const sec = Math.floor(frame / 4);
  const filters: Filters = useMemo(() => ({ age, shelf, sort, q }), [age, shelf, sort, q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => buildStockView(s, cat, filters), [s, cat, filters, sec, acted]);

  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);
  const room = view.cap - view.used;
  const priceAdj = Math.round(s.priceAdj * 100);

  const header = (
    <View style={styles.header}>
      <View style={styles.capRow}>
        <Text style={styles.sub}>Shelf space</Text>
        <Text style={styles.capText}>{view.used} / {view.cap}</Text>
      </View>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, (100 * view.used) / view.cap)}%` }]} /></View>

      <Chips value={cat} options={CATS} onChange={setCat} />
      <Chips value={age} options={AGES} onChange={setAge} />
      <Chips value={shelf} options={SHELVES} onChange={setShelf} />
      <Chips value={sort} options={SORTS} onChange={setSort} />
      <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder="Search name or brand…" placeholderTextColor={colors.dim} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" />

      <View style={styles.pricing}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pricingTitle}>Pricing policy</Text>
          <Text style={styles.sub}>{view.clerk ? 'Higher prices = more profit per sale, fewer buyers.' : 'Hire a Stock Clerk in Upgrades to unlock auto-restocking.'}</Text>
        </View>
        <Pressable style={styles.step} onPress={() => act(() => { s.priceAdj = Math.max(-0.2, Math.round((s.priceAdj - 0.05) * 100) / 100); })}><Text style={styles.stepText}>−</Text></Pressable>
        <Text style={styles.pricingVal}>{priceAdj >= 0 ? '+' : ''}{priceAdj}%</Text>
        <Pressable style={styles.step} onPress={() => act(() => { s.priceAdj = Math.min(0.3, Math.round((s.priceAdj + 0.05) * 100) / 100); })}><Text style={styles.stepText}>+</Text></Pressable>
      </View>

      {!view.unlocked && view.aisle && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{view.aisle.icon} {view.aisle.name}</Text>
          <Text style={styles.sub}>{view.aisle.desc}</Text>
          <Pressable
            style={[styles.open, s.cash < view.aisle.base && styles.openOff]}
            disabled={s.cash < view.aisle.base}
            onPress={() => act(() => E.buyUp(s, view.aisle!.id))}
          >
            <Text style={styles.openText}>Open for {money(view.aisle.base)}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={view.list}
      keyExtractor={(it: Item) => it.key}
      ListHeaderComponent={header}
      ListEmptyComponent={view.unlocked ? <Text style={styles.empty}>Nothing matches these filters.</Text> : undefined}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }: { item: Item }) => (
        <ItemCard
          it={item}
          pop={view.pop[item.key] || 0}
          clerk={view.clerk}
          canBuy={canBuy(s, item, room)}
          onBuy={(n) => act(() => E.buy(s, item.key, n))}
          onTarget={(dir) => act(() => stepTarget(s, item, dir))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 12 },
  sub: { color: colors.dim, fontSize: 12 },
  capRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  bar: { height: 6, backgroundColor: colors.card, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.accent },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  search: { backgroundColor: colors.card, color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  pricing: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  pricingTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  pricingVal: { color: colors.text, fontWeight: '700', fontSize: 16, minWidth: 48, textAlign: 'center' },
  step: { backgroundColor: colors.accent, borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  notice: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8 },
  noticeTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  open: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
  openOff: { opacity: 0.35 },
  openText: { color: '#fff', fontWeight: '700' },
  empty: { color: colors.dim, textAlign: 'center', marginTop: 24 },
});
