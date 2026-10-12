import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recommend } from '../src/coach';
import { HOME_GEAR, title } from '../src/data/exercises';
import { askPermission, reschedule } from '../src/notify';
import { useStore, type Goal, type Profile } from '../src/store';
import { c, f, r } from '../src/theme';
import { ContextFields } from '../src/context';
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
const STEPS = 5;
const TIMES: [number, string][] = [[-1, 'Off'], [7, '7 am'], [12, 'Noon'], [18, '6 pm'], [20, '8 pm']];

export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const setProfile = useStore((st) => st.setProfile);
  const current = useStore((st) => st.profile);
  const existing = current.name ? current : null; // editing a set-up profile vs first personalization
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(existing ?? { ...current, reminder: { hour: 18, minute: 0, on: true } });
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const named = p.name.trim().length > 0;
  const last = step === STEPS - 1;
  const ageOn = AGES.find(([a]) => p.age < a + 5)?.[0] ?? 60;

  async function done() {
    const final = { ...p, name: p.name.trim(), goalWeightKg: existing ? p.goalWeightKg : p.weightKg };
    const plan = recommend(final);
    setProfile(final, existing ? undefined : plan);
    const st = useStore.getState();
    if (!existing && ['desk', 'student'].includes(final.lifestyle ?? '') && !st.breaks.on) st.setBreaks({ ...st.breaks, on: true });
    if (final.reminder.on && !st.reminders.some((x) => x.kind === 'workout'))
      st.setReminders([...st.reminders, { id: 'setup', kind: 'workout', hour: final.reminder.hour, minute: final.reminder.minute, days: [], on: true }]);
    if (final.reminder.on && (await askPermission())) reschedule(useStore.getState().profile, useStore.getState().sessions);
    router.replace(existing ? '/you' : { pathname: '/plan/[id]', params: { id: plan, welcome: '1' } });
  }

  const body = [
    <>
      <T v="label" color={c.accent}>Gym Buddy</T>
      <T v="h1">Hey, what should we call you?</T>
      <TextInput
        autoFocus value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={c.dim}
        style={[s.input, { borderColor: c.accent }]} returnKeyType="done" maxLength={24} autoCapitalize="words"
      />
      <T v="label" style={s.label}>Gender</T>
      <Seg<Profile['gender']> value={p.gender} onPick={(gender) => up({ gender })} opts={[['female', 'Female'], ['male', 'Male'], ['other', 'Other']]} />
      <T v="label" style={s.label}>Age</T>
      <Seg<number> value={ageOn} onPick={(age) => up({ age })} opts={AGES} />
    </>,
    <>
      <T v="h1">What are you here for?</T>
      <View style={s.grid}>
        {GOALS.map((g) => {
          const on = p.goal === g.v;
          return (
            <Tap key={g.v} onPress={() => up({ goal: g.v })} style={[s.tile, on && { backgroundColor: c.accent, borderColor: c.accent }]} scale={0.97}>
              <Ionicons name={g.icon} size={26} color={on ? c.accentInk : c.accent} />
              <T v="h3" color={on ? c.accentInk : c.text}>{g.label}</T>
            </Tap>
          );
        })}
      </View>
      <T v="label" style={s.label}>Where do you train?</T>
      <Seg<Profile['place']> value={p.place} onPick={(place) => up({ place })} opts={[['gym', 'Gym'], ['home', 'Home'], ['both', 'Both']]} />
      {p.place !== 'gym' && (
        <Animated.View entering={FadeIn.duration(220)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
            {HOME_GEAR.map((g) => {
              const on = p.gear.includes(g);
              return (
                <Tap key={g} onPress={() => up({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} style={[s.pill, on && { backgroundColor: c.accent, borderColor: c.accent }]}>
                  <Text style={{ fontFamily: f.semi, fontSize: 14, color: on ? c.accentInk : c.text }}>{title(g)}</Text>
                </Tap>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </>,
    <>
      <T v="h1">Your numbers</T>
      <View style={s.num}><T v="label">Height</T><Stepper big value={p.heightCm} onChange={(heightCm) => up({ heightCm })} min={120} suffix=" cm" /></View>
      <View style={s.num}><T v="label">Weight</T><Stepper big value={p.weightKg} step={0.5} onChange={(weightKg) => up({ weightKg })} min={30} suffix=" kg" /></View>
      <T v="label" style={s.label}>Days per week</T>
      <Seg<number> value={p.daysPerWeek} onPick={(daysPerWeek) => up({ daysPerWeek })} opts={[2, 3, 4, 5, 6].map((d): [number, string] => [d, String(d)])} />
    </>,
    <>
      <T v="h1">A few last bits</T>
      <T v="label" style={s.label}>How do you eat?</T>
      <Seg<Profile['diet']> value={p.diet} onPick={(diet) => up({ diet })} opts={[['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']]} />
      <T v="label" style={s.label}>Training experience</T>
      <Seg<Profile['level']> value={p.level} onPick={(level) => up({ level })} opts={[['beginner', 'New'], ['intermediate', 'Some'], ['advanced', 'Seasoned']]} />
      <T v="label" style={s.label}>Daily nudge</T>
      <Seg<number> value={p.reminder.on ? p.reminder.hour : -1} opts={TIMES}
        onPick={(h) => up({ reminder: h < 0 ? { ...p.reminder, on: false } : { hour: h, minute: 0, on: true } })} />
      <T v="small" style={{ marginTop: 8 }}>A gentle reminder at your training time, plus a heads-up if your streak is at risk. Change any of this later in your profile.</T>
    </>,
    <>
      <T v="h1">Anything we should know?</T>
      <ContextFields p={p} up={up} />
    </>,
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8, paddingBottom: ins.bottom + 16 }}>
      <Row style={{ paddingHorizontal: 12 }} gap={8}>
        {step > 0 ? (
          <Tap onPress={() => setStep(step - 1)} style={s.hdrBtn}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        ) : <View style={s.hdrBtn} />}
        <Row style={{ flex: 1 }} gap={6}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={s.pillTrack}>
              {i <= step && <Animated.View entering={FadeIn.duration(280)} style={[s.pillFill, { backgroundColor: c.accent }]} />}
            </View>
          ))}
        </Row>
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.hdrBtn} feedback="none">
          <T v="small" color={c.muted}>Later</T>
        </Tap>
      </Row>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeInRight.duration(280)} style={{ gap: 10 }}>
          {body[step]}
        </Animated.View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20 }}>
        <Button title={last ? 'Build my plan' : 'Continue'} icon={last ? 'sparkles' : 'arrow-forward'}
          disabled={!named} onPress={() => (last ? done() : setStep(step + 1))} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: f.display, fontSize: 36, color: c.text, borderBottomWidth: 2, paddingVertical: 6, marginBottom: 8 },
  label: { marginTop: 10 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  segItem: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: { width: '48%', flexGrow: 1, height: 92, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, justifyContent: 'space-between' },
  pill: { paddingHorizontal: 16, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  num: { alignItems: 'center', gap: 4, marginTop: 6 },
  hdrBtn: { minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pillTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  pillFill: { ...StyleSheet.absoluteFillObject, borderRadius: 3 },
});
