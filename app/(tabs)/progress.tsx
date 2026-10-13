import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { mapped, MuscleMap } from '../../src/body';
import { Bars, LineChart } from '../../src/charts';
import { dayKey, doneSets, e1rm, streak, targets, volume } from '../../src/calc';
import { byId, title } from '../../src/data/exercises';
import { badges, level } from '../../src/data/badges';
import { JourneyPath } from '../../src/path';
import { Journey } from '../../src/journey';
import { useStore } from '../../src/store';
import { c } from '../../src/theme';
import { Button, Card, Chip, Fold, haptic, IconBox, ListRow, Rise, Row, Screen, Section, Stat, Stepper, T, Tap, TabTitle, Tile } from '../../src/ui';

const DAY = 86400000;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const kgShort = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const kgLabel = (v: number) => `${kgShort(v)} kg`;
const short = (t: number | string) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

type Trend = 'volume' | 'sessions' | 'strength' | 'weight';
type Fuel = 'water' | 'protein' | 'kcal' | 'meals';
const TRENDS: { k: Trend; label: string }[] = [{ k: 'volume', label: 'Volume' }, { k: 'sessions', label: 'Sessions' }, { k: 'strength', label: 'Strength' }, { k: 'weight', label: 'Weight' }];
const FUELS: { k: Fuel; label: string }[] = [{ k: 'water', label: 'Water' }, { k: 'protein', label: 'Protein' }, { k: 'kcal', label: 'Calories' }, { k: 'meals', label: 'Meals' }];

export default function Progress() {
  const sessions = useStore((s) => s.sessions);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const logWeight = useStore((s) => s.logWeight);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const [kg, setKg] = useState(profile?.weightKg ?? 70);
  const [wide, setWide] = useState(false); // activity heatmap: 2 weeks, or 12 when expanded
  const [pick, setPick] = useState<string | null>(null); // strength curve exercise
  const [trend, setTrend] = useState<Trend>('volume');
  const [fuel, setFuel] = useState<Fuel>('water');
  if (!profile) return null;
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  // No-numbers mode hides weight and calorie charts; fall back if one was picked before it was switched on.
  const tr: Trend = gentle && trend === 'weight' ? 'volume' : trend;
  const fu: Fuel = gentle && (fuel === 'protein' || fuel === 'kcal') ? 'water' : fuel;
  const trends = TRENDS.filter((o) => !gentle || o.k !== 'weight');
  const fuels = FUELS.filter((o) => !gentle || o.k === 'water' || o.k === 'meals');

  // Fuel and water, last 14 days, oldest first. Noon anchors keep DST changes from shifting a day.
  const fortnight = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (13 - i)); return d; });
  const keys = fortnight.map((d) => dayKey(d));
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
  const avgMeals = totalMeals / 14;
  const fullDays = mealCounts.filter((n) => n >= 3).length;
  // Day charts are centred on today: the 7 days before, today, then 6 days still to come.
  const around = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i - 7); return d; });
  const aKeys = around.map((d) => dayKey(d));
  const aLabels = around.map((d) => String(d.getDate())); // today's bar and label are in the accent colour
  const aWater = aKeys.map((k) => water[k] ?? 0);
  const aProtein = aKeys.map((k) => meals.filter((m) => m.day === k).reduce((a, m) => a + m.protein, 0));

  // Weeks run Monday to Sunday. back(k, d) is day d (0 = Monday) of the week k weeks before this one.
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const back = (k: number, d = 0) => { const x = new Date(mon); x.setDate(mon.getDate() - 7 * k + d); return x; };
  const weekOf = (k: number) => { const a = back(k).getTime(), b = back(k - 1).getTime(); return sessions.filter((s) => s.startedAt >= a && s.startedAt < b); };

  const volTrend = Array.from({ length: 12 }, (_, i) => weekOf(11 - i).reduce((a, s) => a + volume(s), 0));
  // Four weeks back, this week in the middle, three weeks ahead.
  const perWeek = Array.from({ length: 8 }, (_, i) => ({ label: i === 4 ? 'Now' : String(back(4 - i).getDate()), value: i > 4 ? 0 : weekOf(4 - i).length }));
  const lastW = weights.length ? [...weights].sort((a, b) => a.day.localeCompare(b.day))[weights.length - 1] : null;
  const loggedToday = lastW?.day === dayKey();

  const counts: Record<string, number> = {};
  for (const s of sessions) { const k = dayKey(s.startedAt); counts[k] = (counts[k] ?? 0) + doneSets(s); }
  const weeksBack = Array.from({ length: wide ? 12 : 2 }, (_, i) => (wide ? 12 : 2) - 1 - i); // oldest first

  // Muscles from the last 30 days: primary muscles count every set, helpers half. Top 3 are primary on the map, next 4 helpers.
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
  const ranked = Object.entries(split).filter(([m]) => mapped(m)).sort((a, b) => b[1] - a[1]);
  const splitRows = ranked.slice(0, 8);
  const maxS = Math.max(1, ...splitRows.map((x) => x[1]));
  const mainMuscles = ranked.slice(0, 3).map((x) => x[0]);
  const helperMuscles = ranked.slice(3, 7).map((x) => x[0]);

  // Best estimated 1RM per exercise, and the strength curve of the picked one.
  const best: Record<string, number> = {};
  for (const s of sessions) for (const it of s.items) for (const x of it.sets) if (x.weight) best[it.exId] = Math.max(best[it.exId] ?? 0, e1rm(x.weight, x.reps));
  const lifts = Object.entries(best).sort((a, b) => b[1] - a[1]);
  const topIds = lifts.slice(0, 6).map((x) => x[0]);
  const cur = pick && topIds.includes(pick) ? pick : topIds[0];
  const curve = cur ? sessions.flatMap((s) => {
    const v = Math.max(0, ...s.items.filter((it) => it.exId === cur).flatMap((it) => it.sets.filter((x) => x.done && x.weight).map((x) => e1rm(x.weight, x.reps))));
    return v > 0 ? [v] : [];
  }).slice(-20) : [];

  const w = weights.slice(-30);
  const now = new Date();
  const thisMonth = sessions.filter((s) => { const d = new Date(s.startedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  // Achievements road and level, from the same store slices (no getState, so it re-renders when they change).
  const all = { profile, sessions, meals, water };
  const lv = level(all), bs = badges(all);
  const stops = bs.filter((x) => x.got).length;

  // Example projection: starts from the real top lift when there is one, else a sample 40 kg. Compounds 1.5% a week.
  const base = cur ? best[cur] : 40;
  const days = Math.max(1, profile.daysPerWeek);
  const proj = Array.from({ length: 13 }, (_, i) => base * Math.pow(1.015, i));
  const gain = base * (Math.pow(1.015, 12) - 1);
  const intro = cur ? `From your ${byId[cur]?.name ?? 'top lift'} · ${days} sessions a week` : `Sample 40 kg lift · ${days} sessions a week`;
  const same = loggedToday && lastW?.kg === +kg.toFixed(1);

  return (
    <Screen>
      <Rise><TabTitle title="Progress" /></Rise>

      <Rise i={1}>
        <Row gap={12} style={{ marginTop: 20 }}>
          <Tile icon="barbell" value={sessions.length} label="Workouts" />
          <Tile icon="calendar" value={thisMonth} label="This month" />
          <Tile icon="flame" color={c.warm} value={streak(sessions)} label="Streak" onPress={() => router.push('/history')} />
        </Row>
      </Rise>

      {/* Hero: one chart at a time, picked with the switch. */}
      <Rise i={2}>
        <Section title="Trends">
          <Card style={{ gap: 16 }}>
            <Seg opts={trends} value={tr} onChange={setTrend} />
            <Animated.View key={tr} entering={FadeIn.duration(220).easing(EASE)} style={{ gap: 12 }}>
              {tr === 'volume' && (
                <Panel value={kgShort(volTrend[11])} unit="kg" cap="This week · 12-week trend" empty={!volTrend.some((v) => v > 0) && 'Finish a workout to see volume'}>
                  <LineChart values={volTrend} fmt={kgLabel} height={120} />
                  <Row style={{ justifyContent: 'space-between' }}><T v="small">12 weeks ago</T><T v="small">This week</T></Row>
                </Panel>
              )}
              {tr === 'sessions' && (
                <Panel value={perWeek[4].value} cap="Sessions this week" empty={!sessions.length && 'No sessions yet'}>
                  <Bars items={perWeek} now={4} />
                </Panel>
              )}
              {tr === 'strength' && (
                <>
                  {topIds.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                      {topIds.map((id) => <Chip key={id} label={byId[id]?.name ?? id} on={id === cur} onPress={() => setPick(id)} />)}
                    </ScrollView>
                  )}
                  <Panel value={cur ? Math.round(best[cur]) : '-'} unit={cur ? 'kg' : undefined} cap={`Best est. 1RM · ${curve.length} session${curve.length === 1 ? '' : 's'}`}
                    empty={!topIds.length && 'Log sets with weight to see this'}>
                    <LineChart values={curve} fmt={(v) => `${Math.round(v)} kg`} height={120} />
                  </Panel>
                </>
              )}
              {tr === 'weight' && (
                <Panel value={lastW ? lastW.kg.toFixed(1) : '-'} unit={lastW ? 'kg' : undefined} cap={`Goal ${profile.goalWeightKg} kg · ${weights.length} weigh-ins`}
                  empty={!w.length && 'Log your weight below'}>
                  <LineChart values={w.map((p) => p.kg)} goal={profile.goalWeightKg} fmt={(v) => `${v.toFixed(1)} kg`} height={120} />
                </Panel>
              )}
            </Animated.View>
          </Card>
        </Section>
      </Rise>

      <Rise i={3}>
        <Section title="Journey">
          <Card style={{ gap: 16 }}>
            <View style={{ gap: 10 }}>
              <Row gap={12}>
                <IconBox icon="ribbon" />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h3" numberOfLines={1}>Level {lv.lvl} · {lv.name}</T>
                  <T v="small" numberOfLines={1}>{lv.into}/{lv.need} XP · {stops} of {bs.length} stops</T>
                </View>
              </Row>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (lv.into / lv.need) * 100)}%`, backgroundColor: c.accent }]} /></View>
            </View>
            <JourneyPath badges={bs} />
          </Card>
        </Section>
      </Rise>

      {!gentle && (
        <Rise i={4}>
          <Section title="Body weight">
            <Card style={{ gap: 16 }}>
              <Row gap={12}>
                <IconBox icon="scale-outline" />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="h3" numberOfLines={1}>{lastW ? `${lastW.kg.toFixed(1)} kg` : 'No weigh-ins yet'}</T>
                  <T v="small" numberOfLines={1}>{lastW ? `${loggedToday ? 'Today' : short(lastW.day + 'T12:00:00')} · goal ${profile.goalWeightKg} kg` : `Goal ${profile.goalWeightKg} kg`}</T>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Stepper value={kg} step={0.1} onChange={setKg} min={30} suffix=" kg" />
                <Button title={same ? 'Logged' : loggedToday ? 'Update' : 'Log'} icon={same ? 'checkmark' : undefined}
                  onPress={() => { logWeight(+kg.toFixed(1)); haptic('success'); }} style={{ height: 44, paddingHorizontal: 22 }} />
              </Row>
            </Card>
          </Section>
        </Rise>
      )}

      {!gentle && (profile.goal === 'lose fat' || profile.concerns?.some((x) => x === 'lose-weight' || x === 'gain') || Math.abs(profile.goalWeightKg - profile.weightKg) >= 1) && (
        <Rise i={4}><Journey p={profile} sessions={sessions} meals={meals} weights={weights} /></Rise>
      )}

      <Rise i={5}>
        <Section title="Muscles">
          {splitRows.length ? (
            <Card style={{ gap: 12 }}>
              <T v="small">Sets · last 30 days</T>
              <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <MuscleMap primary={mainMuscles} secondary={helperMuscles} size={180} />
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
      </Rise>

      {lifts.length > 0 && (
        <Rise i={6}>
          <Section title="Top lifts">
            <View style={{ gap: 8 }}>
              {lifts.slice(0, 5).map(([id, v], i) => (
                <ListRow key={id} icon={i === 0 ? 'trophy' : 'barbell'} title={byId[id]?.name ?? id} sub={`#${i + 1} · est. 1RM`}
                  right={<T v="h3" color={c.accent}>{Math.round(v)} kg</T>} />
              ))}
            </View>
          </Section>
        </Rise>
      )}

      <Rise i={7}>
        <Section title="Activity" action={wide ? 'Collapse' : 'Expand'} onAction={() => setWide(!wide)}>
          <Card>
            <Animated.View layout={LinearTransition.duration(320).easing(EASE)} style={{ gap: 6, overflow: 'hidden' }}>
              <Row gap={6}>{DAYS.map((d, i) => <T key={i} v="label" style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}</Row>
              {weeksBack.map((k) => (
                <Animated.View key={k} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ flexDirection: 'row', gap: 6 }}>
                  {DAYS.map((_, j) => {
                    const d = back(k, j);
                    const n = counts[dayKey(d)] ?? 0;
                    const future = d.getTime() > Date.now();
                    return <View key={j} style={[s.cell, { backgroundColor: future ? 'transparent' : n === 0 ? c.card2 : n < 8 ? c.accent + '55' : n < 16 ? c.accent + 'AA' : c.accent }]} />;
                  })}
                </Animated.View>
              ))}
            </Animated.View>
            {!sessions.length && <T v="small" style={{ marginTop: 12 }}>Fills in as you train</T>}
          </Card>
        </Section>
      </Rise>

      <Rise i={8}>
        <Section title="Fuel and water" action="Fuel" onAction={() => router.push('/fuel')}>
          <Card style={{ gap: 16 }}>
            <Seg opts={fuels} value={fu} onChange={setFuel} />
            <Animated.View key={fu} entering={FadeIn.duration(220).easing(EASE)}>
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
                <Panel value={avgMeals.toFixed(1)} cap={`Meals a day · 3+ on ${fullDays} of 14 days`} empty={!totalMeals && 'Log meals on the Fuel tab'} />
              )}
            </Animated.View>
          </Card>
        </Section>
      </Rise>

      <Rise i={9}>
        <Section title="Preview">
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
        </Section>
      </Rise>

      <Rise i={10}>
        <Section title="History" action="Calendar" onAction={() => router.push('/history')}>
          {sessions.length === 0 ? <ListRow icon="time-outline" title="No workouts yet" sub="Finished workouts show up here" /> : (
            <View style={{ gap: 8 }}>
              {[...sessions].reverse().slice(0, 20).map((ss) => (
                <ListRow key={ss.id} icon={ss.place === 'home' ? 'home' : 'barbell'} title={ss.title}
                  sub={`${short(ss.startedAt)} · ${doneSets(ss)} sets · ${kgLabel(volume(ss))}`} />
              ))}
            </View>
          )}
        </Section>
      </Rise>
    </Screen>
  );
}

// A segmented switch: one option on at a time, same look as the place switch on Today.
function Seg<K extends string>({ opts, value, onChange }: { opts: { k: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.segs}>
      {opts.map((o) => (
        <Tap key={o.k} onPress={() => onChange(o.k)} scale={0.96} style={[s.seg, value === o.k && { backgroundColor: c.text }]}>
          <T v="small" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} color={value === o.k ? c.bg : c.muted}>{o.label}</T>
        </Tap>
      ))}
    </View>
  );
}

// One chart panel: a big number, one caption line, then the chart. With nothing logged yet, just the empty line.
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

const s = StyleSheet.create({
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  segs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: c.card2 },
  seg: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
