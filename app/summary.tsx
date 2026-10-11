import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doneSets, prs, streak, volume } from '../src/calc';
import { byId } from '../src/data/exercises';
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
  useEffect(() => { haptic('success'); }, []);
  if (!s) return null;
  const history = sessions.filter((x) => x.id !== s.id);
  const records = prs(s, history);
  const mins = Math.max(1, Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 60000));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 24, paddingHorizontal: 20, paddingBottom: ins.bottom + 16 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 36 }, (_, i) => <Confetti key={i} i={i} />)}
      </View>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={s2.badge}>
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
        </Card>
      </Rise>

      {records.length > 0 && (
        <Rise i={4}>
          <T v="label" style={{ marginTop: 22, marginBottom: 10 }} color={c.warm}>New personal records</T>
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

      <View style={{ flex: 1 }} />
      <Button title="Done" icon="checkmark" onPress={() => router.replace('/')} />
    </View>
  );
}

const s2 = StyleSheet.create({
  badge: { alignSelf: 'center', width: 96, height: 96, borderRadius: r.xl, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
});
