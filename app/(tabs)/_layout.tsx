import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import { Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { spring } from '../../src/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime } from '../../src/calc';
import { TAB_BAR_HEIGHT, useElapsed, useToday } from '../../src/kit';
import { useStore } from '../../src/store';
import { Tap } from '../../src/ui';
import { shadow, TabBarSurface } from '../../src/glass';
import { c, f, tint } from '../../src/theme';

// Round 14: Home · Progress · (Workouts) · Fuel · Plans. The raised centre button opens the exercise library and
// today's workout; Plans (your plan, every plan, challenges) sits at the right end beside Fuel. While a workout runs
// the centre shows its clock and takes you back to it. Profile, settings and Watch & health open from the avatar.
const TABS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Home', icon: 'home' },
  progress: { label: 'Progress', icon: 'stats-chart' },
  train: { label: 'Workouts', icon: 'barbell' },
  fuel: { label: 'Fuel', icon: 'nutrition' },
  plans: { label: 'Plans', icon: 'map' },
};
export { TAB_BAR_HEIGHT };

// Tab switch (REDESIGN motion table): cross-fade with a 4 px rise, 200 ms ease-out.
const fadeRise: BottomTabNavigationOptions['sceneStyleInterpolator'] = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [4, 0, 4] }) }],
  },
});

// The selected tab's icon gives a small bounce when its tab is picked (the glass drop behind it is `Drop`, below).
function Pill({ on, icon }: { on: boolean; icon: keyof typeof Ionicons.glyphMap }) {
  const still = useReducedMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (on && !still) pop.value = withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, spring.bouncy));
  }, [on, still]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View style={s.pill}>
      <Animated.View style={bounce}>
        <Ionicons name={on ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={on ? c.accent : c.muted} />
      </Animated.View>
    </View>
  );
}

// One drop of tinted glass that flows from tab to tab. Its leading edge runs ahead on a quick spring and its trailing
// edge follows on a slower one, so the drop stretches while it travels and settles back to a pill: a liquid feel from
// two transforms (translate and scale) on one view, which every Android phone can draw smoothly. It fades away over
// the centre button, which has its own raised circle.
const SLOTS = ['index', 'progress', 'train', 'fuel', 'plans'];
const DROP_W = 56;
function Drop({ slot }: { slot: number }) {
  const { width } = useWindowDimensions();
  const still = useReducedMotion();
  const centre = (i: number) => (width / SLOTS.length) * (i + 0.5);
  const lead = useSharedValue(centre(slot));
  const trail = useSharedValue(centre(slot));
  const show = useSharedValue(slot === 2 ? 0 : 1);
  useEffect(() => {
    const to = centre(slot);
    if (still) { lead.value = to; trail.value = to; }
    else {
      lead.value = withSpring(to, { stiffness: 520, damping: 34, mass: 1 });
      trail.value = withSpring(to, { stiffness: 190, damping: 24, mass: 1 });
    }
    show.value = withTiming(slot === 2 ? 0 : 1, { duration: still ? 1 : 160 });
  }, [slot, width, still]);
  const style = useAnimatedStyle(() => {
    const stretch = Math.abs(lead.value - trail.value);
    return {
      opacity: show.value,
      transform: [
        { translateX: (lead.value + trail.value) / 2 - DROP_W / 2 },
        { scaleX: 1 + stretch / DROP_W },
        { scaleY: 1 - Math.min(0.28, stretch / 420) }, // thins a little while stretched, like a pulled drop
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[s.drop, style]}>
      <LinearGradient colors={[tint(c.accent, 2), tint(c.accent, 1)]} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: tint(c.accent, 3) }]} />
    </Animated.View>
  );
}

function Bar({ state, navigation }: BottomTabBarProps) {
  const today = useToday();
  const elapsed = useElapsed();
  // Only a started workout shows Resume and its clock; a ready one (opened, clock not started) keeps Start.
  const running = !!today.active && today.active.running !== false;

  const item = (i: number) => {
    const route = state.routes[i];
    const t = route && TABS[route.name];
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
        <Pill on={on} icon={t.icon} />
        <Text style={[s.label, { color: on ? c.accent : c.muted }]}>{t.label}</Text>
      </Tap>
    );
  };

  const by = (name: string) => item(state.routes.findIndex((x) => x.name === name));
  const ci = state.routes.findIndex((x) => x.name === 'train');
  const centreOn = state.index === ci;
  const centrePress = () => {
    if (running) return today.start(); // back to the running workout
    const e = navigation.emit({ type: 'tabPress', target: state.routes[ci].key, canPreventDefault: true });
    if (!centreOn && !e.defaultPrevented) navigation.navigate('train');
  };

  return (
    <>
      {/* The workout mini bar is rendered once at the root (app/_layout.tsx), 8 px above this bar. */}
      <TabBarSurface height={TAB_BAR_HEIGHT}>
        <Drop slot={Math.max(0, SLOTS.indexOf(state.routes[state.index]?.name))} />
        {by('index')}
        {by('progress')}
        {/* The centre button: a raised circle (barbell, or the running clock), label underneath on the same baseline as
            the other tab labels. */}
        <Tap onPress={centrePress} style={s.item} scale={0.92} feedback="none" accessibilityRole="tab" accessibilityState={{ selected: centreOn }}
          accessibilityLabel={running ? `Resume workout, ${fmtTime(elapsed)}` : 'Workouts'}>
          <View style={s.slot}>
            <View style={[s.centre, shadow(2), { backgroundColor: c.accent }]}>
              {running ? (
                <Text style={[s.centreTime, { color: c.accentInk }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{fmtTime(elapsed)}</Text>
              ) : (
                <Ionicons name="barbell" size={24} color={c.accentInk} />
              )}
            </View>
          </View>
          <Text style={[s.label, { color: c.accent }]} numberOfLines={1}>{running ? 'Resume' : 'Workouts'}</Text>
        </Tap>
        {by('fuel')}
        {by('plans')}
      </TabBarSurface>
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
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="fuel" />
      <Tabs.Screen name="plans" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6, backgroundColor: c.bar,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line,
  },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 1 },
  label: { fontFamily: f.semi, fontSize: 11 },
  drop: { position: 'absolute', left: 0, top: 6, width: DROP_W, height: 28, borderRadius: 14, overflow: 'hidden' },
  pill: { width: 56, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // The slot is as tall as a tab icon in its pill (28), so the label below sits on the same line as the others
  // (measured: all five label tops equal). The circle (44 + a 4 px ring in the bar colour) stands on the slot's bottom
  // and rises about 16 px above the bar; CENTRE_RISE in ui.tsx lifts the mini bar by the same amount.
  slot: { width: 64, height: 28, alignItems: 'center', justifyContent: 'flex-end' },
  centre: {
    position: 'absolute', bottom: 0, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
  },
  centreTime: { fontFamily: f.bold, fontSize: 13, fontVariant: ['tabular-nums'], maxWidth: 42, textAlign: 'center' },
});
