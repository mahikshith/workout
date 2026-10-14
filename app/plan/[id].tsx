import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { doneNote, doneRecently, doneThisWeek } from '../../src/calc';
import { byId } from '../../src/data/exercises';
import { perWeek, planById } from '../../src/data/plans';
import { program, WEEKDAYS } from '../../src/data/program';
import { goalWeeks, timeline } from '../../src/data/expect';
import { useStore } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Card, Chip, Fold, IconBox, Rise, Row, Screen, Section, T, Tap, Thumb, Tile } from '../../src/ui';

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
  const name = profile.name;
  const goal = goalWeeks(profile);
  const setPlan = useStore((s) => s.setPlan);
  const sessions = useStore((s) => s.sessions);
  const recent = doneRecently(sessions), doneWeek = doneThisWeek(sessions);
  const [wk, setWk] = useState(0);
  if (!plan) return null;
  const isCurrent = plan.id === planId;
  const leave = () => (welcome ? router.replace('/') : router.back());
  const weeks = program(plan, 4);
  const week = weeks[wk];
  const n = perWeek(plan);
  // Each training day once, in the order it first appears in the week, with this week's sets and reps.
  const days = [...new Map(week.days.filter((d) => d.day).map((d) => [d.index!, d.day!] as const)).entries()];
  // Gentle plans already title their weeks "Week 1"; the others get the number in front of the phase.
  const weekTitle = week.title.startsWith('Week') ? week.title : `Week ${week.week} · ${week.title}`;

  // Opens itself on the welcome screen; on a normal visit it waits closed in the About section.
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
      <T v="small">Social media shows the result, not the months behind it. Consistency and discipline get you there.</T>
    </Fold>
  );

  return (
    <Screen>
      {!welcome && <Tap onPress={leave} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>}

      {/* Hero: what the plan is, in three numbers. */}
      <Rise>
        <T v="label" color={c.accent} style={{ marginTop: welcome ? 8 : 16 }}>
          {welcome ? `Your plan is ready${name ? `, ${name}` : ''}` : `${plan.category} · ${plan.level} · ${plan.place === 'any' ? 'anywhere' : plan.place}`}
        </T>
        <T v="display" style={{ marginTop: 8 }}>{plan.name}</T>
        {isCurrent && !welcome && (
          <Row gap={8} style={[s.current, { backgroundColor: c.accent }]}>
            <Ionicons name="checkmark-circle" size={16} color={c.accentInk} />
            <T v="label" color={c.accentInk}>Your current plan</T>
          </Row>
        )}
        <T v="body" color={c.muted} style={{ marginTop: 4 }}>{plan.tagline}</T>
        {welcome && (
          <Row gap={8} style={{ marginTop: 12 }}>
            <Ionicons name="sparkles" size={16} color={c.accent} />
            <T v="small" numberOfLines={1} style={{ flex: 1 }}>Picked for you · switch anytime in Plans</T>
          </Row>
        )}
        <Row gap={12} style={{ marginTop: 20 }}>
          <Tile icon="calendar-outline" value={n} unit="days" label="Per week" />
          <Tile icon="flag-outline" value={plan.weeks} label="Weeks" />
          <Tile icon="barbell-outline" value={n * plan.weeks} label="Sessions" />
        </Row>
      </Rise>

      {welcome && <Rise i={1} style={{ marginTop: 24 }}>{expect}</Rise>}

      {/* The month: pick a week, see which days you train, then each day's exercises. */}
      <Rise i={2}>
        <Section title="Schedule">
          <Row gap={8}>
            <T v="small" style={{ marginRight: 4 }}>Week</T>
            {weeks.map((w, i) => <Chip key={w.week} label={String(w.week)} on={i === wk} onPress={() => setWk(i)} />)}
          </Row>
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
      </Rise>

      {days.map(([i, d], k) => (
        <Rise key={i} i={k + 3} style={{ marginTop: 12 }}>
          <Card>
            <Row gap={12}>
              <View style={[s.num, { backgroundColor: c.accent }]}><T v="h3" color={c.accentInk}>{i + 1}</T></View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="h3" numberOfLines={1}>{d.name}</T>
                <T v="small">{d.focus}</T>
              </View>
              {isCurrent && doneWeek.has(`${plan.id}:${i}`) && (
                <Row gap={4}><Ionicons name="checkmark-circle" size={16} color={c.ok} /><T v="small" color={c.ok}>Done this week</T></Row>
              )}
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
        </Rise>
      ))}

      {/* Everything to read sits behind folds, so the page stays a schedule, not a wall of text. */}
      <Rise i={days.length + 3}>
        <Section title="About">
          <View style={{ gap: 12 }}>
            <Fold title="What it does" icon="flash-outline"><T v="body" color={c.muted}>{plan.about}</T></Fold>
            <Fold title="Who it’s for" icon="people-outline"><T v="body" color={c.muted}>{plan.who}</T></Fold>
            <Fold title={`Why ${n} day${n > 1 ? 's' : ''}`} icon="calendar-outline"><T v="body" color={c.muted}>{plan.why}</T></Fold>
            {!welcome && expect}
            <Fold title="Benefits" icon="ribbon-outline">
              {plan.benefits.map((b) => <Line key={b} icon="checkmark-circle" color={c.accent} text={b} />)}
            </Fold>
            <Fold title="Food and supplements" icon="nutrition-outline">
              {plan.tips.map((t) => <Line key={t} icon="nutrition-outline" text={t} />)}
              <T v="small" color={c.dim}>General advice, not medical advice. Check with your doctor if you have a health condition.</T>
            </Fold>
          </View>
        </Section>
      </Rise>

      <View style={{ marginTop: 32 }}>
        {welcome ? (
          <>
            <Button title="Let’s go" icon="flash" onPress={() => router.replace('/')} />
            <T v="small" color={c.dim} style={{ textAlign: 'center', marginTop: 12 }}>You can redo setup anytime in Profile</T>
          </>
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
  current: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, height: 30, borderRadius: 15 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: r.sm },
  day: { flex: 1, height: 56, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
  num: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
