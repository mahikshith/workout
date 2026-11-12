import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { planFor } from '../src/coach';
import { GOALS, LEVELS, Pill, type Opt } from '../src/context';
import { HOME_GEAR, title } from '../src/data/exercises';
import { perWeek, planById } from '../src/data/plans';
import { EASE, goBack, Segmented, toToday } from '../src/kit';
import { SafetyNote } from '../src/safety';
import { setSetupFinish } from '../src/setupflow';
import { hasPermission, reschedule } from '../src/notify';
import { useStore, type Goal, type Profile } from '../src/store';
import { c, f, r, tint } from '../src/theme';
import { Meta, Tip } from '../src/tip';
import { Button, IconBox, Row, T, Tap } from '../src/ui';

// The page's blocks, top to bottom. ?step= scrolls to one (the old step names still work).
type Sec = 'goal' | 'level' | 'place' | 'days' | 'about' | 'name';
const SECTIONS: Sec[] = ['goal', 'level', 'place', 'days', 'about', 'name'];

// Round 15: titles carry the meaning; a caption stays only where the title alone is unclear.
const PLACES: Opt<Profile['place']>[] = [
  ['gym', 'Gym', 'barbell'],
  ['home', 'Home', 'home'],
  ['both', 'Both', 'swap-horizontal', 'Gym + home'],
  ['office', 'Office', 'briefcase', 'Short sessions'],
];
// Goals without their subtitles; experience keeps a 2-3 word span because the titles alone overlap.
const GOAL_OPTS: Opt<Goal>[] = GOALS.map(([k, label, icon]) => [k, label, icon]);
const SPAN: Record<Profile['level'], string> = { beginner: 'Under 6 months', intermediate: '6 mo – 2 yrs', advanced: '2+ years' };
const LEVEL_OPTS: Opt<Profile['level']>[] = LEVELS.map(([k, label, icon]) => [k, label, icon, SPAN[k]]);
const DAYS: [number, string][] = [[2, 'An easy start'], [3, 'Most popular'], [4, 'Steady progress'], [5, 'Serious'], [6, 'All in']];
const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];
const GENDERS: { k: Profile['gender']; label: string }[] = [{ k: 'female', label: 'Female' }, { k: 'male', label: 'Male' }, { k: 'other', label: 'Other' }];
const SAFETY = 'Not medical advice.';

const num = (t: string | null) => parseFloat((t ?? '').replace(',', '.'));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// The accent fill of a picked option: it fades and grows in behind the content (transform and opacity only).
function Fill({ on, still, radius }: { on: boolean; still: boolean; radius: number }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => { v.value = still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? 240 : 160, easing: EASE }); }, [on, still]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.9 + 0.1 * v.value }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: c.accent }, a]} />;
}

// One answer box: icon, label and a short line. Two per row (goal, place), or one per row (level: `wide`, which has
// room for a tick as well). The box never changes size when picked.
function Choice({ icon, label, sub, on, onPress, still, wide }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; on: boolean; onPress: () => void; still: boolean; wide?: boolean;
}) {
  return (
    <Tap onPress={onPress} scale={0.97} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={sub ? `${label}. ${sub}` : label}
      style={[s.choice, !sub && { minHeight: 60 }, wide && { minHeight: 64, paddingVertical: 10 }, { borderColor: on ? c.accent : c.line }]}>
      <Fill on={on} still={still} radius={r.md - 1} />
      <View style={[s.choiceIcon, { backgroundColor: on ? 'transparent' : tint(c.accent, 1.2) }]}>
        <Ionicons name={icon} size={20} color={on ? c.accentInk : c.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: f.semi, fontSize: 15, lineHeight: 20, color: on ? c.accentInk : c.text }}>{label}</Text>
        {sub ? <Text numberOfLines={2} style={{ fontFamily: f.medium, fontSize: 12.5, lineHeight: 16, marginTop: 1, color: on ? c.accentInk : c.muted }}>{sub}</Text> : null}
      </View>
      {on && wide && (
        <Animated.View entering={still ? undefined : ZoomIn.duration(220)}>
          <Ionicons name="checkmark-circle" size={20} color={c.accentInk} />
        </Animated.View>
      )}
    </Tap>
  );
}

// Answer boxes in rows of `cols`; boxes in a row share a height, and an odd last box keeps its column width.
function Grid<K extends string>({ opts, cols, on, onPick, still }: { opts: Opt<K>[]; cols: 1 | 2; on: (k: K) => boolean; onPick: (k: K) => void; still: boolean }) {
  const rows: Opt<K>[][] = [];
  for (let i = 0; i < opts.length; i += cols) rows.push(opts.slice(i, i + cols));
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
      {rows.map((row) => (
        <View key={row[0][0]} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map(([k, label, icon, sub]) => <Choice key={k} icon={icon} label={label} sub={sub} on={on(k)} onPress={() => onPick(k)} still={still} wide={cols === 1} />)}
          {row.length < cols && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

// A boxed number with -/+ inside the box; tap the number to type. Typed values outside min-max are clamped on blur.
function NumField({ label, value, onChange, min, max, step, unit, decimal, onFocus }: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number; unit: string; decimal?: boolean; onFocus?: () => void;
}) {
  const ref = useRef<TextInput>(null);
  const [txt, setTxt] = useState<string | null>(null); // what is being typed; null when not editing
  const set = (n: number) => onChange(+Math.min(max, Math.max(min, n)).toFixed(decimal ? 1 : 0));
  const commit = () => { const n = num(txt); if (Number.isFinite(n)) set(n); setTxt(null); };
  const nudge = (d: number) => { const n = num(txt); set((Number.isFinite(n) ? n : value) + d); setTxt(null); };
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <T v="small" color={c.soft}>{label}</T>
      <View style={[s.field, { borderColor: txt !== null ? c.accent : c.line }]}>
        <Tap onPress={() => nudge(-step)} style={s.nudge} scale={0.9} accessibilityLabel={`Lower ${label.toLowerCase()}`}><Ionicons name="remove" size={20} color={c.text} /></Tap>
        <Pressable onPress={() => ref.current?.focus()} style={s.fieldMid} accessible={false}>
          <TextInput ref={ref} value={txt ?? fmt(value)} onFocus={() => { setTxt(fmt(value)); onFocus?.(); }} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit}
            keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus maxLength={5} returnKeyType="done" accessibilityLabel={`${label}, ${unit}`}
            style={[s.fieldText, { width: (txt ?? fmt(value)).length * 12 + 6 }]} />
          <Text style={s.unit}>{unit}</Text>
        </Pressable>
        <Tap onPress={() => nudge(step)} style={s.nudge} scale={0.9} accessibilityLabel={`Raise ${label.toLowerCase()}`}><Ionicons name="add" size={20} color={c.text} /></Tap>
      </View>
    </View>
  );
}

// Setup is one scrolling page: goal, level, where you train (with home equipment), days a week, about you (sex, age,
// height, weight, diet) and an optional name. Nothing is required: Skip sits top right, and the pinned button saves
// whatever is answered (the rest keep the defaults) and lands on Home, where the recommendation and every plan are.
// The same page edits an existing profile (?step= scrolls to a block) and answers again (?redo=1, picks a fresh plan).
// No notification prompt here: it comes with the first reminder.
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

  const [p, setP] = useState<Profile>(() => existing ?? { ...current, reminder: { hour: 18, minute: 0, on: true } });
  // On first launch nothing is pre-selected: an answer only lights up once you pick it (the guest defaults are not
  // your answers). The count at the top reads from the same list.
  const [touched, setTouched] = useState<Sec[]>([]);
  const mine = (k: Sec) => !firstRun || touched.includes(k);
  const up = (k: Sec, patch: Partial<Profile>) => {
    setP((x) => ({ ...x, ...patch }));
    setTouched((t) => (t.includes(k) ? t : [...t, k]));
  };
  const answered = SECTIONS.filter((k) => (k === 'name' ? !!p.name.trim() : touched.includes(k))).length;

  // Where each block sits in the scroll, for ?step= and for bringing a focused field above the keyboard.
  const scroll = useRef<ScrollView>(null);
  const ys = useRef<Partial<Record<Sec, number>>>({});
  const target = (SECTIONS as string[]).includes(params.step ?? '') ? (params.step as Sec) : null;
  const jumped = useRef(false);
  const placed = (k: Sec, y: number) => {
    ys.current[k] = y;
    if (target === k && !jumped.current) { jumped.current = true; scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }); }
  };
  const reveal = (k: Sec, extra = 0) => {
    if (Platform.OS === 'web') return;
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (ys.current[k] ?? 0) + extra - 8), animated: !still }), 120);
  };

  // The pinned bar steps aside while the keyboard is up, so the field being typed in has the room.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  // Android back: a first launch has nowhere to go back to (the system closes the app); otherwise leave unsaved.
  useEffect(() => {
    if (Platform.OS !== 'android' || firstRun) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
  }, [firstRun]);

  // The plan engine's pick for the answers so far, shown as one quiet row at the end of the page.
  const pick = useMemo(() => planFor({ ...p, name: p.name.trim() }), [p]);
  const planInfo = planById[pick.planId];
  const why = pick.reasons.slice(0, 2);

  // Saves the answers. A fresh setup ends on Home (recommendation on top, all plans below); an edit goes back.
  async function finish(from: Profile = p) {
    Keyboard.dismiss();
    const final = { ...from, name: from.name.trim(), goalWeightKg: existing ? from.goalWeightKg : from.weightKg };
    const chosen = planFor(final).planId;
    setProfile(final, fresh ? chosen : undefined);
    const st = useStore.getState();
    if (!existing) {
      // Turn the helpful nudges on now, so reminders actually arrive without a trip to settings.
      st.setHydration({ ...st.hydration, on: true });
      st.setMotivation({ ...st.motivation, on: true });
      if (['desk', 'student', 'driving'].includes(final.lifestyle ?? '')) st.setBreaks({ ...st.breaks, on: true });
      // Without a name the tabs would open setup again; mark it done so Home offers to personalise instead.
      st.skipSetup(!final.name);
    }
    // No permission prompt here (round 13): the phone asks the first time you set a reminder. If permission was
    // already given, keep the schedule in step.
    if (await hasPermission()) reschedule(useStore.getState().profile, useStore.getState().sessions);
    if (fresh) toToday();
    else goBack();
  }
  function skip() { useStore.getState().skipSetup(true); if (router.canGoBack()) router.back(); else router.replace('/'); }
  // The full plan page as a preview: nothing is saved until its "Use this plan", which finishes setup from here.
  function preview() {
    const snap = p;
    setSetupFinish(() => { finish(snap); });
    router.push({ pathname: '/plan/[id]', params: { id: pick.planId, welcome: '1', preview: '1', why: why.join('\n') } });
  }

  const gearOpen = (p.place === 'home' || p.place === 'both') && mine('place');
  const dayNote = mine('days') ? DAYS.find(([d]) => d === p.daysPerWeek)?.[1] : null;
  const head = firstRun ? { t: 'Set up your Gym Buddy', sub: 'A minute of answers and the plan fits you. Skip anything, change it all later.' }
    : redo ? { t: 'Answer again', sub: 'Change what is different now. You get a fresh plan pick at the end.' }
    : { t: 'Your answers', sub: 'Change anything and save. Your current plan stays as it is.' };
  // Round 15: no sentence under a heading. A line that holds real information opens from the (i) instead.
  let i = 0; // stagger of the blocks rising in
  const rise = () => (still ? undefined : FadeInDown.delay(60 * i++).duration(380).easing(EASE));
  const block = (k: Sec, t: string, tip: string | null, children: ReactNode, sub?: string | null) => (
    <Animated.View key={k} entering={rise()} onLayout={(e) => placed(k, e.nativeEvent.layout.y)} style={s.block}>
      <View style={{ gap: 2 }}>
        <Row gap={4}>
          <T v="h2" accessibilityRole="header" style={{ flexShrink: 1 }}>{t}</T>
          {tip ? <Tip title={t} text={tip} /> : null}
        </Row>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      {children}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 6 }}>
      <View style={s.top}>
        {firstRun ? <IconBox icon="barbell" color={c.accent} size={40} /> : (
          <Tap onPress={goBack} style={s.round} scale={0.9} feedback="none" accessibilityLabel="Back"><Ionicons name="chevron-back" size={22} color={c.text} /></Tap>
        )}
        {firstRun ? (
          <View style={{ flex: 1, gap: 6 }}>
            <Progress value={answered / SECTIONS.length} still={still} />
            <T v="small" style={{ fontSize: 13, lineHeight: 16 }} accessibilityLabel={answered ? `${answered} of ${SECTIONS.length} answered` : 'Nothing is required'}>
              {answered ? `${answered}/${SECTIONS.length}` : 'All optional'}
            </T>
          </View>
        ) : <View style={{ flex: 1 }} />}
        {firstRun ? (
          <Tap onPress={skip} style={s.textBtn} scale={0.95} accessibilityLabel="Skip setup"><T v="h3" color={c.muted}>Skip</T></Tap>
        ) : !fresh ? (
          <Tap onPress={() => finish()} style={s.textBtn} scale={0.95}><T v="h3" color={c.accent}>Save</T></Tap>
        ) : <View style={{ width: 44 }} />}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={rise()}>
          <Row gap={4} style={{ alignItems: 'flex-start' }}>
            <T v="display" accessibilityRole="header" style={{ flexShrink: 1 }}>{head.t}</T>
            <Tip title={head.t} text={head.sub} style={{ marginTop: 6 }} />
          </Row>
        </Animated.View>

        {block('goal', 'What do you want most?', null,
          <Grid<Goal> opts={GOAL_OPTS} cols={2} on={(k) => mine('goal') && p.goal === k} onPick={(goal) => up('goal', { goal })} still={still} />)}

        {block('level', 'How much have you trained?', 'Sets how hard the first weeks are.',
          <Grid<Profile['level']> opts={LEVEL_OPTS} cols={1} on={(k) => mine('level') && p.level === k} onPick={(level) => up('level', { level })} still={still} />)}

        {block('place', 'Where will you work out?', null, <>
          <Grid<Profile['place']> opts={PLACES} cols={2} on={(k) => mine('place') && p.place === k} onPick={(place) => up('place', { place })} still={still} />
          {gearOpen && (
            <Animated.View entering={still ? undefined : FadeIn.duration(260)} style={s.inset}>
              <T v="h3">What do you have at home?</T>
              <View style={s.wrap}>
                {HOME_GEAR.map((g) => {
                  const on = p.gear.includes(g);
                  return <Pill key={g} label={title(g)} on={on} onPress={() => up('place', { gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} />;
                })}
              </View>
              <T v="small">None? Bodyweight works.</T>
            </Animated.View>
          )}
        </>)}

        {block('days', 'How many days a week?', 'Pick what you can keep up, not the most.',
          <View style={s.days} accessibilityRole="radiogroup">
            {DAYS.map(([d]) => {
              const on = mine('days') && p.daysPerWeek === d;
              return (
                <Tap key={d} onPress={() => up('days', { daysPerWeek: d })} scale={0.94} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  accessibilityLabel={`${d} days a week`} style={[s.day, { borderColor: on ? c.accent : c.line }]}>
                  <Fill on={on} still={still} radius={r.md - 1} />
                  <Text style={{ fontFamily: f.bold, fontSize: 20, color: on ? c.accentInk : c.text }}>{d}</Text>
                </Tap>
              );
            })}
          </View>, dayNote)}

        {block('about', 'About you', 'Height and weight size your plan and food targets.', <>
          <Segmented options={GENDERS} value={p.gender} onChange={(gender) => up('about', { gender })} />
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <NumField label="Height" value={p.heightCm} onChange={(heightCm) => up('about', { heightCm })} min={120} max={230} step={1} unit="cm" onFocus={() => reveal('about', 60)} />
            <NumField label="Weight" value={p.weightKg} onChange={(weightKg) => up('about', { weightKg })} min={30} max={250} step={0.5} unit="kg" decimal onFocus={() => reveal('about', 60)} />
          </Row>
          <Row gap={10} style={{ alignItems: 'flex-end' }}>
            <NumField label="Age" value={p.age} onChange={(age) => up('about', { age })} min={13} max={100} step={1} unit="y" onFocus={() => reveal('about', 140)} />
            <View style={[s.aside, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Ionicons name="create-outline" size={16} color={c.muted} />
              <T v="small" style={{ fontSize: 13, lineHeight: 17 }}>Tap to type</T>
            </View>
          </Row>
          <View style={{ gap: 10, marginTop: 4 }}>
            <T v="h3">How do you eat?</T>
            <View style={s.wrap}>
              {DIETS.map(([v, label]) => <Pill key={v} label={label} on={p.diet === v} onPress={() => up('about', { diet: v })} />)}
            </View>
          </View>
        </>)}

        {block('name', 'What should we call you?', null,
          <TextInput value={p.name} onChangeText={(name) => setP((x) => ({ ...x, name }))} placeholder="Your first name" placeholderTextColor={c.dim}
            style={s.input} returnKeyType="done" maxLength={24} autoCapitalize="words" autoCorrect={false} accessibilityLabel="Your first name"
            onFocus={() => reveal('name')} />)}

        {fresh && planInfo && (
          <Animated.View entering={rise()}>
            <Tap onPress={preview} scale={0.98} style={s.match} accessibilityLabel={`Best match so far: ${planInfo.name}. Preview the plan`}>
              <IconBox icon="sparkles" color={c.accent} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>Best match</T>
                <T v="h3" numberOfLines={2}>{planInfo.name}</T>
                <Meta style={{ marginTop: 2 }} items={[
                  { icon: 'calendar-outline', text: `${perWeek(planInfo)}×/wk` },
                  { icon: 'bar-chart-outline', text: title(planInfo.level) },
                  { icon: 'location-outline', text: planInfo.place === 'any' ? 'Anywhere' : title(planInfo.place) },
                ]} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Tap>
          </Animated.View>
        )}
      </ScrollView>

      {!typing && (
        <View style={[s.bar, { paddingBottom: ins.bottom + (fresh ? 4 : 12) }]}>
          <Button title={fresh ? 'My plan' : 'Save'} icon={fresh ? 'arrow-forward' : 'checkmark'} onPress={() => finish()} />
          {fresh && <SafetyNote text={SAFETY} center />}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// Thin bar at the top; the fill slides (transform only) as answers come in.
function Progress({ value, still }: { value: number; still: boolean }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    const to = -(1 - value) * w;
    x.value = still ? to : withTiming(to, { duration: 350, easing: EASE });
  }, [value, w]);
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={s.track} onLayout={(e) => { const nw = e.nativeEvent.layout.width; x.value = -(1 - value) * nw; setW(nw); }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      {w > 0 && <Animated.View style={[{ width: w, height: 6, borderRadius: 3, backgroundColor: c.accent }, fill]} />}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  textBtn: { minWidth: 44, height: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  page: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  block: { gap: 14 },
  choice: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 76,
    borderRadius: r.md, borderWidth: 1, backgroundColor: c.card },
  choiceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inset: { gap: 10, padding: 14, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  days: { flexDirection: 'row', gap: 8 },
  day: { flex: 1, height: 56, borderRadius: r.md, borderWidth: 1, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  field: { height: 56, flexDirection: 'row', alignItems: 'center', borderRadius: r.md, borderWidth: 1, backgroundColor: c.card },
  fieldMid: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fieldText: { fontFamily: f.semi, fontSize: 20, color: c.text, textAlign: 'right', padding: 0, outlineWidth: 0 },
  unit: { fontFamily: f.medium, fontSize: 14, color: c.muted, marginLeft: 3 },
  nudge: { width: 44, height: 54, alignItems: 'center', justifyContent: 'center' },
  aside: { flex: 1, minWidth: 0, minHeight: 56, justifyContent: 'center', paddingLeft: 4 },
  input: { height: 56, paddingHorizontal: 16, borderRadius: r.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, fontFamily: f.semi, fontSize: 18,
    color: c.text, outlineWidth: 0 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  bar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
