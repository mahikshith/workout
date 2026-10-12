// "What's going on for you right now?" plus women's health modes. Shared by setup and the profile screen.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { dayKey, postpartumWeek, pregnancyWeek } from './calc';
import type { Concern, Lifestyle, Profile, Women } from './store';
import { c, f } from './theme';
import { Row, Stepper, T, Tap } from './ui';

const DAY = 86400000;
const CONCERNS: [Concern, string][] = [
  ['stressed', 'Stressed or low'], ['breakup', 'Going through a breakup'], ['lose-weight', 'Want to lose weight'],
  ['tone', 'Want to feel firmer and toned'], ['food', 'Complicated relationship with food'], ['desk', 'Desk job'],
  ['back', 'Back pain'], ['knee', 'Knee pain'], ['thyroid', 'Thyroid condition'],
];
const LIFE: [Lifestyle, string][] = [
  ['desk', 'Sit at a desk'], ['standing', 'On my feet all day'], ['active', 'Physical job'], ['home', 'Home and chores'],
  ['driving', 'Drive a lot'], ['student', 'Student'],
];
const MODES: [Women['mode'], string][] = [['none', 'None'], ['cycle', 'Track my cycle'], ['pregnant', 'Pregnant'], ['postpartum', 'Had a baby']];
const AGO: [number, string][] = [[0, 'Today'], [1, 'Yesterday'], [3, '3 days ago'], [7, '1 week ago'], [14, '2 weeks ago'], [21, '3 weeks ago']];

function Pill({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Tap onPress={onPress} scale={0.97}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 22, borderWidth: 1,
        backgroundColor: on ? c.accent : c.card2, borderColor: on ? c.accent : c.line }}>
      {on && <Ionicons name={icon ?? 'checkmark'} size={16} color={c.accentInk} />}
      <Text style={{ fontFamily: f.semi, fontSize: 14, color: on ? c.accentInk : c.text }}>{label}</Text>
    </Tap>
  );
}

export function ContextFields({ p, up }: { p: Profile; up: (patch: Partial<Profile>) => void }) {
  const concerns = p.concerns ?? [];
  const w: Women = p.women ?? { mode: 'none' };
  const setW = (patch: Partial<Women>) => up({ women: { ...w, ...patch } });
  const toggle = (k: Concern) => {
    const next = concerns.includes(k) ? concerns.filter((x) => x !== k) : [...concerns, k];
    up({ concerns: next, ...(k === 'food' ? { gentle: next.includes('food') } : {}) });
  };
  const weeksPreg = pregnancyWeek({ ...p, women: w }) ?? 14;
  const weeksBaby = postpartumWeek({ ...p, women: w }) ?? 0;

  return (
    <View style={{ gap: 10 }}>
      <T v="label">What does a normal day look like?</T>
      <Row style={{ flexWrap: 'wrap' }} gap={8}>
        {LIFE.map(([k, label]) => <Pill key={k} label={label} on={p.lifestyle === k} onPress={() => up({ lifestyle: p.lifestyle === k ? undefined : k })} />)}
      </Row>
      <T v="small">We suggest 2 to 15 minute sessions that fit your day: desk, eye and Kegel breaks for sitters, recovery for people on their feet.</T>

      <T v="label" style={{ marginTop: 14 }}>What's going on for you right now?</T>
      <T v="small">Optional. It helps us be kinder and safer. It stays on your phone.</T>
      <Row style={{ flexWrap: 'wrap' }} gap={8}>
        {CONCERNS.map(([k, label]) => <Pill key={k} label={label} on={concerns.includes(k)} onPress={() => toggle(k)} />)}
      </Row>
      {concerns.includes('food') && (
        <T v="small" color={c.text}>We'll hide calories, weight and BMI, and focus on regular meals and feeling strong.</T>
      )}

      {p.gender !== 'male' && (
        <>
          <T v="label" style={{ marginTop: 14 }}>Women's health</T>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {MODES.map(([m, label]) => <Pill key={m} label={label} on={w.mode === m} onPress={() => setW({ mode: m })} />)}
          </Row>
          {w.mode === 'cycle' && (
            <>
              <T v="small" style={{ marginTop: 6 }}>When did your last period start?</T>
              <Row style={{ flexWrap: 'wrap' }} gap={8}>
                {AGO.map(([n, label]) => (
                  <Pill key={n} label={label} on={w.periodStart === dayKey(Date.now() - n * DAY)} onPress={() => setW({ periodStart: dayKey(Date.now() - n * DAY) })} />
                ))}
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <T v="small">Usual cycle length</T>
                <Stepper value={w.cycleLength ?? 28} min={21} onChange={(cycleLength) => setW({ cycleLength: Math.min(40, cycleLength) })} suffix=" days" />
              </Row>
            </>
          )}
          {w.mode === 'pregnant' && (
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T v="small">Weeks pregnant</T>
              <Stepper value={weeksPreg} min={1} onChange={(n) => setW({ date: dayKey(Date.now() + (40 - Math.min(42, n)) * 7 * DAY) })} />
            </Row>
          )}
          {w.mode === 'postpartum' && (
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T v="small">Weeks since birth</T>
              <Stepper value={weeksBaby} min={0} onChange={(n) => setW({ date: dayKey(Date.now() - Math.min(104, n) * 7 * DAY) })} />
            </Row>
          )}
          {(w.mode === 'pregnant' || w.mode === 'postpartum') && (
            <T v="small" color={c.warm}>We only suggest moves that are usually safe. Follow your doctor or midwife where their advice differs.</T>
          )}
        </>
      )}
    </View>
  );
}
