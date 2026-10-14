// "What's going on for you right now?" plus women's health modes. Shared by setup and the profile screen.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { dayKey, postpartumWeek, pregnancyWeek } from './calc';
import type { Concern, Goal, Lifestyle, Profile, Women } from './store';
import { c, f } from './theme';
import { Row, Stepper, T, Tap } from './ui';

const DAY = 86400000;
// value, label, icon, optional short subtitle
export type Opt<K> = [K, string, keyof typeof Ionicons.glyphMap, string?];

// Option boxes sit quietly on the card: a 1px line only a shade lighter than it, no fill until picked.
export const BOX = '#26262C';

// The stored values never change; these are the words people see, in setup and on the profile.
export const GOALS: Opt<Goal>[] = [
  ['lose fat', 'Lose fat', 'flame', 'Drop body fat'],
  ['build muscle', 'Build muscle', 'body', 'Bigger, firmer muscles'],
  ['get stronger', 'Lift heavier', 'barbell', 'Get stronger, lift more'],
  ['stay fit', 'Stay healthy', 'heart', 'Feel fit and move well'],
];
export const LEVELS: Opt<Profile['level']>[] = [
  ['beginner', 'Just starting', 'leaf', 'Less than 6 months'],
  ['intermediate', 'Trained before', 'trending-up', '6 months to 2 years'],
  ['advanced', 'Train regularly', 'trophy', '2+ years'],
];
export const optLabel = <K extends string>(opts: Opt<K>[], k: K) => opts.find((o) => o[0] === k)?.[1] ?? k;

const LIFE: Opt<Lifestyle>[] = [
  ['desk', 'Desk job', 'desktop'], ['wfh', 'Work from home', 'laptop'], ['standing', 'On my feet all day', 'walk'],
  ['active', 'Physical job', 'hammer'], ['home', 'Home and chores', 'home'], ['parent', 'Parent or carer', 'people'],
  ['driving', 'Drive a lot', 'car'], ['travel', 'Travel a lot', 'airplane'], ['shift', 'Shift or night work', 'moon'],
  ['student', 'Student', 'school'], ['retired', 'Retired', 'sunny'],
];
const CONCERNS: Opt<Concern>[] = [
  ['stressed', 'Stressed or low', 'cloudy'], ['anxious', 'Anxious or overthinking', 'pulse'], ['anger', 'Anger to burn off', 'flame'],
  ['calm', 'Want to calm down', 'leaf'], ['sleep', 'Want better sleep', 'bed'], ['breakup', 'Going through a breakup', 'heart-dislike'],
  ['confidence', 'Want more confidence', 'star'], ['lose-weight', 'Lose weight', 'trending-down'], ['gain', 'Gain weight', 'trending-up'],
  ['tone', 'Firmer and toned', 'body'], ['endurance', 'Build endurance', 'infinite'], ['run', 'Run more', 'walk'],
  ['posture', 'Better posture', 'accessibility'], ['flexibility', 'More flexible', 'git-merge'], ['injury', 'Back from injury', 'bandage'],
  ['back', 'Back pain', 'warning'], ['knee', 'Knee pain', 'warning'], ['thyroid', 'Thyroid condition', 'medkit'],
  ['food', 'Hard relationship with food', 'restaurant'],
];
const MODES: [Women['mode'], string][] = [['none', 'None'], ['cycle', 'Track my cycle'], ['pregnant', 'Pregnant'], ['postpartum', 'Had a baby']];
const AGO: [number, string][] = [[0, 'Today'], [1, 'Yesterday'], [3, '3 days ago'], [7, '1 week ago'], [14, '2 weeks ago'], [21, '3 weeks ago']];

// A one-line option chip in a wrapping row; picked ones fill completely with the accent.
export function Pill({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Tap onPress={onPress} scale={0.97}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 1,
        backgroundColor: on ? c.accent : 'transparent', borderColor: on ? c.accent : BOX }}>
      {on && <Ionicons name={icon ?? 'checkmark'} size={16} color={c.accentInk} />}
      <Text numberOfLines={1} style={{ fontFamily: f.semi, fontSize: 14, color: on ? c.accentInk : c.text }}>{label}</Text>
    </Tap>
  );
}

// Two equal boxes per row; boxes in a row stretch to the same height, an odd last box keeps half width.
export function Tiles<K extends string>({ opts, on, onPick }: { opts: Opt<K>[]; on: (k: K) => boolean; onPick: (k: K) => void }) {
  const tall = opts.some((o) => o[3]);
  const rows: Opt<K>[][] = [];
  for (let i = 0; i < opts.length; i += 2) rows.push(opts.slice(i, i + 2));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View key={row[0][0]} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map(([k, label, icon, sub]) => {
            const sel = on(k);
            return (
              <Tap key={k} onPress={() => onPick(k)} scale={0.97}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: tall ? 72 : 56,
                  borderRadius: 14, borderWidth: 1, backgroundColor: sel ? c.accent : 'transparent', borderColor: sel ? c.accent : BOX }}>
                <Ionicons name={icon} size={18} color={sel ? c.accentInk : c.accent} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontFamily: f.semi, fontSize: 14, lineHeight: 18, color: sel ? c.accentInk : c.text }}>{label}</Text>
                  {sub ? <Text numberOfLines={2} style={{ fontFamily: f.medium, fontSize: 12, lineHeight: 16, marginTop: 2, color: sel ? c.accentInk : c.muted }}>{sub}</Text> : null}
                </View>
              </Tap>
            );
          })}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
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
      <T v="h3">What does a normal day look like?</T>
      <Tiles<Lifestyle> opts={LIFE} on={(k) => p.lifestyle === k} onPick={(k) => up({ lifestyle: p.lifestyle === k ? undefined : k })} />
      <T v="small">We suggest 2 to 15 minute sessions that fit your day: desk, eye and Kegel breaks for sitters, recovery for people on their feet, hotel-room workouts for travellers.</T>

      <T v="h3" style={{ marginTop: 14 }}>What's going on for you right now?</T>
      <T v="small">Optional. It helps us be kinder and safer. It stays on your phone.</T>
      <Tiles<Concern> opts={CONCERNS} on={(k) => concerns.includes(k)} onPick={toggle} />
      {concerns.includes('food') && (
        <T v="small" color={c.text}>We'll hide calories, weight and BMI, and focus on regular meals and feeling strong.</T>
      )}

      {p.gender === 'female' && (
        <>
          <T v="h3" style={{ marginTop: 14 }}>Women's health</T>
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
