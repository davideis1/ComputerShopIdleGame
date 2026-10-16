import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { newGame, tick, dateLabel, GameState } from './src/game';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/** Step-1 scaffold: proves the shared core/ simulation runs on-device. Real screens come next. */
export default function App() {
  const game = useRef<GameState>(newGame());
  const last = useRef(Date.now());
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(10, (now - last.current) / 1000);
      last.current = now;
      tick(game.current, dt);
      force((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const s = game.current;
  const { year } = dateLabel(s);
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{s.name || 'Computer Shop'}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Year</Text>
        <Text style={styles.value}>{year}</Text>
        <Text style={styles.label}>Cash</Text>
        <Text style={styles.value}>{money(s.cash)}</Text>
        <Text style={styles.label}>Revenue</Text>
        <Text style={styles.value}>{money(s.stats.revenue)}</Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10151c', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#1b2330', borderRadius: 12, padding: 16 },
  label: { color: '#8da0b8', fontSize: 13, marginTop: 8 },
  value: { color: '#fff', fontSize: 28, fontWeight: '600' },
});
