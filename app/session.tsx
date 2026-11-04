import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime, isTimed, lastSets, secsOf } from '../src/calc';
import { alternatives, byId, title, type Exercise } from '../src/data/exercises';
import guide from '../src/data/guide.json';
import { gate } from '../src/engine';
import { useLiveHr } from '../src/health/live';
import { EASE, goBack, useElapsed } from '../src/kit';
import { reschedule, restAlert } from '../src/notify';
import { Sheet } from '../src/sheet';
import { useStore, type SetLog } from '../src/store';
import { c, f, r } from '../src/theme';
import { Button, Demo, haptic, Ring, Row, Stepper, T, Tap, Thumb } from '../src/ui';

// The live workout (docs/REDESIGN.md "Workout", rules 6-7). It starts running the moment it is opened; ⌄ or a swipe
// down minimises it into the tab bar's mini bar. The exercise on screen and the rest timer live in the store
// (active.idx, active.restUntil) so the mini bar shows the same thing.

type Guide = { steps?: string[]; mistake?: string };
const GUIDE = guide as Record<string, Guide>;
const NO_WEIGHT = ['pelvic floor', 'stretching', 'mobility', 'eyes', 'desk', 'breathing', 'cardio'];

const useNow = (ms = 1000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
};

const restEndHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

// "Last time 60 kg × 8": the heaviest set from the last session that had this exercise.
function lastText(prev: SetLog[] | null, timed: boolean) {
  if (!prev?.length) return null;
  const top = prev.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
  if (timed) return `Last time ${fmtTime(top.reps)}`;
  return top.weight ? `Last time ${top.weight} kg × ${top.reps}` : `Last time ${top.reps} reps`;
}

export default function SessionScreen() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const active = useStore((s) => s.active);
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const { updateSet, addSet, removeSet, swap, finish, discard, pause, resume, setIdx, setRest } = useStore.getState();
  const elapsed = useElapsed();
  const bpm = useLiveHr();

  const [sheet, setSheet] = useState<'swap' | 'finish' | 'info' | null>(null);
  const last = useRef(sheet);
  if (sheet) last.current = sheet;
  const kind = last.current; // keeps sheet content on screen while it slides away

  const restUntil = active?.restUntil ?? null;
  const restTotal = active?.restTotal ?? 90;
  const pausedAt = active?.pausedAt;
  const now = useNow(restUntil ? 250 : 1000);
  const restLeft = restUntil ? Math.max(0, restUntil - (pausedAt ?? now)) : 0; // frozen while paused
  const resting = restLeft > 0;

  // When an exercise is added from the library, jump straight to it so the user sees it landed.
  const count = active?.items.length ?? 0;
  const seen = useRef(count);
  useEffect(() => { if (count > seen.current) setIdx(count - 1); seen.current = count; }, [count]);

  // Rest over: warning haptic and a ring pulse, then the bottom bar returns. A rest that ran out while the workout
  // was minimised is cleared quietly.
  const [ending, setEnding] = useState(false);
  const pulse = useSharedValue(1);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (endTimer.current) clearTimeout(endTimer.current); }, []);
  useEffect(() => {
    if (!restUntil || pausedAt || restUntil > now) return;
    const late = now - restUntil > 2000;
    setRest(null);
    if (late) return;
    restEndHaptic();
    setEnding(true);
    if (!still) pulse.value = withSequence(withTiming(1.12, { duration: 160 }), withTiming(0.96, { duration: 160 }), withSpring(1, { damping: 10, stiffness: 220 }));
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => setEnding(false), 900);
  }, [now, restUntil, pausedAt]);
  const ringPulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!active) return <Redirect href="/" />;
  const paused = !!pausedAt;
  const idx = Math.min(active.idx ?? 0, active.items.length - 1);
  const it = active.items[idx];
  const ex = byId[it.exId];
  const timed = isTimed(it.target); // '30s' targets log seconds; drills with a hold still count reps
  const showWeight = !(NO_WEIGHT.includes(ex.category) || timed);
  const prev = lastSets(sessions, it.exId);
  const lastLine = lastText(prev, timed);
  const total = active.items.reduce((n, x) => n + x.sets.length, 0);
  const done = active.items.reduce((n, x) => n + x.sets.filter((y) => y.done).length, 0);
  const isLast = idx >= active.items.length - 1;

  // Pausing freezes the rest countdown too: on resume its deadline moves by the paused time.
  const doPause = () => { pause(); restAlert(null); haptic('medium'); };
  const doResume = () => {
    const a = useStore.getState().active;
    const gap = Date.now() - (a?.pausedAt ?? Date.now());
    resume();
    if (a?.restUntil) { setRest(a.restUntil + gap); restAlert((a.restUntil + gap - Date.now()) / 1000); }
    haptic('medium');
  };
  const startRest = (secs: number) => { setRest(Date.now() + secs * 1000, secs); restAlert(secs); };
  const changeRest = (until: number, tot?: number) => { setRest(until, tot); restAlert((until - Date.now()) / 1000); };
  const skipRest = () => { setRest(null); restAlert(null); };

  function toggle(j: number) {
    const was = it.sets[j].done;
    if (paused) doResume();
    updateSet(idx, j, { done: !was });
    if (!was) { haptic('light'); startRest(it.rest); }
  }

  function save() {
    restAlert(null);
    const s = finish();
    setSheet(null);
    reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (s) router.replace({ pathname: '/summary', params: { id: s.id } });
    else goBack();
  }
  function drop() { restAlert(null); discard(); setSheet(null); goBack(); }
  const short = done === 0 && elapsed < 120;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 6 }}>
      {/* Header: minimise, live clock (and heart rate), Finish. */}
      <Row style={{ paddingHorizontal: 12, height: 52 }} gap={8}>
        <Tap onPress={goBack} style={s.icon} scale={0.9} feedback="none">
          <Ionicons name="chevron-down" size={22} color={c.text} />
        </Tap>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Row gap={6}>
            {!paused && <View style={s.live} />}
            <T style={{ fontFamily: f.bold, fontSize: 18, fontVariant: ['tabular-nums'] }} color={paused ? c.muted : c.text}>
              {paused ? `Paused · ${fmtTime(elapsed)}` : fmtTime(elapsed)}
            </T>
          </Row>
        </View>
        {bpm != null && (
          <Row gap={4} style={{ marginRight: 4 }}>
            <Ionicons name="heart" size={14} color={c.pink} />
            <T style={{ fontFamily: f.bold, fontSize: 14, fontVariant: ['tabular-nums'] }} color={c.pink}>{bpm}</T>
          </Row>
        )}
        <Tap onPress={() => setSheet('finish')} style={[s.finish, { backgroundColor: c.accent }]} scale={0.95}>
          <T style={{ fontFamily: f.bold, fontSize: 15 }} color={c.accentInk}>Finish</T>
        </Tap>
      </Row>

      {/* One segment per exercise; tap to jump. */}
      <Row style={{ paddingHorizontal: 12, marginTop: 8 }} gap={4}>
        {active.items.map((x, i) => {
          const fr = x.sets.length ? x.sets.filter((y) => y.done).length / x.sets.length : 0;
          return (
            <Tap key={i} onPress={() => setIdx(i)} style={{ flex: 1, height: 20, justifyContent: 'center' }} feedback="none">
              <View style={[s.seg, i === idx && { backgroundColor: c.dim }]}>
                <View style={{ width: `${fr * 100}%`, height: '100%', backgroundColor: c.accent, borderRadius: 2 }} />
              </View>
            </Tap>
          );
        })}
      </Row>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View key={it.exId + idx} entering={FadeInDown.duration(300).easing(EASE)}>
          <T v="label">Exercise {idx + 1} of {active.items.length} · {title(ex.primary[0])} · {it.sets.length} × {it.target}</T>
          <Row style={{ alignItems: 'flex-start', marginTop: 4 }} gap={8}>
            <View style={{ flex: 1 }}>
              <T v="h2">{ex.name}</T>
              {lastLine && <T v="small">{lastLine}</T>}
              {it.swappedFrom && <T v="small" color={c.warm}>Alternative to {byId[it.swappedFrom].name}</T>}
            </View>
            <Tap onPress={() => setSheet('info')} style={s.info}>
              <Ionicons name="information" size={20} color={c.text} />
            </Tap>
          </Row>

          <Demo ex={ex} height={200} paused={sheet === 'info'} style={{ marginTop: 12 }} />

          <View style={s.table}>
            <Row style={{ paddingHorizontal: 8, paddingBottom: 4 }} gap={6}>
              <T v="label" style={{ width: 32, textAlign: 'center' }}>Set</T>
              {showWeight && <T v="label" style={{ flex: 1, textAlign: 'center' }}>Kg</T>}
              <T v="label" style={{ flex: 1, textAlign: 'center' }}>{timed ? 'Time' : 'Reps'}</T>
              <View style={{ width: 44 }} />
            </Row>
            {it.sets.map((x, j) => (
              <SetRow key={j} n={j + 1} done={x.done} still={still}
                onRemove={() => it.sets.length > 1 && removeSet(idx, j)} onTick={() => toggle(j)}
                weight={showWeight ? <Stepper value={x.weight} step={2.5} min={0} onChange={(weight) => updateSet(idx, j, { weight })} /> : null}
                reps={timed ? (
                  <SetTimer key={`${it.exId}-${j}`} value={x.reps} target={secsOf(it.target) ?? x.reps} done={x.done}
                    onChange={(reps) => updateSet(idx, j, { reps })}
                    onStart={() => { if (paused) doResume(); }}
                    onFinish={(reps) => { updateSet(idx, j, { reps }); if (!x.done) toggle(j); }} />
                ) : (
                  <Stepper value={x.reps} step={1} min={0} onChange={(reps) => updateSet(idx, j, { reps })} />
                )} />
            ))}
          </View>

          <Row style={{ marginTop: 4, paddingHorizontal: 4 }} gap={4}>
            <Tap onPress={() => addSet(idx)} style={s.text}><T v="h3" color={c.accent}>+ Add set</T></Tap>
            <Tap onPress={() => setSheet('swap')} style={s.text}><T v="h3" color={c.accent}>Swap</T></Tap>
            <View style={{ flex: 1 }} />
            <Tap onPress={() => router.push({ pathname: '/library', params: { pick: '1' } })} style={s.text}>
              <T v="h3" color={c.muted}>Add exercise</T>
            </Tap>
          </Row>
        </Animated.View>
      </ScrollView>

      <View style={[s.bottom, { paddingBottom: ins.bottom + 12 }]}>
        {resting || ending ? (
          <Animated.View entering={FadeInDown.duration(320).easing(EASE)} exiting={FadeOutDown.duration(200)} style={s.rest}>
            <Animated.View style={ringPulse}>
              <Ring size={64} stroke={7} progress={restLeft / (restTotal * 1000)} color={c.warm}>
                <T style={{ fontFamily: f.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}>{ending ? 'Go' : fmtTime(Math.ceil(restLeft / 1000))}</T>
              </Ring>
            </Animated.View>
            <View style={{ flex: 1, gap: 8 }}>
              <T v="label" color={c.warm}>{ending ? 'Rest over' : paused ? 'Rest · paused' : 'Rest'}</T>
              <Row gap={8}>
                <Tap onPress={() => restUntil && changeRest(Math.max(Date.now() + 1000, restUntil - 15000))} disabled={ending} style={s.restBtn}><T v="h3">−15</T></Tap>
                <Tap onPress={() => restUntil && changeRest(restUntil + 15000, restTotal + 15)} disabled={ending} style={s.restBtn}><T v="h3">+15</T></Tap>
                <Tap onPress={() => { skipRest(); setEnding(false); }} style={[s.restBtn, { backgroundColor: c.warm }]}><T v="h3" color={c.accentInk}>Skip</T></Tap>
              </Row>
            </View>
          </Animated.View>
        ) : (
          <Row gap={10}>
            <Tap onPress={paused ? doResume : doPause} style={[s.nav, paused && { backgroundColor: c.accent }]} feedback="none">
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color={paused ? c.accentInk : c.text} />
            </Tap>
            <Tap onPress={() => setIdx(idx - 1)} disabled={idx === 0} style={s.nav}>
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </Tap>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T v="label">{done}/{total} sets</T>
            </View>
            {!isLast ? (
              <Tap onPress={() => setIdx(idx + 1)} style={[s.wide, { backgroundColor: c.text }]}>
                <T v="h3" color={c.bg}>Next</T><Ionicons name="chevron-forward" size={20} color={c.bg} />
              </Tap>
            ) : (
              <Tap onPress={() => setSheet('finish')} style={[s.wide, { backgroundColor: c.text }]}>
                <T v="h3" color={c.bg}>Finish</T><Ionicons name="checkmark" size={20} color={c.bg} />
              </Tap>
            )}
          </Row>
        )}
      </View>

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {kind === 'finish' && (
          short ? (
            <View style={{ gap: 12 }}>
              <T v="h2">Discard this workout?</T>
              <T v="body" color={c.muted}>No sets logged · {fmtTime(elapsed)}</T>
              <Button title="Discard workout" kind="danger" icon="trash-outline" onPress={drop} />
              <Button title="Keep going" kind="ghost" onPress={() => setSheet(null)} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <T v="h2">Save this workout?</T>
              <T v="body" color={c.muted}>{done ? `${done} ${done === 1 ? 'set' : 'sets'} logged · ${fmtTime(elapsed)}` : `No sets logged yet · ${fmtTime(elapsed)}`}</T>
              <Button title="Save workout" icon="checkmark" onPress={save} disabled={!done} />
              <Button title="Keep going" kind="ghost" onPress={() => setSheet(null)} />
              <Tap onPress={drop} style={s.discard}><T v="h3" color={c.danger}>Discard workout</T></Tap>
            </View>
          )
        )}
        {kind === 'info' && <InfoSheet ex={ex} />}
        {kind === 'swap' && (
          <View style={{ gap: 10 }}>
            <T v="h2">Swap {ex.name}</T>
            <T v="small">Same muscles, {active.place === 'home' ? 'with what you have at home' : 'at the gym'}</T>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8, paddingTop: 6 }}>
              {alternatives(ex, active.place, profile.gear, 16).filter((a) => !gate(a, profile, sessions.length).locked).slice(0, 8).map((a) => (
                <Tap key={a.id} onPress={() => { swap(idx, a.id); setSheet(null); }} style={s.alt} scale={0.98}>
                  <Thumb ex={a} size={52} />
                  <View style={{ flex: 1 }}>
                    <T v="h3">{a.name}</T>
                    <T v="small">{title(a.equipment)} · {a.level}</T>
                  </View>
                  <Ionicons name="swap-horizontal" size={18} color={c.accent} />
                </Tap>
              ))}
            </ScrollView>
          </View>
        )}
      </Sheet>
    </View>
  );
}

// Exercise how-to as a sheet (rule 7): the demo and the steps, so the workout never leaves the screen.
function InfoSheet({ ex }: { ex: Exercise }) {
  const g = GUIDE[ex.id];
  const steps = g?.steps?.length ? g.steps : ex.steps.slice(0, 5);
  return (
    <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
      <T v="h2">{ex.name}</T>
      <Demo ex={ex} height={220} credit />
      {steps.map((step, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <View style={[s.num, { backgroundColor: c.accent }]}><T v="small" color={c.accentInk}>{i + 1}</T></View>
          <T style={{ flex: 1 }}>{step}</T>
        </Row>
      ))}
      {g?.mistake ? (
        <View style={{ gap: 2 }}>
          <T v="label" color={c.warm}>Common mistake</T>
          <T>{g.mistake}</T>
        </View>
      ) : null}
    </ScrollView>
  );
}

// One set row. Logging pops the ✓ (0.9 → 1.05 → 1) and fades a green tint in behind the row.
function SetRow({ n, done, still, weight, reps, onTick, onRemove }: {
  n: number; done: boolean; still: boolean; weight: ReactNode; reps: ReactNode; onTick: () => void; onRemove: () => void;
}) {
  const scale = useSharedValue(1);
  const tint = useSharedValue(done ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (still) { tint.value = done ? 1 : 0; return; }
    tint.value = withTiming(done ? 1 : 0, { duration: 180 });
    if (done) scale.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(1.05, { duration: 70 }), withSpring(1, { damping: 14, stiffness: 320 }));
  }, [done]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = useAnimatedStyle(() => ({ opacity: tint.value }));
  return (
    <Animated.View entering={FadeIn.duration(200)} style={s.set}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.setTint, bg]} />
      <Tap onPress={onRemove} feedback="none" style={{ width: 32, alignItems: 'center' }}>
        <T v="h3" color={done ? c.ok : c.muted}>{n}</T>
      </Tap>
      {weight ? <View style={{ flex: 1, alignItems: 'center' }}>{weight}</View> : null}
      <View style={{ flex: 1, alignItems: 'center' }}>{reps}</View>
      <Animated.View style={pop}>
        <Tap onPress={onTick} style={[s.check, done && { backgroundColor: c.ok, borderColor: c.ok }]} scale={0.9} feedback="none">
          <Ionicons name="checkmark" size={22} color={done ? c.accentInk : c.dim} />
        </Tap>
      </Animated.View>
    </Animated.View>
  );
}

// A set timer for holds and cardio: nothing runs until the user taps play. It counts up to the target, then logs the
// set; stopping early logs what was done. Before starting, +/- adjusts the target time.
function SetTimer({ value, target, done, onChange, onStart, onFinish }: {
  value: number; target: number; done: boolean; onChange: (n: number) => void; onStart: () => void; onFinish: (secs: number) => void;
}) {
  const [since, setSince] = useState<number | null>(null);
  const now = useNow(since ? 250 : 60000);
  const secs = since ? Math.floor((now - since) / 1000) : value;
  const goal = Math.max(target, value);
  useEffect(() => {
    if (since && secs >= goal) { setSince(null); haptic('success'); onFinish(goal); }
  }, [secs, since]);
  const step = goal >= 120 ? 60 : 5;
  if (since)
    return (
      <Row gap={10}>
        <View style={{ alignItems: 'center', minWidth: 76 }}>
          <T style={{ fontFamily: f.display, fontSize: 24, color: c.accent }}>{fmtTime(secs)}</T>
          <T v="small">of {fmtTime(goal)}</T>
        </View>
        <Tap onPress={() => { setSince(null); onFinish(Math.max(1, secs)); }} style={[s.play, { backgroundColor: c.warm }]} scale={0.9}>
          <Ionicons name="stop" size={18} color={c.accentInk} />
        </Tap>
      </Row>
    );
  return (
    <Row gap={6}>
      {!done && <Tap onPress={() => onChange(Math.max(step, value - step))} style={s.tiny}><Ionicons name="remove" size={16} color={c.text} /></Tap>}
      <T style={{ fontFamily: f.bold, fontSize: 17, color: c.text, minWidth: 48, textAlign: 'center' }}>{fmtTime(value)}</T>
      {!done && <Tap onPress={() => onChange(value + step)} style={s.tiny}><Ionicons name="add" size={16} color={c.text} /></Tap>}
      {!done && (
        <Tap onPress={() => { onStart(); setSince(Date.now()); haptic('medium'); }} style={[s.play, { backgroundColor: c.accent }]} scale={0.9}>
          <Ionicons name="play" size={18} color={c.accentInk} />
        </Tap>
      )}
    </Row>
  );
}

const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  info: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  finish: { height: 40, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  seg: { height: 4, borderRadius: 2, backgroundColor: c.card2, overflow: 'hidden' },
  text: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tiny: { width: 28, height: 32, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  table: { marginTop: 16, backgroundColor: c.card, borderRadius: r.lg, borderWidth: 1, borderColor: c.line, paddingVertical: 12, paddingHorizontal: 6, gap: 6 },
  set: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: r.md, overflow: 'hidden' },
  setTint: { backgroundColor: 'rgba(48,209,88,0.14)', borderRadius: r.md },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.dim, alignItems: 'center', justifyContent: 'center' },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  nav: { height: 52, width: 52, borderRadius: 26, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  wide: { height: 52, minWidth: 128, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1F140C', borderRadius: r.lg, padding: 12 },
  restBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#3A2614', alignItems: 'center', justifyContent: 'center' },
  discard: { height: 48, alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
});
