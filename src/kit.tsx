// Round 10 building blocks shared by every screen: the one header for pushed screens, the one segmented control,
// count-up numbers, the "start today's workout" action used by the centre button and Today, and the workout mini bar.
// Rules they enforce live in docs/REDESIGN.md (section 2 and 3).
import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeOutDown, runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime } from './calc';
import { reschedule, restAlert } from './notify';
import { byId, type Place } from './data/exercises';
import { asDay, quickById } from './data/quick';
import { suggest } from './engine';
import { useStore } from './store';
import { c, f, r } from './theme';
import { CENTRE_RISE, haptic, MINI_BAR_HEIGHT, MINI_GAP, T, TAB_BAR_HEIGHT, Tap, useMiniBarPlace } from './ui';

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
      <Tap onPress={onBack ?? goBack} style={k.round} scale={0.9} feedback="none" accessibilityLabel={close ? 'Close' : 'Back'}>
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
  const still = useReducedMotion();
  const cell = options.length ? (w - 8) / options.length : 0;
  useEffect(() => { x.value = still ? i * cell : withTiming(i * cell, { duration: 260, easing: EASE }); }, [i, cell, still]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[k.seg, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Animated.View style={[k.segPill, { width: cell, backgroundColor: c.accent }, pill]} />}
      {options.map((o) => (
        <Tap key={o.k} onPress={() => o.k !== value && onChange(o.k)} style={k.segItem} scale={0.96}
          accessibilityRole="tab" accessibilityState={{ selected: o.k === value }} accessibilityLabel={o.label}>
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

// Opens the running workout. navigate() reuses an existing /session screen instead of pushing a second one, and a
// short lock swallows the second tap of a double tap.
let opening = 0;
export function openWorkout() {
  if (Date.now() - opening < 600) return;
  opening = Date.now();
  router.navigate('/session');
}

// Back to Today from anywhere (summary Done, erase): pops every pushed screen instead of stacking a new tab set.
export function toToday() {
  if (router.canDismiss()) router.dismissAll();
  router.navigate('/');
}

// Live clock of the running workout, in seconds, excluding pauses. 0 for a workout that is open but not started
// (ready), and it only ticks while the clock actually runs.
export function useElapsed() {
  const a = useStore((s) => s.active);
  const [now, setNow] = useState(Date.now());
  const ticking = !!a && a.running !== false && !a.pausedAt;
  useEffect(() => { if (!ticking) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ticking]);
  if (!a || a.running === false) return 0;
  return Math.max(0, Math.floor(((a.pausedAt ?? now) - a.startedAt - (a.pausedMs ?? 0)) / 1000));
}

// Rest-day hook point. On a rest day Start opens the rest-day sheet (src/restday.tsx: Train anyway / Quick 20 min /
// Pick exercises) instead of starting. The sheet's host in app/_layout.tsx registers a handler here (restday.tsx
// imports kit, so kit can't import it back); the handler returns true when today is a rest day and it opened the
// sheet. With nothing registered, Start simply starts today's workout.
let restDayHandler: (() => boolean) | null = null;
export function registerRestDay(handler: () => boolean) {
  restDayHandler = handler;
  return () => { if (restDayHandler === handler) restDayHandler = null; };
}

// Today's workout, the same one everywhere (centre button, Today hero, Train's plan card). One tap opens it ready (clock
// stopped, Start workout on the workout screen starts it); while a workout is open the same action reopens it.
export function useToday() {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const checkins = useStore((s) => s.checkins);
  const planId = useStore((s) => s.planId);
  const nextDay = useStore((s) => s.nextDay);
  const planStart = useStore((s) => s.planStart);
  const active = useStore((s) => s.active);
  const st = { profile, sessions, meals, water, checkins, planId, nextDay, active, start: useStore.getState().start };
  const sug = useMemo(() => suggest({ profile, sessions, meals, water, checkins, planId, nextDay, planStart }), [profile, sessions, meals, water, checkins, planId, nextDay, planStart]);
  const desk = quickById.desk;
  const office = st.profile.place === 'office' && !!desk;
  const day = office ? asDay(desk) : sug.day;
  const where: Place = st.profile.place === 'home' || office ? 'home' : 'gym';
  const minutes = office ? desk.minutes : sug.minutes;
  // Reads the store at tap time (not the last render), and openWorkout() never stacks a second workout screen,
  // so a fast double tap opens exactly one.
  const start = () => {
    const now = useStore.getState();
    if (!now.active && !office && restDayHandler?.()) { haptic(); return; }
    if (!now.active) {
      haptic('medium');
      if (office) now.start(day, 'home');
      else now.start(day, where, sug.planId, sug.dayIndex);
    }
    openWorkout();
  };
  return { day, where, minutes, kind: office ? 'plan' as const : sug.kind, reason: sug.reason, active: st.active, start,
    planId: office ? undefined : sug.planId, dayIndex: office ? undefined : sug.dayIndex };
}

// The mini bar is rendered once, at the root (app/_layout.tsx). It sits 8 px above the tab bar on tabs and 8 px above
// the bottom safe area on pushed screens; the workout, its summary and setup hide it.
// Placement and the padding hook live in ui.tsx (Screen needs them); re-exported here for screens.
export { CENTRE_RISE, MINI_BAR_HEIGHT, TAB_BAR_HEIGHT, useMiniBarSpace, useScrollTopRef } from './ui';
export function DockedMiniBar() {
  const { visible, tabs } = useMiniBarPlace();
  const ins = useSafeAreaInsets();
  const seg = useSegments() as string[];
  // A workout saved while still ready (app closed on the ready screen) was never started: drop it on launch unless the
  // app opens straight onto the workout screen.
  useEffect(() => {
    const a = useStore.getState().active;
    if (a && a.running === false && seg[0] !== 'session') useStore.getState().discard();
  }, []);
  if (!visible) return null;
  const bottom = tabs ? Math.max(ins.bottom, 8) + TAB_BAR_HEIGHT + CENTRE_RISE + MINI_GAP : ins.bottom + MINI_GAP;
  return <MiniBar bottom={bottom} />;
}

// Docked above the tab bar while a started workout is minimised (a ready one never shows it). Tap opens it; ✓ logs the
// next set.
export function MiniBar({ bottom }: { bottom: number }) {
  const a = useStore((s) => s.active);
  const elapsed = useElapsed();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  // A workout left open (no set logged for 3 hours) saves itself with what was logged when the app comes back, so the
  // bar never follows the person around for days. Nothing logged: it simply goes.
  useEffect(() => {
    const check = () => {
      const r = useStore.getState().closeStale();
      if (!r) return;
      restAlert(null);
      if (r !== 'dropped') reschedule(useStore.getState().profile, useStore.getState().sessions);
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [a?.id]);
  if (!a || a.running === false) return null;
  const i = Math.min(a.idx ?? 0, a.items.length - 1);
  const it = a.items[i];
  const ex = byId[it?.exId];
  const left = a.items.some((x) => x.sets.some((y) => !y.done)); // ✓ logs the next set anywhere, so it shows while any is left
  const done = a.items.reduce((n, x) => n + x.sets.filter((y) => y.done).length, 0);
  const total = a.items.reduce((n, x) => n + x.sets.length, 0);
  const rest = a.restUntil && a.restUntil > now ? Math.ceil((a.restUntil - now) / 1000) : 0;
  // Logs the next unfinished set anywhere in the workout, the same way the workout screen does.
  const tick = () => {
    const { active, updateSet, setRest, setIdx, resume } = useStore.getState();
    if (!active || active.running === false) { openWorkout(); return; }
    const order = [...active.items.keys()].sort((x, y) => (x === i ? -1 : y === i ? 1 : x - y));
    const ii = order.find((n) => active.items[n].sets.some((x) => !x.done));
    if (ii === undefined) { openWorkout(); return; }
    const item = active.items[ii];
    const jj = item.sets.findIndex((x) => !x.done);
    if (active.pausedAt) resume();
    if (ii !== i) setIdx(ii);
    updateSet(ii, jj, { done: true });
    haptic('success');
    // The last set of the workout: open it, where the save beat runs (and Add more can still stop it).
    if (useStore.getState().active?.items.every((x) => x.sets.every((y) => y.done))) { setRest(null); restAlert(null); openWorkout(); return; }
    setRest(Date.now() + item.rest * 1000, item.rest, ii);
    restAlert(item.rest);
  };
  return (
    <Animated.View entering={FadeInDown.duration(320).easing(EASE)} exiting={FadeOutDown.duration(200)} style={[k.mini, { bottom, borderColor: c.accent + '55' }]}>
      <Tap onPress={openWorkout} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 }} scale={0.98}
        accessibilityLabel={`Open workout, ${ex?.name ?? a.title}, ${done} of ${total} sets`}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" numberOfLines={1} style={{ fontSize: 15 }}>{ex?.name ?? a.title}</T>
          <T v="small" color={rest ? c.warm : c.accent} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {rest ? `Rest ${fmtTime(rest)}` : a.pausedAt ? 'Paused' : fmtTime(elapsed)} · {done}/{total} sets
          </T>
        </View>
      </Tap>
      <Tap onPress={tick} style={[k.miniTick, { backgroundColor: c.accent }]} scale={0.9} feedback="none" accessibilityLabel={left ? 'Log next set' : 'Open workout'}>
        <Ionicons name={left ? 'checkmark' : 'chevron-up'} size={22} color={c.accentInk} />
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
// compact: a 36 px icon and 12 px gap, so the title lines up with IconBox rows (Fold, list cards) in the same column.
export function DoorCard({ icon, color = c.accent, title, meta, onPress, right, compact }: {
  icon: Icon; color?: string; title: string; meta?: string; onPress?: () => void; right?: ReactNode; compact?: boolean;
}) {
  return (
    <Tap onPress={onPress} style={[k.door, compact && { gap: 12 }]} scale={0.98}>
      <View style={[k.doorIcon, compact && { width: 36, height: 36, borderRadius: 10 }, { backgroundColor: color + '22' }]}><Ionicons name={icon} size={20} color={color} /></View>
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
    position: 'absolute', left: 12, right: 12, height: MINI_BAR_HEIGHT, borderRadius: r.lg, flexDirection: 'row', alignItems: 'center', paddingRight: 5, // 5 = (56 - 2 border - 44) / 2: equal gap round the ✓
    backgroundColor: '#17171B', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  miniTick: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  emptyBtn: { height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  doorIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
