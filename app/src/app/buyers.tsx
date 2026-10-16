import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useGame } from '@/GameProvider';
import {
  buildBuyersView, CatView, CtlView, fire, hire, openOffice, refreshCands, setCfg, severance, toggleChip, train,
} from '@/buyers';
import { colors, money, theme, themed } from '@/theme';

/* ---------- small building blocks ---------- */
function Btn({ label, onPress, disabled, kind }: { label: string; onPress: () => void; disabled?: boolean; kind?: 'danger' | 'quiet' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, kind === 'quiet' && styles.btnQuiet, kind === 'danger' && styles.btnDanger, disabled && styles.off, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.btnText, kind === 'danger' && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, on && styles.chipOn, disabled && styles.off]}>
      <Text style={[styles.chipText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/** One setting, rendered by control type (the web build uses select / slider / checkbox / chips). */
function Control({ cv, onChange, onChip }: { cv: CtlView; onChange: (v: any) => void; onChip: (id: string) => void }) {
  const { ctl, value, locked } = cv;
  const [draft, setDraft] = useState<string | null>(null); // numeric/text boxes keep what you type until you leave
  if (ctl.t === 'toggle') {
    return (
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctlLabel}>{ctl.l}</Text>
          {!!cv.lockText && <Text style={styles.sub}>{cv.lockText}</Text>}
        </View>
        <Switch value={!!value && !locked} disabled={locked} onValueChange={onChange} />
      </View>
    );
  }
  return (
    <View style={styles.ctl}>
      <View style={styles.ctlHead}>
        <Text style={styles.ctlLabel}>{ctl.l}</Text>
        {ctl.t === 'range' && <Text style={styles.ctlVal}>{cv.display}</Text>}
      </View>
      {!!cv.lockText && <Text style={styles.sub}>{cv.lockText}</Text>}
      {ctl.t === 'range' && (
        <View style={styles.stepRow}>
          <Btn label="−" kind="quiet" disabled={locked || value <= cv.min} onPress={() => onChange(Math.max(cv.min, round(value - (ctl.step || 1))))} />
          <View style={styles.track}><View style={[styles.fill, { width: `${cv.max > cv.min ? (100 * (value - cv.min)) / (cv.max - cv.min) : 0}%` }]} /></View>
          <Btn label="+" kind="quiet" disabled={locked || value >= cv.max} onPress={() => onChange(Math.min(cv.max, round(value + (ctl.step || 1))))} />
        </View>
      )}
      {ctl.t === 'select' && (
        <View style={styles.wrap}>
          {cv.options.map((o) => <Chip key={o.id} label={o.label} on={String(value) === o.id} disabled={locked} onPress={() => onChange(o.id)} />)}
        </View>
      )}
      {ctl.t === 'chips' && (
        <View style={styles.wrap}>
          {cv.options.map((o) => <Chip key={o.id} label={o.label} on={(value || []).includes(o.id)} onPress={() => onChip(o.id)} />)}
        </View>
      )}
      {(ctl.t === 'num' || ctl.t === 'text') && (
        <TextInput
          style={styles.input}
          value={draft ?? String(value ?? (ctl.t === 'num' ? 0 : ''))}
          keyboardType={ctl.t === 'num' ? 'numeric' : 'default'}
          maxLength={ctl.maxlength}
          autoCorrect={false}
          onChangeText={(t) => {
            setDraft(t);
            onChange(ctl.t === 'num' ? Math.max(0, parseFloat(t.replace(/[^0-9.]/g, '')) || 0) : t.replace(/[^\w \-']/g, '').slice(0, 12));
          }}
          onBlur={() => setDraft(null)}
        />
      )}
    </View>
  );
}
const round = (n: number) => Math.round(n * 1000) / 1000;

function Group({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  const [o, setO] = useState(!!open);
  return (
    <View style={styles.group}>
      <Pressable onPress={() => setO(!o)} style={styles.groupHead}>
        <Text style={styles.h}>{title}</Text>
        <Text style={styles.sub}>{o ? '▾' : '▸'}</Text>
      </Pressable>
      {o && <View style={{ gap: 14, marginTop: 10 }}>{children}</View>}
    </View>
  );
}

/* ---------- one category ---------- */
function CategoryPanel({ c, act, s }: { c: CatView; act: (fn: () => void) => void; s: any }) {
  const [collapsed, setCollapsed] = useState(true);
  const confirmFire = () =>
    Alert.alert('Let ' + s.mgr[c.id].name + ' go?', `Severance is ${money(severance(s, c.id))} (one hour of wages). Your settings for this category are kept for the next buyer, and items stay stocked as they are, but nobody will plan or order them until you hire someone.`, [
      { text: 'Keep them', style: 'cancel' },
      { text: 'Let them go', style: 'destructive', onPress: () => act(() => fire(s, c.id)) },
    ]);
  return (
    <View style={styles.panel}>
      <Pressable onPress={() => setCollapsed(!collapsed)} style={styles.panelHead}>
        <Text style={styles.panelTitle}>{c.icon} {c.name}{c.designer ? '' : ' buyer'}</Text>
        <Text style={styles.sub}>{c.staffed ? s.mgr[c.id].name : 'Vacant'}  {collapsed ? '▸' : '▾'}</Text>
      </Pressable>

      {collapsed ? <Text style={styles.sub}>{c.summary}</Text> : !c.staffed ? (
        <View style={{ gap: 10 }}>
          {!!c.need && <View style={styles.alert}><Text style={styles.alertText}>{c.need}</Text></View>}
          {c.cands.map((x) => (
            <View key={x.key} style={styles.cand}>
              <Text style={styles.candName}>{x.icon} {x.title}</Text>
              <Text style={styles.sub}>{x.desc}</Text>
              <Text style={styles.skills}>{x.skills}</Text>
              <Text style={styles.sub}>{x.wage}</Text>
              <Btn label={x.label} disabled={s.cash < x.bonus} onPress={() => act(() => hire(s, c.id, x.idx))} />
            </View>
          ))}
          <Btn label={c.refreshLabel} kind="quiet" disabled={!c.canRefresh} onPress={() => act(() => refreshCands(s, c.id))} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.candName}>{c.person}</Text>
              <Text style={styles.sub}>{c.trait}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Switch value={c.on} onValueChange={(v) => act(() => setCfg(s, c.id, 'on', v))} />
              <Text style={styles.sub}>On duty</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {c.stats.map((st) => (
              <View key={st.label} style={styles.mini}>
                <Text style={styles.sub}>{st.label}</Text>
                <Text style={styles.miniVal}>{st.value}</Text>
              </View>
            ))}
          </View>
          {!!c.stance && <View style={styles.alert}><Text style={styles.alertText}>{c.stance}</Text></View>}

          <Text style={styles.h}>Skills</Text>
          {c.skills.map((k) => (
            <View key={k.id} style={styles.skill}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.ctlLabel}>{k.icon} {k.name}  <Text style={styles.sub}>{k.lv}</Text></Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${k.pct * 100}%` }]} /></View>
                <Text style={styles.sub}>{k.desc}</Text>
              </View>
              <Btn label={k.trainLabel} disabled={!k.canTrain} onPress={() => act(() => train(s, c.id, k.id))} />
            </View>
          ))}

          <Text style={styles.h}>{c.planTitle}</Text>
          {c.offNote && <Text style={styles.sub}>Off duty: nothing is being planned or ordered. Targets you set by hand apply.</Text>}
          {c.emptyPlan && <Text style={styles.sub}>Nothing worth stocking yet. Loosen the filters or wait for new products.</Text>}
          {c.plan.map((p, i) => (
            <View key={i} style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctlLabel} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.sub}>{p.why}</Text>
              </View>
              <Text style={styles.ctlVal}>{p.stock}</Text>
            </View>
          ))}

          {c.groups.map((g) => (
            <Group key={g.grp} title={g.grp} open={g.grp === 'Strategy'}>
              {g.ctls.map((cv) => (
                <Control
                  key={cv.ctl.k}
                  cv={cv}
                  onChange={(v) => act(() => setCfg(s, c.id, cv.ctl.k, v))}
                  onChip={(id) => act(() => toggleChip(s, c.id, cv.ctl.k, id))}
                />
              ))}
            </Group>
          ))}

          <Text style={styles.h}>Notebook</Text>
          {c.log.length ? c.log.map((l, i) => <Text key={i} style={styles.sub}>• {l}</Text>) : <Text style={styles.sub}>Nothing yet.</Text>}
          <Btn label="Let go…" kind="danger" onPress={confirmFire} />
        </View>
      )}
    </View>
  );
}

/* ---------- screen ---------- */
export default function Buyers() {
  const { game: s, frame, refresh } = useGame();
  const [acted, setActed] = useState(0);
  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(() => buildBuyersView(s), [s, Math.floor(sec / 2), acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  if (v.locked) {
    const l = v.locked;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Purchasing Office</Text>
          {l.kind === 'year' ? (
            <Text style={styles.body}>🔒 Purchasing managers become available in {l.year}, once the shop is big enough to need a buyer.</Text>
          ) : (
            <>
              <Text style={styles.body}>{l.desc}</Text>
              <Btn label={'Open the Purchasing Office — ' + money(l.cost)} disabled={!l.canBuy} onPress={() => act(() => openOffice(s))} />
            </>
          )}
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Purchasing Office</Text>
          <Text style={styles.sub}>{v.wages}</Text>
        </View>
        <Text style={styles.body}>Hire a buyer for each product category. They watch sales trends, decide what to stock and how much, and place the orders themselves. Tune how each one works below.</Text>
        <View style={styles.grid}>
          {v.stats.map((st) => (
            <View key={st.label} style={styles.mini}>
              <Text style={styles.sub}>{st.label}</Text>
              <Text style={styles.miniVal}>{st.value}</Text>
            </View>
          ))}
        </View>
      </View>
      {v.cats.map((c) => <CategoryPanel key={c.id} c={c} act={act} s={s} />)}
    </ScrollView>
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  panel: { ...theme.box, padding: 14, gap: 10 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  sub: { color: colors.dim, fontSize: 12 },
  h: { color: colors.text, fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 10, width: '48.5%' },
  miniVal: { color: colors.text, fontSize: 17, fontWeight: '700' },
  alert: { backgroundColor: '#3a2f16', borderRadius: Math.min(10, theme.radius), padding: 10 },
  alertText: { color: colors.text, fontSize: 13 },
  cand: { backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 12, gap: 5 },
  candName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  skills: { color: colors.text, fontSize: 14 },
  skill: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  planRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.inset, borderRadius: Math.min(8, theme.radius), padding: 8 },
  group: { backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 12 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between' },
  ctl: { gap: 6 },
  ctlHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ctlLabel: { color: colors.text, fontSize: 14 },
  ctlVal: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, backgroundColor: colors.inset, borderRadius: Math.min(3, theme.radius), overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.card, borderRadius: Math.min(14, theme.radius), paddingHorizontal: 11, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: Math.min(8, theme.radius), paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  btn: { backgroundColor: colors.accent, borderRadius: Math.min(8, theme.radius), paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  btnQuiet: { backgroundColor: '#2d3b52' },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  off: { opacity: 0.35 },
}));
