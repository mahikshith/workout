import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey, doneSets, prs, streak, volume } from '../src/calc';
import { badges, level } from '../src/data/badges';
import { byId } from '../src/data/exercises';
import { FoodSheet } from '../src/foodsheet';
import { sessionKcal } from '../src/journey';
import { CountUp, EASE, EASE_POP, Empty, Header, toToday } from '../src/kit';
import { useStore, type MealSlot } from '../src/store';
import { c, r } from '../src/theme';
import { Button, haptic, IconBox, ListRow, Row, Section, T, Tap, Thumb } from '../src/ui';

// The end of a workout (docs/REDESIGN.md rule 8). Nothing here leaves the screen except Done: Log a meal opens the
// food sheet in place and Add water counts up in place.

const { width: W, height: H } = Dimensions.get('window');
const COLORS = [c.accent, c.warm, c.pink, c.blue, '#BF8CFF'];

function Confetti({ i }: { i: number }) {
  const p = useSharedValue(0);
  const x0 = W / 2, angle = (i / 36) * Math.PI * 2, dist = 120 + (i % 5) * 40;
  useEffect(() => { p.value = withDelay((i % 6) * 30, withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) })); }, []);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - p.value * 0.9,
    transform: [
      { translateX: x0 + Math.cos(angle) * dist * p.value },
      { translateY: H * 0.18 + Math.sin(angle) * dist * p.value + p.value * p.value * 220 },
      { rotate: `${p.value * 540 + i * 20}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 8, height: 14, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }, a]} />;
}

// A stat tile whose number counts up.
function CountTile({ icon, color = c.accent, value, suffix, label, i }: { icon: keyof typeof Ionicons.glyphMap; color?: string; value: number; suffix?: string; label: string; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 60).duration(400).easing(EASE)} style={s2.tile}>
      <IconBox icon={icon} color={color} size={32} />
      <CountUp value={value} suffix={suffix} style={{ fontSize: 26, marginTop: 10 }} />
      <T v="small" numberOfLines={1}>{label}</T>
    </Animated.View>
  );
}

const slotNow = (): MealSlot => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
};

export default function Summary() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useStore((st) => st.sessions);
  const profile = useStore((st) => st.profile);
  const addWater = useStore((st) => st.addWater);
  const glasses = useStore((st) => st.water[dayKey()] ?? 0);
  const [food, setFood] = useState(false);
  const pop = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    haptic('success');
    if (!still) pop.value = withTiming(1, { duration: 550, easing: EASE_POP });
  }, []);
  // The summary is the end of the workout: hardware Back goes to Today, never back into the finished session.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toToday(); return true; });
    return () => sub.remove();
  }, []);
  const badge = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.4 + pop.value * 0.6 }] }));

  const s = sessions.find((x) => x.id === id);
  // Records and unlocks are worked out once, against the history before this workout.
  const result = useMemo(() => {
    if (!s) return null;
    const history = sessions.filter((x) => x.id !== s.id);
    const all = useStore.getState();
    const before = { ...all, sessions: history };
    const had = badges(before);
    return {
      records: prs(s, history),
      fresh: badges(all).filter((b, i) => b.got && !had[i]?.got),
      lv: level(all), lvBefore: level(before),
    };
  }, [s?.id]);

  if (!s || !result) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Workout" /><Empty icon="checkmark-circle-outline" title="This page is no longer here" action="Back to Today" onPress={toToday} /></View>;
  const { records, fresh, lv, lvBefore } = result;
  const gentle = profile.gentle || profile.concerns?.includes('food');
  const mins = Math.max(1, Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 60000));
  const run = streak(sessions);
  const kcal = gentle ? 0 : sessionKcal(s, profile.weightKg);
  const levelUp = lv.lvl > lvBefore.lvl;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 32, paddingHorizontal: 12, paddingBottom: ins.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s2.badge, { backgroundColor: c.accent }, badge]}>
          <Ionicons name="checkmark" size={48} color={c.accentInk} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(60).duration(400).easing(EASE)}>
          <T v="display" style={{ textAlign: 'center', marginTop: 20 }}>Workout done</T>
          <T v="body" color={c.muted} numberOfLines={1} style={{ textAlign: 'center', marginTop: 2 }}>
            {s.title}{kcal ? ` · about ${kcal} kcal` : ''}
          </T>
        </Animated.View>

        <Row gap={12} style={{ marginTop: 24 }}>
          <CountTile i={0} icon="time-outline" value={mins} suffix=" min" label="Time" />
          <CountTile i={1} icon="checkmark-done" value={doneSets(s)} label="Sets" />
        </Row>
        <Row gap={12} style={{ marginTop: 12 }}>
          <CountTile i={2} icon="barbell" value={Math.round(volume(s))} suffix=" kg" label="Volume" />
          <CountTile i={3} icon="flame" color={c.warm} value={run} label="Streak" />
        </Row>

        {records.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400).easing(EASE)}>
            <Section title="New records">
              <View style={{ gap: 8 }}>
                {records.map((p) => (
                  <ListRow key={p.exId} thumb={<Thumb ex={byId[p.exId]} size={40} />} title={byId[p.exId].name}
                    right={<T v="small" color={c.warm}>{p.label}</T>} />
                ))}
              </View>
            </Section>
          </Animated.View>
        )}

        {(fresh.length > 0 || levelUp) && (
          <Animated.View entering={FadeInDown.delay(460).duration(400).easing(EASE)}>
            <Section title="Unlocked">
              <View style={{ gap: 8 }}>
                {levelUp && <ListRow icon="arrow-up-circle" color={c.warm} title={`Level ${lv.lvl} · ${lv.name}`} sub="Level up" />}
                {fresh.map((b) => <ListRow key={b.id} icon={b.icon} title={b.title} sub="New badge" />)}
              </View>
            </Section>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(520).duration(400).easing(EASE)}>
          <Row gap={10} style={{ marginTop: 32 }}>
            <Tap onPress={() => setFood(true)} style={s2.action}>
              <Ionicons name="restaurant" size={18} color={c.pink} />
              <T v="h3">Log a meal</T>
            </Tap>
            <Tap onPress={() => addWater(1)} style={s2.action}>
              <Ionicons name="water" size={18} color={c.blue} />
              <T v="h3" style={{ fontVariant: ['tabular-nums'] }}>Add water · {glasses}</T>
            </Tap>
          </Row>
        </Animated.View>

        <View style={{ flex: 1, minHeight: 32 }} />
        <Button title="Done" onPress={toToday} />
      </ScrollView>

      {!still && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 36 }, (_, i) => <Confetti key={i} i={i} />)}
        </View>
      )}

      <FoodSheet open={food} onClose={() => setFood(false)} slot={slotNow()} />
    </View>
  );
}

const s2 = StyleSheet.create({
  badge: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, minWidth: 0, backgroundColor: c.card, borderRadius: r.lg, padding: 14, borderWidth: 1, borderColor: c.line },
  action: { flex: 1, height: 52, borderRadius: r.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
