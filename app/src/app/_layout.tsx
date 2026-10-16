import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fragment, ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '@/AuthProvider';
import { GameProvider, useGame } from '@/GameProvider';
import { SyncConflictModal } from '@/components/SyncConflictModal';
import { Ticker } from '@/components/Ticker';
import { ToastBanner } from '@/components/ToastBanner';
import { buyersVisible, hqVisible } from '@/franchise';
import { E } from '@/game';
import { applyTheme, colors, LIGHT, THEME_IDS, ThemeId } from '@/theme';

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

function AppTabs() {
  const { game, notify } = useGame();
  const { notice, clearNotice } = useAuth();
  // The server refused our login on its own (expired): say so once, wherever the player is.
  useEffect(() => { if (notice) { notify(notice); clearNotice(); } }, [notice, notify, clearNotice]);
  // Same rules as the web nav: HQ appears once tokens matter, Buyers once the Purchasing Office is near.
  const showHQ = hqVisible(game);
  const showBuyers = buyersVisible(game);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Ticker />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerStatusBarHeight: 0, // the ticker above already clears the status bar
          headerTintColor: colors.onBg,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.bg },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.dim,
          tabBarLabelStyle: { fontSize: 9 }, // seven tabs must fit on a phone
          tabBarItemStyle: { paddingHorizontal: 0 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Shop' }} />
        <Tabs.Screen name="stock" options={{ title: 'Stock' }} />
        <Tabs.Screen name="upgrades" options={{ title: 'Upgrades' }} />
        <Tabs.Screen name="workshop" options={{ title: 'Workshop' }} />
        <Tabs.Screen name="buyers" options={{ title: 'Buyers', ...(showBuyers ? {} : { href: null }) }} />
        <Tabs.Screen name="franchise" options={{ title: 'HQ', ...(showHQ ? {} : { href: null }) }} />
        <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      </Tabs>
      <ToastBanner />
      <SyncConflictModal />
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
