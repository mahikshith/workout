import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recommend } from '../src/coach';
import { HOME_GEAR, title } from '../src/data/exercises';
import { askPermission, reschedule } from '../src/notify';
import { useStore, type Body, type Goal, type Profile } from '../src/store';
import { c, f, r } from '../src/theme';
import { BODIES, BOX, ContextFields, GOALS, LEVELS, Pill, Tiles } from '../src/context';
import { TimePicker } from '../src/timepicker';
import { Button, Row, T, Tap } from '../src/ui';

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

const num = (t: string | null) => parseFloat((t ?? '').replace(',', '.'));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// A boxed number you tap and type (the main control), with small -/+ beside it. Typed values outside min-max
// are clamped when the field loses focus.
function NumField({ label, value, onChange, min, max, step, unit, decimal }: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number; unit: string; decimal?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [txt, setTxt] = useState<string | null>(null); // what is being typed; null when not editing
  const set = (n: number) => onChange(+Math.min(max, Math.max(min, n)).toFixed(decimal ? 1 : 0));
  const commit = () => { const n = num(txt); if (Number.isFinite(n)) set(n); setTxt(null); };
  const nudge = (d: number) => { const n = num(txt); set((Number.isFinite(n) ? n : value) + d); setTxt(null); };
  return (
    <View style={{ gap: 8 }}>
      <T v="h3" style={s.label}>{label}</T>
      <Row gap={8}>
        <Tap onPress={() => nudge(-step)} style={s.nudge}><Ionicons name="remove" size={18} color={c.text} /></Tap>
        <Pressable onPress={() => ref.current?.focus()} style={[s.field, { borderColor: txt !== null ? c.accent : c.line }]}>
          <TextInput ref={ref} value={txt ?? fmt(value)} onFocus={() => setTxt(fmt(value))} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit}
            keyboardType={decimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus maxLength={5} returnKeyType="done" style={s.fieldText} />
          <Text style={s.unit}>{unit}</Text>
        </Pressable>
        <Tap onPress={() => nudge(step)} style={s.nudge}><Ionicons name="add" size={18} color={c.text} /></Tap>
      </Row>
    </View>
  );
}

const AGES: [number, string][] = [[20, '16-24'], [30, '25-34'], [40, '35-44'], [50, '45-54'], [60, '55+']];
const DIETS: [Profile['diet'], string][] = [['vegetarian', 'Veg'], ['vegan', 'Vegan'], ['eggetarian', 'Egg'], ['pescatarian', 'Fish'], ['non-veg', 'Non-veg']];
const fmt12 = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

// One scrollable page: every question the reasoning engine needs, answered in about a minute.
export default function Onboarding() {
  const ins = useSafeAreaInsets();
  const setProfile = useStore((st) => st.setProfile);
  const current = useStore((st) => st.profile);
  const existing = current.name ? current : null; // editing a set-up profile vs first setup
  // "Redo setup" from the profile: answers start from the saved ones, but finishing picks a fresh plan like first setup.
  const redo = useLocalSearchParams<{ redo?: string }>().redo === '1';
  const fresh = !existing || redo;
  const [p, setP] = useState<Profile>(existing ?? { ...current, reminder: { hour: 18, minute: 0, on: true } });
  const up = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const named = p.name.trim().length > 0;
  const ageOn = AGES.find(([a]) => p.age < a + 5)?.[0] ?? 60;

  async function done() {
    const final = { ...p, name: p.name.trim(), goalWeightKg: existing ? p.goalWeightKg : p.weightKg };
    const plan = recommend(final);
    setProfile(final, fresh ? plan : undefined);
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
    router.replace(fresh ? { pathname: '/plan/[id]', params: { id: plan, welcome: '1' } } : '/you');
  }
  const skip = () => { useStore.getState().skipSetup(true); if (router.canGoBack()) router.back(); else router.replace('/'); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top + 8 }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 140, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} style={{ gap: 6 }}>
          <T v="label" color={c.accent}>Gym Buddy</T>
          <T v="h1">{fresh ? 'Set up your plan' : 'Your profile'}</T>
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
          <Tiles<Goal> opts={GOALS} on={(k) => p.goal === k} onPick={(goal) => up({ goal })} />
          <T v="h3" style={s.label}>How would you describe your body right now?</T>
          <T v="small">Optional. It helps us pick the right start. It stays on your phone.</T>
          <Tiles<Body> opts={BODIES} on={(k) => p.body === k} onPick={(k) => up({ body: p.body === k ? undefined : k })} />
          <View style={s.wrap}>
            <Pill label="Prefer not to say" on={!p.body} onPress={() => up({ body: undefined })} />
          </View>
          <T v="h3" style={s.label}>Where do you train?</T>
          <Seg<Profile['place']> value={p.place} onPick={(place) => up({ place })} opts={[['gym', 'Gym'], ['home', 'Home'], ['both', 'Both'], ['office', 'Office']]} />
          {(p.place === 'home' || p.place === 'both') && (
            <View style={s.wrap}>
              {HOME_GEAR.map((g) => {
                const on = p.gear.includes(g);
                return <Pill key={g} label={title(g)} on={on} onPress={() => up({ gear: on ? p.gear.filter((x) => x !== g) : [...p.gear, g] })} />;
              })}
            </View>
          )}
          <T v="h3" style={s.label}>Training experience</T>
          <Tiles<Profile['level']> opts={LEVELS} on={(k) => p.level === k} onPick={(level) => up({ level })} />
          <T v="h3" style={s.label}>Days per week</T>
          <Seg<number> value={p.daysPerWeek} onPick={(daysPerWeek) => up({ daysPerWeek })} opts={[2, 3, 4, 5, 6].map((d): [number, string] => [d, String(d)])} />
        </Section>

        <Section title="Body and food">
          <NumField label="Height" value={p.heightCm} onChange={(heightCm) => up({ heightCm })} min={120} max={230} step={1} unit="cm" />
          <NumField label="Weight" value={p.weightKg} onChange={(weightKg) => up({ weightKg })} min={30} max={250} step={0.5} unit="kg" decimal />
          <T v="h3" style={s.label}>How do you eat?</T>
          <View style={s.wrap}>
            {DIETS.map(([v, label]) => <Pill key={v} label={label} on={p.diet === v} onPress={() => up({ diet: v })} />)}
          </View>
        </Section>

        <Section title="Daily nudge">
          <Row gap={12}>
            <Ionicons name="alarm-outline" size={20} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T v="h3">Daily reminder</T>
              <T v="small">{p.reminder.on ? `At ${fmt12(p.reminder.hour, p.reminder.minute)}` : 'Off'}</T>
            </View>
            <Switch value={p.reminder.on} trackColor={{ true: c.accent, false: c.card2 }} thumbColor={c.text}
              onValueChange={(on) => up({ reminder: { ...p.reminder, on } })} />
          </Row>
          {p.reminder.on && (
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
        <Button title={fresh ? 'Continue' : 'Save'} style={{ flex: 2 }} disabled={!named} onPress={done} />
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flex: 1, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: r.md, borderWidth: 1.5, backgroundColor: c.bg },
  fieldText: { width: 96, fontFamily: f.display, fontSize: 30, color: c.text, textAlign: 'right', padding: 0 },
  unit: { fontFamily: f.semi, fontSize: 16, color: c.muted, marginLeft: 6, width: 36 },
  nudge: { width: 44, height: 44, borderRadius: r.sm, borderWidth: 1, borderColor: BOX, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10, padding: 18, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 12, backgroundColor: 'rgba(10,10,11,0.94)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
