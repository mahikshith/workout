import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeInDown, FadeOut, FadeOutDown, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime, isTimed, lastSets, secsOf } from '../src/calc';
import { alternatives, available, byId, exercises, title, type Exercise, type Place } from '../src/data/exercises';
import guide from '../src/data/guide.json';
import { gate } from '../src/engine';
import { useLiveHr } from '../src/health/live';
import { EASE, goBack, useElapsed } from '../src/kit';
import { reschedule, restAlert } from '../src/notify';
import { Sheet } from '../src/sheet';
import { useStore, type Profile, type Session, type SetLog } from '../src/store';
import { c, f, r } from '../src/theme';
import { Button, Demo, haptic, Ring, Row, Stepper, T, Tap, Thumb } from '../src/ui';

// The live workout (docs/REDESIGN.md "Workout", rules 6-7). It opens ready, with the clock stopped: the person can look
// through every exercise (demo, info, swap, add) and the one primary button, Start workout, starts the clock. Leaving a
// workout that was never started discards it quietly (nothing was logged, and a stale one would block starting another
// day). Once started, ⌄ or a swipe down minimises it into the tab bar's mini bar. The exercise on screen and the rest timer live in the store
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

// Seconds of the running workout right now, without pauses (read when a sheet opens; the clock itself ticks in Clock).
const elapsedOf = (a: Session | null) =>
  !a || a.running === false ? 0 : Math.max(0, Math.floor(((a.pausedAt ?? Date.now()) - a.startedAt - (a.pausedMs ?? 0)) / 1000));

// The live clock in the header. It is the only part of the header that re-renders every second.
function Clock({ paused }: { paused: boolean }) {
  const elapsed = useElapsed();
  return (
    <T style={{ fontFamily: f.bold, fontSize: 18, fontVariant: ['tabular-nums'] }} color={paused ? c.muted : c.text}>
      {paused ? `Paused · ${fmtTime(elapsed)}` : fmtTime(elapsed)}
    </T>
  );
}

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
  const live = useStore((s) => s.active);
  // While the screen leaves after Finish, Discard or closing a ready workout, it keeps showing the last workout instead
  // of going blank mid-animation.
  const leaving = useRef(false);
  const snap = useRef(live);
  if (live) snap.current = live;
  const active = live ?? (leaving.current ? snap.current : null);
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const { updateSet, addSet, removeSet, swap, addItem, finish, discard, pause, resume, setIdx, setRest, begin } = useStore.getState();
  const nav = useNavigation();
  const bpm = useLiveHr();

  const [sheet, setSheet] = useState<'swap' | 'finish' | 'info' | 'add' | null>(null);
  const last = useRef(sheet);
  if (sheet) last.current = sheet;
  const kind = last.current; // keeps sheet content on screen while it slides away

  const restUntil = active?.restUntil ?? null;
  const restTotal = active?.restTotal ?? 90;
  const pausedAt = active?.pausedAt;

  // When an exercise is added, jump straight to it so the user sees it landed.
  const count = active?.items.length ?? 0;
  const seen = useRef(count);
  useEffect(() => { if (count > seen.current) setIdx(count - 1); seen.current = count; }, [count]);

  // Rest over (RestPanel watches the clock): warning haptic, "Go" for a moment, then the bottom bar returns. A rest
  // that ran out while the workout was minimised is cleared quietly.
  const [ending, setEnding] = useState(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (endTimer.current) clearTimeout(endTimer.current); }, []);
  const restEnded = (late: boolean) => {
    setRest(null);
    if (late) return;
    restEndHaptic();
    setEnding(true);
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => setEnding(false), 900);
  };

  // Swipe down on the header minimises the workout, like the ⌄ button. The header follows the finger unless reduced
  // motion is on.
  const drag = useSharedValue(0);
  const minimise = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-24, 24])
    .onUpdate((e) => { if (!still) drag.value = Math.max(0, e.translationY) * 0.5; })
    .onEnd((e) => {
      const go = e.translationY > 80 || e.velocityY > 800;
      drag.value = still ? 0 : withSpring(0, { damping: 20, stiffness: 260 });
      if (go) runOnJS(goBack)();
    });
  const headerDrag = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));

  // A fast second tap on the same ✓ (within 400 ms) is ignored, so a double tap never logs and un-logs a set.
  const lastTick = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  // Opened with no workout running (old link, notification): step back. After Finish or Discard the screen leaves on
  // its own, so this must not also redirect (it would race the move to the summary).
  useEffect(() => { if (!live && !leaving.current) goBack(); }, [!live]);

  // Closing a workout that never started (⌄, swipe down, system back) discards it at once: nothing was logged, no mini
  // bar is left behind, and the next Start opens a fresh one. The screen keeps showing it while it slides away.
  useEffect(() => nav.addListener('beforeRemove', () => {
    const a = useStore.getState().active;
    if (a && a.running === false) { leaving.current = true; restAlert(null); useStore.getState().discard(); }
  }), [nav]);
  if (!active) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const ready = active.running === false; // opened but not started: browse only, no logging
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
  const elapsed = elapsedOf(active); // fresh whenever the screen re-renders (a sheet opening, a set logged)

  // Pausing freezes the rest countdown too: on resume its deadline moves by the paused time.
  const doPause = () => { pause(); restAlert(null); haptic('medium'); };
  const doResume = () => {
    const a = useStore.getState().active;
    const gap = Date.now() - (a?.pausedAt ?? Date.now());
    resume();
    if (a?.restUntil) { setRest(a.restUntil + gap); restAlert((a.restUntil + gap - Date.now()) / 1000); }
    haptic('medium');
  };
  // Start workout: the clock runs from this tap (begin() ignores a second tap).
  const doBegin = () => { if (useStore.getState().active?.running !== false) return; begin(); haptic('medium'); };
  const startRest = (secs: number) => { setRest(Date.now() + secs * 1000, secs); restAlert(secs); };
  const changeRest = (until: number, tot?: number) => { setRest(until, tot); restAlert((until - Date.now()) / 1000); };
  const skipRest = () => { setRest(null); restAlert(null); };

  function toggle(j: number) {
    const key = `${idx}:${j}`;
    const t = Date.now();
    if (ready || (lastTick.current.key === key && t - lastTick.current.at < 400)) return;
    lastTick.current = { key, at: t };
    const was = it.sets[j].done;
    if (paused) doResume();
    updateSet(idx, j, { done: !was });
    if (!was) { haptic('light'); startRest(it.rest); }
    else { skipRest(); setEnding(false); } // un-logging a set cancels the rest it started
  }

  function save() {
    restAlert(null);
    leaving.current = true;
    const s = finish();
    setSheet(null);
    reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (s) router.replace({ pathname: '/summary', params: { id: s.id } });
    else goBack();
  }
  function drop() { restAlert(null); leaving.current = true; discard(); setSheet(null); goBack(); }
  const short = done === 0 && elapsed < 120;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 6 }}>
      {/* Header: minimise, live clock (and heart rate), Finish. */}
      <GestureDetector gesture={minimise}>
      <Animated.View style={headerDrag}>
      <Row style={{ paddingHorizontal: 12, height: 52 }} gap={8}>
        {/* The clock is centred on the screen, not between the uneven side buttons. */}
        <View pointerEvents="none" style={s.centre}>
          {ready ? (
            <T style={{ fontFamily: f.bold, fontSize: 18 }} numberOfLines={1}>Ready</T>
          ) : (
            <View>
              {/* The live dot hangs left of the time, so the time itself sits on the centre line. */}
              {!paused && <View style={s.live} />}
              <Clock paused={paused} />
            </View>
          )}
        </View>
        <Tap onPress={goBack} style={s.icon} scale={0.9} feedback="none" accessibilityLabel={ready ? 'Close' : 'Minimise workout'}>
          <Ionicons name="chevron-down" size={22} color={c.text} />
        </Tap>
        <View style={{ flex: 1 }} />
        {bpm != null && (
          <Row gap={4} style={{ marginRight: 4 }}>
            <Ionicons name="heart" size={14} color={c.pink} />
            <T style={{ fontFamily: f.bold, fontSize: 14, fontVariant: ['tabular-nums'] }} color={c.pink}>{bpm}</T>
          </Row>
        )}
        {!ready && (
          <Tap onPress={() => setSheet('finish')} style={[s.finish, { backgroundColor: c.accent }]} scale={0.95}>
            <T style={{ fontFamily: f.bold, fontSize: 15 }} color={c.accentInk}>Finish</T>
          </Tap>
        )}
      </Row>
      </Animated.View>
      </GestureDetector>

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
              {lastLine ? <T v="small">{lastLine}</T>
                : showWeight && it.sets[0]?.weight > 0 ? <T v="small">{`First time · start light at ${it.sets[0].weight} kg`}</T> : null}
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
              <SetRow key={j} n={j + 1} done={x.done} still={still} locked={ready}
                onRemove={() => it.sets.length > 1 && removeSet(idx, j)} onTick={() => toggle(j)}
                weight={showWeight ? <Stepper value={x.weight} step={2.5} min={0} onChange={(weight) => updateSet(idx, j, { weight })} /> : null}
                reps={timed ? (
                  <SetTimer key={`${it.exId}-${j}`} locked={ready} value={x.reps} target={secsOf(it.target) ?? x.reps} done={x.done}
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
            <Tap onPress={() => setSheet('add')} style={s.text}>
              <T v="h3" color={c.muted}>Add exercise</T>
            </Tap>
          </Row>
        </Animated.View>
      </ScrollView>

      <View style={[s.bottom, { paddingBottom: ins.bottom + 12 }]}>
        {ready ? (
          <Animated.View exiting={FadeOut.duration(150)} style={{ gap: 10 }}>
            <T v="small" style={{ textAlign: 'center' }}>Look through the moves. The clock starts when you do.</T>
            <Row gap={10}>
              <Tap onPress={() => setIdx(idx - 1)} disabled={idx === 0} style={[s.nav, idx === 0 && s.off]} accessibilityLabel="Previous exercise">
                <Ionicons name="chevron-back" size={22} color={c.text} />
              </Tap>
              <Tap onPress={doBegin} style={[s.wide, { flex: 1, backgroundColor: c.accent }]} scale={0.97} feedback="none" accessibilityLabel="Start workout">
                <Ionicons name="play" size={20} color={c.accentInk} />
                <T v="h3" color={c.accentInk}>Start workout</T>
              </Tap>
              <Tap onPress={() => setIdx(idx + 1)} disabled={isLast} style={[s.nav, isLast && s.off]} accessibilityLabel="Next exercise">
                <Ionicons name="chevron-forward" size={22} color={c.text} />
              </Tap>
            </Row>
          </Animated.View>
        ) : restUntil || ending ? (
          <RestPanel until={restUntil} total={restTotal} pausedAt={pausedAt} ending={ending} still={still} onEnded={restEnded}
            onPause={pausedAt ? doResume : doPause}
            onLess={() => restUntil && changeRest(Math.max(Date.now() + 1000, restUntil - 15000))}
            onMore={() => restUntil && changeRest(restUntil + 15000, restTotal + 15)}
            onSkip={() => { skipRest(); setEnding(false); }} />
        ) : (
          <Animated.View entering={FadeIn.duration(200)}>
          <Row gap={10}>
            <Tap onPress={paused ? doResume : doPause} style={[s.nav, paused && { backgroundColor: c.accent }]} feedback="none"
              accessibilityLabel={paused ? 'Resume workout' : 'Pause workout'}>
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color={paused ? c.accentInk : c.text} />
            </Tap>
            <Tap onPress={() => setIdx(idx - 1)} disabled={idx === 0} style={[s.nav, idx === 0 && s.off]} accessibilityLabel="Previous exercise">
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
          </Animated.View>
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
        {kind === 'add' && <AddPicker place={active.place} profile={profile} sessions={sessions} onPick={(id) => { addItem(id); haptic('light'); setSheet(null); }} />}
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

// The rest timer at the bottom. It owns the 250 ms clock, so only this panel re-renders while resting; the countdown
// freezes while paused. When it reaches zero it tells the screen (late = it ran out while minimised) and pulses.
function RestPanel({ until, total, pausedAt, ending, still, onEnded, onPause, onLess, onMore, onSkip }: {
  until: number | null; total: number; pausedAt?: number; ending: boolean; still: boolean; onEnded: (late: boolean) => void;
  onPause: () => void; onLess: () => void; onMore: () => void; onSkip: () => void;
}) {
  const now = useNow(until && !pausedAt ? 250 : 1000);
  const left = until ? Math.max(0, until - (pausedAt ?? now)) : 0;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!until || pausedAt || until > now) return;
    const late = now - until > 2000;
    onEnded(late);
    if (!late && !still) pulse.value = withSequence(withTiming(1.12, { duration: 160 }), withTiming(0.96, { duration: 160 }), withSpring(1, { damping: 10, stiffness: 220 }));
  }, [now, until, pausedAt]);
  const ringPulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View entering={FadeInDown.duration(320).easing(EASE)} exiting={FadeOutDown.duration(200)} style={s.rest}>
      <Animated.View style={ringPulse}>
        <Ring size={64} stroke={7} progress={left / (total * 1000)} color={c.warm}>
          <T style={{ fontFamily: f.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}>{ending ? 'Go' : fmtTime(Math.ceil(left / 1000))}</T>
        </Ring>
      </Animated.View>
      <View style={{ flex: 1, gap: 8 }}>
        <T v="label" color={c.warm}>{ending ? 'Rest over' : pausedAt ? 'Rest · paused' : 'Rest'}</T>
        <Row gap={8}>
          {/* Pause works during rest too: the countdown freezes with the workout clock. */}
          <Tap onPress={onPause} disabled={ending} style={[s.restPause, pausedAt ? { backgroundColor: c.warm } : null]} feedback="none"
            accessibilityLabel={pausedAt ? 'Resume workout' : 'Pause workout'}>
            <Ionicons name={pausedAt ? 'play' : 'pause'} size={20} color={pausedAt ? c.accentInk : c.text} />
          </Tap>
          <Tap onPress={onLess} disabled={ending} style={s.restBtn}><T v="h3">−15</T></Tap>
          <Tap onPress={onMore} disabled={ending} style={s.restBtn}><T v="h3">+15</T></Tap>
          <Tap onPress={onSkip} style={[s.restBtn, { backgroundColor: c.warm }]}><T v="h3" color={c.accentInk}>Skip</T></Tap>
        </Row>
      </View>
    </Animated.View>
  );
}

// Add an exercise without leaving the workout: search, tap, and it lands at the end. Only moves this place and this
// person can do (gear, level and safety locks) are listed.
function AddPicker({ place, profile, sessions, onPick }: { place: Place; profile: Profile; sessions: Session[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const pool = useMemo(
    () => exercises.filter((e) => available(e, place, profile.gear) && !gate(e, profile, sessions.length).locked).sort((a, b) => a.name.localeCompare(b.name)),
    [place, profile, sessions.length],
  );
  const needle = q.trim().toLowerCase();
  const rows = needle ? pool.filter((e) => e.name.toLowerCase().includes(needle) || e.primary.some((m) => m.includes(needle))) : pool;
  return (
    <View style={{ gap: 10 }}>
      <T v="h2">Add exercise</T>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or muscle" placeholderTextColor={c.dim}
          style={s.searchInput} returnKeyType="search" autoCorrect={false} />
      </View>
      <FlatList data={rows} keyExtractor={(e) => e.id} style={{ height: 420 }} keyboardShouldPersistTaps="handled"
        initialNumToRender={10} windowSize={7} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        ListEmptyComponent={<T v="small" style={{ textAlign: 'center', marginTop: 24 }}>No match</T>}
        renderItem={({ item: e }) => (
          <Tap onPress={() => onPick(e.id)} style={s.alt} scale={0.98}>
            <Thumb ex={e} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3" numberOfLines={1}>{e.name}</T>
              <T v="small" numberOfLines={1}>{title(e.primary[0] ?? '')} · {title(e.equipment)}</T>
            </View>
            <Ionicons name="add-circle" size={22} color={c.accent} />
          </Tap>
        )} />
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
function SetRow({ n, done, still, locked, weight, reps, onTick, onRemove }: {
  n: number; done: boolean; still: boolean; locked?: boolean; weight: ReactNode; reps: ReactNode; onTick: () => void; onRemove: () => void;
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
        <Tap onPress={onTick} disabled={locked} style={[s.check, done && { backgroundColor: c.ok, borderColor: c.ok }, locked && s.off]} scale={0.9} feedback="none"
          accessibilityLabel={locked ? 'Start the workout to log sets' : done ? `Set ${n} logged` : `Log set ${n}`}>
          <Ionicons name="checkmark" size={22} color={done ? c.accentInk : c.dim} />
        </Tap>
      </Animated.View>
    </Animated.View>
  );
}

// A set timer for holds and cardio: nothing runs until the user taps play. It counts up to the target, then logs the
// set; stopping early logs what was done. Before starting, +/- adjusts the target time.
function SetTimer({ value, target, done, locked, onChange, onStart, onFinish }: {
  value: number; target: number; done: boolean; locked?: boolean; onChange: (n: number) => void; onStart: () => void; onFinish: (secs: number) => void;
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
        <Tap onPress={() => { onStart(); setSince(Date.now()); haptic('medium'); }} disabled={locked} style={[s.play, { backgroundColor: c.accent }, locked && s.off]} scale={0.9}>
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
  centre: { position: 'absolute', left: 64, right: 64, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  restPause: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3A2614', alignItems: 'center', justifyContent: 'center' },
  live: { position: 'absolute', left: -14, top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: r.md, backgroundColor: c.card2 },
  searchInput: { flex: 1, color: c.text, fontSize: 16, padding: 0 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
});
