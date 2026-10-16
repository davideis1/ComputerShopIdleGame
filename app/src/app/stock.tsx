import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export default function Stock() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Stock is coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.dim, fontSize: 16 },
});
