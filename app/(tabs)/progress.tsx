import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { mapped, MuscleMap } from '../../src/body';
import { Bars, LineChart } from '../../src/charts';
import { dayKey, doneSets, e1rm, streak, targets, volume } from '../../src/calc';
import { byId, title } from '../../src/data/exercises';
import { Journey } from '../../src/journey';
import { Sheet } from '../../src/sheet';
import { useStore } from '../../src/store';
import { c } from '../../src/theme';
import { Button, Card, Chip, Rise, Row, Screen, Stat, Stepper, T, Tap } from '../../src/ui';

const DAY = 86400000;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const kgLabel = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k kg` : `${Math.round(v)} kg`);

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
  const [preview, setPreview] = useState(false);
  if (!profile) return null;
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));

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
  const totalMeals = mealCounts.reduce((a, b) => a + b, 0);
  const avgMeals = totalMeals / 14;
  const fullDays = mealCounts.filter((n) => n >= 3).length;
  const dayLabels = fortnight.map((d) => String(d.getDate()));

  // Weeks run Monday to Sunday. back(k, d) is day d (0 = Monday) of the week k weeks before this one.
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const back = (k: number, d = 0) => { const x = new Date(mon); x.setDate(mon.getDate() - 7 * k + d); return x; };
  const weekOf = (k: number) => { const a = back(k).getTime(), b = back(k - 1).getTime(); return sessions.filter((s) => s.startedAt >= a && s.startedAt < b); };

  const volTrend = Array.from({ length: 12 }, (_, i) => weekOf(11 - i).reduce((a, s) => a + volume(s), 0));
  const perWeek = Array.from({ length: 8 }, (_, i) => ({ label: String(back(7 - i).getDate()), value: weekOf(7 - i).length }));

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

  // Example projection: starts from the real top lift when there is one, else a sample 40 kg. Compounds 1.5% a week.
  const base = cur ? best[cur] : 40;
  const days = Math.max(1, profile.daysPerWeek);
  const proj = Array.from({ length: 13 }, (_, i) => base * Math.pow(1.015, i));
  const gain = base * (Math.pow(1.015, 12) - 1);
  const intro = cur
    ? `Starts from your ${byId[cur]?.name} est. 1RM of ${Math.round(base)} kg and ${days} sessions a week.`
    : `Starts from a sample lift of 40 kg and ${days} sessions a week. Log a few sets and it starts from your own numbers.`;

  return (
    <Screen>
      <Rise><T v="display">Progress</T></Rise>
      <Rise i={1}>
        <Card style={{ marginTop: 18 }}>
          <Row>
            <Stat label="Workouts" value={sessions.length} />
            <Stat label="This month" value={thisMonth} />
            <Stat label="Streak" value={streak(sessions)} color={c.accent} />
          </Row>
        </Card>
      </Rise>

      {!gentle && (profile.goal === 'lose fat' || profile.concerns?.some((x) => x === 'lose-weight' || x === 'gain') || Math.abs(profile.goalWeightKg - profile.weightKg) >= 1) && (
        <Rise i={1}><Journey p={profile} sessions={sessions} meals={meals} weights={weights} /></Rise>
      )}

      <Rise i={2}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="h3">Preview your progress</T>
          <T v="small">See what 12 weeks of steady training could look like.</T>
          <Button title="See an example" kind="ghost" onPress={() => setPreview(true)} />
        </Card>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3">Activity</T>
            <Tap onPress={() => setWide(!wide)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="small" color={c.accent}>{wide ? 'Collapse' : 'Expand'}</T>
              <Ionicons name={wide ? 'chevron-up' : 'chevron-down'} size={14} color={c.accent} />
            </Tap>
          </Row>
          <Animated.View layout={LinearTransition.duration(320).easing(EASE)} style={{ marginTop: 14, gap: 6, overflow: 'hidden' }}>
            <Row gap={6}>{DAYS.map((d, i) => <T key={i} v="label" style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}</Row>
            {weeksBack.map((k) => (
              <Animated.View key={k} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ flexDirection: 'row', gap: 6 }}>
                {DAYS.map((_, j) => {
                  const d = back(k, j);
                  const n = counts[dayKey(d)] ?? 0;
                  const future = d.getTime() > Date.now();
                  return <View key={j} style={[s.cell, { backgroundColor: future ? 'transparent' : n === 0 ? c.card2 : n < 8 ? '#5C7A1F' : n < 16 ? '#93C22E' : c.accent }]} />;
                })}
              </Animated.View>
            ))}
          </Animated.View>
          {!sessions.length && <T v="small" style={{ marginTop: 12 }}>Your activity fills in as you train.</T>}
        </Card>
      </Rise>

      <Rise i={4}>
        <Card style={{ marginTop: 14 }}>
          <T v="h3">Weekly volume · 12 weeks</T>
          {volTrend.some((v) => v > 0) ? (
            <>
              <View style={{ marginTop: 16 }}><LineChart values={volTrend} fmt={kgLabel} height={120} /></View>
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}><T v="small">12 weeks ago</T><T v="small">This week</T></Row>
            </>
          ) : <T v="body" color={c.muted} style={{ marginTop: 12 }}>Finish a workout and your weekly volume shows here.</T>}
        </Card>
      </Rise>

      <Rise i={5}>
        <Card style={{ marginTop: 14 }}>
          <T v="h3">Sessions per week · 8 weeks</T>
          {sessions.length ? <View style={{ marginTop: 14 }}><Bars items={perWeek} /></View>
            : <T v="body" color={c.muted} style={{ marginTop: 12 }}>No sessions yet. Each week's count shows up here.</T>}
        </Card>
      </Rise>

      <Rise i={6}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="h3">Strength curve · est. 1RM</T>
          {topIds.length ? (
            <>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {topIds.map((id) => <Chip key={id} label={byId[id]?.name ?? id} on={id === cur} onPress={() => setPick(id)} />)}
              </Row>
              <LineChart values={curve} fmt={(v) => `${Math.round(v)} kg`} height={120} />
              <T v="small">{curve.length > 1 ? `${curve.length} sessions with this lift` : 'Log this lift again and the curve draws itself.'}</T>
            </>
          ) : <T v="body" color={c.muted}>Log a few sets with weight and your strength curve shows here.</T>}
        </Card>
      </Rise>

      {!gentle && (
        <Rise i={7}>
          <Card style={{ marginTop: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">Body weight</T>
              <T v="small">Goal {profile.goalWeightKg} kg</T>
            </Row>
            <View style={{ marginTop: 16 }}>
              {w.length ? <LineChart values={w.map((p) => p.kg)} goal={profile.goalWeightKg} fmt={(v) => `${v.toFixed(1)} kg`} height={120} />
                : <T v="body" color={c.muted}>Log your weight to start the line.</T>}
            </View>
            <Row style={{ marginTop: 16, justifyContent: 'space-between' }}>
              <Stepper value={kg} step={0.1} onChange={setKg} min={30} suffix=" kg" />
              <Button title="Log" onPress={() => logWeight(+kg.toFixed(1))} style={{ height: 44, paddingHorizontal: 22 }} />
            </Row>
          </Card>
        </Rise>
      )}

      <Rise i={8}>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="h3">Muscle map · 30 days</T>
          {splitRows.length ? (
            <>
              <View style={{ alignItems: 'center', marginVertical: 4 }}>
                <MuscleMap primary={mainMuscles} secondary={helperMuscles} size={180} />
              </View>
              {splitRows.map(([m, n]) => (
                <Row key={m} gap={10}>
                  <T v="small" color={c.text} style={{ width: 90 }} numberOfLines={1}>{title(m)}</T>
                  <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.card2 }}>
                    <View style={{ width: `${(n / maxS) * 100}%`, height: 10, borderRadius: 5, backgroundColor: c.blue }} />
                  </View>
                  <T v="small" style={{ width: 28, textAlign: 'right' }}>{Math.round(n)}</T>
                </Row>
              ))}
            </>
          ) : <T v="body" color={c.muted}>Train this month and your muscle map fills in.</T>}
        </Card>
      </Rise>

      {lifts.length > 0 && (
        <Rise i={9}>
          <Card style={{ marginTop: 14, gap: 12 }}>
            <T v="h3">Top lifts · est. 1RM</T>
            {lifts.slice(0, 5).map(([id, v], i) => (
              <Row key={id} style={{ justifyContent: 'space-between' }}>
                <T v="num" color={i === 0 ? c.accent : i < 3 ? c.text : c.dim} style={{ fontSize: 18, lineHeight: 22, width: 20 }}>{i + 1}</T>
                <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{byId[id]?.name}</T>
                <T v="h3" color={c.accent}>{Math.round(v)} kg</T>
              </Row>
            ))}
          </Card>
        </Rise>
      )}

      <Rise i={10}>
        <T v="h2" style={{ marginTop: 26 }}>Fuel and water</T>
        <Card style={{ marginTop: 14, gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3">Water · 14 days</T>
            <T v="small">Target {t.water} glasses</T>
          </Row>
          {glasses.some((g) => g > 0)
            ? <Bars items={glasses.map((g, i) => ({ label: dayLabels[i], value: g }))} goal={t.water} height={100} />
            : <T v="body" color={c.muted}>Log water on the Fuel tab and your glasses show here.</T>}
          <T v="small">{hitWater} of 14 days on target. Bars that reach the dashed line met the goal that day.</T>
        </Card>

        {!gentle && (
          <>
            <Card style={{ marginTop: 14, gap: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="h3">Calories · logged days</T>
                <T v="small">Target {t.kcal} kcal</T>
              </Row>
              {kcalLogged.length > 1
                ? <LineChart values={kcalLogged} goal={t.kcal} fmt={(v) => `${Math.round(v)}`} height={120} />
                : <T v="body" color={c.muted}>Log meals on at least two days to see the calorie line.</T>}
              <T v="small">Each dot is a day with meals logged, and the dashed line is your daily target. Days without meals are left out.</T>
            </Card>
            <Card style={{ marginTop: 14, gap: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="h3">Protein · 14 days</T>
                <T v="small">Target {t.protein} g</T>
              </Row>
              {protein.some((p) => p > 0)
                ? <Bars items={protein.map((p, i) => ({ label: dayLabels[i], value: Math.round(p) }))} goal={t.protein} height={100} />
                : <T v="body" color={c.muted}>Log protein with your meals and the bars fill in.</T>}
              <T v="small">Each bar is grams of protein that day. Bars that reach the dashed line met the target.</T>
            </Card>
          </>
        )}

        <Card style={{ marginTop: 14, gap: 12 }}>
          <T v="h3">Meals logged · 14 days</T>
          {totalMeals > 0 ? (
            <Row>
              <Stat label="Meals per day" value={avgMeals.toFixed(1)} />
              <Stat label="Days with 3+ meals" value={`${fullDays} of 14`} color={c.accent} />
            </Row>
          ) : <T v="body" color={c.muted}>Log meals on the Fuel tab and your daily average shows here.</T>}
          <T v="small">The average counts every day in the last two weeks, including days with no meals logged.</T>
        </Card>

        <Row style={{ marginTop: 26, marginBottom: 10, justifyContent: 'space-between' }}>
          <T v="h3">History</T>
          <Tap onPress={() => router.push('/history')}><T v="small" color={c.accent}>Calendar & streaks</T></Tap>
        </Row>
        {sessions.length === 0 && <T v="body" color={c.muted}>Your finished workouts will show up here.</T>}
        <View style={{ gap: 8 }}>
          {[...sessions].reverse().slice(0, 20).map((ss) => (
            <Card key={ss.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <View style={{ flex: 1 }}>
                <T v="h3">{ss.title}</T>
                <Row gap={6}><T v="small">{new Date(ss.startedAt).toDateString()}</T><Ionicons name={ss.place === 'home' ? 'home' : 'barbell'} size={12} color={c.muted} /></Row>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="h3">{doneSets(ss)} sets</T>
                <T v="small">{Math.round(volume(ss))} kg</T>
              </View>
            </Card>
          ))}
        </View>
      </Rise>

      <Sheet open={preview} onClose={() => setPreview(false)}>
        <View style={{ gap: 14 }}>
          <T v="label" color={c.warm}>Example, not a promise</T>
          <T v="h2">12 weeks of steady training</T>
          <T v="small">{intro}</T>
          <T v="label" style={{ marginTop: 6 }}>Estimated strength</T>
          <LineChart values={proj} fmt={(v) => `${Math.round(v)} kg`} height={110} />
          <T v="small">Rising about 1.5% a week, anywhere from 1% to 2%.</T>
          <T v="label">Sessions per week</T>
          <Bars items={Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: days }))} height={90} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Stat label="Sessions" value={days * 12} />
            <Stat label="Streak" value="12 wks" color={c.accent} />
            <Stat label="Strength" value={`+${Math.round(gain)} kg`} />
          </Row>
          <Button title="Close" kind="ghost" onPress={() => setPreview(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
});
