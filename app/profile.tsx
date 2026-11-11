import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BODIES, ContextFields, GOALS, LEVELS, Pill, Tiles } from '../src/context';
import { HOME_GEAR, title } from '../src/data/exercises';
import { perWeek, planById } from '../src/data/plans';
import { UNLOCK } from '../src/engine';
import { planFor } from '../src/coach';

import { EASE, Header, Segmented, useMiniBarSpace } from '../src/kit';
import { answered, setKey, type Answerable } from '../src/glance';
import { SafetyNote } from '../src/safety';
import { useStore, type Body, type Goal, type Profile } from '../src/store';
import { c, f, r } from '../src/theme';
import { Button, Row, Stepper, T } from '../src/ui';

const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];
const PLACES: { k: Profile['place']; label: string }[] = [{ k: 'gym', label: 'Gym' }, { k: 'home', label: 'Home' }, { k: 'both', label: 'Both' }, { k: 'office', label: 'Office' }];
const DAYS = ['2', '3', '4', '5', '6'].map((k) => ({ k, label: k }));
const GENDERS: { k: Profile['gender']; label: string }[] = [{ k: 'female', label: 'Female' }, { k: 'male', label: 'Male' }, { k: 'other', label: 'Other' }];
const TITLES = { plan: 'Plan and goal', about: 'About you', place: 'Where you train' } as const;
type Part = keyof typeof TITLES;

// One section of the profile, opened from a row on You. Every change saves straight away.
export default function ProfilePage() {
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace(); // room for the workout mini bar while it shows
  const raw = useLocalSearchParams<{ s?: string }>().s;
  const part: Part = raw === 'plan' || raw === 'place' ? raw : 'about';
  const p = useStore((st) => st.profile);
  const planId = useStore((st) => st.planId);
  const setProfile = useStore((st) => st.setProfile);
  const save = (patch: Partial<Profile>) => setProfile({ ...useStore.getState().profile, ...patch });
  // Guest defaults (30 y, 170 cm...) read "Not set" until the person picks a value; picking marks the field as answered.
  const dismissed = useStore((st) => st.dismissed);
  const weighIns = useStore((st) => st.weights.length);
  const isSet = (k: Answerable) => answered(p, dismissed, k) || (k === 'weightKg' && weighIns > 1);
  const mark = (k: Answerable) => { if (!dismissed[setKey(k)]) useStore.getState().dismiss(setKey(k)); };
  const answer = <K extends Answerable>(k: K, v: Profile[K]) => { save({ [k]: v } as Partial<Profile>); mark(k); };
  // Weight has one home, the weigh-in history: the stepper logs today's weigh-in (which also updates the profile).
  const logWeight = (kg: number) => { useStore.getState().logWeight(Math.min(250, kg)); mark('weightKg'); };
  // An empty name would send the app back to first-launch setup (see (tabs)/_layout), so mark setup as done-without-name.
  const setName = (name: string) => { save({ name }); if (!name.trim()) useStore.getState().skipSetup(true); };
  const gentle = !!(p.gentle || p.concerns?.includes('food'));

  // Days a week and the plan stay in step: when they differ, offer the plan engine's pick for the new number of days
  // (never switch silently). The engine always fits its pick to the chosen days, so Switch keeps the weekly goal.
  const fitDays = planById[planId] && planById[planId].category !== 'One muscle' ? perWeek(planById[planId]) : null;
  const pick = planFor(p);
  const better = pick.planId !== planId && planById[pick.planId] && perWeek(planById[pick.planId]) === p.daysPerWeek ? pick.planId : null;

  const plan = (
    <>
      <Block i={0} label="Goal">
        <Tiles<Goal> opts={GOALS} on={(k) => p.goal === k} onPick={(goal) => save({ goal })} />
      </Block>
      <Block i={1} label="Days a week">
        <Segmented options={DAYS} value={String(p.daysPerWeek)} onChange={(d) => save({ daysPerWeek: Number(d) })} />
      </Block>
      <Block i={2} label="Experience">
        <Tiles<Profile['level']> opts={LEVELS} on={(k) => p.level === k} onPick={(level) => save({ level })} />
        <T v="small">
          {p.level === 'beginner' ? `Harder moves open after ${UNLOCK.intermediate} sessions`
            : p.level === 'intermediate' ? `Expert moves open after ${UNLOCK.expert} sessions` : 'Everything is open'}
        </T>
      </Block>
      <Block i={3} label="Your plan">
        <T v="body" color={c.muted}>{planById[planId]?.name ?? 'No plan yet'}</T>
        {fitDays !== null && fitDays !== p.daysPerWeek && (
          better
            ? <Row gap={12}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body" numberOfLines={1}>{planById[better].name}</T>
                  <T v="small" numberOfLines={1}>{pick.reasons[0] ?? `Fits your ${p.daysPerWeek} days`}</T>
                </View>
                <Button title="Switch" kind="ghost" onPress={() => useStore.getState().setPlan(better)} />
              </Row>
            : <T v="small">Built for {fitDays} days a week</T>
        )}
        <Button title="Find a new plan" kind="ghost" icon="sparkles-outline"
          onPress={() => router.replace({ pathname: '/onboarding', params: { redo: '1' } })} />
      </Block>
    </>
  );

  const about = (
    <>
      <Block i={0} label="Name">
        <TextInput value={p.name} onChangeText={setName} placeholder="Your name" placeholderTextColor={c.dim}
          style={[s.input, { borderColor: c.line }]} maxLength={24} autoCapitalize="words" returnKeyType="done" />
      </Block>
      <Block i={1} label="Body">
        <View style={s.wrap}>
          {GENDERS.map((g) => <Pill key={g.k} label={g.label} on={isSet('gender') && p.gender === g.k} onPress={() => answer('gender', g.k)} />)}
        </View>
        {!isSet('gender') && <T v="small">Not set</T>}
        <Field label="Age" unset={!isSet('age')}><Stepper value={p.age} min={13} onChange={(age) => answer('age', Math.min(100, age))} suffix=" y" /></Field>
        <Field label="Height" unset={!isSet('heightCm')}><Stepper value={p.heightCm} min={120} onChange={(h) => answer('heightCm', Math.min(230, h))} suffix=" cm" /></Field>
        {!gentle && (
          <Field label="Weight" unset={!isSet('weightKg')}><Stepper value={p.weightKg} step={0.5} min={30} onChange={logWeight} suffix=" kg" /></Field>
        )}
        <T v="small" style={{ marginTop: 6 }}>How would you describe your body right now?</T>
        <Tiles<Body> opts={BODIES} on={(k) => p.body === k} onPick={(k) => save({ body: p.body === k ? undefined : k })} />
        <View style={s.wrap}><Pill label="Prefer not to say" on={!p.body} onPress={() => save({ body: undefined })} /></View>
      </Block>
      <Block i={2} label="How you eat">
        <View style={s.wrap}>
          {DIETS.map(([v, label]) => <Pill key={v} label={label} on={isSet('diet') && p.diet === v} onPress={() => answer('diet', v)} />)}
        </View>
        {!isSet('diet') && <T v="small">Not set</T>}
      </Block>
      <Block i={3}>
        <Row gap={12}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">Gentle mode</T>
            <T v="small">Hide calories, weight and BMI</T>
          </View>
          <Switch value={gentle} trackColor={{ true: c.accent, false: c.card2 }} thumbColor="#FFFFFF" ios_backgroundColor={c.card2}
            onValueChange={(on) => save({ gentle: on, concerns: on ? p.concerns : p.concerns?.filter((x) => x !== 'food') })} />
        </Row>
      </Block>
      <Block i={4} label="Your day and life">
        <ContextFields p={p} up={save} />
      </Block>
    </>
  );

  const place = (
    <>
      <Block i={0} label="Where you train">
        <Segmented options={PLACES} value={p.place} onChange={(v) => save({ place: v })} />
        <T v="small">{p.place === 'office' ? 'Short sessions at work, no equipment' : p.place === 'gym' ? 'Full gym equipment' : 'Workouts fit the gear you have'}</T>
      </Block>
      {(p.place === 'home' || p.place === 'both') && (
        <Block i={1} label="Home equipment">
          <View style={s.wrap}>
            {HOME_GEAR.map((g) => {
              const on = p.gear.includes(g);
              return <Pill key={g} label={title(g)} on={on} onPress={() => save({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} />;
            })}
          </View>
        </Block>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      {/* No "Theme" button here: it was a filled button unrelated to plan or profile. Theme lives in You › Look and feel. */}
      <Header title={TITLES[part]} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: ins.bottom + 40 + mini, gap: 12 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {part === 'plan' ? plan : part === 'place' ? place : about}
        <SafetyNote />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A card holding one group of settings. Defined outside the page so typing in it never remounts it.
function Block({ i, label, children }: { i: number; label?: string; children: ReactNode }) {
  const still = useReducedMotion();
  return (
    <Animated.View entering={still ? undefined : FadeInDown.delay(i * 60).duration(380).easing(EASE)} style={s.block}>
      {label ? <T v="h3">{label}</T> : null}
      {children}
    </Animated.View>
  );
}

const Field = ({ label, unset, children }: { label: string; unset?: boolean; children: ReactNode }) => (
  <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
    <View>
      <T v="body">{label}</T>
      {unset ? <T v="small">Not set</T> : null}
    </View>
    {children}
  </Row>
);

const s = StyleSheet.create({
  block: { gap: 12, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { fontFamily: f.semi, fontSize: 18, color: c.text, height: 48, paddingHorizontal: 14, borderRadius: r.md, borderWidth: 1, backgroundColor: c.bg },
});
