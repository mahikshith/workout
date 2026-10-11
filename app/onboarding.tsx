import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recommend } from '../src/coach';
import { HOME_GEAR, title } from '../src/data/exercises';
import type { Diet } from '../src/data/foods';
import { askPermission, reschedule } from '../src/notify';
import { useStore, type Profile } from '../src/store';
import { c, f, r } from '../src/theme';
import { Button, Chip, Row, Stepper, T, Tap } from '../src/ui';

type Opt<K extends keyof Profile> = { value: Profile[K]; label: string; sub?: string; icon: keyof typeof Ionicons.glyphMap };

function Options<K extends keyof Profile>({ opts, value, onPick }: { opts: Opt<K>[]; value: Profile[K]; onPick: (v: Profile[K]) => void }) {
  return (
    <View style={{ gap: 12 }}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <Tap key={String(o.value)} onPress={() => onPick(o.value)} style={[s.opt, on && s.optOn]} scale={0.98}>
            <View style={[s.optIcon, on && { backgroundColor: c.accentInk }]}>
              <Ionicons name={o.icon} size={22} color={on ? c.accent : c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3" color={on ? c.accentInk : c.text}>{o.label}</T>
              {o.sub && <T v="small" color={on ? '#2B3A10' : c.muted}>{o.sub}</T>}
            </View>
            {on && <Ionicons name="checkmark-circle" size={24} color={c.accentInk} />}
          </Tap>
        );
      })}
    </View>
  );
}

export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const setProfile = useStore((st) => st.setProfile);
  const existing = useStore((st) => st.profile);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(existing ?? {
    name: '', gender: 'female', age: 25, heightCm: 165, weightKg: 62, goalWeightKg: 58, goal: 'stay fit', level: 'beginner',
    place: 'gym', gear: [], daysPerWeek: 3, diet: 'vegetarian', reminder: { hour: 18, minute: 0, on: true },
  });
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const steps: { q: string; sub?: string; ok?: boolean; body: React.ReactNode }[] = [
    {
      q: 'What should we call you?', sub: 'Your buddy will cheer you on by name.', ok: p.name.trim().length > 0,
      body: (
        <TextInput
          autoFocus value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={c.dim}
          style={s.input} returnKeyType="next" onSubmitEditing={() => p.name.trim() && setStep(1)} maxLength={24}
        />
      ),
    },
    {
      q: 'How do you identify?', sub: 'Used to tune calorie targets and suggest plans. Every plan stays open to you.',
      body: (
        <Options<'gender'> value={p.gender} onPick={(gender) => up({ gender })} opts={[
          { value: 'female', label: 'Female', icon: 'female' },
          { value: 'male', label: 'Male', icon: 'male' },
          { value: 'other', label: 'Non-binary / prefer not to say', icon: 'person' },
        ]} />
      ),
    },
    {
      q: 'Your body today', sub: 'No judgement. This is just the starting line.',
      body: (
        <View style={{ gap: 28, alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 6 }}><T v="label">Age</T><Stepper big value={p.age} onChange={(age) => up({ age })} min={13} /></View>
          <View style={{ alignItems: 'center', gap: 6 }}><T v="label">Height</T><Stepper big value={p.heightCm} onChange={(heightCm) => up({ heightCm })} min={120} suffix=" cm" /></View>
          <View style={{ alignItems: 'center', gap: 6 }}><T v="label">Weight</T><Stepper big value={p.weightKg} step={0.5} onChange={(weightKg) => up({ weightKg, goalWeightKg: weightKg })} min={30} suffix=" kg" /></View>
        </View>
      ),
    },
    {
      q: 'What’s the goal?', sub: 'We’ll shape your plan and your food targets around it.',
      body: (
        <Options<'goal'> value={p.goal} onPick={(goal) => up({ goal })} opts={[
          { value: 'lose fat', label: 'Lose fat', sub: 'Lean out and feel lighter', icon: 'flame' },
          { value: 'build muscle', label: 'Build muscle', sub: 'Size, shape and tone', icon: 'body' },
          { value: 'get stronger', label: 'Get stronger', sub: 'Move heavier weight', icon: 'barbell' },
          { value: 'stay fit', label: 'Stay fit & healthy', sub: 'Energy, mobility, longevity', icon: 'heart' },
        ]} />
      ),
    },
    {
      q: 'Goal weight', sub: 'Optional. We’ll draw it as a line on your progress chart.',
      body: <View style={{ alignItems: 'center' }}><Stepper big value={p.goalWeightKg} step={0.5} onChange={(goalWeightKg) => up({ goalWeightKg })} min={30} suffix=" kg" /></View>,
    },
    {
      q: 'Training experience', sub: 'Be honest. We’ll progress you from there.',
      body: (
        <Options<'level'> value={p.level} onPick={(level) => up({ level })} opts={[
          { value: 'beginner', label: 'New to this', sub: 'Under 6 months of training', icon: 'leaf' },
          { value: 'intermediate', label: 'Some experience', sub: 'I know the main lifts', icon: 'trending-up' },
          { value: 'advanced', label: 'Seasoned', sub: 'Years under the bar', icon: 'trophy' },
        ]} />
      ),
    },
    {
      q: 'Where will you train?', sub: 'No gym today? We swap every machine for something you can do.',
      body: (
        <View style={{ gap: 20 }}>
          <Options<'place'> value={p.place} onPick={(place) => up({ place })} opts={[
            { value: 'gym', label: 'At the gym', icon: 'business' },
            { value: 'home', label: 'At home', icon: 'home' },
            { value: 'both', label: 'A bit of both', icon: 'swap-horizontal' },
          ]} />
          {p.place !== 'gym' && (
            <View style={{ gap: 10 }}>
              <T v="label">What do you have at home?</T>
              <Row style={{ flexWrap: 'wrap' }} gap={8}>
                {HOME_GEAR.map((g) => (
                  <Chip key={g} label={title(g)} on={p.gear.includes(g)} onPress={() => up({ gear: p.gear.includes(g) ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} />
                ))}
              </Row>
            </View>
          )}
        </View>
      ),
    },
    {
      q: 'Days per week', sub: 'Pick what you can keep up on a busy week. Consistency beats intensity.',
      body: (
        <View style={{ gap: 20, alignItems: 'center' }}>
          <Row gap={10}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Tap key={d} onPress={() => up({ daysPerWeek: d })} style={[s.day, p.daysPerWeek === d && s.optOn]}>
                <T v="num" color={p.daysPerWeek === d ? c.accentInk : c.text}>{d}</T>
              </Tap>
            ))}
          </Row>
        </View>
      ),
    },
    {
      q: 'How do you eat?', sub: 'Meal suggestions will only show food you actually eat.',
      body: (
        <Options<'diet'> value={p.diet} onPick={(diet) => up({ diet: diet as Diet })} opts={[
          { value: 'vegetarian', label: 'Vegetarian', icon: 'leaf' },
          { value: 'vegan', label: 'Vegan', icon: 'flower' },
          { value: 'eggetarian', label: 'Eggetarian', sub: 'Vegetarian plus eggs', icon: 'egg' },
          { value: 'pescatarian', label: 'Pescatarian', sub: 'Vegetarian plus fish', icon: 'fish' },
          { value: 'non-veg', label: 'Non-vegetarian', icon: 'restaurant' },
        ]} />
      ),
    },
    {
      q: 'When should we nudge you?', sub: 'A daily reminder at your training time, plus a heads-up if your streak is at risk.',
      body: (
        <View style={{ alignItems: 'center', gap: 20 }}>
          <Stepper big value={p.reminder.hour} onChange={(h) => up({ reminder: { ...p.reminder, hour: (h + 24) % 24 } })} suffix=":00" />
          <Row gap={8}>
            {[[6, 'Early'], [12, 'Lunch'], [18, 'Evening'], [20, 'Night']].map(([h, l]) => (
              <Chip key={l} label={String(l)} on={p.reminder.hour === h} onPress={() => up({ reminder: { ...p.reminder, hour: h as number } })} />
            ))}
          </Row>
        </View>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const cur = steps[step];
  const frac = (step + 1) / steps.length;
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withSpring(frac, { damping: 20 }) }] }));

  async function done() {
    const plan = recommend(p);
    setProfile({ ...p, name: p.name.trim() }, existing ? undefined : plan);
    if (await askPermission()) reschedule(useStore.getState().profile, useStore.getState().sessions);
    router.replace(existing ? '/you' : { pathname: '/plan/[id]', params: { id: plan, welcome: '1' } });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 12, paddingBottom: ins.bottom + 16 }}>
      <Row style={{ paddingHorizontal: 20 }}>
        {step > 0 ? (
          <Tap onPress={() => setStep(step - 1)} style={s.back}><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        ) : <View style={s.back} />}
        <View style={s.track}><Animated.View style={[s.fill, bar]} /></View>
        <T v="small" style={{ width: 40, textAlign: 'right' }}>{step + 1}/{steps.length}</T>
      </Row>
      <Animated.ScrollView key={step} entering={FadeInRight.springify().damping(20)} exiting={FadeOutLeft.duration(150)}
        contentContainerStyle={{ padding: 20, paddingTop: 36, gap: 10 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 0 && <T v="label" color={c.accent}>Gym Buddy</T>}
        <T v="h1">{cur.q}</T>
        {cur.sub && <T v="body" color={c.muted} style={{ marginBottom: 20 }}>{cur.sub}</T>}
        {cur.body}
      </Animated.ScrollView>
      <View style={{ paddingHorizontal: 20 }}>
        <Button title={last ? 'Build my plan' : 'Continue'} icon={last ? 'sparkles' : 'arrow-forward'}
          disabled={cur.ok === false} onPress={() => (last ? done() : setStep(step + 1))} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: f.display, fontSize: 40, color: c.text, borderBottomWidth: 2, borderColor: c.accent, paddingVertical: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  optOn: { backgroundColor: c.accent, borderColor: c.accent },
  optIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: 3, backgroundColor: c.accent, transformOrigin: 'left' },
  day: { width: 56, height: 72, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
});
