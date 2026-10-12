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
import { Button, Card, haptic, Rise, Row, Stat, T, Thumb } from '../src/ui';

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
  const fresh = badges(all).filter((b, i) => b.got && !badges(before)[i].got);
  const lv = level(all), lvBefore = level(before);
  const mins = Math.max(1, Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 60000));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 24, paddingHorizontal: 12, paddingBottom: ins.bottom + 16 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 36 }, (_, i) => <Confetti key={i} i={i} />)}
      </View>
      <Animated.View entering={ZoomIn.duration(450).easing(Easing.out(Easing.cubic))} style={[s2.badge, { backgroundColor: c.accent }]}>
        <Ionicons name="trophy" size={44} color={c.accentInk} />
      </Animated.View>
      <Rise i={1}><T v="display" style={{ textAlign: 'center', marginTop: 18 }}>Workout done</T></Rise>
      <Rise i={2}><Row gap={6} style={{ justifyContent: 'center' }}><T v="body" color={c.muted} style={{ textAlign: 'center', flexShrink: 1 }}>{s.title} · {streak(sessions)} session streak</T><Ionicons name="flame" size={16} color={c.warm} /></Row></Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 24 }}>
          <Row>
            <Stat label="Time" value={mins} unit="min" />
            <Stat label="Sets" value={doneSets(s)} />
            <Stat label="Volume" value={Math.round(volume(s)).toLocaleString()} unit="kg" color={c.accent} />
          </Row>
          {!gentle && <T v="small" style={{ marginTop: 12 }}>About {sessionKcal(s, profile.weightKg)} kcal burned in this workout (estimate).</T>}
        </Card>
      </Rise>

      {(fresh.length > 0 || lv.lvl > lvBefore.lvl) && (
        <Rise i={4}>
          <Card style={{ marginTop: 18, gap: 10 }}>
            {lv.lvl > lvBefore.lvl && <Row gap={10}><Ionicons name="arrow-up-circle" size={20} color={c.warm} /><T v="h3">Level {lv.lvl}: {lv.name}</T></Row>}
            {fresh.map((b) => <Row key={b.id} gap={10}><Ionicons name={b.icon} size={20} color={c.accent} /><T v="h3">Unlocked: {b.title}</T></Row>)}
          </Card>
        </Rise>
      )}

      {records.length > 0 && (
        <Rise i={4}>
          <T v="h3" style={{ marginTop: 22, marginBottom: 10 }} color={c.warm}>New personal records</T>
          <View style={{ gap: 8 }}>
            {records.map((p) => (
              <Card key={p.exId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Thumb ex={byId[p.exId]} size={44} />
                <T v="h3" style={{ flex: 1 }}>{byId[p.exId].name}</T>
                <T v="small" color={c.warm}>{p.label}</T>
              </Card>
            ))}
          </View>
        </Rise>
      )}

      <Rise i={5}>
        <Card style={{ marginTop: 18, gap: 10 }}>
          <Row gap={10}><Ionicons name="nutrition" size={18} color={c.pink} /><T v="h3">Refuel and rehydrate</T></Row>
          <T v="body" color={c.muted}>
            {gentle ? 'Have a proper meal or snack soon and a couple of glasses of water. Recovery is part of the training.'
              : `Muscles rebuild from what you eat next. Aim for about ${Math.round(targets(profile).protein / 4)} g of protein in the next two hours, and two glasses of water.`}
          </T>
          <Row gap={10}>
            <Button title="Log a meal" kind="ghost" style={{ flex: 1, height: 46 }} onPress={() => router.replace('/fuel')} />
            <Button title={drank ? 'Water added' : 'Add a glass'} kind="ghost" style={{ flex: 1, height: 46 }} disabled={drank}
              onPress={() => { addWater(1); setDrank(true); }} />
          </Row>
        </Card>
      </Rise>

      <View style={{ flex: 1 }} />
      <Button title="Done" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  badge: { alignSelf: 'center', width: 96, height: 96, borderRadius: r.xl, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
});
