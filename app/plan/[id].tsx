import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { doneThisWeek, doneToday } from '../../src/calc';
import { byId } from '../../src/data/exercises';
import { perWeek, planById } from '../../src/data/plans';
import { program, WEEKDAYS } from '../../src/data/program';
import { goalWeeks, timeline } from '../../src/data/expect';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Chip, Rise, Row, Screen, Stat, T, Tap, Thumb } from '../../src/ui';

const rest = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}${sec % 60 ? `:${String(sec % 60).padStart(2, '0')}` : ''} min rest` : `${sec}s rest`);

const Section = ({ label, text }: { label: string; text: string }) => (
  <View style={{ gap: 4 }}><T v="label" color={c.accent}>{label}</T><T v="body">{text}</T></View>
);

export default function PlanDetail() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const plan = planById[id];
  const planId = useStore((s) => s.planId);
  const profile = useStore((s) => s.profile);
  const name = profile.name;
  const goal = goalWeeks(profile);
  const setPlan = useStore((s) => s.setPlan);
  const sessions = useStore((s) => s.sessions);
  const today = doneToday(sessions), week = doneThisWeek(sessions);
  const [wk, setWk] = useState(0);
  if (!plan) return null;
  const isCurrent = plan.id === planId;
  const leave = () => (welcome ? router.replace('/') : router.back());
  const weeks = program(plan, 4);
  const week = weeks[wk];
  const n = perWeek(plan);
  // Each training day once, in the order it first appears in the week, with this week's sets and reps.
  const days = [...new Map(week.days.filter((d) => d.day).map((d) => [d.index!, d.day!] as const)).entries()];

  return (
    <Screen>
      {!welcome && <Tap onPress={leave} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}
      <Rise>
        <T v="label" color={c.accent} style={{ marginTop: welcome ? 8 : 16 }}>
          {welcome ? `Your plan is ready${name ? `, ${name}` : ''}` : `${plan.category} · ${plan.level} · ${plan.place === 'any' ? 'anywhere' : plan.place}`}
        </T>
        <T v="display" style={{ marginTop: 6 }}>{plan.name}</T>
        {isCurrent && !welcome && (
          <Row gap={6} style={[s.current, { backgroundColor: c.accent }]}>
            <Ionicons name="checkmark-circle" size={16} color={c.accentInk} />
            <T v="label" color={c.accentInk}>Your current plan</T>
          </Row>
        )}
        <T v="body" color={c.muted}>{plan.tagline}</T>
        {welcome && <T v="small" style={{ marginTop: 10 }}>Picked from your goal, place, experience and schedule. You can switch plans anytime in Plans.</T>}
        {welcome && (
          <View style={{ marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: c.card, gap: 10 }}>
            <T v="h3">What to expect</T>
            {timeline(profile).map((x) => (
              <View key={x.when} style={{ flexDirection: 'row', gap: 10 }}>
                <T v="small" color={c.accent} style={{ width: 70 }}>{x.when}</T>
                <T v="small" color={c.text} style={{ flex: 1 }}>{x.what}</T>
              </View>
            ))}
            {goal && !(profile.gentle || profile.concerns?.includes('food')) && (
              <T v="small">A healthy pace to your goal weight is about {goal.perWeek} kg a week: roughly {goal.weeks} weeks. Slower is fine; steady wins.</T>
            )}
            <T v="small">Social media shows the result, not the months behind it. Consistency and discipline get you there.</T>
          </View>
        )}
        <Row style={{ marginTop: 18 }}>
          <Stat label="Days / week" value={n} />
          <Stat label="Weeks" value={plan.weeks} />
          <Stat label="Sessions" value={n * plan.weeks} />
        </Row>
      </Rise>

      <Rise i={1}>
        <Card style={{ marginTop: 18, gap: 16 }}>
          <Section label="What it does" text={plan.about} />
          <Section label="Who it's for" text={plan.who} />
          <Section label={`Why ${n} day${n > 1 ? 's' : ''}`} text={plan.why} />
        </Card>
      </Rise>

      <Rise i={2}>
        <T v="h3" style={{ marginTop: 26, marginBottom: 10 }}>{`Your first 4 weeks${plan.weeks > 4 ? `, then repeat with heavier weights (${plan.weeks} weeks in all)` : ''}`}</T>
        <Row gap={8}>
          <T v="h3" style={{ marginRight: 4 }}>Week</T>
          {weeks.map((w, i) => <Chip key={w.week} label={String(w.week)} on={i === wk} onPress={() => setWk(i)} />)}
        </Row>
        <Card style={{ marginTop: 12 }}>
          <T v="h3">{week.title}</T>
          <T v="small" style={{ marginTop: 2 }}>{week.note}</T>
          <Row gap={6} style={{ marginTop: 14 }}>
            {week.days.map((d, i) => (
              <View key={i} style={[s.day, d.day ? { backgroundColor: c.accent } : { backgroundColor: c.card2 }]}>
                <T v="label" color={d.day ? c.accentInk : c.muted}>{WEEKDAYS[i].slice(0, 2)}</T>
                <T v="h3" color={d.day ? c.accentInk : c.dim}>{d.day ? d.index! + 1 : '–'}</T>
              </View>
            ))}
          </Row>
          <T v="small" color={c.dim} style={{ marginTop: 8 }}>Numbers are training days below. Grey days are rest.</T>
        </Card>
      </Rise>

      {days.map(([i, d], k) => (
        <Rise key={i} i={k + 3}>
          <Card style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T v="h2">{d.name}</T>
                <T v="small">{d.focus}</T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T v="label" color={c.accent}>Day {i + 1}</T>
                {isCurrent && week.has(`${plan.id}:${i}`) && <Row gap={4}><Ionicons name="checkmark-circle" size={16} color={c.ok} /><T v="small" color={c.ok}>Done this week</T></Row>}
              </View>
            </Row>
            <View style={{ gap: 10, marginTop: 14 }}>
              {d.slots.map((sl) => (
                <Tap key={sl.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.slot} scale={0.98}>
                  <Thumb ex={byId[sl.id]} size={44} />
                  <View style={{ flex: 1 }}>
                    <T v="h3" numberOfLines={1} color={today.has(sl.id) ? c.muted : c.text}>{byId[sl.id].name}</T>
                    <T v="small">{today.has(sl.id) ? 'Logged today' : rest(sl.rest)}</T>
                  </View>
                  {today.has(sl.id) ? <Ionicons name="checkmark-circle" size={24} color={c.ok} /> : <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>}
                </Tap>
              ))}
            </View>
          </Card>
        </Rise>
      ))}

      <Rise i={days.length + 3}>
        <Card style={{ marginTop: 18, gap: 10 }}>
          <T v="label" color={c.accent}>Benefits</T>
          {plan.benefits.map((b) => (
            <Row key={b} gap={10} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="checkmark-circle" size={18} color={c.accent} style={{ marginTop: 2 }} />
              <T v="body" style={{ flex: 1 }}>{b}</T>
            </Row>
          ))}
        </Card>
        <Card style={{ marginTop: 12, gap: 10 }}>
          <T v="label" color={c.accent}>Food and supplements</T>
          {plan.tips.map((t) => (
            <Row key={t} gap={10} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="nutrition-outline" size={18} color={c.muted} style={{ marginTop: 2 }} />
              <T v="body" style={{ flex: 1 }}>{t}</T>
            </Row>
          ))}
          <T v="small" color={c.dim}>General advice, not medical advice. Check with your doctor if you have a health condition.</T>
        </Card>
      </Rise>

      <View style={{ marginTop: 22, gap: 10 }}>
        {welcome ? (
          <Button title="Let’s go" icon="flash" onPress={() => router.replace('/')} />
        ) : isCurrent ? (
          <Button title="Current plan" kind="ghost" icon="checkmark" disabled />
        ) : (
          <Button title="Start this plan" icon="play" onPress={() => { setPlan(plan.id); router.back(); }} />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  current: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, height: 30, borderRadius: 15 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: r.sm },
  day: { flex: 1, height: 56, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
