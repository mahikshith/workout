import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient, GlassBar } from '../../src/glass';
import { Empty, Header, Segmented, openWorkout, toToday, useHeaderSpace, useMiniBarSpace } from '../../src/kit';
import { Enter, plural, useOpenSession } from '../library';
import { mapped, MuscleMap, RED, SOFT } from '../../src/body';
import { bestBefore, doneNote, doneRecently } from '../../src/calc';
import { alternatives, available, byId, HOME_GEAR, title, type Exercise } from '../../src/data/exercises';
import guide from '../../src/data/guide.json';
import { benefit, dose, doseText, ease, effort, focusOf, harder, kcal, office, restText } from '../../src/data/muscles';
import { gate, hidden } from '../../src/engine';
import { Sheet } from '../../src/sheet';
import { useStore } from '../../src/store';
import { c, equip, r } from '../../src/theme';
import { Banner, Button, Card, Demo, Fold, Row, Screen, Section, T, Tap, Thumb, Tile } from '../../src/ui';

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
  // Alternatives replace this page instead of stacking another one (depth stays at most 2 below a tab). `origin`
  // remembers where the chain started, so "Back to ..." returns there in one tap.
  const { id, origin } = useLocalSearchParams<{ id: string; origin?: string }>();
  const start = origin && origin !== id ? byId[origin] : undefined;
  const hop = (to: string) => router.replace({ pathname: '/exercise/[id]', params: to === origin ? { id: to } : { id: to, origin: origin ?? id } });
  const toSession = useOpenSession();
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const ex = byId[id];
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const { startSingle, setProfile, addItem } = useStore.getState();
  const inWorkout = !!active?.items.some((x) => x.exId === id);
  // Alternatives open on the place in your profile (its one home) and follow it when it changes.
  const home = profile.place === 'home' ? 'home' : 'gym';
  const [tab, setTab] = useState<'gym' | 'home'>(home);
  useEffect(() => setTab(home), [home]);
  const [sheet, setSheet] = useState(false);
  // Pause the animated figure once it is scrolled out of view: the page below then scrolls without the figure redrawing.
  const [away, setAway] = useState(false);
  const awayRef = useRef(false);
  const onScroll = (y: number) => { const v = y > 340; if (v !== awayRef.current) { awayRef.current = v; setAway(v); } };
  if (!ex) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Exercise" /><Empty icon="barbell-outline" title="This page is no longer here" action="Back to Today" onPress={toToday} /></View>;
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

  const muscle = ex.primary[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Round 14: soft glows behind the page; the header and the action bar are glass and the page scrolls under both. */}
      <Ambient />
      <Header title={ex.name} glass />
      <Screen onScroll={onScroll} top={space + 4} bottom={lock.locked ? 0 : BAR}>
        {start && (
          <Enter>
            <Tap onPress={() => hop(start.id)} scale={0.97} style={[s.origin, { borderColor: c.accent }]}>
              <Ionicons name="return-up-back" size={16} color={c.accent} />
              <T v="small" color={c.text} numberOfLines={1} style={{ flexShrink: 1 }}>Back to {start.name}</T>
            </Tap>
          </Enter>
        )}
        {/* Media first, then the tags and numbers, then instructions on demand. */}
        <Enter i={1}><Demo ex={ex} height={260} credit paused={away} style={{ marginTop: 8 }} /></Enter>

        <Enter i={2}>
          <Row style={{ flexWrap: 'wrap', marginTop: 14 }} gap={8}>
            <View style={[s.tag, { backgroundColor: eq.color + '22' }]}><T v="small" color={eq.color}>{eq.label}</T></View>
            <View style={s.tag}><T v="small" color={c.text}>{title(ex.level)}</T></View>
            {muscle && <View style={s.tag}><T v="small" color={c.text}>{title(muscle)}</T></View>}
            <View style={s.tag}><T v="small" color={c.text}>{`${effort(ex)} effort`}</T></View>
          </Row>
          {at !== undefined && (
            <View style={{ marginTop: 12 }}><Banner icon="checkmark-circle" color={c.ok} title={`Done ${doneNote(at).day} · ready again in ${plural(doneNote(at).left, 'day')}`} /></View>
          )}
          <Row gap={10} style={{ marginTop: 16 }}>
            <Tile icon="repeat" value={doseText(d)} label={d.sets > 1 ? 'Sets × reps' : 'Do'} />
            <Tile icon="timer-outline" color={c.blue} value={restText(d)} label="Rest" />
            <Tile icon="flame-outline" color={c.pink} value={`~${kcal(ex, profile.weightKg)}`} unit="kcal" label="All sets" />
          </Row>
          {best.e1rm > 0 && <View style={{ marginTop: 12 }}><Banner icon="trophy" title={`Your best · about ${Math.round(best.e1rm)} kg for one rep`} /></View>}
          {/* Locked: the card sits in the page (it used to float over the bottom of it). One short line, no paragraph. */}
          {lock.locked && (
            <View style={s.lock}>
              <Row gap={10}><Ionicons name="lock-closed" size={18} color={c.muted} /><T v="h3" style={{ flex: 1 }}>{lock.title}</T></Row>
              <T v="small" style={{ marginTop: 6 }}>{lock.safety || !lock.sessionsLeft ? lock.reason : `Opens after ${plural(lock.sessionsLeft, 'more session')}.`}</T>
              {!lock.safety && (
                <Tap onPress={() => setSheet(true)} feedback="none" style={{ marginTop: 2, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                  <T v="small" color={c.text} style={{ textDecorationLine: 'underline' }}>{"I've trained before"}</T>
                </Tap>
              )}
            </View>
          )}
        </Enter>

        <Enter i={3} style={{ marginTop: 24, gap: 12 }}>
          {steps.length > 0 && (
            <Fold title="How to do it" icon="list" open>
              {steps.map((step, i) => (
                <Row key={i} style={{ alignItems: 'flex-start' }}>
                  <View style={[s.num, { backgroundColor: c.accent }]}><T v="small" color={c.accentInk}>{i + 1}</T></View>
                  <T style={{ flex: 1 }}>{step}</T>
                </Row>
              ))}
            </Fold>
          )}
          {pose.length > 0 && (
            <Fold title="Form cues" icon="body">
              {pose.map(([k, label]) => (
                <View key={k} style={{ gap: 2 }}>
                  <T v="label" color={k === 'mistake' ? c.warm : c.muted}>{label}</T>
                  <T>{g?.[k]}</T>
                </View>
              ))}
            </Fold>
          )}
          <Fold title="Why it helps" icon="sparkles">
            <T color={c.muted}>{benefit(ex)}</T>
            {fo && <T v="small">Focus: {fo.label}. {fo.about}</T>}
            <T v="small">Where: {places(ex).join(', ')}</T>
          </Fold>
        </Enter>

        {ex.primary.some(mapped) && (
          <Enter i={4}>
            <Section title="Muscles">
              <Card style={{ alignItems: 'center', gap: 14 }}>
                <MuscleMap primary={ex.primary} secondary={ex.secondary} size={200} />
                <View style={{ alignSelf: 'stretch', gap: 6 }}>
                  <Legend text={ex.primary.map(title).join(', ')} />
                  {ex.secondary.length > 0 && <Legend faint text={ex.secondary.map(title).join(', ')} />}
                </View>
              </Card>
            </Section>
          </Enter>
        )}

        <Enter i={5}>
          <Section title="Alternatives">
            <Segmented options={[{ k: 'gym', label: 'At the gym' }, { k: 'home', label: 'At home' }]} value={tab} onChange={setTab} />
            <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ gap: 8, marginTop: 10 }}>
              {alts.length ? alts.map((a, i) => <Alt key={a.id} a={a} onPress={() => hop(a.id)} tag={i === 0 && alts.length > 1 ? 'Easiest' : undefined} />)
                : <T v="small">No close match {tab === 'home' ? 'with your home gear' : 'here'} yet.</T>}
              {next && (
                <>
                  <T v="h3" style={{ marginTop: 14 }}>Next level</T>
                  <Alt a={next} onPress={() => hop(next.id)} locked={nextLock?.locked}
                    note={nextLock?.sessionsLeft ? `Opens after ${plural(nextLock.sessionsLeft, 'more session')}` : undefined} />
                </>
              )}
            </Animated.View>
          </Section>
        </Enter>
      </Screen>

      {/* The one action. A running workout is never started twice: we go back to it (pop, never push). */}
      {/* A locked move has no action bar: its card is inline above. */}
      {!lock.locked && <GlassBar edge="bottom" inset={false} style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: ins.bottom + 12 + mini }}>
        {active ? (
          <Button title={inWorkout ? 'Back to your workout' : 'Add to your workout'} icon={inWorkout ? 'arrow-forward' : 'add'}
            onPress={() => { if (!inWorkout) addItem(ex.id); toSession(); }} />
        ) : (
          <Button title="Train this now" icon="play"
            onPress={() => { startSingle(ex.id, profile.place === 'home' ? 'home' : 'gym'); openWorkout(); }} />
        )}
      </GlassBar>}

      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <View style={{ gap: 12 }}>
          <T v="h2">Trained before?</T>
          <T color={c.muted}>Change your level and this move opens up.</T>
          <Button title="Keep it locked" onPress={() => setSheet(false)} />
          <Button title="Change my level" kind="ghost"
            onPress={() => { setProfile({ ...profile, level: ex.level === 'expert' ? 'advanced' : 'intermediate' }); setSheet(false); }} />
        </View>
      </Sheet>
    </View>
  );
}

// The fixed action bar above the safe area: 12 top + button + 12 bottom. Screen pads the content by it.
const BAR = 80;

const Legend = ({ text, faint }: { text: string; faint?: boolean }) => (
  <Row gap={8}><View style={[s.dot, faint && { backgroundColor: SOFT, opacity: 0.7 }]} /><T v="small" style={{ flex: 1 }}>{text}</T></Row>
);

function Alt({ a, tag, locked, note, onPress }: { a: Exercise; tag?: string; locked?: boolean; note?: string; onPress: () => void }) {
  const q = equip(a.equipment);
  return (
    <Tap onPress={onPress} style={s.alt} scale={0.98}>
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
  origin: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, backgroundColor: c.card, maxWidth: '100%' },
  tag: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: c.card2, justifyContent: 'center' },
  mini: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
  lock: { backgroundColor: c.card2, borderRadius: r.lg, padding: 16, marginTop: 12 },
});
