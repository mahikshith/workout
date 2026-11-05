// Progress: this week at a glance, then four doors that each open one chart, then the achievements row.
// Every number here is either this week's (its one home) or a one-line glance that links to its home.
import { router, type Href } from 'expo-router';
import { useMemo, type ComponentProps, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { e1rm, streak, volume } from '../../src/calc';
import { badges, level } from '../../src/data/badges';
import { byId } from '../../src/data/exercises';
import { sessionMinutes, streakLabel } from '../../src/glance';
import { CountUp, DoorCard, EASE } from '../../src/kit';
import { useStore, type Session } from '../../src/store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { c, dom, r, tint } from '../../src/theme';
import { latest, useTracker } from '../../src/tracker';
import { Screen, Section, T, TabTitle } from '../../src/ui';

const hm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

export default function Progress() {
  const sessions = useStore((s) => s.sessions);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const daily = useTracker((s) => s.daily);
  const hcOn = useTracker((s) => s.hc.connected);
  const strap = useTracker((s) => s.strap);
  const still = useReducedMotion();
  // The heavy loops only rerun when what they read changes.
  const strength = useMemo(() => strengthGlance(sessions), [sessions]);
  const ach = useMemo(() => {
    const all = { profile, sessions, meals, water };
    const bs = badges(all);
    return { lv: level(all), earned: bs.filter((b) => b.got).length, total: bs.length };
  }, [profile, sessions, meals, water]);
  if (!profile) return null;
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));
  const enter = (i: number) => (still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE));

  // This week, Monday to now.
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const week = sessions.filter((s) => s.startedAt >= mon.getTime());
  const vol = week.reduce((a, s) => a + volume(s), 0);
  const tonnes = vol >= 1000;
  const minutes = week.reduce((a, s) => a + sessionMinutes(s), 0); // same rounding as Summary and History

  // Body weight glance.
  const lastW = [...weights].sort((a, b) => a.day.localeCompare(b.day)).pop();
  const weightMeta = lastW ? `${lastW.kg.toFixed(1)} kg · goal ${profile.goalWeightKg}` : 'Log your first weigh-in';

  // Consistency glance.
  const now = new Date();
  const thisMonth = sessions.filter((s) => { const d = new Date(s.startedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const st = streak(sessions);
  const consist = sessions.length ? `${streakLabel(st)} · ${thisMonth} this month` : 'Your calendar fills in as you train';

  // Body & watch glance: sleep and resting heart rate when we have them, else steps, else the way to connect.
  const sleep = latest(daily, 'sleep', 2);
  const rhr = latest(daily, 'restingHr', 3);
  const steps = latest(daily, 'steps', 1);
  const parts = [sleep ? `Sleep ${hm(sleep.minutes)}` : null, rhr ? `${Math.round(rhr)} bpm` : null, !sleep && steps !== undefined ? `${steps.toLocaleString()} steps` : null].filter(Boolean);
  const hasWatch = hcOn || !!strap || Object.keys(daily).length > 0;
  const bodyMeta = parts.length ? parts.join(' · ') : hasWatch ? 'Waiting for the next sync' : 'Connect a watch';

  // Achievements glance.
  const { lv, earned, total } = ach;

  type Door = { icon: ComponentProps<typeof DoorCard>['icon']; color: string; title: string; meta: string; go: Href };
  // Each door wears its domain colour: training teal, body weight purple, streak amber, heart red.
  const doors: Door[] = [
    { icon: 'barbell', color: dom.train, title: 'Strength', meta: strength, go: '/chart/strength' },
    ...(gentle ? [] : [{ icon: 'scale', color: dom.weight, title: 'Body weight', meta: weightMeta, go: '/chart/weight' } as Door]),
    { icon: 'flame', color: dom.streak, title: 'Consistency', meta: consist, go: '/history' },
    { icon: 'heart', color: dom.heart, title: 'Body & watch', meta: bodyMeta, go: '/chart/body' },
  ];
  const tiles: { icon: ComponentProps<typeof Ionicons>['name']; node: ReactElement; label: string }[] = [
    { icon: 'barbell', node: <CountUp value={week.length} />, label: 'workouts' },
    { icon: 'layers', node: <CountUp value={tonnes ? vol / 1000 : Math.round(vol)} decimals={tonnes ? 1 : 0} suffix={tonnes ? ' t' : ' kg'} />, label: 'volume' },
    { icon: 'time', node: <CountUp value={minutes} suffix=" min" />, label: 'minutes' },
  ];

  return (
    <Screen>
      <TabTitle title="Progress" />

      <Section title="This week" first>
        {/* This week's training, on a teal wash: the training colour. */}
        <View style={[s.week, { borderColor: tint(dom.train, 1.6) }]}>
          <LinearGradient colors={[tint(dom.train, 1.5), tint(dom.train, 0.3)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {tiles.map((x, i) => (
            <Animated.View key={x.label} entering={enter(i)} style={[s.tile, i > 0 && { borderLeftWidth: 1, borderLeftColor: tint(dom.train, 1.6) }]}>
              <Ionicons name={x.icon} size={18} color={dom.train} />
              {x.node}
              <T v="small" numberOfLines={1}>{x.label}</T>
            </Animated.View>
          ))}
        </View>
      </Section>

      <View style={{ gap: 12, marginTop: 24 }}>
        {doors.map((d, i) => (
          <Animated.View key={d.title} entering={enter(i + 1)}>
            <DoorCard icon={d.icon} color={d.color} title={d.title} meta={d.meta} onPress={() => router.push(d.go)} />
          </Animated.View>
        ))}
      </View>

      <Section title="Achievements">
        <Animated.View entering={enter(doors.length + 1)}>
          <DoorCard icon="trophy" color={dom.streak} title={`Level ${lv.lvl} · ${lv.name}`} meta={`${earned} of ${total} medals`}
            onPress={() => router.push('/chart/achievements')} />
        </Animated.View>
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  week: { flexDirection: 'row', borderRadius: r.xl, borderWidth: 1, overflow: 'hidden', backgroundColor: c.card },
  tile: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 14, gap: 2 },
});

// Strength glance: the top lift's best set last time, and how much heavier it is than the first time.
function strengthGlance(sessions: Session[]) {
  const best: Record<string, number> = {};
  for (const s of sessions) for (const it of s.items) for (const x of it.sets) if (x.done && x.weight) best[it.exId] = Math.max(best[it.exId] ?? 0, e1rm(x.weight, x.reps));
  const top = Object.entries(best).sort((a, b) => b[1] - a[1])[0]?.[0];
  let strength = 'Log sets with weight to see lifts';
  if (top) {
    const tops = sessions.flatMap((s) => {
      const sets = s.items.filter((it) => it.exId === top).flatMap((it) => it.sets.filter((x) => x.done && x.weight));
      return sets.length ? [sets.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a))] : [];
    });
    const last = tops[tops.length - 1];
    const up = last.weight - tops[0].weight;
    const name = (byId[top]?.name ?? 'Top lift').replace(/^(Barbell|Dumbbell|Machine|Cable) /, '');
    strength = `${name} ${last.weight} kg × ${last.reps}${up > 0 ? ` · up ${+up.toFixed(1)} kg` : ''}`;
  }

  return strength;
}
