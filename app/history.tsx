import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { bestStreak, dayKey, doneSets, streak, volume } from '../src/calc';
import { byId } from '../src/data/exercises';
import { useStore } from '../src/store';
import { c, f, r } from '../src/theme';
import { Card, Rise, Row, Screen, Stat, T, Tap, Thumb } from '../src/ui';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function History() {
  const sessions = useStore((s) => s.sessions);
  const deleteSession = useStore((s) => s.deleteSession);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [day, setDay] = useState(dayKey());
  const [confirm, setConfirm] = useState<string | null>(null);

  const byDay: Record<string, typeof sessions> = {};
  for (const s of sessions) (byDay[dayKey(s.startedAt)] ??= []).push(s);
  const lead = (month.getDay() + 6) % 7; // Monday-first grid
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const picked = byDay[day] ?? [];
  const inMonth = sessions.filter((s) => new Date(s.startedAt).getMonth() === month.getMonth() && new Date(s.startedAt).getFullYear() === month.getFullYear()).length;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        <T v="label">History</T>
        <View style={{ width: 40 }} />
      </Row>

      <Rise>
        <Row style={{ marginTop: 18, alignItems: 'flex-end' }} gap={10}>
          <T style={{ fontFamily: f.display, fontSize: 72, lineHeight: 80, color: c.text }}>{streak(sessions)}</T>
          <View style={{ paddingBottom: 14 }}>
            <Ionicons name="flame" size={28} color={c.warm} />
            <T v="small">session streak</T>
          </View>
        </Row>
        <T v="small">Rest days don’t break it. Three days off in a row does.</T>
      </Rise>

      <Rise i={1}>
        <Card style={{ marginTop: 16 }}>
          <Row>
            <Stat label="Best streak" value={bestStreak(sessions)} color={c.warm} />
            <Stat label="This month" value={inMonth} />
            <Stat label="All time" value={sessions.length} />
          </Row>
        </Card>
      </Rise>

      <Rise i={2}>
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Tap onPress={() => shift(-1)} style={s.nav}><Ionicons name="chevron-back" size={18} color={c.text} /></Tap>
            <T v="h3">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</T>
            <Tap onPress={() => shift(1)} style={s.nav}><Ionicons name="chevron-forward" size={18} color={c.text} /></Tap>
          </Row>
          <View style={s.grid}>
            {DOW.map((d, i) => <T key={`h${i}`} v="label" style={s.cellHead}>{d}</T>)}
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={s.cell} />;
              const k = dayKey(d), did = !!byDay[k], on = k === day, today = k === dayKey();
              return (
                <Tap key={k} onPress={() => setDay(k)} style={s.cell} scale={0.9} feedback="none">
                  <View style={[s.dayDot, did && { backgroundColor: c.accent }, on && { borderColor: c.text, borderWidth: 1.5 }, today && !did && { backgroundColor: c.card2 }]}>
                    <T v="small" color={did ? c.accentInk : d.getTime() > Date.now() ? c.dim : c.text}>{d.getDate()}</T>
                  </View>
                </Tap>
              );
            })}
          </View>
        </Card>
      </Rise>

      <T v="h3" style={{ marginTop: 22, marginBottom: 10 }}>{new Date(day + 'T12:00:00').toDateString()}</T>
      {picked.length === 0 && <T v="body" color={c.muted}>No workout logged this day.</T>}
      {picked.map((ss) => (
        <Animated.View key={ss.id} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(250)}>
          <Card style={{ marginBottom: 10, gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T v="h3">{ss.title}</T>
                <T v="small">{doneSets(ss)} sets · {Math.round(volume(ss))} kg · {Math.max(1, Math.round(((ss.endedAt ?? ss.startedAt) - ss.startedAt) / 60000))} min</T>
              </View>
              <Tap onPress={() => (confirm === ss.id ? deleteSession(ss.id) : setConfirm(ss.id))} style={[s.nav, confirm === ss.id && { backgroundColor: '#2A1210' }]}>
                <Ionicons name="trash-outline" size={16} color={confirm === ss.id ? c.danger : c.muted} />
              </Tap>
            </Row>
            {confirm === ss.id && <T v="small" color={c.danger}>Tap the bin again to delete this workout.</T>}
            {ss.items.map((it) => (
              <Row key={it.exId} gap={10}>
                <Thumb ex={byId[it.exId]} size={36} />
                <T v="body" style={{ flex: 1 }} numberOfLines={1}>{byId[it.exId]?.name}</T>
                <T v="small">{it.sets.map((x) => (x.weight ? `${x.weight}×${x.reps}` : x.reps)).join('  ')}</T>
              </Row>
            ))}
          </Card>
        </Animated.View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  nav: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  cellHead: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 34, height: 34, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center' },
});
