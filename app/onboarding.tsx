import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn, FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { planFor } from '../src/coach';
import { GOALS, Pill, Tiles, type Opt } from '../src/context';
import { HOME_GEAR, title } from '../src/data/exercises';
import { perWeek, planById } from '../src/data/plans';
import { EASE, goBack, Segmented, toToday } from '../src/kit';
import { setSetupFinish } from '../src/setupflow';
import { hasPermission, reschedule } from '../src/notify';
import { useStore, type Goal, type Profile } from '../src/store';
import { c, dom, f, r, tint } from '../src/theme';
import { Button, IconBox, Row, T, Tap } from '../src/ui';

type Step = 'welcome' | 'goal' | 'place' | 'days' | 'plan' | 'name' | 'about';
// First launch: a welcome, four quick questions, then your name (optional). 'about' (body and diet) is an optional
// extra reached from the name step. Redo skips the welcome. Editing a profile keeps its own short list.
const FIRST: Step[] = ['welcome', 'goal', 'place', 'days', 'plan', 'name', 'about'];
const FRESH: Step[] = ['goal', 'place', 'days', 'plan', 'name', 'about'];
const EDIT: Step[] = ['goal', 'place', 'days', 'about'];
const COUNTED: Step[] = ['goal', 'place', 'days', 'plan', 'name']; // "Step n of 5" on a fresh setup

const PLACES: Opt<Profile['place']>[] = [
  ['gym', 'Gym', 'barbell', 'Machines and free weights'],
  ['home', 'Home', 'home', 'Bodyweight and your gear'],
  ['both', 'Both', 'swap-horizontal', 'Some days each'],
  ['office', 'Office', 'briefcase', 'Short sessions at work'],
];
const DAYS: Opt<string>[] = [
  ['2', '2 days', 'leaf', 'Easy start'], ['3', '3 days', 'star', 'Most popular'], ['4', '4 days', 'trending-up', 'Steady progress'],
  ['5', '5 days', 'flame', 'Serious'], ['6', '6 days', 'trophy', 'All in'],
];
const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];
const GENDERS: { k: Profile['gender']; label: string }[] = [{ k: 'female', label: 'Female' }, { k: 'male', label: 'Male' }, { k: 'other', label: 'Other' }];

const num = (t: string | null) => parseFloat((t ?? '').replace(',', '.'));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// A boxed number you tap and type, with small -/+ beside it. Typed values outside min-max are clamped on blur.
function NumField({ label, value, onChange, min, max, step, unit, decimal }: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number; unit: string; decimal?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [txt, setTxt] = useState<string | null>(null); // what is being typed; null when not editing
  const set = (n: number) => onChange(+Math.min(max, Math.max(min, n)).toFixed(decimal ? 1 : 0));
  const commit = () => { const n = num(txt); if (Number.isFinite(n)) set(n); setTxt(null); };
  const nudge = (d: number) => { const n = num(txt); set((Number.isFinite(n) ? n : value) + d); setTxt(null); };
  return (
    <Row gap={8}>
      <T v="body" style={{ width: 64 }}>{label}</T>
      <Tap onPress={() => nudge(-step)} style={s.nudge}><Ionicons name="remove" size={18} color={c.text} /></Tap>
      <Pressable onPress={() => ref.current?.focus()} style={[s.field, { borderColor: txt !== null ? c.accent : c.line }]}>
        <TextInput ref={ref} value={txt ?? fmt(value)} onFocus={() => setTxt(fmt(value))} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus maxLength={5} returnKeyType="done" style={s.fieldText} />
        <Text style={s.unit}>{unit}</Text>
      </Pressable>
      <Tap onPress={() => nudge(step)} style={s.nudge}><Ionicons name="add" size={18} color={c.text} /></Tap>
    </Row>
  );
}

// First launch: a welcome (what the app does, Get started or skip), then one question per screen: goal, where you
// train, days a week, the suggested plan ("Use this plan"), and a light, optional name step that lands on Today.
// Body and diet are an optional extra after the name. No notification prompt here: it comes with the first reminder. An existing profile opens the same steps to
// edit them (?step= jumps to one); ?redo=1 answers again and picks a fresh plan.
export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const still = useReducedMotion();
  const params = useLocalSearchParams<{ redo?: string; step?: string }>();
  const setProfile = useStore((st) => st.setProfile);
  const current = useStore((st) => st.profile);
  const existing = current.name ? current : null; // editing a set-up profile vs first setup
  const redo = params.redo === '1';
  const fresh = !existing || redo; // finishing picks a plan
  const firstRun = !existing && !redo;
  const steps = firstRun ? FIRST : fresh ? FRESH : EDIT;

  const [p, setP] = useState<Profile>(() => existing ?? { ...current, reminder: { hour: 18, minute: 0, on: true } });
  const [idx, setIdx] = useState(() => Math.max(0, steps.indexOf(params.step as Step)));
  const [dir, setDir] = useState(1);
  // On first launch nothing is pre-selected: an answer only lights up once you pick it (the guest defaults are not
  // your answers).
  const [touched, setTouched] = useState<Step[]>([]);
  const mine = (st: Step) => !firstRun || touched.includes(st);
  const before = useRef<Profile | null>(null); // answers before the optional About step, for its Skip
  const busy = useRef(false);
  const step = steps[idx];
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  // The direction is set one frame before the step changes, so the leaving step exits the right way too.
  const move = (d: number, then: () => void) => { setDir(d); requestAnimationFrame(then); };
  const go = (to: number) => {
    if (to < 0 || to >= steps.length) return;
    if (steps[to] === 'about' && steps[idx] !== 'about') before.current = p;
    move(to > idx ? 1 : -1, () => setIdx(to));
  };
  const back = () => (idx > 0 ? go(idx - 1) : firstRun ? skip() : goBack());
  // A tap on an answer moves on by itself, after the pick has had a moment to show.
  const pickThen = (patch: Partial<Profile>) => {
    up(patch);
    setTouched((t) => (t.includes(step) ? t : [...t, step]));
    if (busy.current) return;
    busy.current = true;
    setTimeout(() => { busy.current = false; move(1, () => setIdx((i) => Math.min(i + 1, steps.length - 1))); }, still ? 60 : 200);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (idx > 0) { go(idx - 1); return true; } return false; });
    return () => sub.remove();
  }, [idx]);

  // The plan engine's pick for these answers, with its reasons (top two show on the plan step and its welcome page).
  const pick = useMemo(() => planFor({ ...p, name: p.name.trim() }), [p]);
  const plan = pick.planId;
  const planInfo = planById[plan];
  const why = pick.reasons.slice(0, 2);

  // Saves the answers. A first setup ends on Today; "See the full plan" ends on the plan's welcome page instead.
  async function finish(from: Profile = p, view = false) {
    const final = { ...from, name: from.name.trim(), goalWeightKg: existing ? from.goalWeightKg : from.weightKg };
    const chosen = planFor(final).planId;
    setProfile(final, fresh ? chosen : undefined);
    const st = useStore.getState();
    if (!existing) {
      // Turn the helpful nudges on now, so reminders actually arrive without a trip to settings.
      st.setHydration({ ...st.hydration, on: true });
      st.setMotivation({ ...st.motivation, on: true });
      if (['desk', 'student', 'driving'].includes(final.lifestyle ?? '')) st.setBreaks({ ...st.breaks, on: true });
      // Without a name the tabs would open setup again; mark it done so Today offers to personalise instead.
      st.skipSetup(!final.name);
    }
    // No permission prompt here (round 13): the phone asks the first time you set a reminder (Today's Get started
    // card and You › Reminders lead there). If permission was already given, keep the schedule in step.
    if (await hasPermission()) reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (fresh && view) router.replace({ pathname: '/plan/[id]', params: { id: chosen, welcome: '1' } });
    else if (fresh) toToday();
    else goBack();
  }
  function skip() { useStore.getState().skipSetup(true); if (router.canGoBack()) router.back(); else router.replace('/'); }

  // Top right: Skip on the optional steps (keeps the plan), Skip setup on the questions of a first launch, Save when
  // editing.
  const right = step === 'about' && fresh ? { label: 'Skip', on: () => finish(before.current ?? p) }
    : step === 'name' ? { label: 'Skip', on: () => finish({ ...p, name: '' }) }
    : firstRun && step !== 'welcome' ? { label: 'Skip', on: skip }
    : !fresh && step !== 'about' ? { label: 'Save', on: () => finish() } : null;
  // "Step n of 5": the welcome and the optional About step are not counted.
  const counted = fresh ? COUNTED : EDIT;
  const n = counted.indexOf(step);
  const at = n >= 0 ? n + 1 : counted.length;
  const progress = Math.min(1, at / counted.length);
  const stepLabel = (name: string) => (n >= 0 ? `Step ${at} of ${counted.length} · ${name}` : name);
  const showBack = idx > 0 || !firstRun;

  let body: ReactNode = null;
  let cta: { title: string; on: () => void } | null = null;
  let link: { title: string; on: () => void } | null = null;
  if (step === 'welcome') {
    body = (
      <View style={{ gap: 16, paddingTop: 40 }}>
        <IconBox icon="barbell" color={c.accent} size={72} />
        <T v="display">Your gym buddy</T>
        <T v="body" color={c.soft}>Tells you what to do today, logs it in a few taps, and shows your progress.</T>
        <View style={{ gap: 14, marginTop: 12 }}>
          {([['list', dom.train, 'A plan made for your goal'], ['flash', dom.streak, 'Log sets, food and water fast'], ['trending-up', dom.steps, 'See your streak and strength grow']] as const).map(([icon, color, line]) => (
            <Row key={line} gap={12}>
              <View style={[s.bullet, { backgroundColor: tint(color, 1.2) }]}><Ionicons name={icon} size={18} color={color} /></View>
              <T v="body" style={{ flex: 1 }}>{line}</T>
            </Row>
          ))}
        </View>
        <T v="small" style={{ marginTop: 8 }}>4 quick questions, about a minute.</T>
      </View>
    );
    cta = { title: 'Get started', on: () => go(idx + 1) };
    link = { title: "I've used gym apps before · skip", on: skip };
  } else if (step === 'goal') {
    body = (
      <Q label={stepLabel('Your goal')} title="What do you want most?">
        <Tiles<Goal> opts={GOALS} on={(k) => mine('goal') && p.goal === k} onPick={(goal) => pickThen({ goal })} />
      </Q>
    );
  } else if (step === 'place') {
    const gear = p.place === 'home' || p.place === 'both';
    body = (
      <Q label={stepLabel('Where you train')} title="Where will you work out?">
        <Tiles<Profile['place']> opts={PLACES} on={(k) => mine('place') && p.place === k}
          onPick={(place) => (place === 'home' || place === 'both' ? (up({ place }), setTouched((t) => [...t, 'place'])) : pickThen({ place }))} />
        {gear && mine('place') && (
          <Animated.View entering={still ? undefined : FadeIn.duration(260)} style={{ gap: 10, marginTop: 12 }}>
            <T v="h3">What do you have at home?</T>
            <View style={s.wrap}>
              {HOME_GEAR.map((g) => {
                const on = p.gear.includes(g);
                return <Pill key={g} label={title(g)} on={on} onPress={() => up({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} />;
              })}
            </View>
            <T v="small">None is fine. Bodyweight works.</T>
          </Animated.View>
        )}
      </Q>
    );
    if (gear && mine('place')) cta = { title: 'Next', on: () => go(idx + 1) };
  } else if (step === 'days') {
    body = (
      <Q label={stepLabel('Days a week')} title="How many days can you train?">
        <Tiles<string> opts={DAYS} on={(k) => mine('days') && String(p.daysPerWeek) === k} onPick={(d) => pickThen({ daysPerWeek: Number(d) })} />
      </Q>
    );
  } else if (step === 'plan') {
    const n = planInfo ? perWeek(planInfo) : p.daysPerWeek;
    body = (
      <Q label={stepLabel('Your plan')} title={planInfo?.name ?? 'Your plan'}>
        {planInfo && (
          <View style={s.card}>
            <T v="body" color={c.muted}>{planInfo.tagline}</T>
            <T v="small" color={c.accent}>{n} days a week · {title(planInfo.level)} · {planInfo.place === 'any' ? 'Anywhere' : title(planInfo.place)}</T>
            <View style={{ gap: 8, marginTop: 4 }}>
              {planInfo.days.slice(0, 6).map((d, i) => (
                <Row key={d.name + i} gap={10}>
                  <View style={[s.dot, { backgroundColor: c.accent + '22' }]}><T v="small" color={c.accent}>{i + 1}</T></View>
                  <T v="body" numberOfLines={1} style={{ flex: 1 }}>{d.name}</T>
                  <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{d.slots.length} moves</T>
                </Row>
              ))}
            </View>
            <Tap onPress={() => { const snap = p; setSetupFinish(() => { finish(snap); }); router.push({ pathname: '/plan/[id]', params: { id: plan, welcome: '1', preview: '1', why: why.join('\n') } }); }} style={s.see} scale={0.97}>
              <T v="h3" color={c.accent}>See the full plan</T>
              <Ionicons name="chevron-forward" size={16} color={c.accent} />
            </Tap>
          </View>
        )}
        {why.map((line) => (
          <Row key={line} gap={8}>
            <Ionicons name="checkmark-circle" size={18} color={c.accent} />
            <T v="body" style={{ flex: 1 }}>{line}</T>
          </Row>
        ))}
        <T v="small">Change it any time in Train.</T>
      </Q>
    );
    cta = { title: 'Use this plan', on: () => go(idx + 1) };
  } else if (step === 'name') {
    const first = p.name.trim().split(' ')[0];
    body = (
      <Q label={stepLabel('Last one')} title="What should we call you?" sub="Optional. Just for a friendlier hello.">
        <TextInput value={p.name} onChangeText={(name) => up({ name })} placeholder="Your first name" placeholderTextColor={c.dim}
          style={[s.input, { borderColor: c.accent }]} returnKeyType="done" maxLength={24} autoCapitalize="words" autoFocus={Platform.OS !== 'web'}
          onSubmitEditing={() => finish()} />
      </Q>
    );
    cta = { title: first ? `Let's go, ${first}` : "Let's go", on: () => finish() };
    link = { title: 'Add age and weight for food targets', on: () => go(idx + 1) };
  } else {
    body = (
      <Q label="About you · optional" title={fresh ? 'A bit about you' : 'About you'} sub="Sharpens your plan and food targets.">
        <TextInput value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={c.dim}
          style={[s.input, { borderColor: c.accent }]} returnKeyType="done" maxLength={24} autoCapitalize="words" />
        <Segmented options={GENDERS} value={p.gender} onChange={(gender) => up({ gender })} />
        <View style={{ gap: 10, marginTop: 4 }}>
          <NumField label="Age" value={p.age} onChange={(age) => up({ age })} min={13} max={100} step={1} unit="y" />
          <NumField label="Height" value={p.heightCm} onChange={(heightCm) => up({ heightCm })} min={120} max={230} step={1} unit="cm" />
          <NumField label="Weight" value={p.weightKg} onChange={(weightKg) => up({ weightKg })} min={30} max={250} step={0.5} unit="kg" decimal />
        </View>
        <T v="h3" style={{ marginTop: 8 }}>How do you eat?</T>
        <View style={s.wrap}>
          {DIETS.map(([v, label]) => <Pill key={v} label={label} on={p.diet === v} onPress={() => up({ diet: v })} />)}
        </View>
      </Q>
    );
    cta = { title: fresh ? "Let's go" : 'Save', on: () => finish() };
  }

  const enter = still ? undefined : (dir > 0 ? FadeInRight : FadeInLeft).duration(350).easing(EASE);
  const exit = still ? undefined : (dir > 0 ? FadeOutLeft : FadeOutRight).duration(320).easing(EASE);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 6 }}>
      {step !== 'welcome' && <View style={s.top}>
        {showBack ? (
          <Tap onPress={back} style={s.round} scale={0.9} feedback="none"><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        ) : <View style={{ width: 44 }} />}
        <Progress value={progress} still={still} />
        {right ? (
          <Tap onPress={right.on} style={s.textBtn} scale={0.95}><T v="h3" color={right.label === 'Save' ? c.accent : c.muted}>{right.label}</T></Tap>
        ) : <View style={{ width: 44 }} />}
      </View>}

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View key={step} entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        </Animated.View>
      </View>

      {(cta || link) && (
        <View style={[s.bar, { paddingBottom: ins.bottom + 12 }]}>
          {cta && <Button title={cta.title} onPress={cta.on} />}
          {link && (
            <Tap onPress={link.on} style={s.link} scale={0.97}><T v="body" color={c.muted}>{link.title}</T></Tap>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// One question: a small label, the question, an optional line, then the answers.
const Q = ({ label, title: t, sub, children }: { label: string; title: string; sub?: string; children: ReactNode }) => (
  <View style={{ gap: 12 }}>
    <View style={{ gap: 6, marginBottom: 8 }}>
      <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>{label}</T>
      <T v="h1">{t}</T>
      {sub ? <T v="small">{sub}</T> : null}
    </View>
    {children}
  </View>
);

// Thin bar across the top; the fill slides (transform only) as you move through the steps.
function Progress({ value, still }: { value: number; still: boolean }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    const to = -(1 - value) * w;
    x.value = still ? to : withTiming(to, { duration: 350, easing: EASE });
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={s.track} onLayout={(e) => { const nw = e.nativeEvent.layout.width; x.value = -(1 - value) * nw; setW(nw); }}>
      {w > 0 && <Animated.View style={[{ width: w, height: 6, borderRadius: 3, backgroundColor: c.accent }, fill]} />}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  textBtn: { minWidth: 44, height: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  input: { fontFamily: f.semi, fontSize: 26, color: c.text, borderBottomWidth: 2, paddingVertical: 6, marginBottom: 4, outlineWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 8, padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  dot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: r.md, borderWidth: 1.5, backgroundColor: c.card },
  fieldText: { width: 80, fontFamily: f.semi, fontSize: 22, color: c.text, textAlign: 'right', padding: 0 },
  unit: { fontFamily: f.semi, fontSize: 15, color: c.muted, marginLeft: 6, width: 30 },
  nudge: { width: 44, height: 44, borderRadius: r.sm, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  bar: { gap: 4, paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  link: { height: 44, alignItems: 'center', justifyContent: 'center' },
  bullet: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  see: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, marginTop: 4 },
});
