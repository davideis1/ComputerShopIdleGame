import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from '@/GameProvider';
import { ToastBanner } from '@/components/ToastBanner';
import { buyersVisible, hqVisible } from '@/franchise';
import { colors } from '@/theme';

function AppTabs() {
  const { game } = useGame();
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
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="light" />
        <AppTabs />
      </GameProvider>
    </SafeAreaProvider>
  );
}
