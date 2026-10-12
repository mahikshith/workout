import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapped, MuscleMap, RED } from '../../src/body';
import { bestBefore } from '../../src/calc';
import { alternatives, available, byId, HOME_GEAR, title, type Exercise } from '../../src/data/exercises';
import guide from '../../src/data/guide.json';
import { gate } from '../../src/engine';
import { Sheet } from '../../src/sheet';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Demo, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

// Hand-written coaching per exercise (src/data/guide.json); anything missing falls back to the dataset's steps.
type Guide = { steps?: string[]; hands?: string; arms?: string; legs?: string; back?: string; breathe?: string; mistake?: string };
const GUIDE = guide as Record<string, Guide>;
const POSE: [Exclude<keyof Guide, 'steps'>, string][] = [
  ['hands', 'Hands and wrists'], ['arms', 'Arms and elbows'], ['legs', 'Legs and feet'], ['back', 'Back and core'],
  ['breathe', 'Breathing'], ['mistake', 'Common mistake'],
];

// ponytail: guesses desk-friendly moves from the name; a per-exercise tag in the data would be exact.
const OFFICE = /seated|chair|desk|standing|wall|neck|wrist|calf raise/i;
function badges(e: Exercise) {
  const out = [title(e.level)];
  if (e.equipment !== 'body only') out.push(title(e.equipment));
  if (available(e, 'home', [])) out.push('No equipment', ...(OFFICE.test(e.name) && !/jump|hop|lying|kneeling|floor/i.test(e.name) ? ['Office'] : []));
  else out.push(...(available(e, 'home', [...HOME_GEAR]) ? ['Home', 'Gym'] : ['Gym']));
  return out;
}

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ins = useSafeAreaInsets();
  const ex = byId[id];
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const { startSingle, setProfile } = useStore.getState();
  const [tab, setTab] = useState<'gym' | 'home'>(profile.place === 'home' ? 'home' : 'gym');
  const [sheet, setSheet] = useState(false);
  if (!ex) return null;
  const g = GUIDE[ex.id];
  const steps = g?.steps?.length ? g.steps : ex.steps.slice(0, 5);
  const pose = POSE.filter(([k]) => g?.[k]);
  const lock = gate(ex, profile, sessions.length);
  const best = bestBefore(sessions, ex.id);
  const alts = tab === 'gym' ? alternatives(ex, 'gym', [], 3) : alternatives(ex, 'home', profile.gear, 3);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
          <T v="label">{title(ex.category)}</T>
          <View style={{ width: 40 }} />
        </Row>

        <Rise><Demo ex={ex} height={300} credit style={{ marginTop: 16 }} /></Rise>

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
          <T v="h1" style={{ marginTop: 22 }}>{ex.name}</T>
          <Row style={{ flexWrap: 'wrap', marginTop: 10 }} gap={8}>
            {badges(ex).map((b) => <View key={b} style={s.tag}><T v="small" color={c.text}>{b}</T></View>)}
          </Row>
          {best.e1rm > 0 && <T v="small" color={c.accent} style={{ marginTop: 10 }}>Your best: {Math.round(best.e1rm)} kg estimated 1RM</T>}
        </Rise>

        {steps.length > 0 && (
          <Rise i={3}>
            <T v="label" style={s.section}>How to do it</T>
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
            <T v="label" style={s.section}>Body position</T>
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
          <T v="label" style={s.section}>Alternatives</T>
          <View style={s.tabs}>
            {(['gym', 'home'] as const).map((k) => (
              <Tap key={k} onPress={() => setTab(k)} scale={0.98} style={[s.tab, tab === k && { backgroundColor: c.line }]}>
                <T v="h3" color={tab === k ? c.text : c.muted}>{k === 'gym' ? 'At the gym' : 'At home'}</T>
              </Tap>
            ))}
          </View>
          <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ gap: 8, marginTop: 10 }}>
            {alts.length ? alts.map((a) => (
              <Tap key={a.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: a.id } })} style={s.alt} scale={0.98}>
                <Thumb ex={a} size={52} />
                <View style={{ flex: 1 }}>
                  <T v="h3">{a.name}</T>
                  <T v="small">{title(a.equipment)} · {title(a.level)}</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Tap>
            )) : <T v="small">No close match {tab === 'home' ? 'with your home gear' : 'here'} yet.</T>}
          </Animated.View>
        </Rise>
        {lock.locked && <View style={{ height: 70 }} />}
      </Screen>

      {(lock.locked || !active) && (
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
          ) : (
            <Button title="Train this now" icon="play"
              onPress={() => { startSingle(ex.id, profile.place === 'home' ? 'home' : 'gym'); router.push('/session'); }} />
          )}
        </View>
      )}

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
  <Row gap={8}><View style={[s.dot, faint && { opacity: 0.35 }]} /><T v="small" style={{ flex: 1 }}>{text}</T></Row>
);

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: c.card2, justifyContent: 'center' },
  section: { marginTop: 26, marginBottom: 10 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  tab: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: r.md, backgroundColor: c.card },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: 'rgba(10,10,11,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line,
  },
  lock: { backgroundColor: c.card2, borderRadius: r.lg, padding: 16 },
});
