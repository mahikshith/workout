import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapped, MuscleMap, RED, SOFT } from '../../src/body';
import { bestBefore, doneNote, doneRecently } from '../../src/calc';
import { alternatives, available, byId, HOME_GEAR, title, type Exercise } from '../../src/data/exercises';
import guide from '../../src/data/guide.json';
import { benefit, dose, doseText, ease, effort, focusOf, harder, kcal, office, restText } from '../../src/data/muscles';
import { gate, hidden } from '../../src/engine';
import { Sheet } from '../../src/sheet';
import { useStore } from '../../src/store';
import { c, equip, r } from '../../src/theme';
import { Button, Card, Demo, Rise, Row, Screen, Stat, T, Tap, Thumb } from '../../src/ui';

// Hand-written coaching per exercise (src/data/guide.json); anything missing falls back to the dataset's steps.
type Guide = { steps?: string[]; hands?: string; arms?: string; legs?: string; back?: string; breathe?: string; mistake?: string };
const GUIDE = guide as Record<string, Guide>;
const POSE: [Exclude<keyof Guide, 'steps'>, string][] = [
  ['hands', 'Hands and wrists'], ['arms', 'Arms and elbows'], ['legs', 'Legs and feet'], ['back', 'Back and core'],
  ['breathe', 'Breathing'], ['mistake', 'Common mistake'],
];

const places = (e: Exercise) =>
  ['eyes', 'desk', 'breathing', 'pelvic floor'].includes(e.category) ? ['Anywhere']
  : ['Gym', ...(available(e, 'home', [...HOME_GEAR]) ? ['Home'] : []), ...(office(e) ? ['Office'] : [])];

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ins = useSafeAreaInsets();
  const ex = byId[id];
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const { startSingle, setProfile, addItem } = useStore.getState();
  const inWorkout = !!active?.items.some((x) => x.exId === id);
  const [tab, setTab] = useState<'gym' | 'home'>(profile.place === 'home' ? 'home' : 'gym');
  const [sheet, setSheet] = useState(false);
  // Pause the animated figure once it is scrolled out of view: the page below then scrolls without the figure redrawing.
  const [away, setAway] = useState(false);
  const awayRef = useRef(false);
  const onScroll = (y: number) => { const v = y > 420; if (v !== awayRef.current) { awayRef.current = v; setAway(v); } };
  if (!ex) return null;
  const g = GUIDE[ex.id];
  const steps = g?.steps?.length ? g.steps : ex.steps.slice(0, 5);
  const pose = POSE.filter(([k]) => g?.[k]);
  const lock = gate(ex, profile, sessions.length);
  const best = bestBefore(sessions, ex.id);
  const at = doneRecently(sessions).get(ex.id);
  // Best matches the person can do now, shown easiest first; the closest harder match is the next level.
  const pool = tab === 'gym' ? alternatives(ex, 'gym', [], 40) : alternatives(ex, 'home', profile.gear, 40);
  const alts = pool.filter((a) => !gate(a, profile, sessions.length).locked).slice(0, 3).sort((a, b) => ease(a) - ease(b));
  const next = pool.find((a) => harder(a, ex) && !hidden(a, profile) && !alts.includes(a));
  const nextLock = next && gate(next, profile, sessions.length);
  const d = dose(ex);
  const eq = equip(ex.equipment);
  const fo = focusOf(ex);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen onScroll={onScroll}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
          <T v="label">{title(ex.category)}</T>
          <View style={{ width: 40 }} />
        </Row>

        <Rise>
          <T v="h1" style={{ marginTop: 14 }}>{ex.name}</T>
          <Row style={{ flexWrap: 'wrap', marginTop: 8 }} gap={8}>
            <View style={s.tag}><T v="small" color={c.text}>{title(ex.level)}</T></View>
            <View style={[s.tag, { backgroundColor: eq.color + '22' }]}><T v="small" color={eq.color}>{eq.label}</T></View>
            {places(ex).map((b) => <View key={b} style={s.tag}><T v="small" color={c.text}>{b}</T></View>)}
          </Row>
          {at !== undefined && (
            <Row gap={8} style={[s.done, { borderColor: c.ok + '66' }]}>
              <Ionicons name="checkmark-circle" size={18} color={c.ok} />
              <T v="small" color={c.text} style={{ flex: 1 }}>{`You did this ${doneNote(at).day}. It shows as done for a week, then counts as fresh again in ${doneNote(at).left} day${doneNote(at).left > 1 ? 's' : ''}. You can still train it any time.`}</T>
            </Row>
          )}
        </Rise>
        <Rise i={1}><Demo ex={ex} height={300} credit paused={away} style={{ marginTop: 14 }} /></Rise>

        {ex.primary.some(mapped) && (
          <Rise i={1}>
            <Card style={{ marginTop: 14, alignItems: 'center', gap: 14 }}>
              <MuscleMap primary={ex.primary} secondary={ex.secondary} size={200} />
              <View style={{ alignSelf: 'stretch', gap: 6 }}>
                <Legend text={`Main: ${ex.primary.map(title).join(', ')}`} />
                {ex.secondary.length > 0 && <Legend faint text={`Also: ${ex.secondary.map(title).join(', ')}`} />}
              </View>
            </Card>
          </Rise>
        )}

        <Rise i={2}>
          <T color={c.muted} style={{ marginTop: 18 }}>{benefit(ex)}</T>
          {best.e1rm > 0 && <T v="small" color={c.accent} style={{ marginTop: 10 }}>Your best: {Math.round(best.e1rm)} kg estimated 1RM</T>}
          <Card style={{ marginTop: 14, gap: 14 }}>
            <T v="h3">Your dose</T>
            <Row gap={16}><Stat label={d.sets > 1 ? 'Sets x reps' : 'Do'} value={doseText(d)} /><Stat label="Rest" value={restText(d)} /></Row>
            <Row gap={16}><Stat label="Effort" value={effort(ex)} /><Stat label="All sets, approx." value={`~${kcal(ex, profile.weightKg)}`} unit="kcal" /></Row>
            {fo && <T v="small"><T v="small" color={c.text}>Focus: {fo.label}.</T> {fo.about}</T>}
          </Card>
        </Rise>

        {steps.length > 0 && (
          <Rise i={3}>
            <T v="h3" style={s.section}>How to do it</T>
            <Card style={{ gap: 14 }}>
              {steps.map((step, i) => (
                <Row key={i} style={{ alignItems: 'flex-start' }}>
                  <View style={[s.num, { backgroundColor: c.accent }]}><T v="small" color={c.accentInk}>{i + 1}</T></View>
                  <T style={{ flex: 1 }}>{step}</T>
                </Row>
              ))}
            </Card>
          </Rise>
        )}

        {pose.length > 0 && (
          <Rise i={4}>
            <T v="h3" style={s.section}>Body position</T>
            <Card style={{ gap: 14 }}>
              {pose.map(([k, label]) => (
                <View key={k} style={{ gap: 2 }}>
                  <T v="label" color={k === 'mistake' ? c.warm : c.muted}>{label}</T>
                  <T>{g?.[k]}</T>
                </View>
              ))}
            </Card>
          </Rise>
        )}

        <Rise i={5}>
          <T v="h3" style={s.section}>Alternatives</T>
          <View style={s.tabs}>
            {(['gym', 'home'] as const).map((k) => (
              <Tap key={k} onPress={() => setTab(k)} scale={0.98} style={[s.tab, tab === k && { backgroundColor: c.line }]}>
                <T v="h3" color={tab === k ? c.text : c.muted}>{k === 'gym' ? 'At the gym' : 'At home'}</T>
              </Tap>
            ))}
          </View>
          <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ gap: 8, marginTop: 10 }}>
            {alts.length ? alts.map((a, i) => <Alt key={a.id} a={a} tag={i === 0 && alts.length > 1 ? 'Easiest' : undefined} />)
              : <T v="small">No close match {tab === 'home' ? 'with your home gear' : 'here'} yet.</T>}
            {next && (
              <>
                <T v="h3" style={{ marginTop: 14 }}>Next level</T>
                <Alt a={next} locked={nextLock?.locked}
                  note={nextLock?.sessionsLeft ? `Opens after ${nextLock.sessionsLeft} more session${nextLock.sessionsLeft > 1 ? 's' : ''}` : undefined} />
              </>
            )}
          </Animated.View>
        </Rise>
        <View style={{ height: lock.locked ? 70 : active ? 60 : 0 }} />
      </Screen>

      <View style={[s.bottom, { paddingBottom: ins.bottom + 12 }]}>
          {lock.locked ? (
            <View style={s.lock}>
              <Row gap={10}><Ionicons name="lock-closed" size={18} color={c.muted} /><T v="h3" style={{ flex: 1 }}>{lock.title}</T></Row>
              <T v="small" style={{ marginTop: 6 }}>{lock.reason}</T>
              {!lock.safety && (
                <Tap onPress={() => setSheet(true)} feedback="none" style={{ marginTop: 6, paddingVertical: 6, alignSelf: 'flex-start' }}>
                  <T v="small" color={c.text} style={{ textDecorationLine: 'underline' }}>{"I've trained before"}</T>
                </Tap>
              )}
            </View>
          ) : active ? (
            // A workout is already open: add this move to it (or go back to it) instead of hiding the button.
            <Button title={inWorkout ? 'Back to your workout' : 'Add to your workout'} icon={inWorkout ? 'arrow-forward' : 'add'}
              onPress={() => { if (!inWorkout) addItem(ex.id); router.push('/session'); }} />
          ) : (
            <Button title="Train this now" icon="play"
              onPress={() => { startSingle(ex.id, profile.place === 'home' ? 'home' : 'gym'); router.push('/session'); }} />
          )}
      </View>

      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <View style={{ gap: 12 }}>
          <T v="h2">Trained before?</T>
          <T color={c.muted}>
            Most people who jump straight in get sore, frustrated and quit. Usually in that order. If you have trained for a while,
            change your level and this move opens up.
          </T>
          <Button title="Keep it locked" onPress={() => setSheet(false)} />
          <Button title="Change my level" kind="ghost"
            onPress={() => { setProfile({ ...profile, level: ex.level === 'expert' ? 'advanced' : 'intermediate' }); setSheet(false); }} />
        </View>
      </Sheet>
    </View>
  );
}

const Legend = ({ text, faint }: { text: string; faint?: boolean }) => (
  <Row gap={8}><View style={[s.dot, faint && { backgroundColor: SOFT, opacity: 0.7 }]} /><T v="small" style={{ flex: 1 }}>{text}</T></Row>
);

function Alt({ a, tag, locked, note }: { a: Exercise; tag?: string; locked?: boolean; note?: string }) {
  const q = equip(a.equipment);
  return (
    <Tap onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: a.id } })} style={s.alt} scale={0.98}>
      <Thumb ex={a} size={52} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="h3">{a.name}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {tag && <View style={[s.mini, { backgroundColor: c.accent + '22' }]}><T v="small" color={c.accent}>{tag}</T></View>}
          <View style={[s.mini, { backgroundColor: q.color + '22' }]}><T v="small" color={q.color}>{q.label}</T></View>
          <T v="small">{title(a.level)}</T>
        </Row>
        {note && <T v="small">{note}</T>}
      </View>
      <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={locked ? 16 : 18} color={c.muted} />
    </Tap>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  done: { marginTop: 10, padding: 10, borderRadius: r.md, borderWidth: 1, backgroundColor: c.card },
  tag: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: c.card2, justifyContent: 'center' },
  mini: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
  section: { marginTop: 26, marginBottom: 10 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  tab: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12,
    backgroundColor: 'rgba(10,10,11,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
  lock: { backgroundColor: c.card2, borderRadius: r.lg, padding: 16 },
});
