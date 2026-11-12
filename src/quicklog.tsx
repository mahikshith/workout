// Quick log (docs/round13/PLAN.md, principle 3): one bottom sheet for everything you log outside a workout.
// Opened by "+ Log" in Today's header. Food hands over to the full food sheet; water, weight, supplements and the
// mood check-in are logged right here, so you never leave the page you were on.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { dayKey } from './calc';
import { FoodSheet } from './foodsheet';
import { setKey } from './glance';
import { shortName } from './data/foods';
import { drink, ml, useWater } from './water';
import { Sheet } from './sheet';
import { useStore, type Mood } from './store';
import { c, dom, r, tint } from './theme';
import { haptic, IconBox, Stepper, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
const MOODS: { m: Mood; label: string; icon: Icon }[] = [
  { m: 1, label: 'Drained', icon: 'battery-dead-outline' },
  { m: 2, label: 'Meh', icon: 'cloudy-outline' },
  { m: 3, label: 'Good', icon: 'sunny-outline' },
  { m: 4, label: 'Fired up', icon: 'flash-outline' },
];

const NONE: string[] = []; // stable empty list for store selectors

// Close the sheet first, then move, so a sheet never sits over a pushed screen.
const goTo = (onClose: () => void, href: Href) => { onClose(); setTimeout(() => router.push(href), 180); };

export function QuickLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [food, setFood] = useState(false);
  const openFood = () => { onClose(); setTimeout(() => setFood(true), 200); };
  return (
    <>
      <Sheet open={open} onClose={onClose}>
        {open ? <Body onClose={onClose} openFood={openFood} /> : null}
      </Sheet>
      <FoodSheet open={food} onClose={() => setFood(false)} />
    </>
  );
}

function Body({ onClose, openFood }: { onClose: () => void; openFood: () => void }) {
  const key = dayKey();
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const water = useWater(); // ml today, the goal and the person's glass size (src/water.ts)
  const weights = useStore((s) => s.weights);
  const picked = useStore((s) => s.supplements.picked);
  const taken = useStore((s) => s.supplements.taken[key]) ?? NONE;
  const mood = useStore((s) => s.checkins[key]);
  const gentle = !!(profile.gentle || profile.concerns?.includes('food'));

  const todays = meals.filter((m) => m.day === key);
  const kcal = Math.round(todays.reduce((a, m) => a + m.kcal, 0));
  const protein = Math.round(todays.reduce((a, m) => a + m.protein, 0));

  // Water: +1 glass, with a short-lived Undo.
  const [undo, setUndo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const addGlass = (n: number) => {
    drink(n); // one glass of the person's own size (the store counts 250 ml units)
    haptic(n > 0 ? 'light' : 'medium');
    if (timer.current) clearTimeout(timer.current);
    if (n > 0) { setUndo(true); timer.current = setTimeout(() => setUndo(false), 4000); } else setUndo(false);
  };

  // Weight: today's weigh-in if there is one, else the last one, else the profile.
  // Setup seeds one weigh-in from the profile's default weight; that only counts once the person has really weighed in.
  const dismissed = useStore((s) => s.dismissed);
  const real = !!dismissed[setKey('weightKg')] || weights.length > 1;
  const todayKg = real ? weights.find((w) => w.day === key)?.kg : undefined;
  const lastKg = todayKg ?? weights[weights.length - 1]?.kg ?? profile.weightKg;
  const [kg, setKg] = useState(lastKg);
  const savedKg = todayKg !== undefined && todayKg === kg;
  const saveKg = () => {
    const st = useStore.getState();
    st.logWeight(Math.min(250, Math.max(30, kg)));
    if (!st.dismissed[setKey('weightKg')]) st.dismiss(setKey('weightKg')); // now a real answer, as in Profile
    haptic('success');
  };

  return (
    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <T v="h2">Quick log</T>
      <T v="small" style={{ marginTop: -6, marginBottom: 2 }}>Everything is saved as you tap.</T>

      {/* Food: the full food sheet (search, recipes, your own). */}
      <Item icon="restaurant" color={dom.kcal} title="Food"
        sub={todays.length ? (gentle ? `${todays.length} logged today` : `${Math.round(kcal).toLocaleString('en-US')} kcal · ${Math.round(protein)} g protein today`) : 'Nothing logged yet today'}
        onPress={openFood} right={<Ionicons name="chevron-forward" size={18} color={c.muted} />} />

      {/* Water: one tap, right here. */}
      <Item icon="water" color={dom.water} title="Water" sub={`${water.ml.toLocaleString('en-US')} of ${ml(water.goal)}`}
        right={(
          <View style={s.line}>
            {undo && (
              <Tap onPress={() => addGlass(-1)} style={s.ghost} scale={0.95} accessibilityLabel="Undo the last glass">
                <T v="small" color={c.muted}>Undo</T>
              </Tap>
            )}
            <Tap onPress={() => addGlass(1)} style={[s.pill, { backgroundColor: tint(dom.water, 1.2) }]} scale={0.95} accessibilityLabel={`Add a ${water.glass} ml glass of water`}>
              <Ionicons name="add" size={16} color={dom.water} />
              <T v="small" color={dom.water}>{water.glass} ml</T>
            </Tap>
          </View>
        )} />

      {/* Weight: a stepper and Save. Hidden in gentle mode, which hides weight everywhere. */}
      {!gentle && (
        <View style={s.card}>
          <View style={s.line}>
            <IconBox icon="scale" color={dom.weight} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3">Weight</T>
              <T v="small" numberOfLines={1}>{todayKg !== undefined ? `Logged today: ${todayKg} kg` : 'Weigh in at the same time each day'}</T>
            </View>
          </View>
          <View style={[s.line, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Stepper value={kg} step={0.1} min={30} onChange={(n) => setKg(Math.min(250, n))} suffix=" kg" />
            <Tap onPress={saveKg} disabled={savedKg} style={[s.pill, { backgroundColor: tint(dom.weight, 1.2) }]} scale={0.95}>
              <Ionicons name={savedKg ? 'checkmark' : 'save-outline'} size={16} color={dom.weight} />
              <T v="small" color={dom.weight}>{savedKg ? 'Saved' : 'Save'}</T>
            </Tap>
          </View>
        </View>
      )}

      {/* Supplements: tick today's, or pick what you take. */}
      {picked.length ? (
        <View style={s.card}>
          <View style={s.line}>
            <IconBox icon="medkit" color={dom.steps} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3">Supplements</T>
              <T v="small" numberOfLines={1}>{taken.filter((x) => picked.includes(x)).length} of {picked.length} taken today</T>
            </View>
            <Tap onPress={() => goTo(onClose, '/supplements' as Href)} style={s.ghost} scale={0.95} accessibilityLabel="Edit supplements and reminders">
              <T v="small" color={c.accent}>Edit</T>
            </Tap>
          </View>
          <View style={s.wrap}>
            {picked.map((name) => {
              const on = taken.includes(name);
              return (
                <Tap key={name} onPress={() => { useStore.getState().takeSupplement(name); haptic(on ? 'light' : 'success'); }} scale={0.95}
                  style={[s.chip, on && { backgroundColor: dom.steps, borderColor: dom.steps }]}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${shortName(name)}, ${on ? 'taken' : 'not taken'}`}>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={on ? c.accentInk : c.muted} />
                  <T v="small" color={on ? c.accentInk : c.text} numberOfLines={1}>{shortName(name)}</T>
                </Tap>
              );
            })}
          </View>
        </View>
      ) : (
        <Item icon="medkit" color={dom.steps} title="Supplements" sub="Pick what you take, get a reminder"
          onPress={() => goTo(onClose, '/supplements' as Href)} right={<Ionicons name="chevron-forward" size={18} color={c.muted} />} />
      )}

      {/* How you feel: today's plan adapts (drained means a lighter day). */}
      <View style={s.card}>
        <View style={s.line}>
          <IconBox icon="happy" color={dom.streak} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h3">How do you feel?</T>
            <T v="small" numberOfLines={1}>Today's workout adjusts to it</T>
          </View>
        </View>
        <View style={[s.line, { gap: 8, marginTop: 10 }]}>
          {MOODS.map((x) => {
            const on = mood === x.m;
            return (
              <Tap key={x.m} onPress={() => { useStore.getState().checkIn(x.m); haptic('light'); }} scale={0.95}
                style={[s.mood, on && { backgroundColor: dom.streak, borderColor: dom.streak }]}
                accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
                <Ionicons name={x.icon} size={20} color={on ? c.accentInk : c.text} />
                <T v="small" color={on ? c.accentInk : c.text} numberOfLines={1} style={{ fontSize: 13 }}>{x.label}</T>
              </Tap>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function Item({ icon, color, title, sub, right, onPress }: { icon: Icon; color: string; title: string; sub: string; right?: ReactNode; onPress?: () => void }) {
  const inner = (
    <>
      <IconBox icon={icon} color={color} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="h3">{title}</T>
        <T v="small" numberOfLines={2}>{sub}</T>
      </View>
      {right}
    </>
  );
  return onPress
    ? <Tap onPress={onPress} scale={0.98} style={[s.card, s.line]} accessibilityLabel={`${title}. ${sub}`}>{inner}</Tap>
    : <View style={[s.card, s.line]}>{inner}</View>;
}

const s = StyleSheet.create({
  card: { padding: 12, borderRadius: r.lg, backgroundColor: c.bg, borderWidth: 1, borderColor: c.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: 14, borderRadius: 22, minWidth: 44, justifyContent: 'center' },
  ghost: { height: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, maxWidth: '100%' },
  mood: { flex: 1, minWidth: 0, height: 60, borderRadius: r.md, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line },
});
