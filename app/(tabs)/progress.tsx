import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { dayKey, doneSets, e1rm, streak, volume } from '../../src/calc';
import { byId, title } from '../../src/data/exercises';
import { useStore } from '../../src/store';
import { c } from '../../src/theme';
import { Button, Card, Rise, Row, Screen, Stat, Stepper, T, Tap } from '../../src/ui';

const DAY = 86400000;

export default function Progress() {
  const sessions = useStore((s) => s.sessions);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const logWeight = useStore((s) => s.logWeight);
  const [kg, setKg] = useState(profile?.weightKg ?? 70);
  const [chartW, setChartW] = useState(300);
  if (!profile) return null;

  // Weekly volume, last 8 weeks (Monday-first).
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = monday.getTime() - (7 - i) * 7 * DAY;
    const ss = sessions.filter((s) => s.startedAt >= from && s.startedAt < from + 7 * DAY);
    return { label: new Date(from).getDate(), v: ss.reduce((a, s) => a + volume(s), 0), n: ss.length };
  });
  const maxV = Math.max(1, ...weeks.map((w) => w.v));

  // 12-week heatmap.
  const counts: Record<string, number> = {};
  for (const s of sessions) counts[dayKey(s.startedAt)] = (counts[dayKey(s.startedAt)] ?? 0) + doneSets(s);
  const heatStart = monday.getTime() - 11 * 7 * DAY;

  // Muscle split, last 30 days.
  const split: Record<string, number> = {};
  for (const s of sessions.filter((x) => Date.now() - x.startedAt < 30 * DAY))
    for (const it of s.items) { const m = byId[it.exId]?.primary[0]; if (m) split[m] = (split[m] ?? 0) + it.sets.length; }
  const splitRows = Object.entries(split).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxS = Math.max(1, ...splitRows.map((x) => x[1]));

  // Records.
  const best: Record<string, number> = {};
  for (const s of sessions) for (const it of s.items) for (const x of it.sets) if (x.weight) best[it.exId] = Math.max(best[it.exId] ?? 0, e1rm(x.weight, x.reps));
  const records = Object.entries(best).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Weight chart.
  const w = weights.slice(-30);
  const vals = [...w.map((x) => x.kg), profile.goalWeightKg];
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1, H = 120;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const x = (i: number) => (w.length < 2 ? chartW / 2 : (i / (w.length - 1)) * (chartW - 12) + 6);

  const thisMonth = sessions.filter((s) => new Date(s.startedAt).getMonth() === new Date().getMonth()).length;

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

      <Rise i={2}>
        <Card style={{ marginTop: 14 }}>
          <T v="label">Weekly volume</T>
          <Row style={{ alignItems: 'flex-end', height: 130, marginTop: 14 }} gap={8}>
            {weeks.map((wk, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={{ width: '100%', height: Math.max(4, (wk.v / maxV) * 100), borderRadius: 8, backgroundColor: i === 7 ? c.accent : c.card2 }} />
                <T v="label">{wk.label}</T>
              </View>
            ))}
          </Row>
        </Card>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14 }}>
          <T v="label">Last 12 weeks</T>
          <Row style={{ marginTop: 14, justifyContent: 'space-between' }} gap={4}>
            {Array.from({ length: 12 }, (_, wi) => (
              <View key={wi} style={{ gap: 4, flex: 1 }}>
                {Array.from({ length: 7 }, (_, di) => {
                  const t = heatStart + (wi * 7 + di) * DAY;
                  const n = counts[dayKey(t)] ?? 0;
                  const future = t > Date.now();
                  return <View key={di} style={[s.cell, { backgroundColor: future ? 'transparent' : n === 0 ? c.card2 : n < 8 ? '#5C7A1F' : n < 16 ? '#93C22E' : c.accent }]} />;
                })}
              </View>
            ))}
          </Row>
        </Card>
      </Rise>

      {!(profile.gentle || profile.concerns?.includes('food')) && <Rise i={4}>
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label">Body weight</T>
            <T v="small">Goal {profile.goalWeightKg} kg</T>
          </Row>
          <View style={{ height: H, marginTop: 16 }} onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
            <Svg width={chartW} height={H}>
              <Line x1={0} x2={chartW} y1={y(profile.goalWeightKg)} y2={y(profile.goalWeightKg)} stroke={c.warm} strokeDasharray="6 6" strokeWidth={1.5} />
              {w.length > 1 && <Polyline points={w.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')} fill="none" stroke={c.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
              {w.map((p, i) => <Circle key={p.day} cx={x(i)} cy={y(p.kg)} r={i === w.length - 1 ? 5 : 3} fill={c.accent} />)}
            </Svg>
          </View>
          <Row style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <Stepper value={kg} step={0.1} onChange={setKg} min={30} suffix=" kg" />
            <Button title="Log" onPress={() => logWeight(+kg.toFixed(1))} style={{ height: 44, paddingHorizontal: 22 }} />
          </Row>
        </Card>
      </Rise>}

      {splitRows.length > 0 && (
        <Rise i={5}>
          <Card style={{ marginTop: 14, gap: 10 }}>
            <T v="label">Muscle split · 30 days</T>
            {splitRows.map(([m, n]) => (
              <Row key={m} gap={10}>
                <T v="small" color={c.text} style={{ width: 90 }} numberOfLines={1}>{title(m)}</T>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.card2 }}>
                  <View style={{ width: `${(n / maxS) * 100}%`, height: 10, borderRadius: 5, backgroundColor: c.blue }} />
                </View>
                <T v="small" style={{ width: 28, textAlign: 'right' }}>{n}</T>
              </Row>
            ))}
          </Card>
        </Rise>
      )}

      {records.length > 0 && (
        <Rise i={6}>
          <Card style={{ marginTop: 14, gap: 12 }}>
            <T v="label">Top lifts · est. 1RM</T>
            {records.map(([id, v], i) => (
              <Row key={id} style={{ justifyContent: 'space-between' }}>
                <T v="num" color={i === 0 ? c.accent : i < 3 ? c.text : c.dim} style={{ fontSize: 18, lineHeight: 22, width: 20 }}>{i + 1}</T>
                <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{byId[id]?.name}</T>
                <T v="h3" color={c.accent}>{Math.round(v)} kg</T>
              </Row>
            ))}
          </Card>
        </Rise>
      )}

      <Rise i={7}>
        <Row style={{ marginTop: 26, marginBottom: 10, justifyContent: 'space-between' }}>
          <T v="label">History</T>
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
    </Screen>
  );
}

const s = StyleSheet.create({
  cell: { aspectRatio: 1, borderRadius: 4 },
});

