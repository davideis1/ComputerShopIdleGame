import CS from '@core';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { E } from '@/game';
import { useGame } from '@/GameProvider';
import { colors, theme, themed } from '@/theme';

const PX_PER_SEC = 55;

/** The news ticker from the web build: one headline scrolls across, then the next. Era headlines plus anything topical (events count double). */
export function Ticker() {
  const { game } = useGame();
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [textW, setTextW] = useState(0);
  const [n, setN] = useState(0); // which loop we're on; bumps to pick a new headline
  const [text, setText] = useState('');
  const on = game.settings?.showTicker !== false;

  useEffect(() => {
    if (!on) return;
    const pool: string[] = (CS.HEADLINES[theme.id] || CS.HEADLINES.win95).slice();
    E.derive(game).ev.list.forEach((e: { text: string }) => pool.push(e.text, e.text));
    setText('📰 ' + pool[Math.floor(Math.random() * pool.length)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, on]);

  useEffect(() => {
    if (!on || !width || !textW) return;
    x.setValue(width);
    const a = Animated.timing(x, { toValue: -textW, duration: ((width + textW) / PX_PER_SEC) * 1000, easing: Easing.linear, useNativeDriver: true });
    a.start(({ finished }) => { if (finished) setN((k) => k + 1); });
    return () => a.stop();
  }, [on, width, textW, text, x]);

  if (!on) return <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }} />;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.strip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.run, { transform: [{ translateX: x }] }]}>
          <Text numberOfLines={1} style={styles.text} onLayout={(e) => setTextW(e.nativeEvent.layout.width)}>{text}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  wrap: { backgroundColor: colors.bg },
  strip: { height: 24, overflow: 'hidden', backgroundColor: colors.inset, marginHorizontal: 8, marginTop: 4, borderRadius: Math.min(6, theme.radius), justifyContent: 'center' },
  run: { position: 'absolute', left: 0, width: 3000, flexDirection: 'row' },
  text: { color: colors.text, fontSize: 12, alignSelf: 'flex-start' },
}));
