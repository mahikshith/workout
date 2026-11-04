// Round 10 building blocks shared by every screen: the one header for pushed screens, the one segmented control,
// count-up numbers, the "start today's workout" action used by the centre button and Today, and the workout mini bar.
// Rules they enforce live in docs/REDESIGN.md (section 2 and 3).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeOutDown, runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime } from './calc';
import { byId, type Place } from './data/exercises';
import { asDay, quickById } from './data/quick';
import { suggest } from './engine';
import { useStore } from './store';
import { c, f, r } from './theme';
import { haptic, T, Tap } from './ui';

export const EASE = Easing.bezier(0.32, 0.72, 0, 1); // pushes, sheets, the workout opening
export const EASE_FILL = Easing.bezier(0.23, 1, 0.32, 1); // rings and bars
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1); // celebrations

type Icon = keyof typeof Ionicons.glyphMap;

// Leaves a pushed screen. Falls back to Today when the screen was opened cold (deep link, notification).
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

// The header of every pushed screen: back arrow, title, at most one action on the right.
export function Header({ title, action, actionIcon, onAction, onBack, close }: {
  title?: string; action?: string; actionIcon?: Icon; onAction?: () => void; onBack?: () => void; close?: boolean;
}) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[k.header, { paddingTop: ins.top + 6 }]}>
      <Tap onPress={onBack ?? goBack} style={k.round} scale={0.9} feedback="none">
        <Ionicons name={close ? 'chevron-down' : 'chevron-back'} size={22} color={c.text} />
      </Tap>
      <T v="h3" numberOfLines={1} style={{ flex: 1, fontSize: 18 }}>{title ?? ''}</T>
      {onAction ? (
        <Tap onPress={onAction} style={action ? [k.action, { backgroundColor: c.accent }] : k.round} scale={0.95}>
          {actionIcon && <Ionicons name={actionIcon} size={18} color={action ? c.accentInk : c.text} />}
          {action ? <Text style={{ fontFamily: f.bold, fontSize: 15, color: c.accentInk }}>{action}</Text> : null}
        </Tap>
      ) : <View style={{ width: 44 }} />}
    </View>
  );
}

// The one segmented control. The highlight slides between options.
export function Segmented<K extends string>({ options, value, onChange, style }: {
  options: { k: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const i = Math.max(0, options.findIndex((o) => o.k === value));
  const x = useSharedValue(0);
  const cell = options.length ? (w - 8) / options.length : 0;
  useEffect(() => { x.value = withTiming(i * cell, { duration: 260, easing: EASE }); }, [i, cell]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[k.seg, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Animated.View style={[k.segPill, { width: cell, backgroundColor: c.accent }, pill]} />}
      {options.map((o) => (
        <Tap key={o.k} onPress={() => o.k !== value && onChange(o.k)} style={k.segItem} scale={0.96}>
          <Text numberOfLines={1} style={{ fontFamily: f.semi, fontSize: 14, color: o.k === value ? c.accentInk : c.muted }}>{o.label}</Text>
        </Tap>
      ))}
    </View>
  );
}

// A number that counts up to its value (600 ms) and pops when it changes later. Respects reduced motion.
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', style }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; style?: StyleProp<TextStyle>;
}) {
  const still = useReducedMotion();
  const v = useSharedValue(still ? value : 0);
  const scale = useSharedValue(1);
  const [shown, setShown] = useState(still ? value : 0);
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (still) { setShown(value); return; }
    v.value = withTiming(value, { duration: 600, easing: Easing.out(Easing.cubic) });
    if (!first) scale.value = withSequence(withTiming(1.15, { duration: 120 }), withSpring(1, { damping: 12, stiffness: 220 }));
    setFirst(false);
  }, [value]);
  useAnimatedReaction(() => v.value, (n) => runOnJS(setShown)(n));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const txt = `${prefix}${shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  return <Animated.Text style={[{ fontFamily: f.display, fontSize: 28, color: c.text }, style, pop]}>{txt}</Animated.Text>;
}

// Live clock of the running workout, in seconds, excluding pauses.
export function useElapsed() {
  const a = useStore((s) => s.active);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!a) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [!!a]);
  if (!a || a.running === false) return 0;
  return Math.max(0, Math.floor(((a.pausedAt ?? now) - a.startedAt - (a.pausedMs ?? 0)) / 1000));
}

// Today's workout, the same one everywhere (centre button, Today hero, Train's plan card). One tap starts it; while a
// workout is running the same action reopens it.
export function useToday() {
  const st = useStore();
  const sug = suggest(st);
  const desk = quickById.desk;
  const office = st.profile.place === 'office' && !!desk;
  const day = office ? asDay(desk) : sug.day;
  const where: Place = st.profile.place === 'home' || office ? 'home' : 'gym';
  const minutes = office ? desk.minutes : sug.minutes;
  const start = () => {
    if (st.active) { router.push('/session'); return; }
    haptic('medium');
    if (office) st.start(day, 'home');
    else st.start(day, where, sug.planId, sug.dayIndex);
    router.push('/session');
  };
  return { day, where, minutes, kind: office ? 'plan' as const : sug.kind, reason: sug.reason, active: st.active, start };
}

// Docked above the tab bar while a workout runs and its screen is minimised. Tap opens it; ✓ logs the next set.
export function MiniBar({ bottom }: { bottom: number }) {
  const a = useStore((s) => s.active);
  const elapsed = useElapsed();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!a) return null;
  const i = Math.min(a.idx ?? 0, a.items.length - 1);
  const it = a.items[i];
  const ex = byId[it?.exId];
  const j = it ? it.sets.findIndex((x) => !x.done) : -1;
  const done = a.items.reduce((n, x) => n + x.sets.filter((y) => y.done).length, 0);
  const total = a.items.reduce((n, x) => n + x.sets.length, 0);
  const rest = a.restUntil && a.restUntil > now ? Math.ceil((a.restUntil - now) / 1000) : 0;
  const tick = () => {
    if (!it || j < 0) { router.push('/session'); return; }
    const { updateSet, setRest } = useStore.getState();
    updateSet(i, j, { done: true });
    setRest(Date.now() + it.rest * 1000, it.rest);
    haptic('success');
  };
  return (
    <Animated.View entering={FadeInDown.duration(320).easing(EASE)} exiting={FadeOutDown.duration(200)} style={[k.mini, { bottom, borderColor: c.accent + '55' }]}>
      <Tap onPress={() => router.push('/session')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 }} scale={0.98}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" numberOfLines={1} style={{ fontSize: 15 }}>{ex?.name ?? a.title}</T>
          <T v="small" color={rest ? c.warm : c.accent} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {rest ? `Rest ${fmtTime(rest)}` : a.pausedAt ? 'Paused' : fmtTime(elapsed)} · {done}/{total} sets
          </T>
        </View>
      </Tap>
      <Tap onPress={tick} style={[k.miniTick, { backgroundColor: c.accent }]} scale={0.9} feedback="none">
        <Ionicons name={j < 0 ? 'chevron-up' : 'checkmark'} size={22} color={c.accentInk} />
      </Tap>
    </Animated.View>
  );
}

// An empty state: icon, one line, one action. Used wherever data may be missing (no watch, no sessions yet).
export function Empty({ icon, title, action, onPress }: { icon: Icon; title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={k.empty}>
      <Ionicons name={icon} size={28} color={c.muted} />
      <T v="body" color={c.muted} style={{ textAlign: 'center' }}>{title}</T>
      {action && onPress ? <Tap onPress={onPress} style={k.emptyBtn}><T v="h3" color={c.accent}>{action}</T></Tap> : null}
    </View>
  );
}

// A card that is a doorway to one place: icon, title, one meta line, chevron. Progress and You are built from these.
export function DoorCard({ icon, color = c.accent, title, meta, onPress, right }: {
  icon: Icon; color?: string; title: string; meta?: string; onPress?: () => void; right?: ReactNode;
}) {
  return (
    <Tap onPress={onPress} style={k.door} scale={0.98}>
      <View style={[k.doorIcon, { backgroundColor: color + '22' }]}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" numberOfLines={1}>{title}</T>
        {meta ? <T v="small" numberOfLines={1}>{meta}</T> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={c.dim} />}
    </Tap>
  );
}

const k = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: c.bg },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  action: { height: 40, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  seg: { flexDirection: 'row', height: 40, borderRadius: 12, backgroundColor: c.card2, padding: 4 },
  segPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 9 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mini: {
    position: 'absolute', left: 12, right: 12, height: 56, borderRadius: r.lg, flexDirection: 'row', alignItems: 'center', paddingRight: 8,
    backgroundColor: '#17171B', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  miniTick: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  emptyBtn: { height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  doorIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
