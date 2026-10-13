import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doneSets, prs, streak, targets, volume } from '../src/calc';
import { byId } from '../src/data/exercises';
import { badges, level } from '../src/data/badges';
import { sessionKcal } from '../src/journey';
import { useStore } from '../src/store';
import { c, r } from '../src/theme';
import { Button, haptic, ListRow, Rise, Row, Section, T, Thumb, Tile } from '../src/ui';

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
      { translateY: H * 0.28 + Math.sin(angle) * dist * p.value + p.value * p.value * 220 },
      { rotate: `${p.value * 540 + i * 20}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 8, height: 14, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }, a]} />;
}

export default function Summary() {
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useStore((s) => s.sessions);
  const s = sessions.find((x) => x.id === id);
  const profile = useStore((st) => st.profile);
  const addWater = useStore((st) => st.addWater);
  const [drank, setDrank] = useState(false);
  const gentle = profile.gentle || profile.concerns?.includes('food');
  useEffect(() => { haptic('success'); }, []);
  if (!s) return null;
  const history = sessions.filter((x) => x.id !== s.id);
  const records = prs(s, history);
  const all = useStore.getState();
  const before = { ...all, sessions: history };
  const had = badges(before);
  const fresh = badges(all).filter((b, i) => b.got && !had[i].got);
  const lv = level(all), lvBefore = level(before);
  const mins = Math.max(1, Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 60000));
  const run = streak(sessions);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 24, paddingHorizontal: 12, paddingBottom: ins.bottom + 16 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 36 }, (_, i) => <Confetti key={i} i={i} />)}
      </View>
      <Animated.View entering={ZoomIn.duration(450).easing(Easing.out(Easing.cubic))} style={[s2.badge, { backgroundColor: c.accent }]}>
        <Ionicons name="trophy" size={44} color={c.accentInk} />
      </Animated.View>
      <Rise i={1}><T v="display" style={{ textAlign: 'center', marginTop: 20 }}>Workout done</T></Rise>
      <Rise i={2}>
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 4 }}>
          <T v="body" color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{s.title} · {run} session streak</T>
          <Ionicons name="flame" size={16} color={c.warm} />
        </Row>
      </Rise>

      <Rise i={3}>
        <Row gap={12} style={{ marginTop: 24 }}>
          <Tile icon="time-outline" value={mins} unit="min" label="Time" />
          <Tile icon="checkmark-done" value={doneSets(s)} label="Sets" />
        </Row>
        <Row gap={12} style={{ marginTop: 12 }}>
          <Tile icon="barbell" value={Math.round(volume(s)).toLocaleString()} unit="kg" label="Volume" />
          {gentle
            ? <Tile icon="list" value={s.items.length} label="Exercises" />
            : <Tile icon="flame" value={sessionKcal(s, profile.weightKg)} unit="kcal" label="Burned (est.)" />}
        </Row>
      </Rise>

      {(fresh.length > 0 || lv.lvl > lvBefore.lvl) && (
        <Rise i={4}>
          <Section title="Unlocked">
            <View style={{ gap: 8 }}>
              {lv.lvl > lvBefore.lvl && <ListRow icon="arrow-up-circle" color={c.warm} title={`Level ${lv.lvl} · ${lv.name}`} sub="Level up" />}
              {fresh.map((b) => <ListRow key={b.id} icon={b.icon} title={b.title} sub="New badge" />)}
            </View>
          </Section>
        </Rise>
      )}

      {records.length > 0 && (
        <Rise i={4}>
          <Section title="New records">
            <View style={{ gap: 8 }}>
              {records.map((p) => (
                <ListRow key={p.exId} thumb={<Thumb ex={byId[p.exId]} size={40} />} title={byId[p.exId].name}
                  right={<T v="small" color={c.warm}>{p.label}</T>} />
              ))}
            </View>
          </Section>
        </Rise>
      )}

      <Rise i={5}>
        <Section title="Refuel">
          <View style={{ gap: 8 }}>
            <ListRow icon="restaurant" color={c.pink} title="Log a meal" onPress={() => router.replace('/fuel')}
              sub={gentle ? 'A proper meal or snack soon' : `About ${Math.round(targets(profile).protein / 4)} g protein in 2 hours`} />
            <ListRow icon="water" color={c.blue} title={drank ? 'Water added' : 'Add a glass'} sub="Two glasses to rehydrate"
              onPress={drank ? undefined : () => { addWater(1); setDrank(true); }}
              right={drank ? <Ionicons name="checkmark-circle" size={20} color={c.ok} /> : undefined} />
          </View>
        </Section>
      </Rise>

      <View style={{ flex: 1, minHeight: 32 }} />
      <Button title="Done" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  badge: { alignSelf: 'center', width: 96, height: 96, borderRadius: r.xl, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
});
