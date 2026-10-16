import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { colors } from '@/theme';

export default function Menu() {
  const { reset } = useGame();
  const confirmReset = () =>
    Alert.alert('Start over?', 'This deletes your shop and all progress on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: reset },
    ]);
  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>The game saves automatically every 15 seconds and when you leave the app.</Text>
      <Pressable style={styles.danger} onPress={confirmReset}>
        <Text style={styles.dangerText}>Delete save & start over</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 16 },
  note: { color: colors.dim, fontSize: 15, lineHeight: 22 },
  danger: { borderColor: colors.danger, borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  dangerText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
});
