import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, FlatList, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime, isTimed, lastSets, secsOf } from '../src/calc';
import { alternatives, available, byId, exercises, title, type Exercise, type Place } from '../src/data/exercises';
import guide from '../src/data/guide.json';
import { gate } from '../src/engine';
import { useLiveHr } from '../src/health/live';
import { useReadinessAdvice } from '../src/health/useReadiness';
import { EASE, goBack, useElapsed } from '../src/kit';
import { reschedule, restAlert } from '../src/notify';
import { ChangeList } from '../src/restday';
import { Sheet } from '../src/sheet';
import { useStore, type Item, type Profile, type Session, type SetLog } from '../src/store';
import { c, f, r, tint } from '../src/theme';
import { Button, Chip, Demo, haptic, Ring, Row, Stepper, T, Tap, Thumb } from '../src/ui';

// The live workout (docs/REDESIGN.md "Workout", rules 6-7). It opens ready, with the clock stopped: the person can look
// through every exercise (demo, info, swap, edit, change) and the one primary button, Start workout, starts the clock.
// Leaving a workout that was never started discards it quietly. Once started, ⌄ or a swipe down minimises it into the tab
// bar's mini bar. The exercise on screen and the rest timer live in the store (active.idx, active.restUntil) so the mini
// bar shows the same thing.
//
// The flow carries itself: each ✓ logs the set and starts the rest; when the last set of an exercise is logged the rest
// shows what is up next and, when it ends (or is skipped), the next exercise comes on screen. When every set is logged
// the workout saves itself after a short, cancellable beat. The only finish control on screen is Finish workout on the
// last exercise; everything else about the workout (edit, change, end early, discard) lives behind ⋯ in the header.

type Guide = { steps?: string[]; mistake?: string };
const GUIDE = guide as Record<string, Guide>;
const NO_WEIGHT = ['pelvic floor', 'stretching', 'mobility', 'eyes', 'desk', 'breathing', 'cardio'];
const SAVE_BEAT = 3000; // ms between the last set and the automatic save, while "Add more" can still stop it

type Kind = 'menu' | 'end' | 'discard' | 'swap' | 'info' | 'add' | 'edit' | 'change';
type Icon = keyof typeof Ionicons.glyphMap;

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

// The next exercise after `from` that still has sets to log (wrapping round to ones skipped earlier), or -1.
const nextOpen = (items: Item[], from: number) => {
  for (let k = 1; k < items.length; k++) {
    const n = (from + k) % items.length;
    if (items[n].sets.some((x) => !x.done)) return n;
  }
  return -1;
};

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
  // While the screen leaves after a save, Discard or closing a ready workout, it keeps showing the last workout instead
  // of going blank mid-animation.
  const leaving = useRef(false);
  const snap = useRef(live);
  if (live) snap.current = live;
  const active = live ?? (leaving.current ? snap.current : null);
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const { updateSet, addSet, removeSet, swap, addItem, finish, discard, pause, resume, setIdx, setRest, begin, replace } = useStore.getState();
  const nav = useNavigation();
  const bpm = useLiveHr();
  const advice = useReadinessAdvice(); // e.g. "Low readiness: take the easy version", shown before the clock starts
  const scroll = useRef<ScrollView>(null);

  const [sheet, setSheet] = useState<Kind | null>(null);
  const last = useRef(sheet);
  if (sheet) last.current = sheet;
  const kind = last.current; // keeps sheet content on screen while it slides away
  const sheetOpen = useRef(false);
  sheetOpen.current = !!sheet;
  const [swapAt, setSwapAt] = useState(0); // the exercise the swap sheet is for
  const [back, setBack] = useState<Kind | null>(null); // the sheet to return to after a swap or add opened from Edit
  const [addJump, setAddJump] = useState(false); // an exercise added from the workout itself comes on screen

  const restUntil = active?.restUntil ?? null;
  const restTotal = active?.restTotal ?? 90;
  const pausedAt = active?.pausedAt;

  // After a rest (it ended, was skipped, or ran out while minimised): if the person is still on the exercise whose set
  // started it and every set of that exercise is logged, the next exercise with sets left comes on screen. Nothing moves
  // if they went to another exercise meanwhile or have a sheet open.
  const moveOn = () => {
    const a = useStore.getState().active;
    if (!a || a.restFrom === undefined || sheetOpen.current) return;
    const from = a.restFrom;
    if ((a.idx ?? 0) !== from || !a.items[from] || a.items[from].sets.some((x) => !x.done)) return;
    const n = nextOpen(a.items, from);
    if (n >= 0) setIdx(n);
  };

  // Rest over (RestPanel watches the clock): warning haptic, "Go" for a moment, then the bottom bar returns. A rest
  // that ran out while the workout was minimised is cleared quietly.
  const [ending, setEnding] = useState(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (endTimer.current) clearTimeout(endTimer.current); }, []);
  const restEnded = (late: boolean) => {
    moveOn();
    setRest(null);
    if (late) return;
    restEndHaptic();
    setEnding(true);
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => setEnding(false), 900);
  };

  // A new exercise on screen starts at its top.
  const shown = active ? Math.min(active.idx ?? 0, active.items.length - 1) : 0;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: !still }); }, [shown]);

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

  // Opened with no workout running (old link, notification): step back. After a save or Discard the screen leaves on
  // its own, so this must not also redirect (it would race the move to the summary).
  useEffect(() => { if (!live && !leaving.current) goBack(); }, [!live]);

  // Closing a workout that never started (⌄, swipe down, system back) discards it at once: nothing was logged, no mini
  // bar is left behind, and the next Start opens a fresh one. The screen keeps showing it while it slides away.
  useEffect(() => nav.addListener('beforeRemove', () => {
    const a = useStore.getState().active;
    if (a && a.running === false) { leaving.current = true; restAlert(null); useStore.getState().discard(); }
  }), [nav]);

  // A workout left open (nothing logged for 3 hours) saves itself with what was logged when the app comes back to it.
  useEffect(() => {
    const check = () => {
      const r = useStore.getState().closeStale();
      if (!r) return;
      restAlert(null);
      leaving.current = true;
      setSheet(null);
      if (r === 'dropped') { goBack(); return; }
      reschedule(useStore.getState().profile, useStore.getState().sessions);
      router.replace({ pathname: '/summary', params: { id: r.id } });
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [live?.id]);

  // Every set logged: a 3 s beat ("All sets done · Saving…", with Add more to stay), then it saves. Logging, un-logging
  // or adding anything re-arms it; a sheet being open holds it.
  const total = active ? active.items.reduce((n, x) => n + x.sets.length, 0) : 0;
  const done = active ? active.items.reduce((n, x) => n + x.sets.filter((y) => y.done).length, 0) : 0;
  const ready = active?.running === false; // opened but not started: browse only, no logging
  const allDone = !!active && !ready && total > 0 && done === total;
  const [held, setHeld] = useState(false);
  useEffect(() => { setHeld(false); }, [done, total]);
  const saving = allDone && !held && !sheet;
  useEffect(() => {
    if (!saving) return;
    if (useStore.getState().active?.restUntil) { setRest(null); restAlert(null); }
    const t = setTimeout(() => save(), SAVE_BEAT);
    return () => clearTimeout(t);
  }, [saving]);

  if (!active) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const paused = !!pausedAt;
  const idx = shown;
  const it = active.items[idx];
  const ex = byId[it.exId];
  const timed = isTimed(it.target); // '30s' targets log seconds; drills with a hold still count reps
  const showWeight = !(NO_WEIGHT.includes(ex.category) || timed);
  const prev = lastSets(sessions, it.exId);
  const lastLine = lastText(prev, timed);
  const isLast = idx >= active.items.length - 1;
  const elapsed = elapsedOf(active); // fresh whenever the screen re-renders (a sheet opening, a set logged)
  // During a rest that follows the last set of an exercise, the panel says what comes next.
  const from = active.restFrom;
  const upNext = from !== undefined && from === idx && active.items[from]?.sets.every((x) => x.done) ? nextOpen(active.items, from) : -1;
  const nextName = upNext >= 0 ? byId[active.items[upNext].exId]?.name : undefined;

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
  const startRest = (secs: number, at: number) => { setRest(Date.now() + secs * 1000, secs, at); restAlert(secs); };
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
    if (was) { skipRest(); setEnding(false); return; } // un-logging a set cancels the rest it started
    haptic('light');
    const a = useStore.getState().active;
    if (a && a.items.every((x) => x.sets.every((y) => y.done))) { skipRest(); return; } // the save beat takes over
    startRest(it.rest, idx);
  }

  function save() {
    if (leaving.current) return;
    restAlert(null);
    leaving.current = true;
    const s = finish();
    setSheet(null);
    reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (s) router.replace({ pathname: '/summary', params: { id: s.id } });
    else goBack();
  }
  function drop() { restAlert(null); leaving.current = true; discard(); setSheet(null); goBack(); }
  // Keep going closes the sheet and, when this exercise is all logged, brings on the next one with sets left.
  function keepGoing() {
    setSheet(null);
    const a = useStore.getState().active;
    if (!a) return;
    const i = Math.min(a.idx ?? 0, a.items.length - 1);
    if (a.items[i].sets.every((x) => x.done)) { const n = nextOpen(a.items, i); if (n >= 0) setIdx(n); }
  }
  // Finish workout (last exercise): everything logged saves straight away; otherwise it asks first.
  const finishTap = () => (done === total && done > 0 ? save() : setSheet('end'));
  const addMore = () => { setHeld(true); setAddJump(true); setBack(null); setSheet('add'); };
  const openSwap = (i: number, from: Kind | null) => { setSwapAt(i); setBack(from); setSheet('swap'); };
  const swapIt = active.items[Math.min(swapAt, active.items.length - 1)];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 6 }}>
      {/* Header: minimise, live clock (and heart rate), workout options. */}
      <GestureDetector gesture={minimise}>
      <Animated.View style={headerDrag}>
      <Row style={{ paddingHorizontal: 12, height: 52 }} gap={8}>
        {/* The clock is centred on the screen, not between the side buttons. */}
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
        <Tap onPress={() => setSheet('menu')} style={s.icon} scale={0.9} accessibilityLabel="Workout options">
          <Ionicons name="ellipsis-horizontal" size={22} color={c.text} />
        </Tap>
      </Row>
      </Animated.View>
      </GestureDetector>

      {/* One segment per exercise; tap to jump. */}
      <Row style={{ paddingHorizontal: 12, marginTop: 8 }} gap={4}>
        {active.items.map((x, i) => {
          const fr = x.sets.length ? x.sets.filter((y) => y.done).length / x.sets.length : 0;
          return (
            <Tap key={i} onPress={() => setIdx(i)} style={{ flex: 1, height: 20, justifyContent: 'center' }} feedback="none"
              accessibilityLabel={`Exercise ${i + 1}`}>
              <View style={[s.seg, i === idx && { backgroundColor: c.dim }]}>
                <View style={{ width: `${fr * 100}%`, height: '100%', backgroundColor: c.accent, borderRadius: 2 }} />
              </View>
            </Tap>
          );
        })}
      </Row>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View key={it.exId + idx} entering={still ? undefined : FadeInDown.duration(300).easing(EASE)}>
          <T v="label">Exercise {idx + 1} of {active.items.length} · {title(ex.primary[0])} · {it.sets.length} × {it.target}</T>
          <Row style={{ alignItems: 'flex-start', marginTop: 4 }} gap={8}>
            <View style={{ flex: 1 }}>
              <T v="h2">{ex.name}</T>
              {lastLine ? <T v="small">{lastLine}</T>
                : showWeight && it.sets[0]?.weight > 0 ? <T v="small">{`First time · start light at ${it.sets[0].weight} kg`}</T> : null}
              {it.swappedFrom && byId[it.swappedFrom] && <T v="small" color={c.warm}>Alternative to {byId[it.swappedFrom].name}</T>}
              {ready && idx === 0 && advice && <T v="small" color={c.warm}>{advice}</T>}
            </View>
            <Tap onPress={() => setSheet('info')} style={s.info} accessibilityLabel="How to do it">
              <Ionicons name="information" size={20} color={c.text} />
            </Tap>
          </Row>

          <Demo ex={ex} height={200} paused={sheet === 'info'} style={{ marginTop: 12 }} />

          <View style={s.table}>
            <Row style={{ paddingHorizontal: 4, paddingBottom: 4 }} gap={4}>
              <T v="label" style={{ width: 28, textAlign: 'center' }}>Set</T>
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

          {/* Add set and Swap: two equal buttons under the sets. Swap asks why and ranks alternatives for it. */}
          <Row style={{ marginTop: 10 }} gap={10}>
            <Tap onPress={() => addSet(idx)} style={s.pill} scale={0.97} accessibilityLabel="Add set">
              <Ionicons name="add" size={20} color={c.text} />
              <T v="h3">Add set</T>
            </Tap>
            <Tap onPress={() => openSwap(idx, null)} style={s.pill} scale={0.97} accessibilityLabel={`Swap ${ex.name}`}>
              <Ionicons name="swap-horizontal" size={20} color={c.accent} />
              <T v="h3">Swap</T>
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
        ) : saving ? (
          <DonePanel still={still} onAddMore={addMore} />
        ) : restUntil || ending ? (
          <RestPanel until={restUntil} total={restTotal} pausedAt={pausedAt} ending={ending} still={still} next={nextName} onEnded={restEnded}
            onPause={pausedAt ? doResume : doPause}
            onLess={() => restUntil && changeRest(Math.max(Date.now() + 1000, restUntil - 15000))}
            onMore={() => restUntil && changeRest(restUntil + 15000, restTotal + 15)}
            onSkip={() => { moveOn(); skipRest(); setEnding(false); }} />
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
            {isLast || allDone ? (
              <Tap onPress={finishTap} style={[s.wide, { flex: 1, backgroundColor: c.text }]} accessibilityLabel="Finish workout">
                <T v="h3" color={c.bg} numberOfLines={1}>Finish workout</T><Ionicons name="checkmark" size={20} color={c.bg} />
              </Tap>
            ) : (
              <>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <T v="label" numberOfLines={1}>{done}/{total} sets</T>
                </View>
                <Tap onPress={() => setIdx(idx + 1)} style={[s.wide, { backgroundColor: c.text }]} accessibilityLabel="Next exercise">
                  <T v="h3" color={c.bg}>Next</T><Ionicons name="chevron-forward" size={20} color={c.bg} />
                </Tap>
              </>
            )}
          </Row>
          </Animated.View>
        )}
      </View>

      <Sheet open={!!sheet} onClose={() => { setSheet(back && (sheet === 'swap' || sheet === 'add') ? back : null); setBack(null); }}>
        {kind === 'menu' && (
          <View style={{ gap: 8 }}>
            <View style={{ gap: 2, marginBottom: 4 }}>
              <T v="h2" numberOfLines={1}>{active.title}</T>
              <T v="small">{ready ? `${active.items.length} exercises · not started` : `${done}/${total} sets · ${fmtTime(elapsed)}`}</T>
            </View>
            <MenuRow icon="create-outline" title="Edit workout" sub="Reorder, remove, add, change sets" onPress={() => setSheet('edit')} />
            <MenuRow icon="repeat" title="Change workout" sub="Another day or a quick session" onPress={() => setSheet('change')} />
            {!ready && (
              <MenuRow icon="flag-outline" title="End workout early" sub={done ? `Save the ${done} ${done === 1 ? 'set' : 'sets'} you logged` : 'Nothing logged yet'}
                onPress={() => (done === total && done > 0 ? save() : setSheet('end'))} />
            )}
            {!ready && (
              <MenuRow icon="trash-outline" color={c.danger} title="Discard workout" sub="Nothing from today is saved"
                onPress={() => (done ? setSheet('discard') : drop())} />
            )}
          </View>
        )}
        {kind === 'end' && (
          done === 0 ? (
            <View style={{ gap: 12 }}>
              <T v="h2">Discard this workout?</T>
              <T v="body" color={c.muted}>No sets logged · {fmtTime(elapsed)}</T>
              <Button title="Discard workout" kind="danger" icon="trash-outline" onPress={drop} />
              <Button title="Keep going" kind="ghost" onPress={keepGoing} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <T v="h2">End workout early?</T>
              <T v="body" color={c.muted}>{done} of {total} sets logged · {fmtTime(elapsed)}. Sets you didn't log aren't saved.</T>
              <Button title="Save and finish" icon="checkmark" onPress={save} />
              <Button title="Keep going" kind="ghost" onPress={keepGoing} />
              <Tap onPress={drop} style={s.discard}><T v="h3" color={c.danger}>Discard workout</T></Tap>
            </View>
          )
        )}
        {kind === 'discard' && (
          <View style={{ gap: 12 }}>
            <T v="h2">Discard this workout?</T>
            <T v="body" color={c.muted}>{done} logged {done === 1 ? 'set' : 'sets'} will be lost</T>
            <Button title="Discard workout" kind="danger" icon="trash-outline" onPress={drop} />
            <Button title="Keep going" kind="ghost" onPress={keepGoing} />
          </View>
        )}
        {kind === 'info' && <InfoSheet ex={ex} />}
        {kind === 'add' && (
          <AddPicker place={active.place} profile={profile} sessions={sessions} onPick={(id) => {
            addItem(id);
            haptic('light');
            if (addJump) setIdx(useStore.getState().active!.items.length - 1);
            setAddJump(false);
            setSheet(back ?? null);
            setBack(null);
          }} />
        )}
        {kind === 'swap' && swapIt && (
          <SwapSheet ex={byId[swapIt.exId]} place={active.place} profile={profile} sessionsDone={sessions.length}
            logged={swapIt.sets.filter((x) => x.done).length}
            onPick={(id) => {
              swap(Math.min(swapAt, active.items.length - 1), id);
              haptic('light');
              setSheet(back ?? null);
              setBack(null);
            }} />
        )}
        {kind === 'edit' && (
          <EditSheet items={active.items} idx={idx}
            onSwap={(i) => openSwap(i, 'edit')}
            onAdd={() => { setAddJump(false); setBack('edit'); setSheet('add'); }}
            onDone={() => setSheet(null)} />
        )}
        {kind === 'change' && (
          <ChangeList place={active.place} current={{ planId: active.planId, dayIndex: active.dayIndex, title: active.title }}
            note={done ? `Your ${done} logged ${done === 1 ? 'set stays' : 'sets stay'}` : undefined}
            onPick={(p) => { restAlert(null); setEnding(false); replace(p.day, p.place, p.planId, p.dayIndex); setSheet(null); }} />
        )}
      </Sheet>
    </View>
  );
}

// One row of the workout's ⋯ sheet.
function MenuRow({ icon, title: name, sub, color = c.text, onPress }: { icon: Icon; title: string; sub: string; color?: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={s.alt} scale={0.98} accessibilityLabel={name}>
      <View style={s.menuIcon}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="h3" color={color} numberOfLines={1}>{name}</T>
        <T v="small" numberOfLines={1}>{sub}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.dim} />
    </Tap>
  );
}

// Swap with a reason. The reason re-ranks the same pool of alternatives (same muscle and kind of move, allowed at this
// place and unlocked for this person): too hard → the same level or easier, easiest first; equipment busy → different
// equipment; hurts → lighter, guided or bodyweight options, no jumping or heavy free weights; no equipment → bodyweight.
type Why = 'hard' | 'busy' | 'hurts' | 'none';
const WHY: { id: Why; label: string; icon: Icon }[] = [
  { id: 'hard', label: 'Too hard', icon: 'trending-down' },
  { id: 'busy', label: 'Equipment busy', icon: 'time-outline' },
  { id: 'hurts', label: 'Hurts', icon: 'bandage-outline' },
  { id: 'none', label: 'No equipment', icon: 'body-outline' },
];
const LVL = { beginner: 0, intermediate: 1, expert: 2 } as const;
const GENTLE = ['machine', 'cable', 'bands', 'body only', 'exercise ball', 'foam roll'];
const HEAVY = ['barbell', 'e-z curl bar', 'kettlebells'];
// Moves of a different kind than the one being swapped (jumps, strongman, Olympic lifts for a plain strength move) only
// come in for "Equipment busy" or "No equipment", and below the like-for-like ones.
const ROUGH = ['plyometrics', 'strongman', 'olympic weightlifting'];

function rankSwaps(ex: Exercise, place: Place, profile: Profile, sessionsDone: number, why: Why | null): { e: Exercise; note: string }[] {
  const pool = alternatives(ex, why === 'none' ? 'home' : place, why === 'none' ? [] : profile.gear, 60)
    .filter((a) => !gate(a, profile, sessionsDone).locked);
  const eq = (a: Exercise) => title(a.equipment);
  const scored = pool.map((e, k) => {
    const rough = ROUGH.includes(e.category) && !ROUGH.includes(ex.category);
    let keep = !rough || why === 'busy' || why === 'none', score = -k * 0.01 + (e.category === ex.category ? 2 : 0) - (rough ? 4 : 0);
    let note = `${eq(e)} · ${e.level}`;
    if (why === 'hard') {
      keep &&= LVL[e.level] <= LVL[ex.level];
      score += (LVL[ex.level] - LVL[e.level]) * 3 + (GENTLE.includes(e.equipment) ? 1 : 0) + (e.mechanic === 'isolation' ? 0.5 : 0);
      note = LVL[e.level] < LVL[ex.level] ? `Easier · ${eq(e)}` : `${eq(e)} · ${e.level}`;
    } else if (why === 'busy') {
      keep &&= e.equipment !== ex.equipment;
      note = `${eq(e)} instead`;
    } else if (why === 'hurts') {
      keep &&= !HEAVY.includes(e.equipment) && e.category !== 'plyometrics' && e.level !== 'expert';
      score += (GENTLE.includes(e.equipment) ? 3 : 0) + (e.level === 'beginner' ? 1 : 0) + (e.mechanic === 'isolation' ? 1 : 0);
      note = `Gentler on joints · ${eq(e)}`;
    } else if (why === 'none') {
      note = 'No equipment';
    }
    return { e, note, score, keep };
  });
  return scored.filter((x) => x.keep).sort((a, b) => b.score - a.score).slice(0, 8).map(({ e, note }) => ({ e, note }));
}

function SwapSheet({ ex, place, profile, sessionsDone, logged, onPick }: {
  ex: Exercise; place: Place; profile: Profile; sessionsDone: number; logged: number; onPick: (id: string) => void;
}) {
  const [why, setWhy] = useState<Why | null>(null);
  const rows = useMemo(() => rankSwaps(ex, place, profile, sessionsDone, why), [ex.id, place, profile, sessionsDone, why]);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T v="h2" numberOfLines={2}>Swap {ex.name}</T>
        <T v="small" numberOfLines={1}>{logged ? `Your ${logged} logged ${logged === 1 ? 'set stays' : 'sets stay'} · ` : ''}What's wrong?</T>
      </View>
      <View style={s.chips}>
        {WHY.map((w) => <Chip key={w.id} label={w.label} icon={w.icon} on={why === w.id} onPress={() => setWhy(why === w.id ? null : w.id)} />)}
      </View>
      {why === 'hurts' && <T v="small" color={c.warm}>Stop if it still hurts. Lighter weight helps too.</T>}
      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8, paddingTop: 2 }}>
        {rows.length === 0 && (
          <T v="small" style={{ textAlign: 'center', marginVertical: 16 }}>
            {why === 'none' ? 'No bodyweight move for this muscle. Try Equipment busy.' : 'Nothing that fits. Try another reason.'}
          </T>
        )}
        {rows.map(({ e, note }) => (
          <Tap key={e.id} onPress={() => onPick(e.id)} style={s.alt} scale={0.98} accessibilityLabel={`Swap to ${e.name}`}>
            <Thumb ex={e} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3" numberOfLines={2}>{e.name}</T>
              <T v="small" numberOfLines={1}>{note}</T>
            </View>
            <Ionicons name="swap-horizontal" size={18} color={c.accent} />
          </Tap>
        ))}
      </ScrollView>
    </View>
  );
}

// Edit workout: move exercises up or down, remove ones not started, change how many sets, swap, add. Exercises with
// logged sets can't be removed (their sets would be lost) and never go below the sets already logged.
function EditSheet({ items, idx, onSwap, onAdd, onDone }: {
  items: Item[]; idx: number; onSwap: (i: number) => void; onAdd: () => void; onDone: () => void;
}) {
  const { moveItem, removeItem, setSetCount } = useStore.getState();
  return (
    <View style={{ gap: 10 }}>
      <T v="h2">Edit workout</T>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
        {items.map((it, i) => {
          const e = byId[it.exId];
          const logged = it.sets.filter((x) => x.done).length;
          const n = it.sets.length;
          return (
            <View key={`${it.exId}-${i}`} style={s.editRow}>
              <Row gap={10}>
                <T v="h3" color={i === idx ? c.accent : c.muted} style={{ width: 20, textAlign: 'center' }}>{i + 1}</T>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="h3" numberOfLines={1}>{e?.name ?? it.exId}</T>
                  <T v="small" numberOfLines={1}>{logged ? `${logged} of ${n} logged` : `${n} × ${it.target}`}</T>
                </View>
                <Tap onPress={() => onSwap(i)} style={s.smallPill} scale={0.95} accessibilityLabel={`Swap ${e?.name ?? ''}`}>
                  <Ionicons name="swap-horizontal" size={16} color={c.accent} />
                  <T v="small" color={c.text}>Swap</T>
                </Tap>
              </Row>
              <Row gap={6} style={{ marginTop: 8 }}>
                <Tap onPress={() => moveItem(i, -1)} disabled={i === 0} style={s.sq} scale={0.9} feedback="none" accessibilityLabel={`Move ${e?.name ?? ''} up`}>
                  <Ionicons name="arrow-up" size={18} color={c.text} />
                </Tap>
                <Tap onPress={() => moveItem(i, 1)} disabled={i === items.length - 1} style={s.sq} scale={0.9} feedback="none" accessibilityLabel={`Move ${e?.name ?? ''} down`}>
                  <Ionicons name="arrow-down" size={18} color={c.text} />
                </Tap>
                <View style={{ flex: 1 }} />
                <Tap onPress={() => setSetCount(i, n - 1)} disabled={n <= Math.max(1, logged)} style={s.sq} scale={0.9} feedback="none" accessibilityLabel="One set fewer">
                  <Ionicons name="remove" size={18} color={c.text} />
                </Tap>
                <T v="h3" style={{ minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{n} {n === 1 ? 'set' : 'sets'}</T>
                <Tap onPress={() => setSetCount(i, n + 1)} disabled={n >= 12} style={s.sq} scale={0.9} feedback="none" accessibilityLabel="One more set">
                  <Ionicons name="add" size={18} color={c.text} />
                </Tap>
                <Tap onPress={() => removeItem(i)} disabled={logged > 0 || items.length < 2} style={[s.sq, { marginLeft: 6 }]} scale={0.9}
                  accessibilityLabel={`Remove ${e?.name ?? ''}`}>
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </Tap>
              </Row>
            </View>
          );
        })}
      </ScrollView>
      <Row gap={10}>
        <Button title="Add exercise" kind="ghost" icon="add" onPress={onAdd} style={{ flex: 1, paddingHorizontal: 12 }} />
        <Button title="Done" onPress={onDone} style={{ flex: 1, paddingHorizontal: 12 }} />
      </Row>
    </View>
  );
}

// Every set logged: a short beat before the workout saves itself. The bar fills over the beat (or just waits, with
// reduced motion); Add more stops it and opens the exercise picker.
function DonePanel({ still, onAddMore }: { still: boolean; onAddMore: () => void }) {
  const p = useSharedValue(0);
  useEffect(() => { if (!still) p.value = withTiming(1, { duration: SAVE_BEAT, easing: Easing.linear }); }, []);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <Animated.View entering={still ? undefined : FadeInDown.duration(320).easing(EASE)} style={s.done}>
      <Row gap={12}>
        <View style={[s.doneIcon, { backgroundColor: c.accent }]}><Ionicons name="checkmark-done" size={22} color={c.accentInk} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" numberOfLines={1}>All sets done</T>
          <T v="small" numberOfLines={1}>Saving…</T>
        </View>
        <Tap onPress={onAddMore} style={s.addMore} scale={0.95} accessibilityLabel="Add more">
          <Ionicons name="add" size={18} color={c.text} />
          <T v="h3">Add more</T>
        </Tap>
      </Row>
      <View style={s.track}>
        <Animated.View style={[s.trackFill, { backgroundColor: c.accent }, still ? { transform: [{ scaleX: 1 }], opacity: 0.4 } : fill]} />
      </View>
    </Animated.View>
  );
}

// The rest timer at the bottom. It owns the 250 ms clock, so only this panel re-renders while resting; the countdown
// freezes while paused. When it reaches zero it tells the screen (late = it ran out while minimised) and pulses. After
// the last set of an exercise it says what is up next; the screen moves there when the rest ends or is skipped.
function RestPanel({ until, total, pausedAt, ending, still, next, onEnded, onPause, onLess, onMore, onSkip }: {
  until: number | null; total: number; pausedAt?: number; ending: boolean; still: boolean; next?: string; onEnded: (late: boolean) => void;
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
    <Animated.View entering={still ? undefined : FadeInDown.duration(320).easing(EASE)} exiting={still ? undefined : FadeOutDown.duration(200)} style={s.rest}>
      <Animated.View style={ringPulse}>
        <Ring size={64} stroke={7} progress={left / (total * 1000)} color={c.warm}>
          <T style={{ fontFamily: f.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}>{ending ? 'Go' : fmtTime(Math.ceil(left / 1000))}</T>
        </Ring>
      </Animated.View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <T v="label" color={c.warm} numberOfLines={1}>
          {next ? `Up next · ${next}` : ending ? 'Rest over' : pausedAt ? 'Rest · paused' : 'Rest'}
        </T>
        <Row gap={8}>
          {/* Pause works during rest too: the countdown freezes with the workout clock. */}
          <Tap onPress={onPause} disabled={ending} style={[s.restPause, pausedAt ? { backgroundColor: c.warm } : null]} feedback="none"
            accessibilityLabel={pausedAt ? 'Resume workout' : 'Pause workout'}>
            <Ionicons name={pausedAt ? 'play' : 'pause'} size={20} color={pausedAt ? c.accentInk : c.text} />
          </Tap>
          <Tap onPress={onLess} disabled={ending} style={s.restBtn}><T v="h3">−15</T></Tap>
          <Tap onPress={onMore} disabled={ending} style={s.restBtn}><T v="h3">+15</T></Tap>
          <Tap onPress={onSkip} style={[s.restBtn, { backgroundColor: c.warm }]} accessibilityLabel={next ? 'Skip rest, next exercise' : 'Skip rest'}>
            <T v="h3" color={c.accentInk}>Skip</T>
          </Tap>
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
      <Tap onPress={onRemove} feedback="none" style={{ width: 28, alignItems: 'center' }}>
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
  centre: { position: 'absolute', left: 64, right: 64, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  restPause: { width: 44, height: 44, borderRadius: 22, backgroundColor: tint(c.warm, 1.8), alignItems: 'center', justifyContent: 'center' },
  live: { position: 'absolute', left: -14, top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  seg: { height: 4, borderRadius: 2, backgroundColor: c.card2, overflow: 'hidden' },
  pill: { flex: 1, height: 48, borderRadius: 24, backgroundColor: c.card2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  smallPill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sq: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  editRow: { padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tiny: { width: 28, height: 32, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  table: { marginTop: 16, backgroundColor: c.card, borderRadius: r.lg, borderWidth: 1, borderColor: c.line, paddingVertical: 12, paddingHorizontal: 4, gap: 6 },
  set: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 6, borderRadius: r.md, overflow: 'hidden' },
  setTint: { backgroundColor: tint(c.ok, 0.9), borderRadius: r.md },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.dim, alignItems: 'center', justifyContent: 'center' },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  nav: { height: 52, width: 52, borderRadius: 26, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  wide: { height: 52, minWidth: 128, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: tint(c.warm, 0.8), borderWidth: 1, borderColor: tint(c.warm, 1.6), borderRadius: r.lg, padding: 12 },
  restBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: tint(c.warm, 1.8), alignItems: 'center', justifyContent: 'center' },
  done: { gap: 12, backgroundColor: c.card, borderRadius: r.lg, padding: 12, borderWidth: 1, borderColor: c.line },
  doneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addMore: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: c.card2, overflow: 'hidden' },
  trackFill: { height: 4, width: '100%', borderRadius: 2, transformOrigin: 'left' },
  discard: { height: 48, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: r.md, backgroundColor: c.card2 },
  searchInput: { flex: 1, color: c.text, fontSize: 16, padding: 0 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
});
