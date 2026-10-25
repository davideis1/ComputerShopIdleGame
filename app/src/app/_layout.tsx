import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fragment, ReactNode, useEffect } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PageBackground } from '@/components/ui';
import { AuthProvider, useAuth } from '@/AuthProvider';
import { GameProvider, useGame } from '@/GameProvider';
import { SyncConflictModal } from '@/components/SyncConflictModal';
import { Ticker } from '@/components/Ticker';
import { ToastBanner } from '@/components/ToastBanner';
import { CatchUpOverlay } from '@/components/CatchUpOverlay';
import { WhatsNewGate } from '@/components/WhatsNewGate';
import { CashChip } from '@/components/CashChip';
import { buyersVisible, hqVisible } from '@/franchise';
import { serviceVisible } from '@/service';
import { E } from '@/game';
import { applyTheme, colors, LIGHT, theme, THEME_IDS, ThemeId } from '@/theme';

/** Picks the era theme (or the player's choice), applies it before anything renders, and remounts the tree when it changes. */
function ThemeGate({ children }: { children: ReactNode }) {
  const { game } = useGame();
  const pref = game.settings?.theme;
  const id: ThemeId = THEME_IDS.includes(pref) ? pref : (E.eraAt(E.yearOf(game)).theme as ThemeId);
  applyTheme(id);
  return (
    <Fragment key={id}>
      <StatusBar style={LIGHT[id] ? 'dark' : 'light'} />
      {children}
    </Fragment>
  );
}

/** Tab icons: the game's own emoji, dimmed when the tab is not selected. */
const icon = (e: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: focused ? 21 : 19, opacity: focused ? 1 : 0.55 }}>{e}</Text>
);

/** The screen title bar in the era's style: Win95 navy, XP glossy blue, Flat white, RGB night with a rainbow rule, Holo frosted with a pearl rule. */
function HeaderBackground() {
  const gr = theme.grad, id = theme.id;
  if (id === 'win95' || id === 'xp') {
    return <LinearGradient colors={gr.bar as any} start={gr.barHorizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }} end={gr.barHorizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }} style={{ flex: 1 }} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: id === 'flat' ? '#ffffff' : id === 'holo' ? 'rgba(255,255,255,0.7)' : '#0d0f1d', justifyContent: 'flex-end' }}>
      {id === 'rgb' || id === 'holo' ? <LinearGradient colors={gr.bar as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: 2 }} /> : <View style={{ height: 1, backgroundColor: colors.edge }} />}
    </View>
  );
}

function AppTabs() {
  const { game, notify } = useGame();
  const { notice, clearNotice } = useAuth();
  // The server refused our login on its own (expired): say so once, wherever the player is.
  useEffect(() => { if (notice) { notify(notice); clearNotice(); } }, [notice, notify, clearNotice]);
  // Same rules as the web nav: HQ appears once tokens matter, Buyers once the Purchasing Office is near.
  const showHQ = hqVisible(game);
  const showBuyers = buyersVisible(game);
  const showService = serviceVisible(game);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageBackground />
      <Ticker />
      <Tabs
        screenOptions={{
          headerBackground: () => <HeaderBackground />,
          headerStatusBarHeight: 0, // the ticker above already clears the status bar
          headerTintColor: theme.id === 'win95' || theme.id === 'xp' ? '#ffffff' : colors.text,
          headerTitleStyle: { fontFamily: theme.titleFont, fontWeight: '700' },
          headerShadowVisible: false,
          headerRight: () => <CashChip />, // money on every screen
          tabBarStyle: theme.id === 'win95'
            ? { backgroundColor: colors.card, borderTopWidth: 2, borderTopColor: '#ffffff' }
            : { backgroundColor: theme.id === 'rgb' ? '#0d0f1d' : colors.card, borderTopColor: theme.id === 'rgb' ? '#2d3566' : colors.edge },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.dim,
          tabBarLabelStyle: { fontSize: 9 }, // seven tabs must fit on a phone
          tabBarItemStyle: { paddingHorizontal: 0 },
          sceneStyle: { backgroundColor: 'transparent' }, // the gradient page background shows through
        }}
      >
        <Tabs.Screen name="index" options={{ tabBarIcon: icon('🏪'), title: 'Shop' }} />
        <Tabs.Screen name="stock" options={{ tabBarIcon: icon('📦'), title: 'Stock' }} />
        <Tabs.Screen name="upgrades" options={{ tabBarIcon: icon('⬆️'), title: 'Upgrades' }} />
        <Tabs.Screen name="workshop" options={{ tabBarIcon: icon('🔧'), title: 'Workshop' }} />
        <Tabs.Screen name="service" options={{ tabBarIcon: icon('🛎️'), title: 'Service', ...(showService ? {} : { href: null }) }} />
        <Tabs.Screen name="buyers" options={{ tabBarIcon: icon('👔'), title: 'Managers', ...(showBuyers ? {} : { href: null }) }} />
        <Tabs.Screen name="franchise" options={{ tabBarIcon: icon('🏢'), title: 'HQ', ...(showHQ ? {} : { href: null }) }} />
        <Tabs.Screen name="menu" options={{ tabBarIcon: icon('⚙️'), title: 'Menu' }} />
      </Tabs>
      <ToastBanner />
      <CatchUpOverlay />
      <SyncConflictModal />
      <WhatsNewGate />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GameProvider>
          <ThemeGate>
            <AppTabs />
          </ThemeGate>
        </GameProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
