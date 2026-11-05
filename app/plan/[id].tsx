import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { doneNote, doneRecently, doneThisWeek } from '../../src/calc';
import { byId, type Place } from '../../src/data/exercises';
import { perWeek, planById, type Day } from '../../src/data/plans';
import { planWeek, program, WEEKDAYS } from '../../src/data/program';
import { goalWeeks, timeline } from '../../src/data/expect';
import { Empty, Header, Segmented, openWorkout, toToday } from '../../src/kit';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Fold, haptic, IconBox, Row, Screen, Section, T, Tap, Thumb, Tile } from '../../src/ui';
import { Enter, useOpenSession } from '../library';

type Icon = keyof typeof Ionicons.glyphMap;
const STEPS: Icon[] = ['school-outline', 'trending-up-outline', 'shirt-outline', 'trophy-outline'];

const rest = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}${sec % 60 ? `:${String(sec % 60).padStart(2, '0')}` : ''} min rest` : `${sec}s rest`);

// One point inside a Fold: icon, then the line.
const Line = ({ icon, text, color = c.muted }: { icon: Icon; text: string; color?: string }) => (
  <Row gap={12} style={{ alignItems: 'flex-start' }}>
    <Ionicons name={icon} size={18} color={color} style={{ marginTop: 2 }} />
    <T v="body" color={c.muted} style={{ flex: 1 }}>{text}</T>
  </Row>
);

export default function PlanDetail() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const plan = planById[id];
  const planId = useStore((s) => s.planId);
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const active = useStore((s) => s.active);
  const setPlan = useStore((s) => s.setPlan);
  const start = useStore((s) => s.start);
  const planStart = useStore((s) => s.planStart);
  const toSession = useOpenSession();
  const ins = useSafeAreaInsets();
  // The schedule opens on the week you are in (for your current plan), so its sets match the workout's.
  const [wk, setWk] = useState(() => (plan && plan.id === planId ? String(planWeek(plan, planStart, sessions) % 4) : '0'));
  if (!plan) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Plan" /><Empty icon="calendar-outline" title="This page is no longer here" action="Back to Today" onPress={toToday} /></View>;
  const goal = goalWeeks(profile);
  const recent = doneRecently(sessions), doneWeek = doneThisWeek(sessions);
  const isCurrent = plan.id === planId;
  const leave = () => (welcome ? toToday() : router.canGoBack() ? router.back() : toToday());
  const weeks = program(plan, 4);
  const week = weeks[Number(wk)] ?? weeks[0];
  const n = perWeek(plan);
  // Each training day once, in the order it first appears in the week, with this week's sets and reps.
  const days = [...new Map(week.days.filter((d) => d.day).map((d) => [d.index!, d.day!] as const)).entries()];
  // Gentle plans already title their weeks "Week 1"; the others get the number in front of the phase.
  const weekTitle = week.title.startsWith('Week') ? week.title : `Week ${week.week} · ${week.title}`;
  // Where a day runs: the plan's own place, or for "anywhere" plans the place in your profile.
  const where: Place = plan.place === 'any' ? (profile.place === 'gym' || profile.place === 'both' ? 'gym' : 'home') : plan.place;

  // Start one training day: switch to this plan if needed, then the workout runs at once. A running workout is resumed.
  // Resume shows only on the day that is running; any other day's Start still opens the running workout (one at a time).
  const here = (i: number) => !!active && active.planId === plan.id && active.dayIndex === i;
  const startDay = (i: number, d: Day) => {
    if (active) { toSession(); return; }
    haptic('medium');
    if (!isCurrent) setPlan(plan.id);
    start(d, where, plan.id, i);
    openWorkout();
  };

  // What to expect, then food: opened on the welcome screen, a closed fold in About otherwise.
  const expect = (
    <Fold title="What to expect" icon="hourglass-outline" open={!!welcome}>
      {timeline(profile).map((x, i) => (
        <Row key={x.when} gap={12} style={{ alignItems: 'flex-start' }}>
          <IconBox icon={STEPS[i % STEPS.length]} size={32} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small" color={c.accent}>{x.when}</T>
            <T v="small" color={c.text}>{x.what}</T>
          </View>
        </Row>
      ))}
      {goal && !(profile.gentle || profile.concerns?.includes('food')) && (
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <IconBox icon="scale-outline" size={32} />
          <T v="small" color={c.text} style={{ flex: 1 }}>{`Healthy pace: about ${goal.perWeek} kg a week, roughly ${goal.weeks} weeks. Slower is fine; steady wins.`}</T>
        </Row>
      )}
      <T v="small">Social media shows the result, not the months behind it. Consistency gets you there.</T>
      <T v="label" style={{ marginTop: 8 }}>Food and supplements</T>
      {plan.tips.map((t) => <Line key={t} icon="nutrition-outline" text={t} />)}
      <T v="small" color={c.dim}>General advice, not medical advice. Check with your doctor if you have a health condition.</T>
    </Fold>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={welcome ? 'Your plan' : plan.name} onBack={leave} />
      <Screen top={4}>
        {/* Summary: what the plan is, in three numbers. */}
        <Enter>
          <T v="label" color={c.accent}>
            {welcome ? `Your plan is ready${profile.name ? `, ${profile.name}` : ''}` : `${plan.category} · ${plan.level} · ${plan.place === 'any' ? 'anywhere' : plan.place}`}
          </T>
          {welcome && <T v="display" style={{ marginTop: 8 }}>{plan.name}</T>}
          {isCurrent && !welcome && (
            <Row gap={8} style={[s.current, { backgroundColor: c.accent }]}>
              <Ionicons name="checkmark-circle" size={16} color={c.accentInk} />
              <T v="label" color={c.accentInk}>Your current plan</T>
            </Row>
          )}
          <T v="body" color={c.muted} style={{ marginTop: 8 }}>{plan.tagline}</T>
          {!isCurrent && !welcome && (
            <Button title="Start this plan" icon="checkmark" style={{ marginTop: 16 }} onPress={() => { setPlan(plan.id); leave(); }} />
          )}
          {welcome && (
            <Row gap={8} style={{ marginTop: 12 }}>
              <Ionicons name="sparkles" size={16} color={c.accent} />
              <T v="small" numberOfLines={1} style={{ flex: 1 }}>Picked for you · switch anytime in Train</T>
            </Row>
          )}
          <Row gap={12} style={{ marginTop: 20 }}>
            <Tile icon="calendar-outline" value={n} unit="days" label="Per week" />
            <Tile icon="flag-outline" value={plan.weeks} label="Weeks" />
            <Tile icon="barbell-outline" value={n * plan.weeks} label="Sessions" />
          </Row>
        </Enter>

        {welcome && <Enter i={1} style={{ marginTop: 24 }}>{expect}</Enter>}

        {/* The month: pick a week, see which days you train, then each day's exercises with its own Start. */}
        <Enter i={2}>
          <Section title="Schedule">
            <Segmented options={weeks.map((w, i) => ({ k: String(i), label: `Week ${w.week}` }))} value={wk} onChange={setWk} />
            {plan.weeks > 4 && (
              <Row gap={8} style={{ marginTop: 12 }}>
                <Ionicons name="repeat" size={16} color={c.muted} />
                <T v="small">{`Then repeat heavier · ${plan.weeks} weeks total`}</T>
              </Row>
            )}
            <Card style={{ marginTop: 12 }}>
              <T v="h3">{weekTitle}</T>
              <T v="small" style={{ marginTop: 4 }}>{week.note}</T>
              <Row gap={4} style={{ marginTop: 12 }}>
                {week.days.map((d, i) => (
                  <View key={i} style={[s.day, { backgroundColor: d.day ? c.accent : c.card2 }]}>
                    <T v="label" color={d.day ? c.accentInk : c.muted}>{WEEKDAYS[i].slice(0, 2)}</T>
                    <T v="h3" color={d.day ? c.accentInk : c.dim}>{d.day ? d.index! + 1 : '–'}</T>
                  </View>
                ))}
              </Row>
            </Card>
          </Section>
        </Enter>

        {days.map(([i, d], k) => {
          const doneNow = isCurrent && doneWeek.has(`${plan.id}:${i}`);
          return (
            <Enter key={`${wk}-${i}`} i={k + 3} style={{ marginTop: 12 }}>
              <Card>
                <Row gap={12}>
                  <View style={[s.num, { backgroundColor: c.accent }]}><T v="h3" color={c.accentInk}>{i + 1}</T></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>{d.name}</T>
                    {doneNow
                      ? <Row gap={4}><Ionicons name="checkmark-circle" size={14} color={c.ok} /><T v="small" color={c.ok}>Done this week</T></Row>
                      : <T v="small" numberOfLines={1}>{d.focus}</T>}
                  </View>
                  <Tap onPress={() => startDay(i, d)} style={[s.go, { borderColor: c.accent }]} scale={0.94} feedback="none">
                    <Ionicons name={here(i) ? 'arrow-forward' : 'play'} size={14} color={c.accent} />
                    <T v="h3" color={c.accent} style={{ fontSize: 15 }}>{here(i) ? 'Resume' : 'Start'}</T>
                  </Tap>
                </Row>
                <View style={{ gap: 12, marginTop: 16 }}>
                  {d.slots.map((sl) => (
                    <Tap key={sl.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.slot} scale={0.98}>
                      <Thumb ex={byId[sl.id]} size={44} />
                      <View style={{ flex: 1 }}>
                        <T v="h3" numberOfLines={1} color={recent.has(sl.id) ? c.muted : c.text}>{byId[sl.id].name}</T>
                        <T v="small" color={recent.has(sl.id) ? c.ok : c.muted}>{recent.has(sl.id) ? doneNote(recent.get(sl.id)!).text : rest(sl.rest)}</T>
                      </View>
                      {recent.has(sl.id) ? <Ionicons name="checkmark-circle" size={24} color={c.ok} /> : <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>}
                    </Tap>
                  ))}
                </View>
              </Card>
            </Enter>
          );
        })}

        {/* Reading sits behind at most two folds, so the page stays a schedule, not a wall of text. */}
        <Enter i={days.length + 3}>
          <Section title="About">
            <View style={{ gap: 12 }}>
              <Fold title="About this plan" icon="flash-outline">
                <T v="body" color={c.muted}>{plan.about}</T>
                <T v="label" style={{ marginTop: 8 }}>Who it’s for</T>
                <T v="body" color={c.muted}>{plan.who}</T>
                <T v="label" style={{ marginTop: 8 }}>{`Why ${n} day${n > 1 ? 's' : ''}`}</T>
                <T v="body" color={c.muted}>{plan.why}</T>
                <T v="label" style={{ marginTop: 8 }}>Benefits</T>
                {plan.benefits.map((b) => <Line key={b} icon="checkmark-circle" color={c.accent} text={b} />)}
              </Fold>
              {!welcome && expect}
            </View>
          </Section>
        </Enter>

        {welcome && <T v="small" color={c.dim} style={{ textAlign: 'center', marginTop: 24 }}>You can redo setup anytime in Profile</T>}
      </Screen>
      {/* Welcome: the commit button stays on screen, so setup never needs a scroll to finish. */}
      {welcome && (
        <View style={[s.bar, { paddingBottom: ins.bottom + 12 }]}>
          <Button title="Start this plan" icon="checkmark" onPress={() => { if (!isCurrent) setPlan(plan.id); toToday(); }} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  current: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, height: 30, borderRadius: 15 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: r.sm },
  day: { flex: 1, height: 56, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
  num: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  go: { height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
