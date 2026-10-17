import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { E } from '@/game';
import { useGame } from '@/GameProvider';
import { colors, theme, themed } from '@/theme';
import { takeWalkers } from '@/walkers';

const FACES = ['🧑', '👩', '👨', '🧓', '👧', '🧑‍🎓', '🧑‍💼'];
const MAX = 7;
type W = { id: number; face: string; buy: boolean; ms: number };

function Walker({ w, width, done }: { w: W; width: number; done: (id: number) => void }) {
  const x = useRef(new Animated.Value(-40)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: width + 10, duration: w.ms, easing: Easing.linear, useNativeDriver: true }).start(() => done(w.id));
    if (w.buy) Animated.timing(pop, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[styles.walker, { transform: [{ translateX: x }] }]}>
      <Text style={styles.face}>{w.face}</Text>
      {w.buy && (
        <Animated.Text style={[styles.cash, { opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [6, -8] }) }] }]}>💲</Animated.Text>
      )}
    </Animated.View>
  );
}

/** The storefront: sign, street with customers walking past (a few stop to buy), and the shelves along the bottom. */
export function Scene({ shelves }: { shelves: string }) {
  const { game, frame } = useGame();
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [walkers, setWalkers] = useState<W[]>([]);
  const nextId = useRef(1);
  const on = game.settings?.showWalkers !== false;

  useEffect(() => {
    if (!on || !focused || !width) { takeWalkers(); return; }
    const { buys, browsers } = takeWalkers();
    const lambda = E.derive(game).lambda as number;
    let extra = Math.random() < Math.min(0.5, lambda * 0.25 * 0.6) ? 1 : 0; // ~ web: arrival chance per frame
    setWalkers((cur) => {
      const add: W[] = [];
      const spawn = (buy: boolean) => {
        if (cur.length + add.length >= MAX) return;
        add.push({ id: nextId.current++, face: FACES[Math.floor(Math.random() * FACES.length)], buy, ms: (2.8 + Math.random() * 1.6) * 1000 });
      };
      for (let i = 0; i < buys; i++) spawn(true);
      for (let i = 0; i < browsers + extra; i++) spawn(false);
      return add.length ? [...cur, ...add] : cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, on, focused, width]);

  const done = (id: number) => setWalkers((cur) => cur.filter((w) => w.id !== id));
  const [sky, road, ground] = theme.scene;

  return (
    <View style={styles.scene} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flex: 38, backgroundColor: sky }} />
      <View style={{ flex: 14, backgroundColor: road }} />
      <View style={{ flex: 48, backgroundColor: ground }} />
      <Text numberOfLines={1} style={styles.sign}>{game.name || 'Computer Shop'}</Text>
      <View style={styles.street} pointerEvents="none">
        {on && walkers.map((w) => <Walker key={w.id} w={w} width={width} done={done} />)}
      </View>
      <View style={styles.shopfront}>
        <Text style={styles.shelves} numberOfLines={3}>{shelves || 'The shelves are empty…'}</Text>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  scene: { height: 150, overflow: 'hidden', borderRadius: Math.min(8, theme.radius) },
  sign: { position: 'absolute', top: 4, left: 8, right: 8, textAlign: 'center', fontWeight: '700', fontSize: 15, color: '#fff', textShadowColor: 'rgba(0,0,0,.8)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  street: { position: 'absolute', left: 0, right: 0, top: 48, height: 50 },
  walker: { position: 'absolute', bottom: 0, left: 0 },
  face: { fontSize: 30 },
  cash: { position: 'absolute', top: -14, left: 6, fontSize: 16 },
  shopfront: { position: 'absolute', left: 6, right: 6, bottom: 0, height: 56, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,.35)', borderTopLeftRadius: Math.min(8, theme.radius), borderTopRightRadius: Math.min(8, theme.radius), overflow: 'hidden' },
  shelves: { color: colors.onAccent, fontSize: 17, lineHeight: 19 },
}));
