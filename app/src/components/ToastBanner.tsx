import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/GameProvider';
import { colors, theme, themed } from '@/theme';

/** Achievement / notice banner, shown above whichever tab is open. */
export function ToastBanner() {
  const { toast } = useGame();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={styles.box}><Text style={styles.text}>{toast}</Text></View>
    </View>
  );
}

const styles = themed(() => ({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  box: { backgroundColor: colors.accent, ...theme.btn, padding: 12 },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
}));
