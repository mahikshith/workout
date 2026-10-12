import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, StyleSheet, Switch, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { askPermission, hasPermission, rescheduleAll } from '../src/notify';
import { Sheet } from '../src/sheet';
import { useStore, type Interval, type NudgePrefs, type Reminder } from '../src/store';
import { c } from '../src/theme';
import { Button, Card, Chip, Row, Screen, Stepper, T, Tap } from '../src/ui';

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first; the store counts 0 = Sunday
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MEALS: [string, number, number][] = [['Breakfast', 8, 0], ['Lunch', 13, 0], ['Snack', 16, 30], ['Dinner', 19, 30]];
const web = Platform.OS === 'web';
const wrap = (n: number, m: number) => (n + m) % m;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clock = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;
const dayList = (d: number[]) => (!d.length || d.length >= 7 ? 'Every day' : WEEK.filter((x) => d.includes(x)).map((x) => SHORT[x]).join(' '));
const JUMPS: { label: string; to: (m: number) => number; at?: number }[] = [
  { label: '−5', to: (m) => wrap(m - 5, 60) },
  ...[0, 15, 30, 45].map((at) => ({ label: `:${String(at).padStart(2, '0')}`, to: () => at, at })),
  { label: '+5', to: (m) => wrap(m + 5, 60) },
];

// Every change saves to the store straight away; useNudgeSync in the root layout reschedules.
export default function Reminders() {
  const st = useStore();
  const { reminders, hydration, breaks, motivation, nudges } = st;
  const [granted, setGranted] = useState(true);
  const [tried, setTried] = useState(false);
  const [edit, setEdit] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);

  // Checked again when coming back from the phone's settings.
  useEffect(() => {
    hasPermission().then(setGranted);
    const sub = AppState.addEventListener('change', async (a) => {
      if (a !== 'active') return;
      const g = await hasPermission();
      setGranted(g);
      if (g) rescheduleAll(useStore.getState());
    });
    return () => sub.remove();
  }, []);

  const grant = async () => {
    if (tried) { Linking.openSettings(); return; }
    if (await askPermission()) { setGranted(true); rescheduleAll(useStore.getState()); } else setTried(true);
  };
  const turnedOn = (on: boolean) => { if (on && !granted && !tried && !web) grant(); };
  const upsert = (r: Reminder) => {
    const all = useStore.getState().reminders;
    st.setReminders(all.some((x) => x.id === r.id) ? all.map((x) => (x.id === r.id ? r : x)) : [...all, r]);
  };
  const change = (patch: Partial<Reminder>) => { if (!edit) return; const next = { ...edit, ...patch }; setEdit(next); upsert(next); };
  const show = (r: Reminder) => { setEdit(r); setOpen(true); };
  const toggle = (r: Reminder, on: boolean) => { upsert({ ...r, on }); turnedOn(on); };
  const add = () => { const r: Reminder = { id: Date.now().toString(36), kind: 'workout', hour: 18, minute: 0, days: [], on: true }; upsert(r); show(r); turnedOn(true); };
  const remove = () => { if (edit) st.setReminders(useStore.getState().reminders.filter((x) => x.id !== edit.id)); setOpen(false); };
  const setN = (patch: Partial<NudgePrefs>) => { st.setNudges({ ...nudges, ...patch }); turnedOn(!!(patch.missed || patch.streak || patch.recap)); };

  const workouts = reminders.filter((r) => r.kind === 'workout');
  const meals = MEALS.map(([label, hour, minute]): Reminder =>
    reminders.find((r) => r.kind === 'meal' && r.label === label) ?? { id: `meal-${label.toLowerCase()}`, kind: 'meal', hour, minute, days: [], on: false, label });

  return (
    <>
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <Tap onPress={() => router.back()} style={s.icon}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
          <T v="h2">Reminders</T>
          <View style={{ width: 40 }} />
        </Row>
        <Animated.View entering={FadeInDown.duration(380).easing(EASE)} style={{ marginTop: 18, gap: 4 }}>
          <T v="h2">Nudges that fit your day</T>
          <T v="small">Set on this phone, so they work offline. Changes save straight away.</T>
        </Animated.View>

        {!granted && (
          <Section i={1}>
            <Row gap={10}>
              <Ionicons name="notifications-off-outline" size={20} color={c.accent} />
              <T v="h3" style={{ flex: 1 }}>Notifications are off</T>
            </Row>
            <T v="small">
              {web ? 'Reminders ring in the phone app. The browser version cannot send them.'
                : tried ? 'Notifications are turned off for this app. You can turn them on in your phone settings.'
                : 'Reminders, water breaks and the missed-workout nudge need your permission to show up. Nothing is sent anywhere.'}
            </T>
            {!web && <Button title={tried ? 'Open settings' : 'Allow notifications'} onPress={grant} />}
          </Section>
        )}

        <Section i={2}>
          <T v="h2">Workout reminders</T>
          {!workouts.length && <T v="small">None yet. Add the times you like to train, up to five.</T>}
          {workouts.map((r) => <Line key={r.id} r={r} sub={dayList(r.days)} onOpen={() => show(r)} onToggle={(on) => toggle(r, on)} />)}
          {workouts.length < 5 && <Button title="Add reminder" kind="ghost" icon="add" onPress={add} />}
        </Section>

        <Section i={3}>
          <Toggle title="Missed workout nudge" sub="If a reminder passes without a workout, we suggest a 5 or 15 minute session two hours later."
            value={nudges.missed} onChange={(missed) => setN({ missed })} />
        </Section>

        <Section i={4}>
          <Toggle title="Motivation and tips" sub="Every few hours: a line that fits how life is going, a mindset habit or a food tip."
            value={motivation.on} onChange={(on) => { st.setMotivation({ ...motivation, on }); turnedOn(on); }} />
          {motivation.on && <Hours value={motivation} set={st.setMotivation} opts={[[120, '2 h'], [180, '3 h'], [240, '4 h']]} />}
        </Section>

        <Section i={5}>
          <Toggle title="Water"
            sub={hydration.on ? `Every ${hydration.every} min from ${clock(hydration.from, 0)} to ${clock(hydration.to, 0)}. They stop once today's glasses are in.` : 'A few gentle reminders to drink through the day.'}
            value={hydration.on} onChange={(on) => { st.setHydration({ ...hydration, on }); turnedOn(on); }} />
          {hydration.on && <Hours value={hydration} set={st.setHydration} opts={[[60, '60 min'], [90, '90 min'], [120, '120 min']]} />}
        </Section>

        <Section i={6}>
          <Toggle title="Desk and eye breaks" sub="On weekdays, a nudge to stand up or rest your eyes."
            value={breaks.on} onChange={(on) => { st.setBreaks({ ...breaks, on }); turnedOn(on); }} />
          {breaks.on && <Hours value={breaks} set={st.setBreaks} opts={[[45, '45 min'], [60, '60 min'], [90, '90 min']]} labels={['Work starts', 'Work ends']} />}
        </Section>

        <Section i={7}>
          <T v="h2">Meals</T>
          {meals.map((m) => <Line key={m.id} r={m} sub={m.label ?? 'Meal'} onOpen={() => show(m)} onToggle={(on) => toggle(m, on)} />)}
        </Section>

        <Section i={8}>
          <Toggle title="Streak alert" sub="A heads-up after two days without a workout." value={nudges.streak} onChange={(streak) => setN({ streak })} />
          <Toggle title="Weekly recap" sub="Sunday at 19:00, a look back at your week." value={nudges.recap} onChange={(recap) => setN({ recap })} />
          <View style={s.rule} />
          <View style={{ gap: 2 }}>
            <T v="h3">Quiet hours</T>
            <T v="small">{nudges.quietFrom === nudges.quietTo ? 'Off while both times match.' : 'Automatic nudges stay silent in this window. Reminders you set yourself still ring.'}</T>
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="body">From</T>
            <Stepper value={nudges.quietFrom} min={-1} onChange={(h) => setN({ quietFrom: wrap(h, 24) })} suffix=":00" />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="body">Until</T>
            <Stepper value={nudges.quietTo} min={-1} onChange={(h) => setN({ quietTo: wrap(h, 24) })} suffix=":00" />
          </Row>
        </Section>
      </Screen>

      <Sheet open={open} onClose={() => setOpen(false)}>
        {edit && (
          <View style={{ gap: 16 }}>
            <T v="h3">{edit.kind === 'meal' ? `${edit.label} reminder` : 'Workout reminder'}</T>
            <T v="display" style={{ textAlign: 'center' }}>{clock(edit.hour, edit.minute)}</T>
            <Row style={{ justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <T v="label">Hour</T>
                <Stepper value={edit.hour} min={-1} onChange={(h) => change({ hour: wrap(h, 24) })} />
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <T v="label">Minute</T>
                <Stepper value={edit.minute} min={-1} onChange={(m) => change({ minute: wrap(m, 60) })} />
              </View>
            </Row>
            <Row gap={6}>
              {JUMPS.map((j) => {
                const on = j.at === edit.minute;
                return (
                  <Tap key={j.label} onPress={() => change({ minute: j.to(edit.minute) })} style={[s.pill, on && { backgroundColor: c.accent }]} scale={0.94}>
                    <T v="small" color={on ? c.accentInk : c.text}>{j.label}</T>
                  </Tap>
                );
              })}
            </Row>
            {edit.kind === 'workout' && (
              <View style={{ gap: 8 }}>
                <Row gap={6}>
                  {WEEK.map((d) => {
                    const on = edit.days.includes(d);
                    return (
                      <Tap key={d} onPress={() => change({ days: on ? edit.days.filter((x) => x !== d) : [...edit.days, d] })} style={[s.day, on && { backgroundColor: c.accent }]} scale={0.92}>
                        <T v="h3" color={on ? c.accentInk : c.text}>{LETTER[d]}</T>
                      </Tap>
                    );
                  })}
                </Row>
                <T v="small">{edit.days.length ? dayList(edit.days) : 'No days picked means every day.'}</T>
              </View>
            )}
            <Row gap={10}>
              {edit.kind === 'workout' && <Button title="Delete" kind="danger" icon="trash-outline" style={{ flex: 1 }} onPress={remove} />}
              <Button title="Done" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            </Row>
          </View>
        )}
      </Sheet>
    </>
  );
}

function Section({ i, children }: { i: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(i * 50).duration(380).easing(EASE)} layout={LinearTransition.duration(260).easing(EASE)} style={{ marginTop: 14 }}>
      <Card style={{ gap: 12 }}>{children}</Card>
    </Animated.View>
  );
}

const On = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.card2 }} thumbColor={c.text} ios_backgroundColor={c.card2} />
);

function Toggle({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3">{title}</T>
        <T v="small">{sub}</T>
      </View>
      <On value={value} onChange={onChange} />
    </Row>
  );
}

function Line({ r, sub, onOpen, onToggle }: { r: Reminder; sub: string; onOpen: () => void; onToggle: (on: boolean) => void }) {
  return (
    <Row>
      <Tap onPress={onOpen} scale={0.98} style={{ flex: 1 }}>
        <Row gap={8}>
          <T v="h2" color={r.on ? c.text : c.muted}>{clock(r.hour, r.minute)}</T>
          <Ionicons name="chevron-forward" size={14} color={c.dim} />
        </Row>
        <T v="small">{sub}</T>
      </Tap>
      <On value={r.on} onChange={onToggle} />
    </Row>
  );
}

// Interval chips plus a from/to window in whole hours; from always stays before to.
function Hours({ value, set, opts, labels = ['From', 'Until'] }: {
  value: Interval; set: (v: Interval) => void; opts: [number, string][]; labels?: [string, string];
}) {
  return (
    <Animated.View entering={FadeIn.duration(260).easing(EASE)} style={{ gap: 12 }}>
      <Row gap={8}>
        {opts.map(([m, label]) => <Chip key={m} label={label} on={value.every === m} onPress={() => set({ ...value, every: m })} />)}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="body">{labels[0]}</T>
        <Stepper value={value.from} onChange={(h) => set({ ...value, from: clamp(h, 0, value.to - 1) })} suffix=":00" />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="body">{labels[1]}</T>
        <Stepper value={value.to} onChange={(h) => set({ ...value, to: clamp(h, value.from + 1, 23) })} suffix=":00" />
      </Row>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, height: 36, borderRadius: 18, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.line },
});
