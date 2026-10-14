// Achievements on the Progress tab: a level gauge (an instrument-style arc that sweeps in once) and a medal shelf.
// Earned medals are metal hexagons (bronze, silver or gold by difficulty), the next one to earn has a thin accent
// progress ring, the rest wait behind a lock. A medal earned since the last visit pops and gets one shine sweep,
// then is remembered as seen (store.dismissed['badge:' + id]). Nothing animates continuously.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import type { Badge, level } from './data/badges';
import { useStore } from './store';
import { c, f } from './theme';
import { haptic, T, Tap } from './ui';

type Level = ReturnType<typeof level>;
type Tier = 'bronze' | 'silver' | 'gold';

// Easiest first, so the shelf reads left to right as the order people tend to earn them.
const ORDER = ['first', 'streak3', 'home', 'water7', 'five', 'meals7', 'pr', 'early', 'late', 'sets100', 'twenty', 'ton', 'streak10', 'pr10', 'fifty'];
const TIER: Record<string, Tier> = {
  first: 'bronze', streak3: 'bronze', home: 'bronze', early: 'bronze', late: 'bronze', pr: 'bronze',
  five: 'silver', water7: 'silver', meals7: 'silver', sets100: 'silver', twenty: 'silver', ton: 'silver',
  streak10: 'gold', pr10: 'gold', fifty: 'gold',
};
const TIER_NAME: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
// Light, mid and shadow tone of each metal.
const METAL: Record<Tier, [string, string, string]> = {
  bronze: ['#F2BE95', '#B97A4E', '#6E3F22'],
  silver: ['#F7F8FA', '#B8BCC6', '#62666F'],
  gold: ['#FFEAA8', '#E0B04A', '#8E6618'],
};
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const ARect = Animated.createAnimatedComponent(Rect);

export function Achievements({ lv, badges }: { lv: Level; badges: Badge[] }) {
  const dismissed = useStore((s) => s.dismissed);
  const dismiss = useStore((s) => s.dismiss);
  const [pick, setPick] = useState<string | null>(null);
  const ref = useRef<ScrollView>(null);
  // Earned first (easiest first within each group), so the next medal sits right after the last one earned.
  const list = useMemo(() => {
    const byOrder = ORDER.map((id) => badges.find((b) => b.id === id)).filter((b): b is Badge => !!b);
    return [...byOrder.filter((b) => b.got), ...byOrder.filter((b) => !b.got)];
  }, [badges]);
  const earned = list.filter((b) => b.got).length;
  const next = list[earned]; // undefined once every medal is earned
  const fresh = list.filter((b) => b.got && !dismissed['badge:' + b.id]).map((b) => b.id);

  // Mark new unlocks as seen after their shine has played.
  useEffect(() => {
    if (!fresh.length) return;
    haptic('success');
    const t = setTimeout(() => fresh.forEach((id) => dismiss('badge:' + id)), 2600);
    return () => clearTimeout(t);
  }, [fresh.join()]);

  const shown = list.find((b) => b.id === (pick ?? fresh[0] ?? next?.id)) ?? list[list.length - 1];
  const focus = Math.max(0, list.findIndex((b) => b.id === shown?.id));

  return (
    <View style={{ gap: 16 }}>
      <Gauge lv={lv} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="label">Medals</T>
        <T v="small">{earned} of {list.length}</T>
      </View>
      {shown && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.card2, gap: 2 }}>
          <T v="label" color={shown.got ? c.accent : shown === next ? c.text : c.muted}>
            {shown.got ? `Earned · ${TIER_NAME[TIER[shown.id] ?? 'bronze']}` : shown === next ? 'Next medal' : 'Locked'}
          </T>
          <T v="h3" numberOfLines={1}>{shown.title}</T>
          <T v="small" numberOfLines={1}>{shown.how}{shown.got ? '' : ` · ${shown.have.toLocaleString()} of ${shown.need.toLocaleString()}`}</T>
        </View>
      )}
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        onContentSizeChange={() => ref.current?.scrollTo({ x: Math.max(0, (focus - 1) * ITEM), animated: false })}>
        {list.map((b) => (
          <Medal key={b.id} b={b} isNext={b === next} fresh={fresh.includes(b.id)} picked={b.id === shown?.id}
            onPress={() => setPick(b.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

// The level gauge: a 270° arc, dim to bright accent, with a knob riding its tip and a tick scale inside.
const GS = 220, GW = 14;
function Gauge({ lv }: { lv: Level }) {
  const still = useReducedMotion();
  const m = GS / 2, R = m - GW / 2 - 6, R2 = R - GW / 2 - 9;
  const at = (rad: number, deg: number) => { const a = (deg * Math.PI) / 180; return `${m + rad * Math.cos(a)},${m + rad * Math.sin(a)}`; };
  const arc = (rad: number) => `M${at(rad, 135)} A${rad},${rad} 0 1 1 ${at(rad, 45)}`;
  const len = 1.5 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, lv.into / Math.max(1, lv.need)));
  const p = useSharedValue(still ? frac : 0);
  useEffect(() => { p.value = still ? frac : withDelay(250, withTiming(frac, { duration: 1300, easing: EASE })); }, [frac, still]);
  // At zero a round cap would still paint a dot, so the arc and knob hide until there is something to show.
  const fill = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value), strokeOpacity: p.value > 0.003 ? 1 : 0 }));
  const glow = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value), strokeOpacity: p.value > 0.003 ? 0.14 : 0 }));
  const knob = useAnimatedProps(() => {
    const a = ((135 + 270 * p.value) * Math.PI) / 180;
    return { cx: m + R * Math.cos(a), cy: m + R * Math.sin(a), opacity: p.value > 0.003 ? 1 : 0 };
  });
  return (
    <View style={{ width: GS, height: GS, alignSelf: 'center' }}>
      <Svg width={GS} height={GS} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="lvlArc" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.3} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={arc(R)} stroke={c.card2} strokeWidth={GW} fill="none" strokeLinecap="round" />
        <Path d={arc(R2)} stroke={c.line} strokeWidth={5} fill="none" strokeDasharray="1.5 7" />
        <APath d={arc(R)} stroke={c.accent} strokeWidth={GW + 12} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${len}`} animatedProps={glow} />
        <APath d={arc(R)} stroke="url(#lvlArc)" strokeWidth={GW} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${len}`} animatedProps={fill} />
        <ACircle r={GW / 2 + 2} fill={c.text} stroke={c.card} strokeWidth={3} animatedProps={knob} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <T v="label">Level</T>
        <Text style={{ fontFamily: f.display, fontSize: 72, lineHeight: 80, color: c.text }}>{lv.lvl}</Text>
        <T v="h3" color={c.accent} numberOfLines={1}>{lv.name}</T>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' }}>
        <T v="small" numberOfLines={1}>{lv.need - lv.into} XP to level {lv.lvl + 1}</T>
      </View>
    </View>
  );
}

// One medal: a hexagon, metal when earned, outlined and locked otherwise. The next one gets a progress ring.
const ITEM = 92, MS = 84, MC = MS / 2;
const hex = (rad: number) =>
  Array.from({ length: 6 }, (_, i) => { const a = ((-90 + i * 60) * Math.PI) / 180; return `${MC + rad * Math.cos(a)},${MC + rad * Math.sin(a)}`; }).join(' ');

function Medal({ b, isNext, fresh, picked, onPress }: { b: Badge; isNext: boolean; fresh: boolean; picked: boolean; onPress: () => void }) {
  const still = useReducedMotion();
  const tier = TIER[b.id] ?? 'bronze';
  const [hi, mid, lo] = METAL[tier];
  const ringR = 40, ringLen = 2 * Math.PI * ringR;
  const ring = useSharedValue(0);
  const shine = useSharedValue(0);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (isNext) ring.value = still ? b.have / b.need : withDelay(500, withTiming(b.have / b.need, { duration: 900, easing: EASE }));
  }, [isNext, b.have, b.need, still]);
  useEffect(() => {
    if (!fresh || still) return;
    pop.value = withSequence(withTiming(1.14, { duration: 260, easing: EASE }), withTiming(1, { duration: 420, easing: EASE }));
    shine.value = withDelay(350, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [fresh, still]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ringLen * (1 - ring.value), strokeOpacity: ring.value > 0.003 ? 1 : 0 }));
  const shineProps = useAnimatedProps(() => ({ x: -30 + shine.value * 120, opacity: shine.value > 0 && shine.value < 1 ? 0.6 : 0 }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const g = 'm' + b.id; // gradient / clip ids, unique per medal

  return (
    <Tap onPress={onPress} scale={0.92} style={{ width: ITEM, alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      <Animated.View style={[{ width: MS, height: MS, alignItems: 'center', justifyContent: 'center' }, popStyle]}>
        <Svg width={MS} height={MS} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={g + 'o'} x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={hi} />
              <Stop offset="0.55" stopColor={mid} />
              <Stop offset="1" stopColor={lo} />
            </LinearGradient>
            <LinearGradient id={g + 'i'} x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={mid} />
              <Stop offset="1" stopColor={hi} />
            </LinearGradient>
            <ClipPath id={g + 'c'}><Polygon points={hex(33)} /></ClipPath>
          </Defs>
          {isNext && (
            <>
              <Circle cx={MC} cy={MC} r={ringR} stroke={c.card2} strokeWidth={3} fill="none" />
              <ACircle cx={MC} cy={MC} r={ringR} stroke={c.accent} strokeWidth={3} fill="none" strokeLinecap="round"
                strokeDasharray={ringLen} animatedProps={ringProps} transform={`rotate(-90 ${MC} ${MC})`} />
            </>
          )}
          {b.got ? (
            <>
              <Polygon points={hex(30)} fill={`url(#${g}o)`} stroke={`url(#${g}o)`} strokeWidth={6} strokeLinejoin="round" />
              <Polygon points={hex(22)} fill={`url(#${g}i)`} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.2} strokeLinejoin="round" />
              <G clipPath={`url(#${g}c)`}>
                <ARect y={-10} width={14} height={MS + 20} fill="#FFFFFF" transform={`rotate(25 ${MC} ${MC})`} animatedProps={shineProps} />
              </G>
            </>
          ) : (
            <Polygon points={hex(30)} fill={isNext ? c.card2 : '#141417'} stroke={isNext ? c.accent : c.line} strokeOpacity={isNext ? 0.6 : 1}
              strokeWidth={isNext ? 1.5 : 2} strokeLinejoin="round" />
          )}
        </Svg>
        <Ionicons name={b.got || isNext ? b.icon : 'lock-closed'} size={b.got || isNext ? 24 : 18}
          color={b.got ? '#1A1408' : isNext ? c.accent : c.dim} />
      </Animated.View>
      <T v="small" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
        color={picked ? c.text : b.got ? '#C8C8CE' : c.muted} style={{ textAlign: 'center' }}>{b.title}</T>
      <T v="label" numberOfLines={1} color={isNext ? c.accent : b.got ? '#8E8E93' : c.dim} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>
        {isNext ? `${b.have.toLocaleString()} of ${b.need.toLocaleString()}` : TIER_NAME[tier]}
      </T>
    </Tap>
  );
}
