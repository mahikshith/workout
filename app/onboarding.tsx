import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recommend } from '../src/coach';
import { HOME_GEAR, title } from '../src/data/exercises';
import { askPermission, reschedule } from '../src/notify';
import { useStore, type Goal, type Profile } from '../src/store';
import { c, f, r } from '../src/theme';
import { ContextFields } from '../src/context';
import { TimePicker } from '../src/timepicker';
import { Button, Row, Stepper, T, Tap } from '../src/ui';

// Equal-width segmented row; every segment is a full 44px tap target.
function Seg<V extends string | number>({ opts, value, onPick }: { opts: [V, string][]; value: V; onPick: (v: V) => void }) {
  return (
    <View style={s.seg}>
      {opts.map(([v, label]) => {
        const on = v === value;
        return (
          <Tap key={String(v)} onPress={() => onPick(v)} style={[s.segItem, on && { backgroundColor: c.accent }]} scale={0.97}>
            <Text style={{ fontFamily: f.semi, fontSize: 15, color: on ? c.accentInk : c.text }}>{label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

const AGES: [number, string][] = [[20, '16-24'], [30, '25-34'], [40, '35-44'], [50, '45-54'], [60, '55+']];
const GOALS: { v: Goal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 'lose fat', label: 'Lose fat', icon: 'flame' },
  { v: 'build muscle', label: 'Build muscle', icon: 'body' },
  { v: 'get stronger', label: 'Get stronger', icon: 'barbell' },
  { v: 'stay fit', label: 'Stay fit', icon: 'heart' },
];
const fmt12 = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
const TIMES: [number, string][] = [[-1, 'Off'], [7, '7 am'], [12, 'Noon'], [18, '6 pm'], [20, '8 pm']];

// One scrollable page: every question the reasoning engine needs, answered in about a minute.
export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const setProfile = useStore((st) => st.setProfile);
  const current = useStore((st) => st.profile);
  const existing = current.name ? current : null; // editing a set-up profile vs first setup
  const [p, setP] = useState<Profile>(existing ?? { ...current, reminder: { hour: 18, minute: 0, on: true } });
  const [clock, setClock] = useState(false);
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const named = p.name.trim().length > 0;
  const ageOn = AGES.find(([a]) => p.age < a + 5)?.[0] ?? 60;

  async function done() {
    const final = { ...p, name: p.name.trim(), goalWeightKg: existing ? p.goalWeightKg : p.weightKg };
    const plan = recommend(final);
    setProfile(final, existing ? undefined : plan);
    const st = useStore.getState();
    if (!existing) {
      // Turn the helpful nudges on now, so reminders actually arrive without a trip to settings.
      st.setHydration({ ...st.hydration, on: true });
      st.setMotivation({ ...st.motivation, on: true });
      if (['desk', 'student', 'driving'].includes(final.lifestyle ?? '')) st.setBreaks({ ...st.breaks, on: true });
      st.skipSetup(false);
    }
    if (final.reminder.on && !st.reminders.some((x) => x.kind === 'workout'))
      st.setReminders([...st.reminders, { id: 'setup', kind: 'workout', hour: final.reminder.hour, minute: final.reminder.minute, days: [], on: true }]);
    if (await askPermission()) reschedule(useStore.getState().profile, useStore.getState().sessions);
    router.replace(existing ? '/you' : { pathname: '/plan/[id]', params: { id: plan, welcome: '1' } });
  }
  const skip = () => { useStore.getState().skipSetup(true); if (router.canGoBack()) router.back(); else router.replace('/'); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 140, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} style={{ gap: 6 }}>
          <T v="label" color={c.accent}>Gym Buddy</T>
          <T v="h1">{existing ? 'Your profile' : 'Set up your plan'}</T>
          <T v="body" color={c.muted}>About a minute. Your plan, food targets and reminders are built from these answers.</T>
        </Animated.View>

        <Section title="You">
          <TextInput
            value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={c.dim}
            style={[s.input, { borderColor: c.accent }]} returnKeyType="done" maxLength={24} autoCapitalize="words"
          />
          <T v="h3" style={s.label}>Gender</T>
          <Seg<Profile['gender']> value={p.gender} onPick={(gender) => up({ gender })} opts={[['female', 'Female'], ['male', 'Male'], ['other', 'Other']]} />
          <T v="h3" style={s.label}>Age</T>
          <Seg<number> value={ageOn} onPick={(age) => up({ age })} opts={AGES} />
        </Section>

        <Section title="Your goal">
          <View style={s.grid}>
            {GOALS.map((g) => {
              const on = p.goal === g.v;
              return (
                <Tap key={g.v} onPress={() => up({ goal: g.v })} style={[s.tile, on && { backgroundColor: c.accent, borderColor: c.accent }]} scale={0.97}>
                  <Ionicons name={g.icon} size={22} color={on ? c.accentInk : c.accent} />
                  <T v="h3" color={on ? c.accentInk : c.text}>{g.label}</T>
                </Tap>
              );
            })}
          </View>
          <T v="h3" style={s.label}>Where do you train?</T>
          <Seg<Profile['place']> value={p.place} onPick={(place) => up({ place })} opts={[['gym', 'Gym'], ['home', 'Home'], ['both', 'Both'], ['office', 'Office']]} />
          {(p.place === 'home' || p.place === 'both') && (
            <View style={s.wrap}>
              {HOME_GEAR.map((g) => {
                const on = p.gear.includes(g);
                return (
                  <Tap key={g} onPress={() => up({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} style={[s.pill, on && { backgroundColor: c.accent, borderColor: c.accent }]}>
                    <Text style={{ fontFamily: f.semi, fontSize: 14, color: on ? c.accentInk : c.text }}>{title(g)}</Text>
                  </Tap>
                );
              })}
            </View>
          )}
          <T v="h3" style={s.label}>Training experience</T>
          <Seg<Profile['level']> value={p.level} onPick={(level) => up({ level })} opts={[['beginner', 'New'], ['intermediate', 'Some'], ['advanced', 'Seasoned']]} />
          <T v="h3" style={s.label}>Days per week</T>
          <Seg<number> value={p.daysPerWeek} onPick={(daysPerWeek) => up({ daysPerWeek })} opts={[2, 3, 4, 5, 6].map((d): [number, string] => [d, String(d)])} />
        </Section>

        <Section title="Body and food">
          <Row style={{ justifyContent: 'space-between' }}><T v="body">Height</T><Stepper value={p.heightCm} onChange={(heightCm) => up({ heightCm })} min={120} suffix=" cm" /></Row>
          <Row style={{ justifyContent: 'space-between' }}><T v="body">Weight</T><Stepper value={p.weightKg} step={0.5} onChange={(weightKg) => up({ weightKg })} min={30} suffix=" kg" /></Row>
          <T v="h3" style={s.label}>How do you eat?</T>
          <Seg<Profile['diet']> value={p.diet} onPick={(diet) => up({ diet })} opts={[['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']]} />
        </Section>

        <Section title="Daily nudge">
          <Seg<number> value={p.reminder.on ? (p.reminder.minute ? -2 : p.reminder.hour) : -1} opts={TIMES}
            onPick={(h) => up({ reminder: h < 0 ? { ...p.reminder, on: false } : { hour: h, minute: 0, on: true } })} />
          <Tap onPress={() => setClock(!clock)} scale={0.98} style={s.clock}>
            <Ionicons name="alarm-outline" size={20} color={c.accent} />
            <T v="h3" style={{ flex: 1 }}>{p.reminder.on ? `At ${fmt12(p.reminder.hour, p.reminder.minute)}` : 'Pick an exact time'}</T>
            <T v="small" color={c.accent}>{clock ? 'Done' : 'Set time'}</T>
          </Tap>
          {clock && (
            <TimePicker hour={p.reminder.hour} minute={p.reminder.minute}
              onChange={(hour, minute) => up({ reminder: { hour, minute, on: true } })} />
          )}
          <T v="small">A reminder at your training time, plus water and motivation through the day. Fine-tune it all later in Reminders.</T>
        </Section>

        <Section title="Your day and life">
          <ContextFields p={p} up={up} />
        </Section>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: ins.bottom + 12 }]}>
        {!existing && <Button title="Skip" kind="ghost" style={{ flex: 1 }} onPress={skip} />}
        <Button title={existing ? 'Save' : 'Continue'} style={{ flex: 2 }} disabled={!named} onPress={done} />
      </View>
    </KeyboardAvoidingView>
  );
}

const Section = ({ title: t, children }: { title: string; children: ReactNode }) => (
  <Animated.View entering={FadeIn.duration(300)} style={s.section}>
    <T v="h2">{t}</T>
    {children}
  </Animated.View>
);

const s = StyleSheet.create({
  input: { fontFamily: f.display, fontSize: 36, color: c.text, borderBottomWidth: 2, paddingVertical: 6, marginBottom: 8 },
  label: { marginTop: 6 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  segItem: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: { width: '48%', flexGrow: 1, height: 76, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, justifyContent: 'space-between' },
  pill: { paddingHorizontal: 16, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: r.md, backgroundColor: c.card2 },
  section: { gap: 10, padding: 18, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'rgba(10,10,11,0.94)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
