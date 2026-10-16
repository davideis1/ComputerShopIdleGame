import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/AuthProvider';
import { GameProvider, useGame } from '@/GameProvider';
import { SyncConflictModal } from '@/components/SyncConflictModal';
import { ToastBanner } from '@/components/ToastBanner';
import { buyersVisible, hqVisible } from '@/franchise';
import { colors } from '@/theme';

function AppTabs() {
  const { game, notify } = useGame();
  const { notice, clearNotice } = useAuth();
  // The server refused our login on its own (expired): say so once, wherever the player is.
  useEffect(() => { if (notice) { notify(notice); clearNotice(); } }, [notice, notify, clearNotice]);
  // Same rules as the web nav: HQ appears once tokens matter, Buyers once the Purchasing Office is near.
  const showHQ = hqVisible(game);
  const showBuyers = buyersVisible(game);
  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
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
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GameProvider>
          <StatusBar style="light" />
          <AppTabs />
        </GameProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
