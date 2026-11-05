// Consistency: the one home of the streak, the month calendar and the workout history (with delete).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bars } from '../src/charts';
import { bestStreak, dayKey, doneSets, streak, targets, volume } from '../src/calc';
import { byId } from '../src/data/exercises';
import { sessionMinutes } from '../src/glance';
import { CountUp, EASE, Header, useMiniBarSpace } from '../src/kit';
import { useStore } from '../src/store';
import { mergedFor, useTracker } from '../src/tracker';
import { c, f, r } from '../src/theme';
import { Card, haptic, IconBox, ListRow, Row, Section, T, Tap, Thumb, Tile } from '../src/ui';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function History() {
  const sessions = useStore((s) => s.sessions);
  const deleteSession = useStore((s) => s.deleteSession);
  const profile = useStore((s) => s.profile);
  const water = useStore((s) => s.water);
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const still = useReducedMotion();
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [day, setDay] = useState(dayKey());
  const [confirm, setConfirm] = useState<string | null>(null);
  const sessionHr = useTracker((t) => t.sessionHr);
  const merged = useTracker((t) => t.merged);
  // Heart rate glance (its home is the workout summary): avg · max from Health Connect, or from the watch's merged copy.
  const hrOf = (id: string) => {
    const h = sessionHr[id], w = mergedFor(merged, id);
    const avg = h?.avg ?? w?.avgHr, max = h?.max ?? w?.maxHr;
    return avg && max ? `${Math.round(avg)} avg · ${Math.round(max)} max` : null;
  };

  const byDay: Record<string, typeof sessions> = {};
  for (const s of sessions) (byDay[dayKey(s.startedAt)] ??= []).push(s);
  // Sets per day tint the calendar: more sets, stronger accent.
  const setsOn = (k: string) => (byDay[k] ?? []).reduce((a, s) => a + doneSets(s), 0);
  const lead = (month.getDay() + 6) % 7; // Monday-first grid
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const pickDay = (k: string) => { setDay(k); setConfirm(null); };
  const picked = byDay[day] ?? [];
  const inMonth = sessions.filter((s) => new Date(s.startedAt).getMonth() === month.getMonth() && new Date(s.startedAt).getFullYear() === month.getFullYear()).length;
  const dayTitle = day === dayKey() ? 'Today' : new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  // Sessions per week: four weeks back, this week, three weeks still to come (Monday to Sunday).
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const back = (k: number) => { const x = new Date(mon); x.setDate(mon.getDate() - 7 * k); return x; };
  const weekOf = (k: number) => { const a = back(k).getTime(), b = back(k - 1).getTime(); return sessions.filter((s) => s.startedAt >= a && s.startedAt < b).length; };
  const perWeek = Array.from({ length: 8 }, (_, i) => ({ label: i === 4 ? 'Now' : String(back(4 - i).getDate()), value: i > 4 ? 0 : weekOf(4 - i) }));

  // Glance for the fuel and water charts (their home is /chart/fuel).
  const t = targets(profile);
  const fortnight = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); return dayKey(d); });
  const waterDays = fortnight.filter((k) => (water[k] ?? 0) >= t.water).length;

  const remove = (id: string) => {
    if (confirm !== id) { setConfirm(id); haptic('light'); return; }
    deleteSession(id); setConfirm(null); haptic('medium');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Consistency" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 120 + mini }} showsVerticalScrollIndicator={false}>
        {/* Hero: the streak. */}
        <Animated.View entering={enter(0)}>
          <Card style={{ gap: 8 }}>
            <Row gap={16}>
              <IconBox icon="flame" color={c.warm} size={56} />
              <View style={{ flex: 1 }}>
                <CountUp value={streak(sessions)} style={{ fontFamily: f.display, fontSize: 56, lineHeight: 62 }} />
                <T v="small">Day streak</T>
              </View>
            </Row>
            <T v="small" color={c.dim}>Rest days are fine · 3 days off ends it</T>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Row gap={12} style={{ marginTop: 12 }}>
            <Tile icon="trophy" color={c.warm} value={bestStreak(sessions)} label="Best streak" />
            <Tile icon="calendar" value={inMonth} label="This month" />
            <Tile icon="barbell" value={sessions.length} label="All time" />
          </Row>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <Section title="Calendar">
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Tap onPress={() => shift(-1)} style={s.nav}><Ionicons name="chevron-back" size={18} color={c.text} /></Tap>
                <T v="h3">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</T>
                <Tap onPress={() => shift(1)} style={s.nav}><Ionicons name="chevron-forward" size={18} color={c.text} /></Tap>
              </Row>
              <View style={s.grid}>
                {DOW.map((d, i) => <T key={`h${i}`} v="label" style={s.cellHead}>{d}</T>)}
                {cells.map((d, i) => {
                  if (!d) return <View key={`e${i}`} style={s.cell} />;
                  const k = dayKey(d), n = setsOn(k), did = !!byDay[k], on = k === day, today = k === dayKey();
                  const tint = !did ? undefined : n >= 16 || n === 0 ? c.accent : n >= 8 ? c.accent + 'CC' : c.accent + '88';
                  return (
                    <Tap key={k} onPress={() => pickDay(k)} style={s.cell} scale={0.9} feedback="none">
                      <View style={[s.dayDot, tint ? { backgroundColor: tint } : null, on && { borderColor: c.text, borderWidth: 1.5 }, today && !did && { backgroundColor: c.card2 }]}>
                        <T v="small" color={did ? c.accentInk : d.getTime() > Date.now() ? c.dim : c.text}>{d.getDate()}</T>
                      </View>
                    </Tap>
                  );
                })}
              </View>
              <Row gap={8} style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <T v="small">Fewer sets</T>
                {['88', 'CC', ''].map((a) => <View key={a} style={[s.key, { backgroundColor: c.accent + a }]} />)}
                <T v="small">More</T>
              </Row>
            </Card>
          </Section>
        </Animated.View>

        <Section title={dayTitle}>
          {picked.length === 0 && <ListRow icon="bed-outline" color={c.muted} title="Rest day" sub="No workout logged" />}
          <View style={{ gap: 12 }}>
            {picked.map((ss) => (
              <Animated.View key={ss.id} entering={still ? undefined : FadeIn.duration(250)} exiting={still ? undefined : FadeOut.duration(200)}>
                <Card style={{ gap: 12 }}>
                  <Row gap={12}>
                    <IconBox icon={ss.place === 'home' ? 'home' : 'barbell'} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3" numberOfLines={1}>{ss.title}</T>
                      <T v="small" numberOfLines={1}>{doneSets(ss)} sets · {Math.round(volume(ss))} kg · {sessionMinutes(ss)} min</T>
                    </View>
                    <Tap onPress={() => remove(ss.id)} style={[s.nav, confirm === ss.id && { backgroundColor: '#2A1210' }]}>
                      <Ionicons name="trash-outline" size={18} color={confirm === ss.id ? c.danger : c.muted} />
                    </Tap>
                  </Row>
                  {hrOf(ss.id) && (
                    <Row gap={8}>
                      <Ionicons name="heart" size={14} color={c.pink} />
                      <T v="small" style={{ fontVariant: ['tabular-nums'] }}>{hrOf(ss.id)}</T>
                    </Row>
                  )}
                  {confirm === ss.id && <Animated.View entering={FadeIn.duration(160)}><T v="small" color={c.danger}>Tap the bin again to delete</T></Animated.View>}
                  {ss.items.map((it, j) => (
                    <Row key={`${it.exId}-${j}`} gap={12}>
                      {byId[it.exId] ? <Thumb ex={byId[it.exId]} size={36} /> : <IconBox icon="barbell" size={36} />}
                      <T v="body" style={{ flex: 1 }} numberOfLines={1}>{byId[it.exId]?.name ?? it.exId}</T>
                      <T v="small" numberOfLines={1} style={{ maxWidth: '45%' }}>{it.sets.filter((x) => x.done).map((x) => (x.weight ? `${x.weight}×${x.reps}` : x.reps)).join('  ')}</T>
                    </Row>
                  ))}
                </Card>
              </Animated.View>
            ))}
          </View>
        </Section>

        <Animated.View entering={enter(3)}>
          <Section title="Sessions per week">
            <Card>
              {sessions.length ? <Bars items={perWeek} now={4} /> : <T v="body" color={c.muted}>No sessions yet</T>}
            </Card>
          </Section>
        </Animated.View>

        <Section title="Habits">
          <ListRow icon="water" color={c.blue} title="Fuel and water" sub={`Water on target ${waterDays} of 14 days`} onPress={() => router.push('/chart/fuel')} />
        </Section>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  nav: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  cellHead: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 34, height: 34, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center' },
  key: { width: 12, height: 12, borderRadius: 3 },
});
