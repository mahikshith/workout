import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import { Easing, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime } from '../../src/calc';
import { TAB_BAR_HEIGHT, useElapsed, useToday } from '../../src/kit';
import { useStore } from '../../src/store';
import { Tap } from '../../src/ui';
import { c, f } from '../../src/theme';

// Four labelled tabs with the Start button in the middle (docs/REDESIGN.md, section 2). Profile, settings and
// Watch & health open from the avatar at the top of every tab.
const TABS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Today', icon: 'today' },
  train: { label: 'Train', icon: 'barbell' },
  progress: { label: 'Progress', icon: 'stats-chart' },
  fuel: { label: 'Fuel', icon: 'nutrition' },
};
export { TAB_BAR_HEIGHT };

// Tab switch (REDESIGN motion table): cross-fade with a 4 px rise, 200 ms ease-out.
const fadeRise: BottomTabNavigationOptions['sceneStyleInterpolator'] = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [4, 0, 4] }) }],
  },
});

function Bar({ state, navigation }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  const today = useToday();
  const elapsed = useElapsed();
  const running = !!today.active;
  const bottom = Math.max(ins.bottom, 8);

  const item = (i: number) => {
    const route = state.routes[i];
    const t = TABS[route.name];
    if (!t) return null;
    const on = state.index === i;
    const press = () => {
      // The tab you're on: scroll to the top, then back to its first screen (react-navigation handles both via tabPress).
      const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!on && !e.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Tap key={route.key} onPress={press} style={s.item} scale={0.92} feedback="none"
        accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
        <Ionicons name={on ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={on ? c.accent : c.muted} />
        <Text style={[s.label, { color: on ? c.accent : c.muted }]}>{t.label}</Text>
      </Tap>
    );
  };

  return (
    <>
      {/* The workout mini bar is rendered once at the root (app/_layout.tsx), 8 px above this bar. */}
      <View style={[s.bar, { paddingBottom: bottom, height: TAB_BAR_HEIGHT + bottom }]} accessibilityRole="tablist">
        {item(0)}
        {item(1)}
        <View style={s.centreWrap}>
          <Tap onPress={today.start} style={[s.centre, { backgroundColor: c.accent }]} scale={0.92} feedback="none"
            accessibilityLabel={running ? `Resume workout, ${fmtTime(elapsed)}` : 'Start workout'}>
            {running ? (
              <>
                <Text style={[s.centreSmall, { color: c.accentInk }]} numberOfLines={1}>Resume</Text>
                <Text style={[s.centreTime, { color: c.accentInk }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{fmtTime(elapsed)}</Text>
              </>
            ) : (
              <>
                <Ionicons name="play" size={22} color={c.accentInk} style={{ marginLeft: 3 }} />
                <Text style={[s.centreLabel, { color: c.accentInk }]} numberOfLines={1}>Start</Text>
              </>
            )}
          </Tap>
        </View>
        {item(2)}
        {item(3)}
      </View>
    </>
  );
}

export default function TabsLayout() {
  // First launch opens setup; after Skip the app stays usable and Today keeps a Personalize card.
  const firstRun = useStore((s) => !s.profile.name && !s.setupSkipped && !s.sessions.length);
  const still = useReducedMotion();
  if (firstRun) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      tabBar={(p) => <Bar {...p} />}
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false, sceneStyle: { backgroundColor: c.bg },
        animation: still ? 'none' : 'fade', sceneStyleInterpolator: fadeRise,
        transitionSpec: { animation: 'timing', config: { duration: 200, easing: Easing.out(Easing.cubic) } },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="fuel" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6, backgroundColor: '#111113',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line,
  },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: f.semi, fontSize: 11 },
  centreWrap: { flex: 1, alignItems: 'center' },
  centre: {
    marginTop: -20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: c.bg, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  centreLabel: { fontFamily: f.bold, fontSize: 10, marginTop: -1, fontVariant: ['tabular-nums'] },
  centreSmall: { fontFamily: f.semi, fontSize: 9, lineHeight: 11 },
  centreTime: { fontFamily: f.bold, fontSize: 13, lineHeight: 16, fontVariant: ['tabular-nums'] },
});
