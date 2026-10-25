import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import CS from '@core';
import { GameState } from '@/game';
import { colors, theme, themed } from '@/theme';
import { Panel } from './ui';

type OfferView = { id: string; icon: string; title: string; text: string; left: number; choices: string[] };

/** Decision card at the top of the Shop tab (core/offers.js), or the boost an earlier choice bought. */
export function OfferPanel({ s, decide }: { s: GameState; decide: (i: number) => void }) {
  const v: OfferView | null = CS.Offers.view(s);
  const b = CS.Offers.activeBoost(s);
  if (!v && !b) return null;
  if (!v) {
    return (
      <Panel title={b.label} icon="📣" right={Math.ceil(b.left) + 's'}>
        <Text style={styles.good}>+{Math.round((b.demand - 1) * 100)}% shoppers while it lasts.</Text>
      </Panel>
    );
  }
  return (
    <Panel title={v.title} icon={v.icon} right={Math.ceil(v.left) + 's'} style={styles.card}>
      <Text style={styles.body}>{v.text}</Text>
      <View style={styles.btns}>
        {v.choices.map((c, i) => (
          <Pressable
            key={i}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); decide(i); }}
            style={({ pressed }) => [styles.btn, i > 0 && styles.quiet, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.btnText}>{c}</Text>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

const styles = themed(() => ({
  card: { borderWidth: 2, borderColor: colors.warn },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  good: { color: colors.good, fontSize: 14, fontWeight: '600' },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { backgroundColor: colors.accent, ...theme.btn, paddingVertical: 9, paddingHorizontal: 14 },
  quiet: { backgroundColor: colors.quiet, ...theme.quietBtn },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
}));
