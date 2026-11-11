import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cycle, dayKey, postpartumWeek, pregnancyWeek, streak as calcStreak, targets } from '../../src/calc';
import { byId, title } from '../../src/data/exercises';
import { motivation } from '../../src/data/motivation';
import { FoodSheet } from '../../src/foodsheet';
import { STREAK_SUFFIX } from '../../src/glance';
import { CountUp, EASE, openWorkout, useMiniBarSpace, useScrollTopRef, useToday } from '../../src/kit';
import { ChangeList, restLine, type ChangePick } from '../../src/restday';
import { Sheet } from '../../src/sheet';
import { askPermission, hasPermission, lastReminderMin, plannedOn, reschedule } from '../../src/notify';
import { useStore, type Excuse } from '../../src/store';
import { c, dom, f, r, tint } from '../../src/theme';
import { latest, sleepScore, useTracker } from '../../src/tracker';
import { levelColor, useReadiness } from '../../src/health/useReadiness';
import { ChallengeCard } from '../../src/challenges/Card';
import { TrackerCard } from '../../src/health/TrackerCard';
import { TodayBurn } from '../../src/health/TodayBurn';
import { Ambient } from '../../src/glass';
import { Pulse } from '../../src/motion';
import { Hint } from '../../src/hint';
import { QuickLogSheet } from '../../src/quicklog';
import { useWater } from '../../src/water';
import { Avatar, Button, Chip, Ring, Row, Section, T, Tap } from '../../src/ui';
import { explain, ranked } from '../../src/coach';
import { planById } from '../../src/data/plans';
import { because, PlanCard } from '../../src/plansui';

// Home (docs/round14/PLAN.md): one calm column. Header with + Log; the recommended workout with two short reasons;
// today's three rings in one card; plans for you in a sideways row (all of them one tap away on the Plans tab); your
// challenge; then the quieter things: Get started folded to one row, the tracker, the week, one coach line.
// Anything that needs a decision (setup, reminders, health context) collapses into one line at the very bottom.

type Icon = keyof typeof Ionicons.glyphMap;
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STEP_GOAL = 8000;
const LABEL = { plan: 'Recommended for you', light: 'Lighter today', rest: 'Rest day', gentle: 'Gentle today' } as const;
const EXCUSES: { id: Excuse; label: string; icon: Icon }[] = [
  { id: 'sick', label: 'Sick', icon: 'medkit-outline' }, { id: 'travel', label: 'Travelling', icon: 'airplane-outline' }, { id: 'rest', label: 'Rest', icon: 'bed-outline' },
];

// Sections rise in one after another, 60 ms apart.
const Enter = ({ i, children, style }: { i: number; children: ReactNode; style?: object }) => (
  <Animated.View entering={FadeInDown.delay(i * 60).duration(380).easing(EASE)} style={style}>{children}</Animated.View>
);


export default function Today() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const periods = useStore((s) => s.periods);
  const logPeriod = useStore((s) => s.logPeriod);
  const setupSkipped = useStore((s) => s.setupSkipped);
  const dismissed = useStore((s) => s.dismissed);
  const dismiss = useStore((s) => s.dismiss);
  const reminders = useStore((s) => s.reminders);
  const excuses = useStore((s) => s.excuses);
  const planStart = useStore((s) => s.planStart);
  const excuse = useStore((s) => s.excuse);
  const hcOn = useTracker((s) => s.hc.connected);
  const strapOn = useTracker((s) => !!s.strap);
  const daily = useTracker((s) => s.daily);
  const challenge = useStore((s) => s.challenge);
  const pastChallenges = useStore((s) => s.pastChallenges);
  const supplementReminders = useStore((s) => s.supplementReminders);
  const today = useToday();
  const scroll = useScrollTopRef<ScrollView>(); // tapping Today again scrolls back up
  const [food, setFood] = useState(false); // the food ring opens the food sheet right here
  const [change, setChange] = useState(false); // Change next to Start: another day, a quick session or a focus
  const [log, setLog] = useState(false); // + Log: the Quick log sheet
  const [askExcuse, setAskExcuse] = useState(false); // the excuse chips unfold from one quiet line
  const [openSteps, setOpenSteps] = useState(false); // Get started is one row until tapped
  const planId = useStore((s) => s.planId);

  const [notifOff, setNotifOff] = useState(false);
  useEffect(() => { if (Platform.OS !== 'web') hasPermission().then((ok) => setNotifOff(!ok)); }, []);

  const key = dayKey();
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const trained = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const trainedToday = trained.has(key);
  const streak = calcStreak(sessions);

  // Hero: today's workout from the shared useToday(), so this card, the centre button and Train always agree.
  const { day, minutes, kind, reason, active, start } = today;
  const rest = kind === 'rest';
  const label = active?.running ? 'In progress' : rest && trainedToday ? 'Done for today' : LABEL[kind];
  const wh = active ? active.place : today.where;
  const place = profile.place === 'office' && !active ? 'Office' : wh === 'home' ? 'Home' : 'Gym';
  const muscles = [...new Set(day.slots.map((sl) => byId[sl.id]?.primary[0]).filter(Boolean))].slice(0, 3).map(title);
  const button = active?.running ? 'Resume' : rest ? 'Train anyway' : 'Start';
  // Why this workout: the engine's top reasons for the plan it comes from (two short lines at most).
  const why = useMemo(() => (today.planId ? explain(profile, today.planId).slice(0, 2) : []), [profile, today.planId]);
  // Plans for you: the one you are on first, then the engine's best fits.
  const curBase = planById[planId]?.base ?? planId;
  const forYou = useMemo(() => {
    const list = ranked(profile);
    const cur = planById[curBase];
    return [...(cur ? [cur] : []), ...list.filter((x) => x.id !== curBase)].slice(0, 7);
  }, [profile, curBase]);

  // "Not today?" excuse chips: on a planned day with no workout yet once the evening is near (or the day's last
  // reminder has passed), or the day after a missed planned day. An excused day pauses the missed-workout nudge.
  const hasReminders = reminders.some((x) => x.kind === 'workout' && x.on);
  const plannedToday = hasReminders ? plannedOn(reminders, now) : !rest;
  const lastMin = lastReminderMin(reminders, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const evening = nowMin >= Math.min(17 * 60, lastMin >= 0 ? lastMin : 17 * 60);
  const yday = new Date(now); yday.setDate(yday.getDate() - 1);
  const ykey = dayKey(yday);
  const since = Math.min(sessions[0]?.startedAt ?? Infinity, planStart ?? Infinity);
  const missedYesterday = hasReminders && plannedOn(reminders, yday) && !trained.has(ykey) && !excuses[ykey] && since !== Infinity && dayKey(since) <= ykey;
  const excused = excuses[key];
  const showExcuse = !active && !trainedToday && (!!excused || (plannedToday && evening) || missedYesterday);

  // Rings. Training: sessions since Monday against the weekly goal.
  const week = sessions.filter((s) => s.startedAt >= monday.getTime()).length;
  const goal = Math.max(1, profile.daysPerWeek);
  // Fuel: protein, or meals in gentle mode (no grams for people who asked not to count).
  const gentle = profile.gentle || !!profile.concerns?.includes('food');
  const t = targets(profile);
  const todays = meals.filter((m) => m.day === key);
  const protein = Math.round(todays.reduce((a, m) => a + m.protein, 0));
  const mealsIn = new Set(todays.map((m) => m.slot ?? m.id)).size;
  // Body: sleep score from the watch, else steps, else an invitation to connect one.
  const score = hcOn ? sleepScore(latest(daily, 'sleep', 1)) : undefined;
  const steps = latest(daily, 'steps', 1);
  const water = useWater(); // ml today and the goal (src/water.ts)
  // Readiness (HRV, resting HR and sleep against your own baseline) wins the third ring once it has 4 nights.
  const rd = useReadiness();

  // Coach line: one sentence that changes once a day.
  const lastAt = sessions[sessions.length - 1]?.startedAt;
  const daysOff = lastAt ? Math.floor((Date.now() - lastAt) / 86400000) : 0;
  const quote = motivation(profile, daysOff, Math.floor(Date.now() / 86400000));

  // The bottom line: at most one, in priority order, each dismissible for the day.
  const cyc = cycle(profile), pw = pregnancyWeek(profile), pp = postpartumWeek(profile);
  const lastPeriod = periods[periods.length - 1];
  const inPeriod = !!lastPeriod && !lastPeriod.end && Date.now() - Date.parse(lastPeriod.start) < 10 * 86400000;
  const PHASE = { period: 'Period', follicular: 'Energy rising', ovulation: 'Peak energy', luteal: 'Pre-period' };
  const notes: Note[] = [];
  // Only when setup was skipped before a plan was picked (finishing setup without a name is not "unfinished").
  if (setupSkipped && !planStart && (dismissed['get-started'] || sessions.length >= 5)) notes.push({ id: 'today-setup', icon: 'sparkles', color: c.accent, text: 'Get a plan made for you', action: '1 min', onAction: () => router.push('/onboarding') });
  if (notifOff) notes.push({ id: 'today-notif', icon: 'notifications-off', color: c.warm, text: 'Reminders are off', action: 'Allow',
    onAction: async () => { if (await askPermission()) { setNotifOff(false); reschedule(); } } });
  if (pw !== null) notes.push({ id: 'today-health', icon: 'heart', color: c.pink, text: `Pregnancy · week ${pw} · plan adjusted` });
  else if (pp !== null) notes.push({ id: 'today-health', icon: 'heart', color: c.pink, text: `After birth · week ${pp} · plan adjusted` });
  else if (cyc) notes.push({ id: 'today-health', icon: 'water', color: c.pink, text: `Cycle day ${cyc.day} · ${PHASE[cyc.phase]}`,
    action: inPeriod ? 'Period ended' : 'Log period', onAction: () => logPeriod(inPeriod ? 'end' : 'start') });
  const note = notes.find((n) => dismissed[n.id] !== key);

  // A pick from Change opens that workout ready, exactly like Start does with today's.
  const pickChange = (p: ChangePick) => {
    setChange(false);
    if (!useStore.getState().active) useStore.getState().start(p.day, p.place, p.planId, p.dayIndex);
    openWorkout();
  };

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  // Get started: five first steps that tick themselves from real data. Hidden once all are done, once dismissed, or
  // for anyone with a few workouts behind them (they know their way around).
  const watchOn = hcOn || strapOn || Object.keys(daily).length > 0;
  const reminderOn = reminders.some((x) => x.on) || supplementReminders.some((x) => x.on);
  const noPlan = setupSkipped && !planStart; // skipped setup before picking a plan
  const firstSteps: Step[] = [
    ...(noPlan ? [{ id: 'plan', icon: 'sparkles' as Icon, color: c.accent, text: 'Get a plan made for you', done: false, go: () => router.push('/onboarding') }] : []),
    { id: 'workout', icon: 'play', color: dom.train, text: active ? 'Finish your first workout' : 'Start your first workout', done: sessions.length > 0, go: start },
    { id: 'watch', icon: 'watch', color: dom.heart, text: 'Connect a watch', done: watchOn, go: () => router.push('/watch') },
    { id: 'reminder', icon: 'notifications', color: dom.streak, text: 'Set a workout reminder', done: reminderOn, go: () => router.push('/reminders') },
    { id: 'meal', icon: 'restaurant', color: dom.kcal, text: 'Log a meal', done: meals.length > 0, go: () => setFood(true) },
    { id: 'challenge', icon: 'trophy', color: dom.streak, text: 'Join a challenge', done: !!challenge || pastChallenges.length > 0, go: () => router.push('/challenges' as Href) },
  ];
  const showSteps = !dismissed['get-started'] && sessions.length < 5 && firstSteps.some((x) => !x.done);

  return (
    <>
    <Ambient colors={[c.accent, dom.train, dom.sleep]} strength={1.25} />
    <ScrollView ref={scroll} style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: ins.top + 16, paddingHorizontal: 16, paddingBottom: ins.bottom + 120 + mini, gap: 24 }}>
      {/* 1. Header: date and streak, the title, + Log (the Quick log sheet), profile. */}
      <Enter i={0}>
        <Row gap={10}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tap onPress={() => router.push('/history')} scale={0.98} feedback="none" style={s.dateLine}
              accessibilityLabel={streak ? `${dateLabel}, ${streak}${STREAK_SUFFIX}. Open calendar` : `${dateLabel}. Open calendar`}>
              <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{dateLabel}</T>
              {streak > 0 && (
                <>
                  <Pulse value={streak}><Ionicons name="flame" size={14} color={dom.streak} /></Pulse>
                  <CountUp value={streak} suffix={STREAK_SUFFIX} style={[s.streak, { color: dom.streak }]} />
                </>
              )}
            </Tap>
            <T v="display" numberOfLines={1}>{profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Today'}</T>
          </View>
          <Tap onPress={() => setLog(true)} style={[s.log, { backgroundColor: tint(c.accent, 1.3) }]} scale={0.95}
            accessibilityLabel="Log food, water, weight, supplements or mood">
            <Ionicons name="add" size={20} color={c.accent} />
            <T v="h3" color={c.accent}>Log</T>
          </Tap>
          <Avatar />
        </Row>
        {<Hint id="today-log" text="Tap Log to add food, water, weight or how you feel." style={{ marginTop: 12 }} />}
      </Enter>

      {/* 2. Hero: today's workout. Only the button acts. */}
      <Enter i={1}>
        <View style={[s.hero, { borderColor: tint(dom.train, 1.6) }]}>
          {/* A soft training-teal wash: the workout's domain colour. */}
          <LinearGradient colors={[tint(dom.train, 1.5), tint(c.accent, 0.4), c.card]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
          <T v="small" color={dom.train} numberOfLines={1} style={{ fontFamily: f.semi }}>{label}</T>
          <T v="h1" numberOfLines={2}>{active ? active.title : day.name}</T>
          <T v="small" numberOfLines={1}>{active ? `${active.items.length} exercises` : `${day.slots.length} exercises · ${minutes} min`} · {place}</T>
          {!active && muscles.length > 0 && (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {muscles.map((m) => <View key={m} style={[s.chip, { backgroundColor: tint(dom.train, 1.1) }]}><T v="small" color={c.soft}>{m}</T></View>)}
            </Row>
          )}
          {!active && kind !== 'plan' && <T v="small" color={c.soft} numberOfLines={1}>{restLine(reason)}</T>}
          {!active && kind === 'plan' && why.length > 0 && (
            <View style={{ gap: 4 }}>
              {why.map((line) => (
                <Row key={line} gap={6}>
                  <Ionicons name="checkmark-circle" size={15} color={dom.train} />
                  <T v="small" color={c.soft} numberOfLines={1} style={{ flex: 1 }}>{line}</T>
                </Row>
              ))}
            </View>
          )}
          {/* One primary button; Change (before a workout is open) picks something else to start instead. */}
          <Row gap={10} style={{ marginTop: 4 }}>
            <Button title={button} icon="play" onPress={start} style={{ flex: 1, paddingHorizontal: 16 }} />
            {!active && (
              <Tap onPress={() => setChange(true)} style={s.change} scale={0.96} accessibilityLabel="Change workout">
                <T v="h3">Change</T>
              </Tap>
            )}
          </Row>
        </View>
        {/* "Can't train today?" stays one quiet line until tapped (or once a day is excused). */}
        {showExcuse && !excused && !askExcuse && (
          <Tap onPress={() => setAskExcuse(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 }} scale={0.98} feedback="none">
            <T v="small" color={c.muted}>Can’t train today?</T>
          </Tap>
        )}
        {showExcuse && (!!excused || askExcuse) && (
          <Animated.View entering={FadeInDown.duration(200).easing(EASE)}>
            <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
              {excused ? <T v="small" color={c.muted}>Excused today</T> : null}
              {EXCUSES.filter((x) => !excused || x.id === excused).map((x) => (
                <Chip key={x.id} label={x.label} icon={x.icon} on={excused === x.id} onPress={() => excuse(excused === x.id ? null : x.id)} />
              ))}
            </Row>
          </Animated.View>
        )}
      </Enter>

      {/* 3. Three rings, each opens its own place. */}
      <Enter i={2}>
        <Row gap={0} style={s.rings}>
          <Dial i={0} progress={week / goal} color={dom.train} label="Training" onPress={() => router.navigate('/progress')}>
            <CountUp value={week} suffix={`/${goal}`} style={s.ringNum} />
          </Dial>
          {gentle ? (
            <Dial i={1} progress={mealsIn / 3} color={dom.kcal} label="Meals" onPress={() => setFood(true)}>
              <CountUp value={mealsIn} suffix="/3" style={s.ringNum} />
            </Dial>
          ) : (
            <Dial i={1} progress={protein / Math.max(1, t.protein)} color={dom.protein} label="Protein" onPress={() => setFood(true)}>
              <CountUp value={protein} suffix="g" style={s.ringNum} />
            </Dial>
          )}
          {rd.score !== null ? (
            <Dial i={2} progress={rd.score / 100} color={levelColor(rd.level)} label="Readiness" onPress={() => router.push('/recovery')}>
              <CountUp value={rd.score} style={s.ringNum} />
            </Dial>
          ) : score !== undefined ? (
            <Dial i={2} progress={score / 100} color={dom.sleep} label="Sleep score" onPress={() => router.push('/chart/body')}>
              <CountUp value={score} style={s.ringNum} />
            </Dial>
          ) : steps !== undefined ? (
            <Dial i={2} progress={steps / STEP_GOAL} color={dom.steps} label="Steps" onPress={() => router.push('/chart/body')}>
              {steps >= 1000
                ? <CountUp value={Math.round(steps / 100) / 10} decimals={1} suffix="k" style={s.ringNum} />
                : <CountUp value={steps} style={s.ringNum} />}
            </Dial>
          ) : (
            // No watch data: water, which you can fill yourself in one tap (Quick log). Connecting a watch is offered by
            // the tracker pane below and the Get started card, so the ring doesn't ask a third time.
            <Dial i={2} progress={water.ml / Math.max(1, water.goal)} color={dom.water} label="Water" onPress={() => setLog(true)}>
              {water.ml >= 1000
                ? <CountUp value={Math.round(water.ml / 100) / 10} decimals={1} suffix=" L" style={s.ringNum} />
                : <CountUp value={water.ml} suffix=" ml" style={[s.ringNum, { fontSize: 15 }]} />}
            </Dial>
          )}
        </Row>
      </Enter>

      {/* 4. Plans for you: yours first, then the best fits; every plan is on the Plans tab. */}
      <Enter i={3}>
        <Section title="Plans for you" action="All plans" onAction={() => router.navigate('/plans')} first>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {forYou.map((p) => (
              <PlanCard key={p.id} plan={p} tag={p.id === curBase ? 'Your plan' : undefined}
                why={explain(profile, p.id).find((x) => !/days/.test(x)) ?? because(profile, p)} />
            ))}
          </ScrollView>
        </Section>
      </Enter>

      {/* 5. Your challenge (or one picked for you), and today's numbers from the watch. Each hides itself when empty. */}
      <View style={{ gap: 12 }}>
        <ChallengeCard />
        <TodayBurn />
        {!(showSteps && !watchOn) && <TrackerCard />}
        {/* Get started: new people only, one row until opened; ticks itself, hides when done or closed. */}
        {showSteps && <GetStarted steps={firstSteps} open={openSteps} onToggle={() => setOpenSteps((v) => !v)} onClose={() => dismiss('get-started')} />}
      </View>

      {/* 6. This week: a dot per day, filled when you trained, a ring around today. The whole strip opens the calendar. */}
      <Enter i={4}>
        <Tap onPress={() => router.push('/history')} scale={0.98} style={s.week} accessibilityLabel={`This week, ${week} of ${goal} workouts. Open calendar`}>
        <Row gap={8} style={{ marginBottom: 10 }}>
          <T v="h3" style={{ flex: 1 }}>This week</T>
          <T v="small" color={c.accent}>Calendar</T>
          <Ionicons name="chevron-forward" size={16} color={c.accent} />
        </Row>
        <Row gap={0} style={{ justifyContent: 'space-between' }}>
          {WEEK.map((w, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            const k = dayKey(d), did = trained.has(k), isToday = k === key;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 6, width: 40 }}>
                <T v="small" color={isToday ? c.text : c.muted} style={{ fontSize: 12 }}>{w}</T>
                <View style={[s.dayRing, isToday && { borderColor: c.accent }]}>
                  <View style={[s.dot, did && { backgroundColor: dom.train, borderColor: dom.train }]} />
                </View>
              </View>
            );
          })}
        </Row>
        </Tap>
      </Enter>

      {/* 7. One coach line. */}
      <Enter i={5}>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <Ionicons name="star-outline" size={20} color={c.accent} style={{ marginTop: 1 }} />
          <T v="body" color={c.soft} style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{quote}</T>
        </Row>
      </Enter>

      {/* The one line that needs a decision, if any. */}
      {note && (
        <Enter i={5}>
          <Animated.View key={note.id} exiting={FadeOut.duration(200)} style={[s.note, { borderColor: note.color + '55' }]}>
            <Ionicons name={note.icon} size={18} color={note.color} />
            <T v="small" color={c.text} numberOfLines={1} style={{ flex: 1 }}>{note.text}</T>
            {note.action && note.onAction ? (
              <Tap onPress={note.onAction} style={s.noteAction} scale={0.95}><T v="small" color={note.color} style={{ fontFamily: f.semi }}>{note.action}</T></Tap>
            ) : null}
            <Tap onPress={() => dismiss(note.id)} style={s.noteClose} scale={0.9} feedback="none">
              <Ionicons name="close" size={18} color={c.muted} />
            </Tap>
          </Animated.View>
        </Enter>
      )}
    </ScrollView>
    <FoodSheet open={food} onClose={() => setFood(false)} />
    <QuickLogSheet open={log} onClose={() => setLog(false)} />
    <Sheet open={change} onClose={() => setChange(false)}>
      <ChangeList place={today.where} current={{ planId: today.planId, dayIndex: today.dayIndex }} onPick={pickChange} />
    </Sheet>
    </>
  );
}

type Note = { id: string; icon: Icon; color: string; text: string; action?: string; onAction?: () => void };
type Step = { id: string; icon: Icon; color: string; text: string; done: boolean; go: () => void };

// The Get started card: one row (progress and the next step) until tapped, then one row per first step. Done rows
// stay (ticked) so you see how far you've come; the close button hides the card for good.
function GetStarted({ steps, open, onToggle, onClose }: { steps: Step[]; open: boolean; onToggle: () => void; onClose: () => void }) {
  const done = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  return (
    <View style={s.steps}>
      <Tap onPress={onToggle} scale={0.99} feedback="none" style={s.stepsHead} accessibilityLabel={`Get started, ${done} of ${steps.length} done`} accessibilityState={{ expanded: open }}>
        <Ring size={36} stroke={4} progress={done / steps.length} color={c.accent} track={c.line}>
          <T v="small" style={{ fontSize: 12, lineHeight: 15, fontFamily: f.semi }} color={c.text}>{`${done}/${steps.length}`}</T>
        </Ring>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" numberOfLines={1}>Get started</T>
          <T v="small" numberOfLines={1}>{open || !next ? `${done} of ${steps.length} done` : `Next: ${next.text.toLowerCase()}`}</T>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
      </Tap>
      {open && (
        <Animated.View entering={FadeInDown.duration(220).easing(EASE)}>
          {steps.map((x) => (
            <Tap key={x.id} onPress={x.go} scale={0.99} style={[s.stepRow, s.rule]}
              accessibilityRole="button" accessibilityState={{ checked: x.done }} accessibilityLabel={x.done ? `${x.text}, done` : x.text}>
              <View style={[s.check, x.done ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.dim }]}>
                {x.done && <Ionicons name="checkmark" size={16} color={c.accentInk} />}
              </View>
              <T v="body" numberOfLines={1} color={x.done ? c.muted : c.text}
                style={[{ flex: 1 }, x.done && { textDecorationLine: 'line-through' }]}>{x.text}</T>
              {!x.done && <Ionicons name="chevron-forward" size={16} color={c.dim} />}
            </Tap>
          ))}
          <Tap onPress={onClose} style={[s.stepRow, s.rule, { justifyContent: 'center' }]} scale={0.99} feedback="none" accessibilityLabel="Hide Get started">
            <T v="small">Hide this list</T>
          </Tap>
        </Animated.View>
      )}
    </View>
  );
}

// One ring card. The fill waits its turn (80 ms apart) so the three rings sweep in one after another.
function Dial({ i, progress, color, label, onPress, children }: {
  i: number; progress: number; color: string; label: string; onPress: () => void; children: ReactNode;
}) {
  const still = useReducedMotion();
  const [go, setGo] = useState(still);
  useEffect(() => { if (go) return; const t = setTimeout(() => setGo(true), 120 + i * 80); return () => clearTimeout(t); }, []);
  const p = Math.min(1, Math.max(0, progress || 0));
  return (
    <Tap onPress={onPress} style={s.ringCard} scale={0.96} accessibilityLabel={label}>
      <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
        <RingFill progress={go ? p : 0} color={color} />
        {children}
      </View>
      <T v="small" numberOfLines={1}>{label}</T>
    </Tap>
  );
}

// Ring from src/ui.tsx sized for the Today dials (absolute, so the number sits on top).
const RingFill = ({ progress, color }: { progress: number; color: string }) => (
  <View style={StyleSheet.absoluteFill}><Ring size={72} stroke={8} progress={progress} color={color} track={c.line} /></View>
);

const s = StyleSheet.create({
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22, alignSelf: 'flex-start', maxWidth: '100%' },
  streak: { fontFamily: f.medium, fontSize: 14, lineHeight: 19 },
  log: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22 },
  week: { padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  steps: { borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  track: { height: 4, borderRadius: 2, backgroundColor: c.card2, marginHorizontal: 16, marginTop: 10, marginBottom: 6, overflow: 'hidden' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  change: { height: 56, paddingHorizontal: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.card2 },
  hero: { gap: 12, padding: 20, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: c.card2 },
  rings: { paddingVertical: 6, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  ringCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8 },
  stepsHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14 },
  ringNum: { fontFamily: f.semi, fontSize: 18, lineHeight: 22 },
  dayRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1 },
  noteAction: { height: 44, paddingHorizontal: 8, justifyContent: 'center' },
  noteClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
