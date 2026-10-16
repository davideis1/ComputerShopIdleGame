import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GameProvider } from '@/GameProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GameProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.bg },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.dim,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Shop' }} />
        <Tabs.Screen name="stock" options={{ title: 'Stock' }} />
        <Tabs.Screen name="upgrades" options={{ title: 'Upgrades' }} />
        <Tabs.Screen name="workshop" options={{ title: 'Workshop' }} />
        <Tabs.Screen name="buyers" options={{ title: 'Buyers' }} />
        <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      </Tabs>
    </GameProvider>
  );
}
