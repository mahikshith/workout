import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goalColor, useRun } from '../src/challenges/use';
import { doneSets, isTimed, prs, streak, volume } from '../src/calc';
import { badges, level } from '../src/data/badges';
import { taskTitle } from '../src/data/challenges';
import { byId } from '../src/data/exercises';
import { planById } from '../src/data/plans';
import { FoodSheet } from '../src/foodsheet';
import { sessionMinutes } from '../src/glance';
import { SOURCE_LINE } from '../src/health/energy';
import { useSessionEnergy } from '../src/health/useEnergy';
import { CountUp, EASE, EASE_POP, Empty, Header, toToday } from '../src/kit';
import { useStore, type MealSlot, type Session } from '../src/store';
import { c, dom, f, r } from '../src/theme';
import { STRAP_ORIGIN, useTracker } from '../src/tracker';
import { drink, ml, useWater } from '../src/water';
import { Button, haptic, IconBox, ListRow, Row, Section, T, Tap, Thumb } from '../src/ui';

// The end of a workout (docs/REDESIGN.md rule 8). Nothing here leaves the screen except Done (pinned at the bottom, so it
// is one tap away from the first moment): Log a meal opens the food sheet in place and Add water counts up in place.

const { width: W, height: H } = Dimensions.get('window');
// Confetti colours are read at render (c.accent changes at runtime).
function Confetti({ i, color }: { i: number; color: string }) {
  const p = useSharedValue(0);
  const x0 = W / 2, angle = (i / 36) * Math.PI * 2, dist = 120 + (i % 5) * 40;
  useEffect(() => { p.value = withDelay((i % 6) * 30, withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) })); }, []);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - p.value * 0.9,
    transform: [
      { translateX: x0 + Math.cos(angle) * dist * p.value },
      { translateY: H * 0.18 + Math.sin(angle) * dist * p.value + p.value * p.value * 220 },
      { rotate: `${p.value * 540 + i * 20}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 8, height: 14, borderRadius: 2, backgroundColor: color }, a]} />;
}

// A stat tile whose number counts up.
function CountTile({ icon, color = c.accent, value, suffix, label, i }: { icon: keyof typeof Ionicons.glyphMap; color?: string; value: number; suffix?: string; label: string; i: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 60).duration(400).easing(EASE)} style={s2.tile}>
      <IconBox icon={icon} color={color} size={32} />
      <CountUp value={value} suffix={suffix} style={{ fontSize: 26, marginTop: 10 }} />
      <T v="small" numberOfLines={1}>{label}</T>
    </Animated.View>
  );
}

// What the workout burned and the heart rate, with where the numbers come from: the watch's own count for this time,
// else worked out from heart rate, else an estimate from the sets and body weight (src/health/energy.ts). "By exercise"
// opens the split, with each set's peak heart rate when the watch saved often enough. No-numbers mode hides calories.
function Burn({ s, i, gentle }: { s: Session; i: number; gentle: boolean }) {
  const en = useSessionEnergy(s);
  const hr = useTracker((t) => t.sessionHr[s.id]);
  const hc = useTracker((t) => t.hc);
  const linked = useTracker((t) => t.hc.connected || !!t.strap || !!t.ring);
  const [open, setOpen] = useState(false);
  if (!en) return null;
  const showKcal = !gentle && en.kcal > 0;
  const waiting = hc.connected && hc.granted.includes('HeartRate') && !en.avgHr && !!s.endedAt && Date.now() - s.endedAt < 86400000;
  if (!showKcal && !en.avgHr) {
    if (!waiting) return null;
    return (
      <Animated.View entering={FadeInDown.delay(340).duration(400).easing(EASE)} style={[s2.hr, { marginTop: 12 }]}>
        <IconBox icon="heart-outline" color={c.pink} size={32} />
        <T v="small" style={{ flex: 1 }}>Heart rate shows once your watch syncs</T>
      </Animated.View>
    );
  }
  const hrText = en.avgHr ? (en.maxHr ? `avg ${en.avgHr} bpm · max ${en.maxHr}` : `avg ${en.avgHr} bpm`) : null;
  const from = showKcal ? SOURCE_LINE[en.source] : hr?.origin === STRAP_ORIGIN ? 'Heart rate from your strap' : 'Heart rate from your watch';
  const sub = [from, showKcal && en.source === 'watch' && waiting ? 'heart rate follows when your watch syncs' : null,
    hr?.rest ? `rests ${hr.rest.avg} avg` : null].filter(Boolean).join(' · ');
  const rows = s.items.map((it, k) => ({ it, e: en.perExercise[k], peaks: hr?.sets?.length === s.items.length ? hr.sets[k] : undefined })).filter((x) => x.e);
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 60).duration(400).easing(EASE)} style={[s2.hr, { marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }]}>
      <Row gap={12}>
        <IconBox icon={showKcal ? 'flame' : 'heart'} color={showKcal ? dom.kcal : c.pink} size={32} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T v="h3" numberOfLines={2} style={{ fontVariant: ['tabular-nums'] }}>
            {[showKcal ? `Burned ${en.source === 'watch' ? '' : 'about '}${en.kcal} kcal` : null, hrText].filter(Boolean).join(' · ')}
          </T>
          <T v="small" numberOfLines={2}>{sub}</T>
        </View>
      </Row>
      {rows.length > 0 && (
        <Tap onPress={() => { setOpen(!open); haptic('light'); }} style={s2.more} feedback="none" accessibilityLabel={open ? 'Hide the split by exercise' : 'Show the split by exercise'}>
          <T v="small" color={c.text} style={{ flex: 1 }}>By exercise</T>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
        </Tap>
      )}
      {open && (
        <View style={{ gap: 12, marginTop: 4 }}>
          {rows.map(({ it, e, peaks }, k) => (
            <View key={`${it.exId}-${k}`} style={{ gap: 6 }}>
              <Row gap={8}>
                <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>{byId[it.exId]?.name ?? it.exId}</T>
                <T v="small" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                  {[showKcal ? `${e.kcal} kcal` : null, e.avgHr ? `${e.avgHr} avg bpm` : null, `${Math.max(1, Math.round(e.minutes))} min`].filter(Boolean).join(' · ')}
                </T>
              </Row>
              {peaks?.some(Boolean) && (
                <View style={s2.chips}>
                  {peaks.map((x, j) => (
                    <View key={j} style={s2.chip} accessibilityLabel={x ? `Set ${j + 1} peak ${x.max} bpm` : `Set ${j + 1}, no reading`}>
                      <T v="small" color={x ? c.text : c.dim} style={{ fontFamily: f.semi, fontVariant: ['tabular-nums'] }}>{x ? x.max : '–'}</T>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          {hr?.sets?.some((r0) => r0.some(Boolean)) && <T v="small" color={c.dim}>The chips are each set's peak heart rate.</T>}
          {hr?.sparse && <T v="small" color={c.dim}>Your watch saved too few readings to show each set.</T>}
        </View>
      )}
      {!linked && (
        <Tap onPress={() => router.push('/watch')} style={s2.more} feedback="none" accessibilityLabel="Connect a watch for measured calories and heart rate">
          <Ionicons name="watch-outline" size={16} color={c.muted} />
          <T v="small" style={{ flex: 1 }}>Connect a watch for measured calories and heart rate</T>
          <Ionicons name="chevron-forward" size={16} color={c.dim} />
        </Tap>
      )}
    </Animated.View>
  );
}

const slotNow = (): MealSlot => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
};

export default function Summary() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useStore((st) => st.sessions);
  const profile = useStore((st) => st.profile);
  const water = useWater(); // ml today; a tap adds one of the person's own glasses
  const planId = useStore((st) => st.planId);
  const nextDay = useStore((st) => st.nextDay);
  const { ch, prog, ctx } = useRun(); // the running challenge, if any, worked out with this workout counted
  const [food, setFood] = useState(false);
  const pop = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    haptic('success');
    if (!still) pop.value = withTiming(1, { duration: 550, easing: EASE_POP });
  }, []);
  // The summary is the end of the workout: hardware Back goes to Today, never back into the finished session.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toToday(); return true; });
    return () => sub.remove();
  }, []);
  const badge = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.4 + pop.value * 0.6 }] }));

  const s = sessions.find((x) => x.id === id);
  // Records and unlocks are worked out once, against the history before this workout.
  const result = useMemo(() => {
    if (!s) return null;
    const history = sessions.filter((x) => x.id !== s.id);
    const all = useStore.getState();
    const before = { ...all, sessions: history };
    const had = badges(before);
    return {
      records: prs(s, history),
      fresh: badges(all).filter((b, i) => b.got && !had[i]?.got),
      lv: level(all), lvBefore: level(before),
    };
  }, [s?.id]);

  if (!s || !result) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Workout" /><Empty icon="checkmark-circle-outline" title="This page is no longer here" action="Back to Today" onPress={toToday} /></View>;
  const { records, fresh, lv, lvBefore } = result;
  const gentle = profile.gentle || profile.concerns?.includes('food');
  const mins = sessionMinutes(s); // the same rounding as Progress and History
  const run = streak(sessions);
  const levelUp = lv.lvl > lvBefore.lvl;
  const kg = Math.round(volume(s));
  const reps = s.items.reduce((n, it) => n + (isTimed(it.target) ? 0 : it.sets.reduce((a, x) => a + (x.done ? x.reps : 0), 0)), 0);
  const colors = [c.accent, c.warm, c.pink, c.blue, dom.weight];
  // What comes next time, so the end of a workout points at the next one (only for a plan workout; the plan has already
  // moved on to it).
  const plan = s.planId && s.planId === planId ? planById[planId] : undefined;
  const nextName = plan && plan.days.length > 1 ? plan.days[nextDay % plan.days.length]?.name : undefined;
  // The running challenge (read-only): today's day done, or this workout counted with something still to do. Nothing
  // when today's task isn't one a workout can count for (steps, water…), so it never claims what didn't happen.
  const chLine = (() => {
    const day = prog?.today;
    if (!ch || !prog || !day || prog.over || !day.tasks.some((t) => t.done && t.task.kind !== 'steps' && t.task.kind !== 'protein' && t.task.kind !== 'water')) return null;
    const week = prog.weeks?.find((w) => w.from <= prog.todayIdx && prog.todayIdx <= w.to);
    const where = week ? `${Math.min(week.have, week.need)} of ${week.need} this week` : `Day ${prog.todayIdx + 1} of ${ch.days}`;
    if (day.done) return { done: true, title: 'Challenge day done', sub: `${ch.name} · ${where}` };
    const left = day.tasks.find((t) => !t.done);
    return { done: false, title: `${ch.name} · workout counted`, sub: left ? `Still today: ${taskTitle(left.task, ctx)}` : where };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 32, paddingHorizontal: 12, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s2.badge, { backgroundColor: c.accent }, badge]}>
          <Ionicons name="checkmark" size={48} color={c.accentInk} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(60).duration(400).easing(EASE)}>
          <T v="display" style={{ textAlign: 'center', marginTop: 20 }}>Workout done</T>
          <T v="body" color={c.muted} numberOfLines={1} style={{ textAlign: 'center', marginTop: 2 }}>
            {s.title}
          </T>
        </Animated.View>

        <Row gap={12} style={{ marginTop: 24 }}>
          <CountTile i={0} icon="time-outline" value={mins} suffix=" min" label="Time" />
          <CountTile i={1} icon="checkmark-done" value={doneSets(s)} label="Sets" />
        </Row>
        <Row gap={12} style={{ marginTop: 12 }}>
          {kg > 0 ? <CountTile i={2} icon="barbell" value={kg} suffix=" kg" label="Volume" />
            : reps > 0 ? <CountTile i={2} icon="repeat" value={reps} label="Reps" />
            : <CountTile i={2} icon="list" value={s.items.length} label="Exercises" />}
          <CountTile i={3} icon="flame" color={c.warm} value={run} label="Day streak" />
        </Row>
        <Burn s={s} i={4} gentle={!!gentle} />

        {chLine && ch && (
          <Animated.View entering={FadeInDown.delay(340).duration(400).easing(EASE)} style={[s2.hr, { marginTop: 12 }]}>
            <IconBox icon={chLine.done ? 'trophy' : ch.icon} color={goalColor(ch)} size={32} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T v="h3" numberOfLines={1}>{chLine.title}</T>
              <T v="small" numberOfLines={1}>{chLine.sub}</T>
            </View>
            {chLine.done && <Ionicons name="checkmark-circle" size={24} color={c.ok} />}
          </Animated.View>
        )}

        {nextName && (
          <Animated.View entering={FadeInDown.delay(380).duration(400).easing(EASE)} style={[s2.hr, { marginTop: 12 }]}>
            <IconBox icon="calendar-outline" color={dom.train} size={32} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T v="h3" numberOfLines={1}>Next time · {nextName}</T>
              <T v="small" numberOfLines={1}>{plan!.name} moves on by itself</T>
            </View>
          </Animated.View>
        )}

        {records.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400).easing(EASE)}>
            <Section title="New records">
              <View style={{ gap: 8 }}>
                {records.map((p) => (
                  <ListRow key={p.exId} thumb={<Thumb ex={byId[p.exId]} size={40} />} title={byId[p.exId].name}
                    right={<T v="small" color={c.warm}>{p.label}</T>} />
                ))}
              </View>
            </Section>
          </Animated.View>
        )}

        {(fresh.length > 0 || levelUp) && (
          <Animated.View entering={FadeInDown.delay(460).duration(400).easing(EASE)}>
            <Section title="Unlocked">
              <View style={{ gap: 8 }}>
                {levelUp && <ListRow icon="arrow-up-circle" color={c.warm} title={`Level ${lv.lvl} · ${lv.name}`} sub="Level up" />}
                {fresh.map((b) => <ListRow key={b.id} icon={b.icon} title={b.title} sub="New badge" />)}
              </View>
            </Section>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(520).duration(400).easing(EASE)}>
          <Row gap={10} style={{ marginTop: 32 }}>
            <Tap onPress={() => setFood(true)} style={s2.action}>
              <Ionicons name="restaurant" size={18} color={c.pink} />
              <T v="h3">Log a meal</T>
            </Tap>
            <Tap onPress={() => drink()} style={s2.action} accessibilityLabel={`Add ${water.glass} ml of water${water.ml ? `, ${ml(water.ml)} today` : ''}`}>
              <Ionicons name={water.ml ? 'add' : 'water'} size={18} color={c.blue} />
              <T v="h3" numberOfLines={1} style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{water.ml ? `Water · ${ml(water.ml)}` : 'Add water'}</T>
            </Tap>
          </Row>
        </Animated.View>

      </ScrollView>
      {/* Done is always on screen, so leaving never needs a scroll past the celebration. */}
      <View style={[s2.foot, { paddingBottom: ins.bottom + 12 }]}>
        <Button title="Done" onPress={toToday} />
      </View>

      {!still && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 36 }, (_, i) => <Confetti key={i} i={i} color={colors[i % colors.length]} />)}
        </View>
      )}

      <FoodSheet open={food} onClose={() => setFood(false)} slot={slotNow()} />
    </View>
  );
}

const s2 = StyleSheet.create({
  foot: { paddingHorizontal: 12, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  badge: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, minWidth: 0, backgroundColor: c.card, borderRadius: r.lg, padding: 14, borderWidth: 1, borderColor: c.line },
  hr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: r.lg, padding: 14, borderWidth: 1, borderColor: c.line },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minWidth: 40, height: 28, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, height: 52, borderRadius: r.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
