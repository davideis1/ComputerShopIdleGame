import { Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { colors, theme, themed } from '@/theme';
import { Bar } from './ui';

/** Shown while a long offline catch-up runs (GameProvider slices it so the phone keeps drawing). */
export function CatchUpOverlay() {
  const { catchProgress } = useGame();
  if (catchProgress == null) return null;
  return (
    <View style={styles.wrap} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.title}>⏳ Catching up</Text>
        <Text style={styles.sub}>Your shop kept trading while you were away.</Text>
        <Bar value={catchProgress} height={10} />
        <Text style={styles.pct}>{Math.round(catchProgress * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { ...theme.box, padding: 20, gap: 10, width: '100%', maxWidth: 360 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: theme.titleFont },
  sub: { color: colors.dim, fontSize: 14 },
  pct: { color: colors.dim, fontSize: 12, textAlign: 'right' },
}));
