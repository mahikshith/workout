// One chart screen per Progress card: /chart/strength, /chart/weight, /chart/body, /chart/fuel, /chart/achievements.
// Each is the one home of its numbers (docs/REDESIGN.md, "every item has one home"); Progress only shows a glance.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapped, MuscleMap } from '../../src/body';
import { Bars, LineChart } from '../../src/charts';
import { dayKey, e1rm, targets, volume } from '../../src/calc';
import { badges, level } from '../../src/data/badges';
import { byId, title } from '../../src/data/exercises';
import { Journey } from '../../src/journey';
import { EASE, Empty, goBack, Header, Segmented, useMiniBarSpace } from '../../src/kit';
import { Achievements } from '../../src/medals';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { latest, sleepScore, useTracker } from '../../src/tracker';
import { Button, Card, Chip, Fold, haptic, ListRow, Row, Section, Stat, Stepper, T, Tile } from '../../src/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const DAY = 86400000;
const TITLES: Record<string, string> = { strength: 'Strength', weight: 'Body weight', body: 'Body & watch', fuel: 'Fuel and water', achievements: 'Achievements' };
const kgShort = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const short = (t: number | string) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const hm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
// The last 14 days, oldest first, anchored at noon so DST never shifts a day.
const fortnight = () => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (13 - i)); return d; });

export default function Chart() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const k = typeof kind === 'string' ? kind : '';
  return (
    <Page title={TITLES[k] ?? 'Progress'}>
      {k === 'strength' ? <Strength /> : k === 'weight' ? <Weight /> : k === 'body' ? <BodyWatch /> : k === 'fuel' ? <Fuel /> : k === 'achievements' ? <Medals /> : (
        <Empty icon="help-circle-outline" title="Nothing to show here" action="Back" onPress={goBack} />
      )}
    </Page>
  );
}

// Pushed-screen frame: the shared Header, then the scrolling content.
function Page({ title: t, children }: { title: string; children: ReactNode }) {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 120 + mini }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

// Staggered entrance (60 ms), or none with reduced motion.
function useEnter() {
  const still = useReducedMotion();
  return (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));
}

// Charts draw in with a fade and a small rise. A new key replays it when the data shown changes.
function Draw({ k, children }: { k: string; children: ReactNode }) {
  const still = useReducedMotion();
  return <Animated.View key={k} entering={still ? undefined : FadeInDown.duration(420).easing(EASE)}>{children}</Animated.View>;
}

// A big number, one caption line, then the chart. With nothing logged yet, just the empty line.
function Panel({ value, unit, cap, empty, children }: { value: string | number; unit?: string; cap: string; empty?: string | false; children?: ReactNode }) {
  if (empty) return <T v="body" color={c.muted}>{empty}</T>;
  return (
    <View style={{ gap: 12 }}>
      <View>
        <T v="num">{value}{unit ? <T v="small"> {unit}</T> : null}</T>
        <T v="small" numberOfLines={1}>{cap}</T>
      </View>
      {children}
    </View>
  );
}

// ---------- Strength: per-lift curve, weekly volume, top lifts, muscle split, the 12-week example ----------
function Strength() {
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const [pick, setPick] = useState<string | null>(null);
  const enter = useEnter();

  const best: Record<string, number> = {};
  for (const s of sessions) for (const it of s.items) for (const x of it.sets) if (x.done && x.weight) best[it.exId] = Math.max(best[it.exId] ?? 0, e1rm(x.weight, x.reps));
  const lifts = Object.entries(best).sort((a, b) => b[1] - a[1]);
  const topIds = lifts.slice(0, 6).map((x) => x[0]);
  const cur = pick && topIds.includes(pick) ? pick : topIds[0];
  // Each session's best set of the picked lift (by estimated 1RM), oldest first, last 20.
  const tops = cur ? sessions.flatMap((s) => {
    const sets = s.items.filter((it) => it.exId === cur).flatMap((it) => it.sets.filter((x) => x.done && x.weight));
    return sets.length ? [sets.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a))] : [];
  }).slice(-20) : [];
  const curve = tops.map((x) => e1rm(x.weight, x.reps));
  const lastSet = tops[tops.length - 1];

  // Weekly volume, 12 weeks, Monday to Sunday, oldest first.
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const back = (k: number) => { const x = new Date(mon); x.setDate(mon.getDate() - 7 * k); return x.getTime(); };
  const volTrend = Array.from({ length: 12 }, (_, i) => { const k = 11 - i; return sessions.filter((s) => s.startedAt >= back(k) && s.startedAt < back(k - 1)).reduce((a, s) => a + volume(s), 0); });
  const volWeeks = volTrend.filter((v) => v > 0);
  const volAvg = volWeeks.length ? volWeeks.reduce((a, b) => a + b, 0) / volWeeks.length : 0;
  // Bodyweight-only training has no kg volume: chart reps a week instead, so a finished workout always shows up.
  const repsOf = (s: (typeof sessions)[number]) => s.items.reduce((a, it) => a + it.sets.filter((x) => x.done).reduce((b, x) => b + x.reps, 0), 0);
  const repTrend = Array.from({ length: 12 }, (_, i) => { const k = 11 - i; return sessions.filter((s) => s.startedAt >= back(k) && s.startedAt < back(k - 1)).reduce((a, s) => a + repsOf(s), 0); });
  const repWeeks = repTrend.filter((v) => v > 0);
  const byReps = !volWeeks.length && repWeeks.length > 0;
  const repAvg = repWeeks.length ? repWeeks.reduce((a, b) => a + b, 0) / repWeeks.length : 0;

  // Muscles from the last 30 days: primary muscles count every set, helpers half. Top 3 main on the map, next 4 helpers.
  const split: Record<string, number> = {};
  for (const s of sessions) {
    if (Date.now() - s.startedAt >= 30 * DAY) continue;
    for (const it of s.items) {
      const ex = byId[it.exId];
      if (!ex) continue;
      const n = it.sets.filter((x) => x.done).length;
      for (const m of ex.primary) split[m] = (split[m] ?? 0) + n;
      for (const m of ex.secondary) split[m] = (split[m] ?? 0) + n / 2;
    }
  }
  const ranked = Object.entries(split).filter(([m]) => mapped(m) && split[m] > 0).sort((a, b) => b[1] - a[1]);
  const splitRows = ranked.slice(0, 8);
  const maxS = Math.max(1, ...splitRows.map((x) => x[1]));

  // The 12-week example: from the real top lift when there is one, else a sample 40 kg, compounding 1.5% a week.
  const base = cur ? best[cur] : 40;
  const days = Math.max(1, profile.daysPerWeek);
  const proj = Array.from({ length: 13 }, (_, i) => base * Math.pow(1.015, i));
  const gain = base * (Math.pow(1.015, 12) - 1);
  const intro = cur ? `From your ${byId[cur]?.name ?? 'top lift'} · ${days} a week` : `Sample 40 kg lift · ${days} a week`;

  return (
    <>
      <Animated.View entering={enter(0)}>
        <Card style={{ gap: 16 }}>
          {topIds.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {topIds.map((id) => <Chip key={id} label={byId[id]?.name ?? id} on={id === cur} onPress={() => setPick(id)} />)}
            </ScrollView>
          )}
          <Panel value={lastSet ? `${lastSet.weight} kg × ${lastSet.reps}` : '-'}
            cap={`${byId[cur ?? '']?.name ?? 'Lift'} · best set last time · est. 1RM ${cur ? Math.round(best[cur]) : 0} kg`}
            empty={!topIds.length && 'Log sets with weight to see your lifts'}>
            <Draw k={cur ?? ''}><LineChart values={curve} fmt={(v) => `${Math.round(v)} kg`} height={140} /></Draw>
            <T v="small">Estimated 1RM · last {curve.length} session{curve.length === 1 ? '' : 's'}</T>
          </Panel>
        </Card>
      </Animated.View>

      {lifts.length > 0 && (
        <Animated.View entering={enter(1)}>
          <Section title="Top lifts">
            <View style={{ gap: 8 }}>
              {lifts.slice(0, 5).map(([id, v], i) => (
                <ListRow key={id} icon={i === 0 ? 'trophy' : 'barbell'} title={byId[id]?.name ?? id} sub={`#${i + 1} · est. 1RM`}
                  onPress={() => setPick(id)} right={<T v="h3" color={c.accent}>{Math.round(v)} kg</T>} />
              ))}
            </View>
          </Section>
        </Animated.View>
      )}

      <Animated.View entering={enter(2)}>
        <Section title="Muscles">
          {splitRows.length ? (
            <Card style={{ gap: 12 }}>
              <T v="small">Sets · last 30 days</T>
              <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <MuscleMap primary={ranked.slice(0, 3).map((x) => x[0])} secondary={ranked.slice(3, 7).map((x) => x[0])} size={180} />
              </View>
              {splitRows.map(([m, n]) => (
                <Row key={m} gap={12}>
                  <T v="small" color={c.text} style={{ width: 90 }} numberOfLines={1}>{title(m)}</T>
                  <View style={[s.track, { flex: 1 }]}><View style={[s.fill, { width: `${(n / maxS) * 100}%`, backgroundColor: c.accent }]} /></View>
                  <T v="small" style={{ width: 28, textAlign: 'right' }}>{Math.round(n)}</T>
                </Row>
              ))}
            </Card>
          ) : <ListRow icon="body-outline" title="No muscle data yet" sub="Train this month to fill it in" />}
        </Section>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Section title="Volume">
          <Card>
            <Panel value={byReps ? Math.round(repAvg) : kgShort(volAvg)} unit={byReps ? 'reps a week' : 'kg a week'}
              cap={byReps ? 'Bodyweight sets · average week · 12 weeks' : 'Average training week · 12 weeks'}
              empty={!volWeeks.length && !repWeeks.length && 'Finish a workout to see volume'}>
              <Draw k={byReps ? 'reps' : 'vol'}>
                <LineChart values={byReps ? repTrend : volTrend} fmt={(v) => (byReps ? `${Math.round(v)} reps` : `${kgShort(v)} kg`)} height={120} />
              </Draw>
              <Row style={{ justifyContent: 'space-between' }}><T v="small">12 weeks ago</T><T v="small">This week</T></Row>
            </Panel>
          </Card>
        </Section>
      </Animated.View>

      <Animated.View entering={enter(4)} style={{ marginTop: 32 }}>
        <Fold title="12-week example" icon="eye-outline">
          <T v="label" color={c.warm}>Example, not a promise</T>
          <T v="small" numberOfLines={1}>{intro}</T>
          <T v="label">Strength · about 1.5% a week</T>
          <LineChart values={proj} fmt={(v) => `${Math.round(v)} kg`} height={110} />
          <T v="label">Sessions per week</T>
          <Bars items={Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: days }))} height={90} />
          <Row>
            <Stat label="Sessions" value={days * 12} />
            <Stat label="Streak" value="12 wks" color={c.accent} />
            <Stat label="Strength" value={`+${Math.round(gain)} kg`} />
          </Row>
        </Fold>
      </Animated.View>
    </>
  );
}

// ---------- Body weight: trend vs goal, the only weight logger, last weigh-ins, journey, what to expect ----------
function Weight() {
  const sessions = useStore((s) => s.sessions);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const logWeight = useStore((s) => s.logWeight);
  const [kg, setKg] = useState(profile?.weightKg ?? 70);
  const enter = useEnter();
  if (!profile) return null;
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  if (gentle) return <Empty icon="eye-off-outline" title="Weight is hidden in no-numbers mode" action="Back" onPress={goBack} />;

  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const lastW = sorted.length ? sorted[sorted.length - 1] : null;
  const w = sorted.slice(-30);
  const recentW = sorted.map((x, i) => ({ ...x, diff: i > 0 ? x.kg - sorted[i - 1].kg : null })).slice(-5).reverse();
  const today = lastW?.day === dayKey() ? lastW.kg : null;
  const same = today !== null && today === +kg.toFixed(1);
  const losing = profile.goal === 'lose fat' || profile.goalWeightKg < profile.weightKg;
  const showJourney = profile.goal === 'lose fat' || profile.concerns?.some((x) => x === 'lose-weight' || x === 'gain') || Math.abs(profile.goalWeightKg - profile.weightKg) >= 1;

  return (
    <>
      <Animated.View entering={enter(0)}>
        <Card>
          <Panel value={lastW ? lastW.kg.toFixed(1) : '-'} unit={lastW ? 'kg' : undefined} cap={`Goal ${profile.goalWeightKg} kg · ${weights.length} weigh-ins`}
            empty={!w.length && 'No weigh-ins yet'}>
            <Draw k="w"><LineChart values={w.map((p) => p.kg)} goal={profile.goalWeightKg} fmt={(v) => `${v.toFixed(1)} kg`} height={140} /></Draw>
            <Row gap={8}><View style={[s.dash, { borderColor: c.warm }]} /><T v="small">Goal</T></Row>
          </Panel>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Section title="Log today's weight">
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Stepper value={kg} step={0.1} onChange={setKg} min={30} suffix=" kg" />
              <Button title={same ? 'Logged' : 'Log'} icon={same ? 'checkmark' : undefined} style={{ height: 44, paddingHorizontal: 22 }}
                onPress={() => { logWeight(+kg.toFixed(1)); haptic('success'); }} />
            </Row>
            <T v="small">One entry a day · logging again replaces today's</T>
            {today !== null && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Row gap={8}>
                  <Ionicons name="checkmark-circle" size={18} color={c.ok} />
                  <T v="small" color={c.text}>Saved · {today.toFixed(1)} kg today</T>
                </Row>
              </Animated.View>
            )}
          </Card>
        </Section>
      </Animated.View>

      {recentW.length > 0 && (
        <Animated.View entering={enter(2)}>
          <Section title="Last weigh-ins">
            <Card style={{ gap: 4, paddingVertical: 8 }}>
              {recentW.map((x) => (
                <Row key={x.day} style={{ height: 36 }}>
                  <T v="small" color={c.text} style={{ flex: 1 }} numberOfLines={1}>{x.day === dayKey() ? 'Today' : short(x.day + 'T12:00:00')}</T>
                  <T v="small" color={c.text} style={{ width: 72, textAlign: 'right' }}>{x.kg.toFixed(1)} kg</T>
                  <T v="small" style={{ width: 56, textAlign: 'right' }}>{x.diff === null ? '-' : `${x.diff > 0 ? '+' : x.diff < 0 ? '−' : ''}${Math.abs(x.diff).toFixed(1)}`}</T>
                </Row>
              ))}
            </Card>
          </Section>
        </Animated.View>
      )}

      {showJourney && <Animated.View entering={enter(3)}><Journey p={profile} sessions={sessions} meals={meals} weights={weights} /></Animated.View>}

      <Animated.View entering={enter(4)} style={{ marginTop: 32 }}>
        <Fold title="What to expect" icon="information-circle-outline">
          <ListRow icon="water-outline" color={c.blue} title="Daily swings of 1-2 kg" sub="Mostly water, salt and food" />
          <ListRow icon={losing ? 'trending-down' : 'trending-up'} title={losing ? '0.25-1 kg a week' : '0.25-0.5 kg a week'} sub={losing ? 'A pace you can keep' : 'Mostly muscle, little fat'} />
          <ListRow icon="calendar-outline" color={c.warm} title="Judge by the trend" sub="Compare weekly, same time of day" />
        </Fold>
      </Animated.View>
    </>
  );
}

// ---------- Body & watch: today's watch numbers, 14-day steps and sleep, imported workouts ----------
function BodyWatch() {
  // Opened from Watch & health: its links go back there instead of stacking another copy (no watch -> chart -> watch loop).
  const fromWatch = useLocalSearchParams<{ from?: string }>().from === 'watch';
  const toWatch = () => (fromWatch ? goBack() : router.push({ pathname: '/watch', params: { from: 'chart' } }));
  const daily = useTracker((s) => s.daily);
  const workouts = useTracker((s) => s.workouts);
  const hcOn = useTracker((s) => s.hc.connected);
  const lastSync = useTracker((s) => s.hc.lastSync);
  const strap = useTracker((s) => s.strap);
  const strapHrv = useTracker((s) => s.strapHrv);
  const [metric, setMetric] = useState<'steps' | 'sleep'>('steps');
  const enter = useEnter();

  const imported = Object.values(workouts).sort((a, b) => b.start.localeCompare(a.start));
  const hasData = Object.keys(daily).length > 0 || imported.length > 0 || Object.keys(strapHrv).length > 0;
  if (!hcOn && !strap && !hasData) {
    return <Empty icon="watch-outline" title="No watch connected yet" action="Connect a watch" onPress={toWatch} />;
  }

  const steps = latest(daily, 'steps', 1);
  const sleep = latest(daily, 'sleep', 2);
  const score = sleepScore(sleep);
  const rhr = latest(daily, 'restingHr', 3);
  const strapDay = Object.keys(strapHrv).sort().pop();
  const hrv = latest(daily, 'hrvMs', 3) ?? (strapDay ? strapHrv[strapDay] : undefined);
  const spo2 = latest(daily, 'spo2Pct', 3);
  const vo2 = latest(daily, 'vo2max', 30);
  const tiles: { icon: Icon; color: string; value: string | number; unit?: string; label: string }[] = [];
  if (steps !== undefined) tiles.push({ icon: 'footsteps', color: c.accent, value: steps.toLocaleString(), label: 'Steps today' });
  if (sleep) tiles.push({ icon: 'moon', color: c.blue, value: hm(sleep.minutes), label: score !== undefined ? `Sleep · score ${score}` : 'Sleep' });
  if (rhr !== undefined) tiles.push({ icon: 'heart', color: c.pink, value: Math.round(rhr), unit: 'bpm', label: 'Resting HR' });
  if (hrv !== undefined) tiles.push({ icon: 'pulse', color: c.pink, value: Math.round(hrv), unit: 'ms', label: 'HRV' });
  if (spo2 !== undefined) tiles.push({ icon: 'water', color: c.blue, value: Math.round(spo2), unit: '%', label: 'SpO2' });
  if (vo2 !== undefined) tiles.push({ icon: 'speedometer', color: c.accent, value: vo2.toFixed(1), label: 'VO2 max' });
  const pairs = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, i) => tiles.slice(i * 2, i * 2 + 2));

  const days = fortnight();
  const rows = days.map((d) => daily[dayKey(d)]);
  const stepBars = rows.map((x, i) => ({ label: String(days[i].getDate()), value: x?.steps ? Math.round(x.steps / 100) / 10 : 0 }));
  const sleepBars = rows.map((x, i) => ({ label: String(days[i].getDate()), value: x?.sleep ? Math.round(x.sleep.minutes / 6) / 10 : 0 }));
  const bars = metric === 'steps' ? stepBars : sleepBars;
  const st = sleep?.stages;
  const stageList = st ? ([['Deep', st.deep, '#3A6FF7'], ['Light', st.light, c.blue], ['REM', st.rem, '#A78BFA'], ['Awake', st.awake, c.warm]] as const) : [];
  const stageTotal = st ? Math.max(1, st.deep + st.light + st.rem + st.awake) : 1;

  return (
    <>
      {tiles.length ? (
        <View style={{ gap: 12 }}>
          {pairs.map((p, i) => (
            <Animated.View key={i} entering={enter(i)}>
              <Row gap={12}>
                {p.map((t) => <Tile key={t.label} icon={t.icon} color={t.color} value={t.value} unit={t.unit} label={t.label} />)}
                {p.length === 1 && <View style={{ flex: 1 }} />}
              </Row>
            </Animated.View>
          ))}
        </View>
      ) : <Empty icon="sync-outline" title="Waiting for the next sync" />}

      {st && (
        <Animated.View entering={enter(3)}>
          <Section title="Last night">
            <Card style={{ gap: 12 }}>
              <View style={s.stages}>
                {stageList.map(([n, m, col]) => <View key={n} style={{ flex: Math.max(0.001, m / stageTotal), backgroundColor: col }} />)}
              </View>
              <Row style={{ justifyContent: 'space-between' }}>
                {stageList.map(([n, m, col]) => (
                  <View key={n} style={{ gap: 2 }}>
                    <Row gap={6}><View style={[s.dot, { backgroundColor: col }]} /><T v="label">{n}</T></Row>
                    <T v="small" color={c.text}>{hm(m)}</T>
                  </View>
                ))}
              </Row>
            </Card>
          </Section>
        </Animated.View>
      )}

      <Animated.View entering={enter(4)}>
        <Section title="Last 14 days">
          <Card style={{ gap: 16 }}>
            <Segmented options={[{ k: 'steps', label: 'Steps' }, { k: 'sleep', label: 'Sleep' }]} value={metric} onChange={setMetric} />
            <Panel value={metric === 'steps' ? avgOf(stepBars.map((b) => b.value)).toFixed(1) : avgOf(sleepBars.map((b) => b.value)).toFixed(1)}
              unit={metric === 'steps' ? 'k steps' : 'h'} cap={metric === 'steps' ? 'Average day · thousands of steps' : 'Average night · hours asleep'}
              empty={!bars.some((b) => b.value > 0) && (metric === 'steps' ? 'No steps synced yet' : 'No sleep synced yet')}>
              <Draw k={metric}><Bars items={bars} now={13} height={100} color={metric === 'steps' ? c.accent : c.blue} goal={8} /></Draw>
            </Panel>
          </Card>
        </Section>
      </Animated.View>

      <Animated.View entering={enter(5)}>
        <Section title="Imported workouts">
          {imported.length ? (
            <View style={{ gap: 8 }}>
              {imported.slice(0, 10).map((w) => (
                <ListRow key={w.id} icon="watch-outline" color={c.blue} title={w.title ?? w.type}
                  sub={[short(w.start), `${Math.max(1, Math.round(w.durationS / 60))} min`, w.kcal ? `${Math.round(w.kcal)} kcal` : null, w.avgHr ? `${Math.round(w.avgHr)} bpm` : null].filter(Boolean).join(' · ')} />
              ))}
              {imported.length > 10 && <T v="small">Latest 10 of {imported.length}</T>}
            </View>
          ) : <ListRow icon="watch-outline" color={c.muted} title="No imported workouts" sub="Workouts from your watch show here" />}
        </Section>
      </Animated.View>

      <Section title="Source">
        <ListRow icon="sync-outline" color={c.blue} title="Watch & health" onPress={toWatch}
          sub={hcOn ? `Health Connect${lastSync ? ` · synced ${short(lastSync)}` : ''}` : strap ? strap.name : 'Manage connections'} />
      </Section>
    </>
  );
}
const avgOf = (xs: number[]) => { const v = xs.filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

// ---------- Fuel and water: the 14-day charts (water, protein, calories, meals) ----------
type FuelK = 'water' | 'protein' | 'kcal' | 'meals';
const FUELS: { k: FuelK; label: string }[] = [{ k: 'water', label: 'Water' }, { k: 'protein', label: 'Protein' }, { k: 'kcal', label: 'Calories' }, { k: 'meals', label: 'Meals' }];
function Fuel() {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const [fuel, setFuel] = useState<FuelK>('water');
  const enter = useEnter();
  if (!profile) return null;
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  // No-numbers mode hides calorie and protein charts.
  const fu: FuelK = gentle && (fuel === 'protein' || fuel === 'kcal') ? 'water' : fuel;
  const fuels = FUELS.filter((o) => !gentle || o.k === 'water' || o.k === 'meals');

  const keys = fortnight().map((d) => dayKey(d));
  const t = targets(profile);
  const glasses = keys.map((k) => water[k] ?? 0);
  const hitWater = glasses.filter((g) => g >= t.water).length;
  const dayMeals = keys.map((k) => meals.filter((m) => m.day === k));
  const kcal = dayMeals.map((ms) => ms.reduce((a, m) => a + m.kcal, 0));
  const protein = dayMeals.map((ms) => ms.reduce((a, m) => a + m.protein, 0));
  const mealCounts = dayMeals.map((ms) => ms.length);
  const kcalLogged = kcal.filter((_, i) => mealCounts[i] > 0);
  const kcalAvg = kcalLogged.length ? Math.round(kcalLogged.reduce((a, b) => a + b, 0) / kcalLogged.length) : 0;
  const totalMeals = mealCounts.reduce((a, b) => a + b, 0);
  const fullDays = mealCounts.filter((n) => n >= 3).length;
  // Day charts are centred on today: the 7 days before, today, then 6 days still to come.
  const around = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i - 7); return d; });
  const aKeys = around.map((d) => dayKey(d));
  const aLabels = around.map((d) => String(d.getDate()));
  const aWater = aKeys.map((k) => water[k] ?? 0);
  const aProtein = aKeys.map((k) => meals.filter((m) => m.day === k).reduce((a, m) => a + m.protein, 0));

  return (
    <Animated.View entering={enter(0)}>
      <Card style={{ gap: 16 }}>
        <Segmented options={fuels} value={fu} onChange={setFuel} />
        <Draw k={fu}>
          {fu === 'water' && (
            <Panel value={hitWater} unit="/ 14 days" cap={`On target · ${t.water} glasses a day`} empty={!glasses.some((g) => g > 0) && 'Log water on the Fuel tab'}>
              <Bars items={aWater.map((g, i) => ({ label: aLabels[i], value: g }))} goal={t.water} height={100} now={7} color={c.blue} />
            </Panel>
          )}
          {fu === 'protein' && (
            <Panel value={Math.round(aProtein[7])} unit={`/ ${t.protein} g`} cap="Protein today" empty={!protein.some((p) => p > 0) && 'Log meals on the Fuel tab'}>
              <Bars items={aProtein.map((p, i) => ({ label: aLabels[i], value: Math.round(p) }))} goal={t.protein} height={100} now={7} color={c.pink} />
            </Panel>
          )}
          {fu === 'kcal' && (
            <Panel value={kcalAvg || '-'} unit={kcalAvg ? 'kcal' : undefined} cap={`Average logged day · target ${t.kcal}`} empty={kcalLogged.length < 2 && 'Log meals on two days to see this'}>
              <LineChart values={kcalLogged} goal={t.kcal} fmt={(v) => `${Math.round(v)}`} height={120} color={c.pink} />
            </Panel>
          )}
          {fu === 'meals' && (
            <Panel value={(totalMeals / 14).toFixed(1)} cap={`Meals a day · 3+ on ${fullDays} of 14 days`} empty={!totalMeals && 'Log meals on the Fuel tab'} />
          )}
        </Draw>
      </Card>
    </Animated.View>
  );
}

// ---------- Achievements: level gauge and the full medal shelf ----------
function Medals() {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const enter = useEnter();
  if (!profile) return null;
  const all = { profile, sessions, meals, water };
  return <Animated.View entering={enter(0)}><Card><Achievements lv={level(all)} badges={badges(all)} /></Card></Animated.View>;
}

const s = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  dash: { width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  stages: { flexDirection: 'row', height: 14, borderRadius: r.sm, overflow: 'hidden', backgroundColor: c.card2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
