import { StyleSheet as RNStyleSheet } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MgrRow } from '@/components/MgrRow';
import { useGame } from '@/GameProvider';
import {
  BP_FILTERS, BP_SORTS, BpFilter, BpRow, BpSort, buildWorkshop, buildWorkshopView, deleteBlueprint, Design, newDesign,
  saveBlueprint, setMarkup, SlotView, stepBpTarget, takeOver, togglePin,
} from '@/workshop';
import { colors, money, theme, themed } from '@/theme';

function Btn({ label, onPress, disabled, quiet }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.btn, quiet && styles.btnQuiet, disabled && styles.off, pressed && { opacity: 0.7 }]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}
function Chips<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.chip, value === o.id && styles.chipOn]}>
          <Text style={[styles.chipText, value === o.id && { color: '#fff' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
/** − / value / + row used for markup and targets. */
function Stepper({ label, value, onMinus, onPlus, minusOff, plusOff }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusOff?: boolean; plusOff?: boolean }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.sub}>{label}</Text>
      <View style={styles.stepRow}>
        <Btn label="−" quiet onPress={onMinus} disabled={minusOff} />
        <Text style={styles.stepVal}>{value}</Text>
        <Btn label="+" quiet onPress={onPlus} disabled={plusOff} />
      </View>
    </View>
  );
}

function BlueprintCard({ row, act, s }: { row: BpRow; act: (fn: () => void) => void; s: any }) {
  const { it } = row;
  const bp = it.def;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.icon}>🛠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{bp.name}</Text>
          <Text style={styles.sub}>{row.spec}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.stock}>{it.stock}</Text>
          <Text style={styles.sub}>in stock</Text>
        </View>
      </View>
      <View style={styles.tags}>
        <Text style={styles.tag}>{row.perf}</Text>
        {row.warn && <Text style={[styles.tag, styles.tagWarn]}>⚠ Parts discontinued</Text>}
        {row.auto && <Text style={styles.tag}>📐 Auto-designed</Text>}
      </View>
      <View style={styles.nums}>
        <Text style={styles.num}>Cost <Text style={styles.b}>{money(row.cost)}</Text></Text>
        <Text style={styles.num}>Price <Text style={styles.b}>{money(row.price)}</Text></Text>
        <Text style={styles.num}>Profit <Text style={[styles.b, { color: row.profit >= 0 ? colors.good : colors.danger }]}>{money(row.profit)}</Text></Text>
      </View>
      <Stepper
        label="Markup"
        value={'+' + row.markupPct + '%'}
        minusOff={row.markupPct <= 0} plusOff={row.markupPct >= 150}
        onMinus={() => act(() => setMarkup(s, bp.id, row.markupPct - 5))}
        onPlus={() => act(() => setMarkup(s, bp.id, row.markupPct + 5))}
      />
      {it.mgrCat && <MgrRow it={it} onPin={() => act(() => togglePin(s, it, 'pin'))} onSkip={() => act(() => togglePin(s, it, 'skip'))} />}
      {!it.managed && (
        <Stepper
          label="Auto-build to"
          value={String(it.target)}
          plusOff={!it.canBuild}
          onMinus={() => act(() => stepBpTarget(s, it, -1))}
          onPlus={() => act(() => stepBpTarget(s, it, 1))}
        />
      )}
      <View style={styles.stepRow}>
        {row.auto && <Btn label="Take over" quiet onPress={() => act(() => { takeOver(s, bp.id); })} />}
        <Btn
          label="Delete"
          quiet
          disabled={it.stock > 0}
          onPress={() => Alert.alert('Delete ' + bp.name + '?', 'The blueprint is removed. Sell the remaining stock first if you have any.', [
            { text: 'Keep it', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => act(() => { deleteBlueprint(s, bp.id); }) },
          ])}
        />
      </View>
    </View>
  );
}

function PartPicker({ slot, onPick }: { slot: SlotView; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = slot.options.find((o) => o.id === slot.selected);
  return (
    <View style={styles.field}>
      <Pressable onPress={() => setOpen(!open)} style={styles.pickerHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctlLabel}>{slot.icon} {slot.name}</Text>
          <Text style={styles.sub} numberOfLines={2}>{cur ? cur.label : 'Nothing available'}</Text>
        </View>
        <Text style={styles.sub}>{slot.price}  {open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <View style={styles.optList}>
          {slot.options.map((o) => (
            <Pressable key={o.id} onPress={() => { onPick(o.id); setOpen(false); }} style={[styles.opt, o.id === slot.selected && styles.optOn]}>
              <Text style={[styles.optText, o.id === slot.selected && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Workshop() {
  const { game: s, frame, refresh } = useGame();
  const [filter, setFilter] = useState<BpFilter>('all');
  const [sort, setSort] = useState<BpSort>('new');
  const [design, setDesign] = useState<Design>(newDesign);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [acted, setActed] = useState(0);

  const sec = Math.floor(frame / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const v = useMemo(() => buildWorkshopView(s, filter, sort, design), [s, filter, sort, design, Math.floor(sec / 2), acted]);
  const act = useCallback((fn: () => void) => { fn(); setActed((n) => n + 1); refresh(); }, [refresh]);

  if (v.locked) {
    const l = v.locked;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Build Workshop</Text>
          {l.kind === 'year' ? (
            <Text style={styles.body}>🔒 Custom PC building becomes possible in {l.year}.{'\n'}For now, stick to reselling name-brand prebuilts.</Text>
          ) : (
            <>
              <Text style={styles.body}>{l.desc}</Text>
              <Btn label={'Build the Workshop — ' + money(l.cost)} disabled={!l.canBuy} onPress={() => act(() => buildWorkshop(s))} />
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Workshop</Text>
        <View style={styles.grid}>
          {v.stats.map((st) => (
            <View key={st.label} style={styles.mini}>
              <Text style={styles.sub}>{st.label}</Text>
              <Text style={styles.miniVal}>{st.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sub}>{v.hint}</Text>
      </View>

      <Text style={styles.section}>Your Blueprints</Text>
      <Chips value={filter} options={BP_FILTERS} onChange={setFilter} />
      <Chips value={sort} options={BP_SORTS} onChange={setSort} />
      {!v.rows.length && <Text style={styles.empty}>{v.totalBps ? 'Nothing matches this filter.' : 'No blueprints yet — design your first PC below.'}</Text>}
      {v.rows.map((r) => <BlueprintCard key={r.it.key} row={r} act={act} s={s} />)}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Design a New PC</Text>
        <View style={styles.field}>
          <Text style={styles.ctlLabel}>Model name</Text>
          <TextInput style={styles.input} value={design.name} maxLength={28} onChangeText={(name) => setDesign({ ...design, name })} />
        </View>
        {v.slots.map((sl) => (
          <PartPicker key={sl.id} slot={sl} onPick={(id) => setDesign({ ...design, parts: { ...v.parts, [sl.id]: id } })} />
        ))}
        <Stepper
          label={'Markup over parts cost'}
          value={'+' + Math.round(design.markup * 100) + '%'}
          minusOff={design.markup <= 0} plusOff={design.markup >= 1.5}
          onMinus={() => setDesign({ ...design, markup: Math.max(0, Math.round((design.markup - 0.05) * 100) / 100) })}
          onPlus={() => setDesign({ ...design, markup: Math.min(1.5, Math.round((design.markup + 0.05) * 100) / 100) })}
        />
        <View style={styles.grid}>
          {[['Build cost', money(v.info.cost)], ['Sell price', money(v.info.price)], ['Profit / PC', money(v.info.profit)], ['Performance', v.info.perf + '%']].map(([label, value]) => (
            <View key={label} style={styles.mini}>
              <Text style={styles.sub}>{label}</Text>
              <Text style={styles.miniVal}>{value}</Text>
            </View>
          ))}
        </View>
        <Btn
          label="Save blueprint"
          disabled={v.full}
          onPress={() => act(() => { const r = saveBlueprint(s, design, v.parts); setNote({ ok: r.ok, text: r.msg }); })}
        />
        <Text style={[styles.sub, note && { color: note.ok ? colors.good : colors.danger }]}>{note ? note.text : v.msg}</Text>
      </View>
    </ScrollView>
  );
}

const styles = themed(() => ({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  panel: { ...theme.box, padding: 14, gap: 10 },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  sub: { color: colors.dim, fontSize: 12 },
  empty: { color: colors.dim, textAlign: 'center', marginVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { backgroundColor: colors.inset, borderRadius: Math.min(10, theme.radius), padding: 10, width: '48.5%' },
  miniVal: { color: colors.text, fontSize: 17, fontWeight: '700' },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: colors.card, borderRadius: Math.min(16, theme.radius), paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.dim, fontSize: 13, fontWeight: '600' },
  card: { ...theme.box, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 28 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stock: { color: colors.text, fontSize: 22, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: colors.dim, backgroundColor: colors.inset, borderRadius: Math.min(6, theme.radius), paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, overflow: 'hidden' },
  tagWarn: { color: '#e8b04a' },
  nums: { flexDirection: 'row', justifyContent: 'space-between' },
  num: { color: colors.dim, fontSize: 13 },
  b: { color: colors.text, fontWeight: '700' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepVal: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  field: { gap: 6 },
  ctlLabel: { color: colors.text, fontSize: 14 },
  input: { backgroundColor: colors.inset, color: colors.text, borderRadius: Math.min(8, theme.radius), paddingHorizontal: 10, paddingVertical: 9, fontSize: 15 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inset, borderRadius: Math.min(8, theme.radius), padding: 10 },
  optList: { backgroundColor: colors.inset, borderRadius: Math.min(8, theme.radius), overflow: 'hidden' },
  opt: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: RNStyleSheet.hairlineWidth, borderBottomColor: colors.card },
  optOn: { backgroundColor: colors.accent },
  optText: { color: colors.dim, fontSize: 13 },
  btn: { backgroundColor: colors.accent, borderRadius: Math.min(8, theme.radius), paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  btnQuiet: { backgroundColor: '#2d3b52' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  off: { opacity: 0.35 },
}));
