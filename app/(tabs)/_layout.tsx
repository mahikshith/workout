import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tap } from '../../src/ui';
import { c, f } from '../../src/theme';

const TABS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Today', icon: 'flash' },
  exercises: { label: 'Exercises', icon: 'body' },
  train: { label: 'Plans', icon: 'barbell' },
  progress: { label: 'Progress', icon: 'stats-chart' },
  fuel: { label: 'Fuel', icon: 'nutrition' },
};

function Bar({ state, navigation }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { bottom: Math.max(ins.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const t = TABS[route.name];
        if (!t) return null;
        return (
          <Tap key={route.key} onPress={() => !on && navigation.navigate(route.name)} style={[s.item, on && s.on]} scale={0.9}>
            <Ionicons name={on ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={20} color={on ? c.accentInk : c.muted} />
            {on && <Text style={s.label}>{t.label}</Text>}
          </Tap>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="exercises" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="fuel" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 16, right: 16, height: 64, borderRadius: 32, backgroundColor: 'rgba(24,24,27,0.96)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  item: { height: 48, minWidth: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  on: { backgroundColor: c.accent },
  label: { fontFamily: f.bold, fontSize: 13, color: c.accentInk },
});
