import { Text, View } from 'react-native';
import { useGame } from '@/GameProvider';
import { colors, money, theme, themed } from '@/theme';

/** Cash (and income per minute) in every screen's header, so the money is never off screen. */
export function CashChip() {
  const { game } = useGame();
  const onBar = theme.id === 'win95' || theme.id === 'xp';
  return (
    <View style={styles.wrap}>
      <Text style={[styles.cash, onBar && styles.cashOnBar]} numberOfLines={1}>{money(game.cash)}</Text>
      <Text style={[styles.rate, onBar && styles.rateOnBar]} numberOfLines={1}>▲ {money(game.rate.rev * 60 - game.rate.up * 60)}/min</Text>
    </View>
  );
}

const styles = themed(() => ({
  wrap: { alignItems: 'flex-end', paddingRight: 14, justifyContent: 'center' },
  cash: { color: colors.good, fontSize: 16, fontWeight: '800', fontFamily: theme.monoFont },
  cashOnBar: { color: '#ffffff' },
  rate: { color: colors.dim, fontSize: 10, fontWeight: '600' },
  rateOnBar: { color: '#dbe7ff' },
}));
