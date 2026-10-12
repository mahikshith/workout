import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtTime, isTimed, lastSets } from '../src/calc';
import { alternatives, byId, title } from '../src/data/exercises';
import { reschedule, restAlert } from '../src/notify';
import { gate } from '../src/engine';
import { Sheet } from '../src/sheet';
import { useStore } from '../src/store';
import { c, f, r } from '../src/theme';
import { Button, Demo, haptic, Ring, Row, Stepper, T, Tap, Thumb } from '../src/ui';

const useNow = (ms = 1000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
};

export default function SessionScreen() {
  const ins = useSafeAreaInsets();
  const active = useStore((s) => s.active);
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const { updateSet, addSet, removeSet, swap, finish, discard, begin, pause, resume } = useStore.getState();
  const [idx, setIdx] = useState(0);
  const [restUntil, setRestUntil] = useState<number | null>(null); // absolute deadline survives backgrounding
  const [restTotal, setRestTotal] = useState(90);
  const [sheet, setSheet] = useState<'swap' | 'end' | null>(null);
  const last = useRef(sheet);
  if (sheet) last.current = sheet;
  const kind = last.current; // keeps sheet content on screen while it slides away
  const now = useNow(restUntil ? 250 : 1000);

  const resting = restUntil && restUntil > now;
  useEffect(() => { if (restUntil && restUntil <= now && !useStore.getState().active?.pausedAt) { haptic('success'); setRestUntil(null); } }, [now, restUntil]);

  if (!active) return <Redirect href="/" />;
  const started = active.running !== false;
  const paused = !!active.pausedAt;
  const elapsed = started ? Math.max(0, Math.floor(((active.pausedAt ?? now) - active.startedAt - (active.pausedMs ?? 0)) / 1000)) : 0;
  // Pausing freezes the rest countdown too: on resume its deadline moves by the paused time.
  const doPause = () => { pause(); if (restUntil) restAlert(null); haptic('medium'); };
  const doResume = () => { const gap = Date.now() - (active.pausedAt ?? Date.now()); resume(); if (restUntil) { setRestUntil(restUntil + gap); restAlert((restUntil + gap - Date.now()) / 1000); } haptic('medium'); };
  const it = active.items[Math.min(idx, active.items.length - 1)];
  const ex = byId[it.exId];
  const timed = isTimed(it.target); // '30s' targets log seconds; drills with a hold still count reps
  const showWeight = !(['pelvic floor', 'stretching', 'mobility', 'eyes', 'desk', 'breathing'].includes(ex.category) || (ex.equipment === 'body only' && timed));
  const prev = lastSets(sessions, it.exId);
  const total = active.items.reduce((n, x) => n + x.sets.length, 0);
  const done = active.items.reduce((n, x) => n + x.sets.filter((y) => y.done).length, 0);

  function toggle(j: number) {
    const was = it.sets[j].done;
    if (!started) begin();
    if (paused) doResume();
    updateSet(idx, j, { done: !was });
    if (!was) {
      haptic('success');
      const allDone = it.sets.every((x, k) => k === j || x.done);
      setRestTotal(it.rest);
      setRestUntil(Date.now() + it.rest * 1000);
      restAlert(it.rest);
      if (allDone && idx < active!.items.length - 1) setTimeout(() => setIdx(idx + 1), 600);
    }
  }

  function end() {
    restAlert(null);
    const s = finish();
    setSheet(null);
    reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (s) router.replace({ pathname: '/summary', params: { id: s.id } });
    else router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <Row style={{ paddingHorizontal: 12, justifyContent: 'space-between' }}>
        <Tap onPress={() => setSheet('end')} style={s.icon}><Ionicons name="close" size={22} color={c.text} /></Tap>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Row gap={6}><View style={s.live} /><T v="label" color={c.text} numberOfLines={1} style={{ flexShrink: 1 }}>{active.title}</T></Row>
          <T style={{ fontFamily: f.display, fontSize: 20 }}>{!started ? 'Ready' : paused ? 'Paused' : fmtTime(elapsed)}</T>
        </View>
        <Tap onPress={() => setSheet('end')} style={[s.finish, { backgroundColor: c.accent }]}><T v="h3" color={c.accentInk} numberOfLines={1}>Finish</T></Tap>
      </Row>

      <Row style={{ paddingHorizontal: 12, marginTop: 14 }} gap={4}>
        {active.items.map((x, i) => {
          const fr = x.sets.length ? x.sets.filter((y) => y.done).length / x.sets.length : 0;
          return (
            <Tap key={i} onPress={() => setIdx(i)} style={{ flex: 1, height: 18, justifyContent: 'center' }} feedback="none">
              <View style={[s.seg, i === idx && { backgroundColor: c.dim }]}>
                <View style={{ width: `${fr * 100}%`, height: '100%', backgroundColor: c.accent, borderRadius: 2 }} />
              </View>
            </Tap>
          );
        })}
      </Row>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        <Animated.View key={it.exId + idx} entering={FadeInDown.duration(300)}>
          <T v="label">Exercise {idx + 1} of {active.items.length} · {title(ex.primary[0])}</T>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
            <T v="h1" style={{ flex: 1 }}>{ex.name}</T>
            <Tap onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })} style={s.icon}><Ionicons name="information" size={20} color={c.text} /></Tap>
          </Row>
          {it.swappedFrom && <T v="small" color={c.warm}>Alternative to {byId[it.swappedFrom].name}</T>}
          <T v="small" style={{ marginTop: 4 }}>
            Target {it.sets.length} × {it.target}{prev ? `  ·  Last ${prev.map((p) => (p.weight ? `${p.weight}×${p.reps}` : p.reps)).join(' · ')}` : ''}
          </T>

          <Demo ex={ex} height={220} style={{ marginTop: 14 }} />

          <Row style={{ marginTop: 12 }} gap={10}>
            <Tap onPress={() => setSheet('swap')} style={s.pill}><Ionicons name="swap-horizontal" size={16} color={c.text} /><T v="small" color={c.text}>Alternatives</T></Tap>
            <Tap onPress={() => addSet(idx)} style={s.pill}><Ionicons name="add" size={16} color={c.text} /><T v="small" color={c.text}>Add set</T></Tap>
            <Tap onPress={() => router.push({ pathname: '/library', params: { pick: '1' } })} style={s.pill}><Ionicons name="list" size={16} color={c.text} /><T v="small" color={c.text}>Exercise</T></Tap>
          </Row>

          <View style={s.table}>
            <Row style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
              <T v="label" style={{ width: 22 }}>#</T>
              <T v="label" style={{ flex: 1, textAlign: 'center' }}>{timed ? 'Seconds' : 'Reps'}</T>
              {showWeight && <T v="label" style={{ flex: 1, textAlign: 'center' }}>Kg</T>}
              <View style={{ width: 44 }} />
            </Row>
            {it.sets.map((x, j) => (
              <Animated.View key={j} entering={FadeIn} style={[s.set, x.done && s.setDone]}>
                <Tap onPress={() => it.sets.length > 1 && removeSet(idx, j)} feedback="none" style={{ width: 22 }}><T v="h3" color={x.done ? c.accent : c.muted}>{j + 1}</T></Tap>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Stepper value={x.reps} step={timed ? 5 : 1} min={0} onChange={(reps) => updateSet(idx, j, { reps })} />
                </View>
                {showWeight && (
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Stepper value={x.weight} step={2.5} min={0} onChange={(weight) => updateSet(idx, j, { weight })} />
                  </View>
                )}
                <Tap onPress={() => toggle(j)} style={[s.check, x.done && { backgroundColor: c.accent, borderColor: c.accent }]} scale={0.85} feedback="none">
                  {x.done && <Ionicons name="checkmark" size={22} color={c.accentInk} />}
                </Tap>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[s.bottom, { paddingBottom: ins.bottom + 12 }]}>
        {!started || paused ? (
          <Animated.View entering={FadeInDown.duration(260).easing(Easing.bezier(0.32, 0.72, 0, 1))} style={{ gap: 8 }}>
            {paused && <T v="small" style={{ textAlign: 'center' }}>Paused at {fmtTime(elapsed)}. Take your time.</T>}
            <Tap onPress={() => { if (!started) { begin(); haptic('success'); } else doResume(); }} style={[s.big, { backgroundColor: c.accent }]} scale={0.98} feedback="none">
              <Ionicons name="play" size={26} color={c.accentInk} />
              <T v="h2" color={c.accentInk}>{started ? 'Resume' : 'Start workout'}</T>
            </Tap>
          </Animated.View>
        ) : resting ? (
          <Animated.View entering={FadeInDown.duration(320).easing(Easing.bezier(0.32, 0.72, 0, 1))} exiting={FadeOutDown.duration(200)} style={s.rest}>
            <Ring size={84} stroke={8} progress={(restUntil! - now) / (restTotal * 1000)} color={c.warm}>
              <T style={{ fontFamily: f.display, fontSize: 22 }}>{fmtTime(Math.ceil((restUntil! - now) / 1000))}</T>
            </Ring>
            <View style={{ flex: 1, gap: 8 }}>
              <T v="label" color={c.warm}>Resting · breathe</T>
              <Row gap={8}>
                <Tap onPress={() => { const t = Math.max(Date.now() + 1000, restUntil! - 15000); setRestUntil(t); restAlert((t - Date.now()) / 1000); }} style={s.restBtn}><T v="h3">−15</T></Tap>
                <Tap onPress={() => { setRestUntil(restUntil! + 15000); setRestTotal(restTotal + 15); restAlert((restUntil! + 15000 - Date.now()) / 1000); }} style={s.restBtn}><T v="h3">+15</T></Tap>
                <Tap onPress={() => { setRestUntil(null); restAlert(null); }} style={[s.restBtn, { backgroundColor: c.warm }]}><T v="h3" color={c.accentInk}>Skip</T></Tap>
              </Row>
            </View>
          </Animated.View>
        ) : (
          <Row gap={10}>
            <Tap onPress={doPause} style={[s.nav, { width: 64, height: 64, borderRadius: 32 }]} feedback="none"><Ionicons name="pause" size={26} color={c.text} /></Tap>
            <Tap onPress={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} style={s.nav}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T v="label">{done}/{total} sets</T>
            </View>
            {idx < active.items.length - 1 ? (
              <Tap onPress={() => setIdx(idx + 1)} style={[s.nav, { width: 140, flexDirection: 'row', gap: 6 }]}>
                <T v="h3">Next</T><Ionicons name="chevron-forward" size={20} color={c.text} />
              </Tap>
            ) : (
              <Tap onPress={() => setSheet('end')} style={[s.nav, { width: 140, flexDirection: 'row', gap: 6, backgroundColor: c.accent }]}><T v="h3" color={c.accentInk}>Finish</T><Ionicons name="checkmark" size={20} color={c.accentInk} /></Tap>
            )}
          </Row>
        )}
      </View>

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
          {kind === 'end' && (
            <View style={{ gap: 12 }}>
              <T v="h1">End workout?</T>
              <T v="body" color={c.muted}>{done ? `${done} sets logged. Finish to save them and see your summary.` : 'No sets logged yet.'}</T>
              <Button title="Finish & save" icon="checkmark" onPress={end} disabled={!done} />
              <Button title="Keep going" kind="ghost" onPress={() => setSheet(null)} />
              <Button title="Discard workout" kind="danger" onPress={() => { discard(); setSheet(null); router.back(); }} />
            </View>
          )}
          {kind === 'swap' && profile && (
            <View style={{ gap: 10 }}>
              <T v="h2">Alternatives to {ex.name}</T>
              <T v="small">Best matches for the same muscles, {active.place === 'home' ? 'using what you have at home' : 'at the gym'}.</T>
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

const s = StyleSheet.create({
  finish: { height: 40, minWidth: 88, paddingHorizontal: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  seg: { height: 4, borderRadius: 2, backgroundColor: c.card2, overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.card2 },
  table: { marginTop: 16, backgroundColor: c.card, borderRadius: r.lg, paddingVertical: 12, paddingHorizontal: 6, gap: 6 },
  set: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 16 },
  setDone: { backgroundColor: '#1C2410' },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.dim, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'rgba(10,10,11,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  big: { height: 68, borderRadius: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nav: { height: 56, width: 56, borderRadius: 28, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1F140C', borderRadius: r.lg, padding: 14 },
  restBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#3A2614', alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card2 },
});
