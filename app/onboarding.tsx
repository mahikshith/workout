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
const STEPS = 3;

export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const setProfile = useStore((st) => st.setProfile);
  const existing = useStore((st) => st.profile);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(existing ?? {
    name: '', gender: 'other', age: 30, heightCm: 165, weightKg: 62, goalWeightKg: 62, goal: 'stay fit', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: true },
  });
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const named = p.name.trim().length > 0;
  const last = step === STEPS - 1;
  const ageOn = AGES.find(([a]) => p.age < a + 5)?.[0] ?? 60;

  async function done() {
    const final = { ...p, name: p.name.trim(), goalWeightKg: existing ? p.goalWeightKg : p.weightKg };
    const plan = recommend(final);
    setProfile(final, existing ? undefined : plan);
    if (await askPermission()) reschedule(useStore.getState().profile, useStore.getState().sessions);
    router.replace(existing ? '/you' : { pathname: '/plan/[id]', params: { id: plan, welcome: '1' } });
  }

  const body = [
    <>
      <T v="label" color={c.accent}>Gym Buddy</T>
      <T v="h1">Hey, what should we call you?</T>
      <TextInput
        autoFocus value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={c.dim}
        style={s.input} returnKeyType="done" maxLength={24} autoCapitalize="words"
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
            <Tap key={g.v} onPress={() => up({ goal: g.v })} style={[s.tile, on && s.on]} scale={0.97}>
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
                <Tap key={g} onPress={() => up({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} style={[s.pill, on && s.on]}>
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
      <T v="small" style={{ marginTop: 12 }}>Diet, reminders and more can be changed anytime in You.</T>
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
              {i <= step && <Animated.View entering={FadeIn.duration(280)} style={s.pillFill} />}
            </View>
          ))}
        </Row>
        <Tap onPress={done} disabled={!named} style={s.hdrBtn} feedback="none">
          <T v="small" color={c.muted}>Skip</T>
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
  input: { fontFamily: f.display, fontSize: 36, color: c.text, borderBottomWidth: 2, borderColor: c.accent, paddingVertical: 6, marginBottom: 8 },
  label: { marginTop: 10 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  segItem: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: { width: '48%', flexGrow: 1, height: 92, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, justifyContent: 'space-between' },
  on: { backgroundColor: c.accent, borderColor: c.accent },
  pill: { paddingHorizontal: 16, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
  num: { alignItems: 'center', gap: 4, marginTop: 6 },
  hdrBtn: { minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pillTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  pillFill: { ...StyleSheet.absoluteFillObject, borderRadius: 3, backgroundColor: c.accent },
});
