import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { cycle, dayKey, postpartumWeek, pregnancyWeek, streak as calcStreak, targets } from '../../src/calc';
import { byId, title } from '../../src/data/exercises';
import { motivation } from '../../src/data/motivation';
import { FoodSheet } from '../../src/foodsheet';
import { STREAK_SUFFIX } from '../../src/glance';
import { CountUp, EASE, openWorkout, useMiniBarSpace, useScrollTopRef, useToday } from '../../src/kit';
import { ChangeList, type ChangePick } from '../../src/restday';
import { Sheet } from '../../src/sheet';
import { askPermission, hasPermission, lastReminderMin, plannedOn, reschedule } from '../../src/notify';
import { useStore, type Excuse } from '../../src/store';
import { c, dom, f, r, tint } from '../../src/theme';
import { latest, sleepScore, useTracker } from '../../src/tracker';
import { levelColor, useReadiness } from '../../src/health/useReadiness';
import { Avatar, Button, Chip, Ring, Row, T, Tap } from '../../src/ui';

// Today (docs/REDESIGN.md, "Today"): header, one hero card, three rings, the week strip, one coach line.
// Anything that needs a decision (setup, reminders, health context) collapses into one line at the very bottom.

type Icon = keyof typeof Ionicons.glyphMap;
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STEP_GOAL = 8000;
const LABEL = { plan: 'Up next', light: 'Lighter today', rest: 'Rest day', gentle: 'Gentle today' } as const;
const EXCUSES: { id: Excuse; label: string; icon: Icon }[] = [
  { id: 'sick', label: 'Sick', icon: 'medkit-outline' }, { id: 'travel', label: 'Travelling', icon: 'airplane-outline' }, { id: 'rest', label: 'Rest', icon: 'bed-outline' },
];

// Sections rise in one after another, 60 ms apart.
const Enter = ({ i, children, style }: { i: number; children: ReactNode; style?: object }) => (
  <Animated.View entering={FadeInDown.delay(i * 60).duration(380).easing(EASE)} style={style}>{children}</Animated.View>
);

// The first sentence of the engine's reason, so a rest day explains itself in one short line.
const firstSentence = (s: string) => (s.match(/^[^.]*\./)?.[0] ?? s).trim();

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
  const daily = useTracker((s) => s.daily);
  const today = useToday();
  const scroll = useScrollTopRef<ScrollView>(); // tapping Today again scrolls back up
  const [food, setFood] = useState(false); // the food ring opens the food sheet right here
  const [change, setChange] = useState(false); // Change next to Start: another day, a quick session or a focus

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
  if (!profile.name && setupSkipped) notes.push({ id: 'today-setup', icon: 'sparkles', color: c.accent, text: 'Finish setting up your plan', action: '1 min', onAction: () => router.push('/onboarding') });
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

  return (
    <>
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: c.bg }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: ins.top + 16, paddingHorizontal: 16, paddingBottom: ins.bottom + 120 + mini, gap: 24 }}>
      {/* 1. Header: date, title, streak, profile. */}
      <Enter i={0}>
        <Row gap={12}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="label" color={c.muted}>{dateLabel}</T>
            <T v="display" numberOfLines={1}>Today</T>
          </View>
          <Tap onPress={() => router.push('/history')} style={[s.pill, { backgroundColor: streak ? tint(dom.streak, 1.3) : c.card2 }]} scale={0.95}>
            <Ionicons name="flame" size={15} color={streak ? dom.streak : c.muted} />
            {streak ? <CountUp value={streak} suffix={STREAK_SUFFIX} style={[s.pillNum, { color: dom.streak }]} /> : <T v="small" style={[s.pillNum, { color: c.muted }]}>Start a streak</T>}
          </Tap>
          <Avatar />
        </Row>
      </Enter>

      {/* 2. Hero: today's workout. Only the button acts. */}
      <Enter i={1}>
        <View style={[s.hero, { borderColor: tint(dom.train, 1.6) }]}>
          {/* A soft training-teal wash: the workout's domain colour. */}
          <LinearGradient colors={[tint(dom.train, 1.5), tint(c.accent, 0.4), c.card]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
          <T v="label" color={dom.train} numberOfLines={1}>{label}</T>
          <T v="h1" numberOfLines={2}>{active ? active.title : day.name}</T>
          <T v="small" numberOfLines={1}>{active ? `${active.items.length} exercises` : `${day.slots.length} exercises · ${minutes} min`} · {place}</T>
          {!active && muscles.length > 0 && (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {muscles.map((m) => <View key={m} style={[s.chip, { backgroundColor: tint(dom.train, 1.1) }]}><T v="small" color={c.soft}>{m}</T></View>)}
            </Row>
          )}
          {!active && kind !== 'plan' && <T v="small" color={c.soft} numberOfLines={1}>{firstSentence(reason)}</T>}
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
        {showExcuse && (
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <T v="small" color={c.muted}>{excused ? 'Excused today' : 'Not today?'}</T>
            {EXCUSES.filter((x) => !excused || x.id === excused).map((x) => (
              <Chip key={x.id} label={x.label} icon={x.icon} on={excused === x.id} onPress={() => excuse(excused === x.id ? null : x.id)} />
            ))}
          </Row>
        )}
      </Enter>

      {/* 3. Three rings, each opens its own place. */}
      <Enter i={2}>
        <Row gap={12}>
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
            <Tap onPress={() => router.push('/watch')} style={s.ringCard} scale={0.96}>
              <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={72} height={72} style={StyleSheet.absoluteFill}>
                  <Circle cx={36} cy={36} r={32} stroke={c.line} strokeWidth={8} strokeDasharray="6 6" fill="none" />
                </Svg>
                <Ionicons name="add" size={24} color={dom.heart} />
              </View>
              <T v="small" color={dom.heart} numberOfLines={1}>{hcOn ? 'No data yet' : 'Connect watch'}</T>
            </Tap>
          )}
        </Row>
      </Enter>

      {/* 4. This week: a dot per day, filled when you trained, a ring around today. */}
      <Enter i={3}>
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
      </Enter>

      {/* 5. One coach line. */}
      <Enter i={4}>
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
    <Sheet open={change} onClose={() => setChange(false)}>
      <ChangeList place={today.where} current={{ planId: today.planId, dayIndex: today.dayIndex }} onPick={pickChange} />
    </Sheet>
    </>
  );
}

type Note = { id: string; icon: Icon; color: string; text: string; action?: string; onAction?: () => void };

// One ring card. The fill waits its turn (80 ms apart) so the three rings sweep in one after another.
function Dial({ i, progress, color, label, onPress, children }: {
  i: number; progress: number; color: string; label: string; onPress: () => void; children: ReactNode;
}) {
  const still = useReducedMotion();
  const [go, setGo] = useState(still);
  useEffect(() => { if (go) return; const t = setTimeout(() => setGo(true), 120 + i * 80); return () => clearTimeout(t); }, []);
  const p = Math.min(1, Math.max(0, progress || 0));
  return (
    <Tap onPress={onPress} style={s.ringCard} scale={0.96}>
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
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16 },
  pillNum: { fontFamily: f.semi, fontSize: 14, lineHeight: 18 },
  change: { height: 56, paddingHorizontal: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.card2 },
  hero: { gap: 12, padding: 20, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: c.card2 },
  ringCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 8, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  ringNum: { fontFamily: f.bold, fontSize: 18, lineHeight: 22 },
  dayRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1 },
  noteAction: { height: 44, paddingHorizontal: 8, justifyContent: 'center' },
  noteClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
