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
import { Banner, Button, Card, Demo, Fold, Rise, Row, Screen, Section, T, Tap, Thumb, Tile } from '../../src/ui';

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
  // origin/depth: when people hop from alternative to alternative, each page remembers where the chain started and how
  // many pages deep it is, so one tap on "Back to ..." returns there instead of pressing back again and again.
  const { id, origin, depth: d0 } = useLocalSearchParams<{ id: string; origin?: string; depth?: string }>();
  const depth = Number(d0) || 0;
  const start = origin && origin !== id ? byId[origin] : undefined;
  const hop = (to: string) => router.push({ pathname: '/exercise/[id]', params: { id: to, origin: origin ?? id, depth: String(depth + 1) } });
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
      {/* Pinned header: the exercise name stays in view while the page scrolls. */}
      <View style={[s.head, { paddingTop: ins.top + 8 }]}>
        <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <View style={{ flex: 1 }}>
          <T v="h2" numberOfLines={2}>{ex.name}</T>
          <T v="small" numberOfLines={1}>{title(ex.category)}</T>
        </View>
      </View>
      <Screen onScroll={onScroll} top={0}>

        <Rise>
          {start && depth > 1 && (
            <Tap onPress={() => router.dismiss(depth)} scale={0.97} style={[s.origin, { borderColor: c.accent }]}>
              <Ionicons name="return-up-back" size={16} color={c.accent} />
              <T v="small" color={c.text} numberOfLines={1} style={{ flexShrink: 1 }}>Back to {start.name}</T>
            </Tap>
          )}
          <Row style={{ flexWrap: 'wrap', marginTop: 12 }} gap={8}>
            <View style={s.tag}><T v="small" color={c.text}>{title(ex.level)}</T></View>
            <View style={[s.tag, { backgroundColor: eq.color + '22' }]}><T v="small" color={eq.color}>{eq.label}</T></View>
            {places(ex).map((b) => <View key={b} style={s.tag}><T v="small" color={c.text}>{b}</T></View>)}
          </Row>
          {at !== undefined && (
            <View style={{ marginTop: 12 }}><Banner icon="checkmark-circle" color={c.ok} title={`Done ${doneNote(at).day} · fresh in ${doneNote(at).left}d`} /></View>
          )}
        </Rise>
        {/* Media first, then the numbers, then instructions on demand. */}
        <Rise i={1}><Demo ex={ex} height={300} credit paused={away} style={{ marginTop: 16 }} /></Rise>

        <Rise i={2}>
          <Section title="Your dose">
            <Row gap={12}>
              <Tile icon="repeat" value={doseText(d)} label={d.sets > 1 ? 'Sets × reps' : 'Do'} />
              <Tile icon="timer-outline" color={c.blue} value={restText(d)} label="Rest" />
            </Row>
            <Row gap={12} style={{ marginTop: 12 }}>
              <Tile icon="speedometer-outline" color={c.warm} value={effort(ex)} label="Effort" />
              <Tile icon="flame-outline" color={c.pink} value={`~${kcal(ex, profile.weightKg)}`} unit="kcal" label="All sets" />
            </Row>
            {best.e1rm > 0 && <View style={{ marginTop: 12 }}><Banner icon="trophy" title={`Your best · ${Math.round(best.e1rm)} kg 1RM`} /></View>}
          </Section>
        </Rise>

        {ex.primary.some(mapped) && (
          <Rise i={3}>
            <Section title="Muscles">
              <Card style={{ alignItems: 'center', gap: 14 }}>
                <MuscleMap primary={ex.primary} secondary={ex.secondary} size={200} />
                <View style={{ alignSelf: 'stretch', gap: 6 }}>
                  <Legend text={ex.primary.map(title).join(', ')} />
                  {ex.secondary.length > 0 && <Legend faint text={ex.secondary.map(title).join(', ')} />}
                </View>
              </Card>
            </Section>
          </Rise>
        )}

        <Rise i={4} style={{ marginTop: 32, gap: 12 }}>
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
          </Fold>
        </Rise>

        <Rise i={5}>
          <T v="h2" style={s.section}>Alternatives</T>
          <View style={s.tabs}>
            {(['gym', 'home'] as const).map((k) => (
              <Tap key={k} onPress={() => setTab(k)} scale={0.98} style={[s.tab, tab === k && { backgroundColor: c.line }]}>
                <T v="h3" color={tab === k ? c.text : c.muted}>{k === 'gym' ? 'At the gym' : 'At home'}</T>
              </Tap>
            ))}
          </View>
          <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ gap: 8, marginTop: 10 }}>
            {alts.length ? alts.map((a, i) => <Alt key={a.id} a={a} onPress={() => hop(a.id)} tag={i === 0 && alts.length > 1 ? 'Easiest' : undefined} />)
              : <T v="small">No close match {tab === 'home' ? 'with your home gear' : 'here'} yet.</T>}
            {next && (
              <>
                <T v="h3" style={{ marginTop: 14 }}>Next level</T>
                <Alt a={next} onPress={() => hop(next.id)} locked={nextLock?.locked}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.line },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  origin: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, backgroundColor: c.card, maxWidth: '100%' },
  done: { marginTop: 10, padding: 10, borderRadius: r.md, borderWidth: 1, backgroundColor: c.card },
  tag: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: c.card2, justifyContent: 'center' },
  mini: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: c.card2, justifyContent: 'center' },
  section: { marginTop: 32, marginBottom: 12 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  tab: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12,
    backgroundColor: 'rgba(10,10,11,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
  lock: { backgroundColor: c.card2, borderRadius: r.lg, padding: 16 },
});
