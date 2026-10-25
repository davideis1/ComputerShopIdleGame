import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import CS from '@core';
import { Pressable } from 'react-native';
import { useGame } from '@/GameProvider';
import { ServicePanel } from '@/components/ServicePanel';
import { Panel } from '@/components/ui';
import { buildUpgradesView, buyMax, buyOne, SERVICE_GROUPS, UpRow } from '@/upgrades';
import { UpgradeCard } from './upgrades';
import { money, num, colors, theme, themed } from '@/theme';

/** Service tab: the desk (jobs, capacity, menu, warranties), its manager, and the service upgrades. */
export default function Service() {
  const { game: s, frame, refresh } = useGame();
  const router = useRouter();
  const [acted, setActed] = useState(0);
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows: UpRow[] = useMemo(() => buildUpgradesView(s, 'all', SERVICE_GROUPS).sections[0]?.data ?? [], [s, sec, acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  const mg = s.mgr?.svc;
  const cfg = mg ? CS.M.cfgOf(s, 'svc') : null;
  const open = !!(rows.length && s.up.svc_desk);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ServicePanel s={s} onChange={() => { setActed((n) => n + 1); refresh(); }} />

      <Panel title="Service Desk manager" icon="👔">
        <Text style={styles.body}>
          {!open ? 'Open the desk first.'
            : mg ? `${CS.MGR_TRAITS[mg.trait].icon} ${mg.name} keeps the desk staffed: ${cfg.on ? 'on duty' : '😴 off duty'}, ${money(mg.stats.spent)} spent on ${num(mg.stats.ordered)} upgrades.`
            : 'Hire a manager in the Managers tab to add repair capacity and Warranty Pitch for you.'}
        </Text>
        {open && (
          <Pressable onPress={() => router.navigate('/buyers' as any)} style={styles.btn}><Text style={styles.btnText}>Open Managers</Text></Pressable>
        )}
      </Panel>

      {!!rows.length && (
        <View style={{ gap: 10 }}>
          <View style={styles.sectionRow}><Text style={styles.section}>Service upgrades</Text><View style={styles.sectionRule} /></View>
          {rows.map((row) => (
            <UpgradeCard key={row.u.id} row={row} onBuy={() => act(() => buyOne(s, row.u.id))} onMax={() => act(() => buyMax(s, row.u.id))} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  section: { color: colors.onBg, fontSize: 18, fontWeight: '800', fontFamily: theme.titleFont },
  sectionRule: { flex: 1, height: 2, backgroundColor: colors.onBgDim, opacity: 0.35 },
}));
