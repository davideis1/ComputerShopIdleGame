import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/AuthProvider';
import { AccountPanel } from '@/components/AccountPanel';
import { useGame } from '@/GameProvider';
import { APP_VERSION, PRIVACY_URL, SUPPORT_URL } from '@/config';
import { buildMenuView, setShopName, TRO_FILTERS, TroFilter } from '@/menu';
import { colors, theme, themed, THEME_IDS, THEME_LABELS } from '@/theme';
import { Bar, Panel } from '@/components/ui';
import { gcAvailable, gcPlayer, gcShowAchievements, onGcPlayer } from '@/gamecenter';

export default function Menu() {
  const { game: s, frame, refresh, reset, saveNow } = useGame();
  const { token } = useAuth();
  const [filter, setFilter] = useState<TroFilter>('all');
  const [name, setName] = useState<string | null>(null); // what's being typed, until the box loses focus
  const [gc, setGc] = useState(gcPlayer);
  useEffect(() => onGcPlayer(setGc), []);
  const openGc = async () => {
    if (!(await gcShowAchievements())) Alert.alert('Game Center', 'Sign in to Game Center in the Settings app, then reopen Mega Byte Computers to sync your trophies.');
  };

  // Statistics tick up constantly, so refresh about once a second.
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(() => buildMenuView(s, filter), [s, filter, sec]);

  const confirmReset = () =>
    Alert.alert(
      'Erase everything?',
      'This permanently deletes your shop' + (token ? ' (on this phone and in your account)' : '') + ' and your Franchise Tokens, HQ upgrades and trophies, and starts over in 1993. (To restart a shop but keep your tokens, use Franchise HQ.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase all',
          style: 'destructive',
          onPress: async () => {
            const r = await reset();
            if (!r.ok) Alert.alert("Couldn't erase", r.message);
          },
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Panel title="Shop Settings" icon="🏷️">
        <Text style={styles.label}>Shop name</Text>
        <TextInput
          style={styles.input}
          value={name ?? s.name}
          maxLength={30}
          autoCorrect={false}
          onChangeText={(t) => { setName(t); setShopName(s, t); refresh(); }}
          onBlur={() => setName(null)}
        />
      </Panel>

      <Panel title="Look" icon="🎨">
        <Text style={styles.label}>Visual theme</Text>
        <View style={styles.chips}>
          {['auto', ...THEME_IDS].map((t) => {
            const on = (s.settings?.theme || 'auto') === t;
            return (
              <Pressable key={t} onPress={() => { s.settings = { ...s.settings, theme: t }; refresh(); }} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && { color: colors.onAccent }]}>{t === 'auto' ? 'Follow the era' : THEME_LABELS[t as keyof typeof THEME_LABELS]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Customers walking past</Text>
          <Switch value={s.settings?.showWalkers !== false} onValueChange={(v) => { s.settings = { ...s.settings, showWalkers: v }; refresh(); }} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>News ticker</Text>
          <Switch value={s.settings?.showTicker !== false} onValueChange={(v) => { s.settings = { ...s.settings, showTicker: v }; refresh(); }} />
        </View>
      </Panel>

      <AccountPanel />

      <Panel title="Statistics" icon="📈">
        {v.stats.map((st) => (
          <View key={st.label} style={styles.row}>
            <Text style={styles.rowLabel}>{st.label}</Text>
            <Text style={styles.rowVal}>{st.value}</Text>
          </View>
        ))}
      </Panel>

      <Panel title="Trophies" icon="🏆" right={v.trophyCount}>
        <View style={styles.chips}>
          {TRO_FILTERS.map((f) => (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, filter === f.id && styles.chipOn]}>
              <Text style={[styles.chipText, filter === f.id && { color: '#fff' }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        {gcAvailable && (
          <View style={styles.gcRow}>
            <Text style={[styles.sub, { flex: 1 }]}>
              {gc.authenticated ? '🎮 Synced to Game Center' + (gc.name ? ' as ' + gc.name : '') : '🎮 Sign in to Game Center to collect these there too'}
            </Text>
            <Pressable style={[styles.btn, styles.gcBtn]} onPress={openGc}><Text style={styles.btnText}>Game Center</Text></Pressable>
          </View>
        )}
        {v.trophies.map((t) => (
          <View key={t.id} style={[styles.trophy, !t.earned && styles.locked]}>
            <Text style={styles.trophyIcon}>{t.earned ? '🏆' : '🔒'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.trophyName}>{t.name}</Text>
              <Text style={styles.sub}>{t.desc}</Text>
              {!t.earned && t.progress > 0 && <View style={styles.trophyBar}><Bar value={t.progress} height={5} /></View>}
            </View>
          </View>
        ))}
        {!v.trophies.length && <Text style={styles.sub}>Nothing matches this filter.</Text>}
      </Panel>

      <Panel title="Save Data" icon="💾">
        <Text style={styles.body}>
          The game saves automatically every 15 seconds and when you leave the app. While you are away the shop keeps trading, up to your offline limit.
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.btn} onPress={saveNow}><Text style={styles.btnText}>💾 Save now</Text></Pressable>
          <Pressable style={[styles.btn, styles.danger]} onPress={confirmReset}><Text style={[styles.btnText, { color: colors.danger }]}>🗑️ Erase all</Text></Pressable>
        </View>
      </Panel>

      <Panel title="About" icon="ℹ️" right={APP_VERSION ? 'v' + APP_VERSION : undefined}>
        <Text style={styles.body}>
          Idle computer shop, 1993 → 2035 (the last decade is pure speculation). Every brand and product name is a made-up parody; this game is not affiliated with or endorsed by any real company. Offline progress is capped by your shop's Night Lock-Up, and Franchise Tokens, HQ upgrades and trophies carry over when you open a new franchise.
        </Text>
        <View style={styles.linkRow}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}><Text style={styles.link}>Privacy policy</Text></Pressable>
          <Pressable onPress={() => Linking.openURL(SUPPORT_URL)} hitSlop={8}><Text style={styles.link}>Support</Text></Pressable>
        </View>
      </Panel>
    </ScrollView>
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  panel: { ...theme.box, padding: 14, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 12 },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  label: { color: colors.text, fontSize: 14 },
  input: { backgroundColor: colors.inset, color: colors.text, borderRadius: Math.min(8, theme.radius), paddingHorizontal: 10, paddingVertical: 10, fontSize: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: colors.dim, fontSize: 14, flex: 1 },
  rowVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.inset, borderRadius: Math.min(16, theme.radius), paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  trophy: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 10 },
  locked: { opacity: 0.55 },
  trophyBar: { marginTop: 5 },
  gcRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gcBtn: { flex: 0, paddingHorizontal: 14, paddingVertical: 8 },
  trophyIcon: { fontSize: 22 },
  trophyName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },
  linkRow: { flexDirection: 'row', gap: 24 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  btn: { flex: 1, backgroundColor: colors.accent, ...theme.btn, paddingVertical: 11, alignItems: 'center' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
}));
