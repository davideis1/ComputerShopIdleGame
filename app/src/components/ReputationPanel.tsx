import { Text, View } from 'react-native';
import { E, GameState } from '@/game';
import { colors, themed } from '@/theme';
import { Bar, Panel } from './ui';

type Factor = { id: string; label: string; score: number; cost: number; tip: string };

/** Shop rating: stars, where they are heading, and what each factor costs (E.reputationView, shared with the web). */
export function ReputationPanel({ s }: { s: GameState }) {
  const v = E.reputationView(s, E.derive(s));
  const dir = v.target > v.stars + 0.05 ? '↗ rising to ' + v.target.toFixed(1) : v.target < v.stars - 0.05 ? '↘ falling to ' + v.target.toFixed(1) : 'steady';
  return (
    <Panel title="Reputation" icon="⭐" right={<Text style={styles.stars}>{v.label} {v.stars.toFixed(1)}</Text>}>
      <Text style={styles.sub}>{dir} · {v.effect >= 0 ? '+' : ''}{Math.round(v.effect * 100)}% shoppers</Text>
      {v.factors.map((f: Factor) => (
        <View key={f.id} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{f.label}</Text>
          <Bar value={f.score} height={7} style={styles.bar} />
          <Text style={[styles.cost, f.cost < 0.05 && { color: colors.good }]}>{f.cost >= 0.05 ? '−' + f.cost.toFixed(1) + '★' : '✓'}</Text>
        </View>
      ))}
      {!!v.worst && <Text style={styles.tip}>{v.worst.tip}</Text>}
    </Panel>
  );
}

const styles = themed(() => ({
  stars: { color: colors.warn, fontSize: 13, fontWeight: '800' },
  sub: { color: colors.dim, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: colors.text, fontSize: 13 },
  bar: { width: 80 },
  cost: { width: 44, textAlign: 'right', color: colors.danger, fontSize: 12, fontWeight: '700' },
  tip: { color: colors.warn, fontSize: 12, fontWeight: '600' },
}));
