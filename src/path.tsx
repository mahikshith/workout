// The journey path: every achievement as a stop on one winding road, Duolingo style but in the app's own dark,
// single-accent look. Done stops are filled, the next stop pulses with a progress ring and a "you are here" marker,
// later stops wait behind a lock. A stop unlocked since the last visit bursts into confetti once, then it is
// remembered as seen. Only the next stop animates continuously, so the path stays light to scroll past.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Badge } from './data/badges';
import { useStore } from './store';
import { c } from './theme';
import { haptic, T, Tap } from './ui';

// Easiest first, so the road reads as a journey: first workout, early habits, then the long hauls.
const ORDER = ['first', 'streak3', 'home', 'water7', 'five', 'meals7', 'pr', 'early', 'late', 'sets100', 'twenty', 'ton', 'streak10', 'pr10', 'fifty'];
const STEP = 96; // vertical distance between stops
const NODE = 60;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

export function JourneyPath({ badges }: { badges: Badge[] }) {
  const [w, setW] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [whole, setWhole] = useState(false);
  const dismissed = useStore((s) => s.dismissed);
  const dismiss = useStore((s) => s.dismiss);
  const list = useMemo(() => ORDER.map((id) => badges.find((b) => b.id === id)!).filter(Boolean), [badges]);
  const next = list.findIndex((b) => !b.got);
  const fresh = list.filter((b) => b.got && !dismissed['badge:' + b.id]).map((b) => b.id);
  // Mark new unlocks as seen after their celebration has played.
  useEffect(() => {
    if (!fresh.length) return;
    haptic('success');
    const t = setTimeout(() => fresh.forEach((id) => dismiss('badge:' + id)), 2600);
    return () => clearTimeout(t);
  }, [fresh.join()]);

  const amp = Math.max(0, w / 2 - NODE / 2 - 16);
  const reach = next < 0 ? list.length - 1 : next;
  // Collapsed, the road shows the last two stops reached and the next three ahead; expanded, all of it.
  const lo = whole ? 0 : Math.max(0, reach - 2), hi = whole ? list.length - 1 : Math.min(list.length - 1, reach + 3);
  const pos = (i: number) => ({ x: w / 2 + Math.sin(i * 1.15) * amp * 0.85, y: NODE / 2 + 18 + (i - lo) * STEP });
  const road = (from: number, to: number) => {
    let d = '';
    for (let i = from; i <= to; i++) {
      const p = pos(i);
      if (i === from) { d += `M${p.x},${p.y}`; continue; }
      const q = pos(i - 1), my = (q.y + p.y) / 2;
      d += `C${q.x},${my} ${p.x},${my} ${p.x},${p.y}`;
    }
    return d;
  };
  const h = pos(hi).y + NODE / 2 + 24;
  const shown = pick ? list.find((b) => b.id === pick) : list[reach];

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {shown && (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: c.card2, marginBottom: 6, gap: 2 }}>
          <T v="label" color={shown.got ? c.accent : c.muted}>{shown.got ? 'Unlocked' : shown.id === list[reach]?.id ? 'Next stop' : 'Locked'}</T>
          <T v="h3">{shown.title}</T>
          <T v="small">{shown.how}{shown.got ? '' : ` · ${shown.have.toLocaleString()} of ${shown.need.toLocaleString()}`}</T>
        </View>
      )}
      {w > 0 && (
        <View style={{ height: h }}>
          <Svg width={w} height={h} style={{ position: 'absolute' }}>
            <Path d={road(lo, hi)} stroke={c.card2} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray="2 14" />
            {reach > lo && <Road d={road(lo, reach)} />}
          </Svg>
          {list.map((b, i) => {
            if (i < lo || i > hi) return null;
            const p = pos(i);
            return (
              <Stop key={b.id} b={b} x={p.x} y={p.y} current={i === next} fresh={fresh.includes(b.id)} i={i}
                onPress={() => { haptic(); setPick(pick === b.id ? null : b.id); }} />
            );
          })}
        </View>
      )}
      {list.length > hi - lo + 1 || whole ? (
        <Tap onPress={() => setWhole(!whole)} style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 }}>
          <T v="small" color={c.accent}>{whole ? 'Show less' : `See the whole road (${list.length} stops)`}</T>
        </Tap>
      ) : null}
    </View>
  );
}

// The travelled part of the road draws itself in once.
function Road({ d }: { d: string }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(1, { duration: 900, easing: EASE }); }, [d]);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: 4000 * (1 - p.value) }));
  return <APath d={d} stroke={c.accent} strokeOpacity={0.85} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray="4000" animatedProps={ap} />;
}

function Stop({ b, x, y, current, fresh, i, onPress }: { b: Badge; x: number; y: number; current: boolean; fresh: boolean; i: number; onPress: () => void }) {
  const still = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (current && !still) pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 900, easing: EASE }), withTiming(1, { duration: 900, easing: EASE })), -1);
  }, [current, still]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const R = NODE / 2 + 5, len = 2 * Math.PI * R;
  const ring = useSharedValue(0);
  useEffect(() => { ring.value = withDelay(400, withTiming(b.have / b.need, { duration: 900, easing: EASE })); }, [b.have]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - ring.value) }));
  const bg = b.got ? c.accent : current ? c.card : '#18181B';
  return (
    <Animated.View entering={FadeIn.delay(Math.min(i, 8) * 40).duration(300)}
      style={{ position: 'absolute', left: x - NODE / 2 - 6, top: y - NODE / 2 - 6, width: NODE + 12, height: NODE + 12, alignItems: 'center', justifyContent: 'center' }}>
      {current && (
        <Svg width={NODE + 12} height={NODE + 12} style={{ position: 'absolute' }}>
          <Circle cx={NODE / 2 + 6} cy={NODE / 2 + 6} r={R} stroke={c.card2} strokeWidth={4} fill="none" />
          <ACircle cx={NODE / 2 + 6} cy={NODE / 2 + 6} r={R} stroke={c.accent} strokeWidth={4} fill="none" strokeLinecap="round"
            strokeDasharray={len} animatedProps={ringProps} transform={`rotate(-90 ${NODE / 2 + 6} ${NODE / 2 + 6})`} />
        </Svg>
      )}
      <Animated.View style={a}>
        <Tap onPress={onPress} scale={0.9} feedback="none"
          style={{ width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
            borderWidth: b.got ? 0 : 2, borderColor: current ? c.accent : c.line, borderBottomWidth: b.got ? 5 : 2, borderBottomColor: b.got ? '#00000040' : c.line }}>
          <Ionicons name={b.got || current ? b.icon : 'lock-closed'} size={b.got || current ? 26 : 20} color={b.got ? c.accentInk : current ? c.accent : c.dim} />
        </Tap>
      </Animated.View>
      {current && (
        <View pointerEvents="none" style={{ position: 'absolute', top: -16, left: -50, right: -50, alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: c.accent, justifyContent: 'center' }}>
            <T v="label" color={c.accentInk} numberOfLines={1} style={{ fontSize: 10, lineHeight: 12 }}>You are here</T>
          </View>
        </View>
      )}
      {fresh && <Burst />}
    </Animated.View>
  );
}

// A one-off confetti pop around a stop that was just unlocked.
const COLORS = ['#FFD60A', '#FF6B6B', '#64D2FF', '#BF8CFF', '#30D158'];
function Burst() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: NODE / 2 + 6, top: NODE / 2 + 6 }}>
      {Array.from({ length: 18 }, (_, i) => <Bit key={i} i={i} />)}
    </View>
  );
}
function Bit({ i }: { i: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(300 + (i % 3) * 60, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })); }, []);
  const ang = (i / 18) * Math.PI * 2, dist = 46 + (i % 4) * 14;
  const a = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [{ translateX: Math.cos(ang) * dist * p.value }, { translateY: Math.sin(ang) * dist * p.value + 30 * p.value * p.value }, { rotate: `${p.value * 360 + i * 30}deg` }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 10, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }, a]} />;
}
