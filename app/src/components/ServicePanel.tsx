import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { E, GameState } from '@/game';
import { colors, money, num, theme, themed } from '@/theme';
import { Panel, Stat } from './ui';

/** Service Desk on the Shop tab: a teaser with an Open button, then jobs, capacity, the era's menu and warranties.
    The numbers come from E.serviceView, which the web build renders too. */
export function ServicePanel({ s, onChange }: { s: GameState; onChange: () => void }) {
  const v = E.serviceView(s, E.derive(s));
  if (!v.available) return null;
  if (!v.open) {
    const can = s.cash >= v.openCost;
    return (
      <Panel title="Service Desk" icon="🛎️">
        <Text style={styles.body}>Fix customers' computers and sell extended warranties: steady money that takes no shelf space.</Text>
        <Pressable
          disabled={!can}
          onPress={() => { if (E.buyUp(s, 'svc_desk')) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onChange(); } }}
          style={({ pressed }) => [styles.btn, !can && styles.off, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.btnText}>Open the Service Desk for {money(v.openCost)}</Text>
        </Pressable>
      </Panel>
    );
  }
  const tiles: [string, string][] = [
    ['Repair jobs / min', num(v.jobs)], ['Walk-ins / min', num(v.walkIns)],
    ['Capacity / min', num(v.capacity)], ['Taking a warranty', Math.round(v.warrantyShare * 100) + '%'],
    ['Repair income', money(v.repairRevenue)], ['Warranty income', money(v.warrantyRevenue)],
    ['Claims paid', money(v.claimsPaid)], ['Claims to come', money(v.claimsDue)],
  ];
  return (
    <Panel title="Service Desk" icon="🛎️" right={money(v.income) + '/min'}>
      <View style={styles.grid}>{tiles.map(([l, x]) => <Stat key={l} label={l} value={x} style={styles.mini} />)}</View>
      {v.busy && <Text style={styles.warn}>🚪 Turning away {num(v.turnedAway)} jobs a minute. Hire technicians in the Service tab, or a Service Desk manager in Managers.</Text>}
      <Text style={styles.sub}>On the menu</Text>
      <View style={styles.menu}>
        {v.menu.map((x: { id: string; icon: string; name: string; price: number }) => (
          <View key={x.id} style={styles.chip}><Text style={styles.chipText}>{x.icon} {x.name} · {money(x.price)}</Text></View>
        ))}
      </View>
    </Panel>
  );
}

const styles = themed(() => ({
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  sub: { color: colors.dim, fontSize: 12, fontWeight: '600' },
  warn: { color: colors.warn, fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { width: '48.5%' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.inset, borderRadius: Math.min(12, theme.radius + 2), paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { color: colors.text, fontSize: 12 },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginTop: 4 },
  off: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
}));
