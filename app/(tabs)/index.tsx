import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { dayKey, streak as calcStreak, targets } from '../../src/calc';
import { greeting, nudge } from '../../src/coach';
import { available, byId, type Place } from '../../src/data/exercises';
import { planById, type Day } from '../../src/data/plans';
import { useStore } from '../../src/store';
import { c, f, r } from '../../src/theme';
import { Button, Card, Chip, Ring, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Today() {
  const profile = useStore((s) => s.profile)!;
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const plan = planById[useStore((s) => s.planId)] ?? planById['full-body-gym'];
  const nextDay = useStore((s) => s.nextDay);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water[dayKey()] ?? 0);
  const start = useStore((s) => s.start);
  const [place, setPlace] = useState<Place>(profile?.place === 'home' ? 'home' : 'gym');
  if (!profile) return null;

  const day = plan.days[nextDay % plan.days.length];
  const streak = calcStreak(sessions);
  const t = targets(profile);
  const today = meals.filter((m) => m.day === dayKey());
  const kcal = today.reduce((a, m) => a + m.kcal, 0);
  const protein = today.reduce((a, m) => a + m.protein, 0);
  const trained = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const swaps = day.slots.filter((sl) => !available(byId[sl.id], place, profile.gear)).length;

  const go = (d: Day, pl: Place, planId?: string) => { start(d, pl, planId); router.push('/session'); };

  return (
    <Screen>
      <Rise>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T v="small">{greeting()}</T>
            <T v="display" numberOfLines={1}>{profile.name}</T>
          </View>
          <Row gap={8}>
            <Tap onPress={() => router.push('/history')} style={s.streak}>
              <Ionicons name="flame" size={18} color={c.warm} />
              <T v="h3">{streak}</T>
            </Tap>
            <Tap onPress={() => router.push('/you')} style={s.avatar}>
              <T v="h3" color={c.accentInk}>{profile.name[0]?.toUpperCase()}</T>
            </Tap>
          </Row>
        </Row>
      </Rise>

      <Rise i={1}>
        <Row style={{ justifyContent: 'space-between', marginTop: 18 }} gap={6}>
          {WEEK.map((w, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            const isToday = dayKey(d) === dayKey();
            const did = trained.has(dayKey(d));
            return (
              <View key={i} style={[s.wd, isToday && s.wdToday, did && s.wdDone]}>
                <T v="label" color={did ? c.accentInk : isToday ? c.text : c.muted}>{w}</T>
                <T v="h3" color={did ? c.accentInk : c.text}>{d.getDate()}</T>
              </View>
            );
          })}
        </Row>
      </Rise>

      {active && (
        <Rise i={2}>
          <Tap onPress={() => router.push('/session')} style={[s.resume]}>
            <Ionicons name="play" size={18} color={c.accentInk} />
            <T v="h3" color={c.accentInk} style={{ flex: 1 }}>Resume {active.title}</T>
            <Ionicons name="chevron-forward" size={18} color={c.accentInk} />
          </Tap>
        </Rise>
      )}

      <Rise i={2}>
        <View style={s.hero}>
          <LinearGradient colors={[plan.color + '55', plan.color + '10', c.card]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label" color={plan.color}>Up next · {plan.name}</T>
            <Tap onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}><Ionicons name="ellipsis-horizontal" size={20} color={c.muted} /></Tap>
          </Row>
          <T v="display" style={{ fontSize: 52, lineHeight: 58, marginTop: 6 }}>{day.name}</T>
          <T v="body" color={c.muted}>{day.focus}</T>
          <Row style={{ marginTop: 16 }} gap={8}>
            {day.slots.slice(0, 5).map((sl) => <Thumb key={sl.id} ex={byId[sl.id]} size={48} />)}
            {day.slots.length > 5 && <T v="small">+{day.slots.length - 5}</T>}
          </Row>
          <Row style={{ marginTop: 18 }} gap={8}>
            <Chip label="Gym" icon="barbell" on={place === 'gym'} onPress={() => setPlace('gym')} />
            <Chip label="Home" icon="home" on={place === 'home'} onPress={() => setPlace('home')} />
          </Row>
          {swaps > 0 && (
            <T v="small" color={c.warm} style={{ marginTop: 10 }}>
              {swaps} exercise{swaps > 1 ? 's' : ''} need gym kit, so they’ll be swapped for home alternatives.
            </T>
          )}
          <Button title={`Start · ${day.slots.length} exercises`} icon="play" style={{ marginTop: 16 }} onPress={() => go(day, place, plan.id)} />
        </View>
      </Rise>

      <Rise i={3}>
        <Card style={{ marginTop: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={s.coach}><Ionicons name="chatbubble-ellipses" size={18} color={c.accentInk} /></View>
          <T v="body" style={{ flex: 1 }}>{nudge(profile, sessions, streak)}</T>
        </Card>
      </Rise>

      <Rise i={4}>
        <Tap onPress={() => router.push('/fuel')} scale={0.98}>
          <Card style={{ marginTop: 14 }}>
            <T v="label">Today’s fuel</T>
            <Row style={{ justifyContent: 'space-around', marginTop: 14 }}>
              <Mini value={kcal} max={t.kcal} label="kcal" color={c.warm} />
              <Mini value={protein} max={t.protein} label="protein g" color={c.pink} />
              <Mini value={water} max={t.water} label="water" color={c.blue} />
            </Row>
          </Card>
        </Tap>
      </Rise>

      <Rise i={5}>
        <T v="label" style={{ marginTop: 26, marginBottom: 12 }}>Quick sessions</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {[
            { p: 'pelvic-floor', d: 0, icon: 'pulse', min: 10 },
            { p: 'fat-burn-home', d: 1, icon: 'flame', min: 15 },
            { p: 'mobility', d: 0, icon: 'body', min: 12 },
            { p: 'fat-burn-home', d: 0, icon: 'heart', min: 20 },
          ].map((q, i) => {
            const qp = planById[q.p]; const qd = qp.days[q.d];
            return (
              <Tap key={i} onPress={() => go(qd, place)} style={[s.quick, { borderColor: qp.color + '55' }]}>
                <View style={[s.quickIcon, { backgroundColor: qp.color }]}><Ionicons name={q.icon as never} size={20} color={c.accentInk} /></View>
                <T v="h3" style={{ marginTop: 14 }}>{qd.name}</T>
                <T v="small">{q.min} min · no kit</T>
              </Tap>
            );
          })}
        </ScrollView>
      </Rise>
    </Screen>
  );
}

function Mini({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Ring size={74} stroke={7} progress={value / max} color={color}>
        <T style={{ fontFamily: f.display, fontSize: 18 }}>{value}</T>
      </Ring>
      <T v="small">{label} / {max}</T>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card2, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.line },
  wd: { flex: 1, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.card },
  wdToday: { borderWidth: 1.5, borderColor: c.text },
  wdDone: { backgroundColor: c.accent },
  hero: { marginTop: 18, borderRadius: r.xl, padding: 22, overflow: 'hidden', backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  resume: { marginTop: 18, height: 56, borderRadius: 28, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  coach: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  quick: { width: 150, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1 },
  quickIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
