import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { Brief } from '@/sync';
import { colors, money } from '@/theme';

const when = (ms: number) => (ms ? new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'unknown');

function Card({ title, b }: { title: string; b: Brief }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardName}>{b.name || 'Your shop'}</Text>
      <Text style={styles.sub}>{b.date} · {money(b.cash)} cash</Text>
      <Text style={styles.sub}>Saved {when(b.saved)}</Text>
    </View>
  );
}

/** Shown when this phone and the account both changed since they last matched. Nothing is overwritten until the player picks. */
export function SyncConflictModal() {
  const { conflict, resolveConflict } = useGame();
  return (
    <Modal visible={!!conflict} transparent animationType="fade" onRequestClose={() => resolveConflict('later')}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Which shop do you want?</Text>
          <Text style={styles.body}>
            This phone and your account both have progress the other doesn't. Pick the one to keep; the other is replaced.
          </Text>
          {conflict && (
            <>
              <Card title="📱 On this phone" b={conflict.local} />
              <Card title="☁️ In your account" b={conflict.server} />
            </>
          )}
          <Pressable style={styles.btn} onPress={() => resolveConflict('local')}><Text style={styles.btnText}>Keep this phone's shop</Text></Pressable>
          <Pressable style={styles.btn} onPress={() => resolveConflict('server')}><Text style={styles.btnText}>Use the account's shop</Text></Pressable>
          <Pressable onPress={() => resolveConflict('later')} hitSlop={8}><Text style={styles.dim}>Decide later (keeps playing, no syncing)</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.card, borderRadius: 14, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  body: { color: colors.dim, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.bg, borderRadius: 10, padding: 12, gap: 3 },
  cardTitle: { color: colors.dim, fontSize: 12, fontWeight: '700' },
  cardName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.dim, fontSize: 13 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dim: { color: colors.dim, textAlign: 'center', fontSize: 13 },
});
