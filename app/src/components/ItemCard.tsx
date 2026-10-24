import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Bar } from '@/components/ui';
import { ageTag, extraTag, Item, perfLabel, subtitle } from '@/stock';
import { MgrRow } from '@/components/MgrRow';
import { colors, money, theme, themed } from '@/theme';

type Props = {
  it: Item;
  pop: number;
  clerk: boolean;
  canBuy: boolean;
  onBuy: (n: number | 'max') => void;
  onTarget: (dir: 1 | -1) => void;
  onPin: () => void;
  onSkip: () => void;
};

function Btn({ label, onPress, disabled, quiet }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  const tap = () => { Haptics.selectionAsync().catch(() => {}); onPress(); };
  return (
    <Pressable onPress={tap} disabled={disabled} style={({ pressed }) => [styles.btn, quiet && styles.btnQuiet, disabled && styles.btnOff, pressed && styles.btnDown]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export const ItemCard = memo(function ItemCard({ it, pop, clerk, canBuy, onBuy, onTarget, onPin, onSkip }: Props) {
  const extra = extraTag(it);
  const profit = it.price - it.cost;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconTile}><Text style={styles.icon}>{it.icon}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={2}>{(it.brand ? it.brand + ' ' : '') + it.name}</Text>
          <Text style={styles.sub}>{subtitle(it)}</Text>
        </View>
        <View style={[styles.stockBox, it.stock === 0 && styles.stockEmpty]}>
          <Text style={[styles.stockNum, it.stock === 0 && { color: colors.danger }]}>{it.stock}</Text>
          <Text style={styles.stockLbl}>in stock</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <Text style={[styles.tag, it.age < 0.7 && it.buyable && styles.tagNew]}>{it.age < 0.7 && it.buyable ? '✨ ' : ''}{ageTag(it)}</Text>
        {extra && <Text style={styles.tag}>{extra}</Text>}
      </View>

      <View style={styles.meters}>
        <View style={styles.meter}>
          <Text style={styles.meterLbl}>{perfLabel(it)}</Text>
          <Bar value={Math.min(1, it.rel / 1.5)} height={6} />
        </View>
        <View style={styles.meter}>
          <Text style={styles.meterLbl}>🔥 Demand {Math.round(pop * 100)}%</Text>
          <Bar value={pop} height={6} />
        </View>
      </View>

      <View style={styles.nums}>
        <View><Text style={styles.numLbl}>Price</Text><Text style={styles.numVal}>{money(it.price)}</Text></View>
        <View><Text style={styles.numLbl}>Cost</Text><Text style={styles.numVal}>{money(it.cost)}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={styles.numLbl}>Profit / unit</Text><Text style={[styles.numVal, { color: profit >= 0 ? colors.good : colors.danger }]}>{money(profit)}</Text></View>
      </View>

      <View style={styles.row}>
        <Btn label="Buy 1" onPress={() => onBuy(1)} disabled={!canBuy} />
        <Btn label={'+' + (it.pack || 5)} onPress={() => onBuy(it.pack || 5)} disabled={!canBuy} quiet />
        <Btn label="Max" onPress={() => onBuy('max')} disabled={!canBuy} quiet />
      </View>

      {it.mgrCat && <MgrRow it={it} onPin={onPin} onSkip={onSkip} />}
      {!it.managed && (
        <View style={styles.stepper}>
          <Text style={styles.sub}>{clerk ? 'Auto-restock to' : '🔒 Needs Stock Clerk'}</Text>
          <View style={styles.row}>
            <Btn label="−" onPress={() => onTarget(-1)} disabled={!clerk || !it.buyable} quiet />
            <Text style={styles.target}>{it.target}</Text>
            <Btn label="+" onPress={() => onTarget(1)} disabled={!clerk || !it.buyable} quiet />
          </View>
        </View>
      )}
    </View>
  );
});

const styles = themed(() => ({
  card: { ...theme.box, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inset, borderRadius: Math.min(12, theme.radius + 2),
    ...(theme.id === 'win95' ? { borderWidth: 1, borderTopColor: '#808080', borderLeftColor: '#808080', borderRightColor: '#ffffff', borderBottomColor: '#ffffff' } : {}),
    ...(theme.id === 'rgb' ? { borderWidth: 1, borderColor: '#2d3566' } : {}),
  },
  icon: { fontSize: 30 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: theme.titleFont },
  sub: { color: colors.dim, fontSize: 12 },
  stockBox: { alignItems: 'center', minWidth: 58, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius) },
  stockEmpty: { borderWidth: 1, borderColor: colors.danger },
  stockNum: { color: colors.text, fontSize: 20, fontWeight: '800', fontFamily: theme.monoFont },
  stockLbl: { color: colors.dim, fontSize: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: colors.dim, backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, overflow: 'hidden' },
  tagNew: { color: colors.onAccent, backgroundColor: colors.accent, fontWeight: '700' },
  meters: { flexDirection: 'row', gap: 12 },
  meter: { flex: 1, gap: 4 },
  meterLbl: { color: colors.dim, fontSize: 11 },
  nums: { flexDirection: 'row', justifyContent: 'space-between' },
  numLbl: { color: colors.dim, fontSize: 11 },
  numVal: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: theme.monoFont },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  target: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center', fontFamily: theme.monoFont },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 9, paddingHorizontal: 14, minWidth: 48, alignItems: 'center' },
  btnQuiet: { backgroundColor: colors.quiet, ...theme.quietBtn },
  btnOff: { opacity: 0.35 },
  btnDown: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
}));
