import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { year } from '@/game';
import { colors, money } from '@/theme';

export default function Shop() {
  const { game: s, away, dismissAway } = useGame();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{s.name || 'Computer Shop'}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Year</Text>
        <Text style={styles.value}>{year(s)}</Text>
        <Text style={styles.label}>Cash</Text>
        <Text style={styles.value}>{money(s.cash)}</Text>
        <Text style={styles.label}>Revenue</Text>
        <Text style={styles.value}>{money(s.stats.revenue)}</Text>
      </View>

      <Modal visible={!!away} transparent animationType="fade" onRequestClose={dismissAway}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.title}>Welcome back!</Text>
            {away && (
              <Text style={styles.body}>
                You were away {Math.round(away.elapsed / 60)} min
                {away.capped ? ' (offline limit reached)' : ''}.{'\n'}
                Cash {money(away.cash0)} → {money(away.cash1)}
              </Text>
            )}
            <Pressable style={styles.button} onPress={dismissAway}>
              <Text style={styles.buttonText}>Back to the shop</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  label: { color: colors.dim, fontSize: 13, marginTop: 8 },
  value: { color: colors.text, fontSize: 28, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.card, borderRadius: 14, padding: 20 },
  body: { color: colors.dim, fontSize: 16, lineHeight: 24, marginBottom: 16 },
  button: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
