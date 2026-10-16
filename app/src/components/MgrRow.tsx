import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pinLabels } from '@/workshop';
import { colors } from '@/theme';

/** Shown on a card when a purchasing manager covers it: who sets the target, plus pin / skip. */
export function MgrRow({ it, onPin, onSkip }: { it: any; onPin: () => void; onSkip: () => void }) {
  const l = pinLabels(it);
  return (
    <View style={styles.wrap}>
      <Text style={styles.info}>{l.info}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={onPin}><Text style={styles.text}>{l.pin}</Text></Pressable>
        <Pressable style={styles.btn} onPress={onSkip}><Text style={styles.text}>{l.skip}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  info: { color: colors.dim, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: '#2d3b52', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
