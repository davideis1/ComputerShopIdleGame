import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
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

function Btn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.btn, disabled && styles.btnOff, pressed && styles.btnDown]}>
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
        <Text style={styles.icon}>{it.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{(it.brand ? it.brand + ' ' : '') + it.name}</Text>
          <Text style={styles.sub}>{subtitle(it)}</Text>
        </View>
        <View style={styles.stockBox}>
          <Text style={styles.stockNum}>{it.stock}</Text>
          <Text style={styles.sub}>in stock</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <Text style={[styles.tag, it.age < 0.7 && it.buyable && styles.tagNew]}>{ageTag(it)}</Text>
        <Text style={styles.tag}>{perfLabel(it)}</Text>
        <Text style={styles.tag}>🔥 Demand {Math.round(pop * 100)}%</Text>
        {extra && <Text style={styles.tag}>{extra}</Text>}
      </View>

      <View style={styles.nums}>
        <Text style={styles.num}>Price <Text style={styles.b}>{money(it.price)}</Text></Text>
        <Text style={styles.num}>Cost <Text style={styles.b}>{money(it.cost)}</Text></Text>
        <Text style={styles.num}>Profit <Text style={[styles.b, { color: profit >= 0 ? colors.good : colors.danger }]}>{money(profit)}</Text></Text>
      </View>

      <View style={styles.row}>
        <Btn label="Buy 1" onPress={() => onBuy(1)} disabled={!canBuy} />
        <Btn label={'+' + (it.pack || 5)} onPress={() => onBuy(it.pack || 5)} disabled={!canBuy} />
        <Btn label="Max" onPress={() => onBuy('max')} disabled={!canBuy} />
      </View>

      {it.mgrCat && <MgrRow it={it} onPin={onPin} onSkip={onSkip} />}
      {!it.managed && (
        <View style={styles.stepper}>
          <Text style={styles.sub}>{clerk ? 'Auto-restock to' : '🔒 Needs Stock Clerk'}</Text>
          <View style={styles.row}>
            <Btn label="−" onPress={() => onTarget(-1)} disabled={!clerk || !it.buyable} />
            <Text style={styles.target}>{it.target}</Text>
            <Btn label="+" onPress={() => onTarget(1)} disabled={!clerk || !it.buyable} />
          </View>
        </View>
      )}
    </View>
  );
});

const styles = themed(() => ({
  card: { ...theme.box, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 30 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 12 },
  stockBox: { alignItems: 'flex-end' },
  stockNum: { color: colors.text, fontSize: 22, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: colors.dim, backgroundColor: colors.inset, borderRadius: Math.min(6, theme.radius), paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, overflow: 'hidden' },
  tagNew: { color: colors.text, backgroundColor: colors.accent },
  nums: { flexDirection: 'row', justifyContent: 'space-between' },
  num: { color: colors.dim, fontSize: 13 },
  b: { color: colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  target: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  btn: { backgroundColor: colors.accent, borderRadius: Math.min(8, theme.radius), paddingVertical: 9, paddingHorizontal: 14, minWidth: 48, alignItems: 'center' },
  btnOff: { opacity: 0.35 },
  btnDown: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
}));
