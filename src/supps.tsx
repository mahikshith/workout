// Supplements and daily habits: what the person takes (State.supplements.picked), today's ticks
// (State.supplements.taken) and reminder times (State.supplementReminders, scheduled in src/notify.ts).
// Fuel's Supplements card and app/supplements.tsx both tick through SupplementTicks, so ticking a protein shake offers
// to log it as food in both places.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { dayKey, postpartumWeek, pregnancyWeek } from './calc';
import { shakeFood, supplementByName, SUPPLEMENTS, type Supplement } from './data/foods';
import { isGentle, slotName, slotNow } from './foodsheet';
import { useStore, type Profile, type SupplementReminder } from './store';
import { c, dom, f, r, tint } from './theme';
import { haptic, Row, T, Tap } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;
export type MySupp = { name: string; short: string; dose: string; icon: Icon; cat?: Supplement; times: SupplementReminder[] };

export const clock = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; // "6:00 pm", as on You and in the time picker
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
export const dayList = (d: number[]) => (!d.length || d.length >= 7 ? 'every day' : WEEK.filter((x) => d.includes(x)).map((x) => SHORT[x]).join(' '));

// No strong pre-training products for under-18s or around pregnancy.
export const careful = (p: Profile) => p.age < 18 || pregnancyWeek(p) !== null || postpartumWeek(p) !== null;
export const catalogue = (p: Profile) => SUPPLEMENTS.filter((x) => !(x.strong && careful(p)));

// What the person takes, in the order they added it, each with its reminder times.
export function useMySupplements(): MySupp[] {
  const picked = useStore((s) => s.supplements.picked);
  const rems = useStore((s) => s.supplementReminders);
  return picked.map((name) => {
    const cat = supplementByName(name);
    const times = rems.filter((x) => x.name === name).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return { name, short: cat?.short ?? name, dose: times[0]?.dose ?? cat?.dose ?? '', icon: cat?.icon ?? 'ellipse', cat, times };
  });
}

// Adds something to the list with one reminder time ready (off until the person turns it on).
export function addSupplement(name: string, dose?: string) {
  const st = useStore.getState();
  const cat = supplementByName(name);
  st.pickSupplement(name, true);
  if (!st.supplementReminders.some((x) => x.name === name))
    st.setSupplementReminders([...st.supplementReminders, {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, dose: dose ?? cat?.dose,
      hour: cat?.hour ?? 9, minute: cat?.minute ?? 0, days: [], on: false,
    }]);
}
export function removeSupplement(name: string) {
  const st = useStore.getState();
  st.pickSupplement(name, false);
  st.setSupplementReminders(st.supplementReminders.filter((x) => x.name !== name));
}

// Chips to tick today's supplements. Ticking a protein shake offers to log it as food (once, for a few seconds).
export function SupplementTicks({ items }: { items: MySupp[] }) {
  const profile = useStore((s) => s.profile);
  const taken = useStore((s) => s.supplements.taken[dayKey()]) ?? [];
  const take = useStore((s) => s.takeSupplement);
  const addMeal = useStore((s) => s.addMeal);
  const removeMeal = useStore((s) => s.removeMeal);
  const [offer, setOffer] = useState<string | null>(null);
  const [logged, setLogged] = useState<string | null>(null); // meal id, for undo
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const later = (ms: number) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { setOffer(null); setLogged(null); }, ms); };
  const gentle = isGentle(profile);
  const shake = shakeFood(profile.diet);

  const tick = (x: MySupp) => {
    const on = !taken.includes(x.name);
    take(x.name);
    haptic(on ? 'success' : 'light');
    if (on && x.cat?.shake) { setOffer(x.name); setLogged(null); later(8000); } else if (offer === x.name) setOffer(null);
  };
  const logShake = () => {
    addMeal({ name: 'Protein shake', kcal: gentle ? 0 : shake.kcal, protein: gentle ? 0 : shake.protein, slot: slotNow() });
    setLogged(useStore.getState().meals.at(-1)?.id ?? null);
    setOffer(null);
    haptic('light');
    later(4000);
  };

  return (
    <View style={{ gap: 10 }}>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {items.map((x) => {
          const on = taken.includes(x.name);
          return (
            <Tap key={x.name} onPress={() => tick(x)} scale={0.95} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              accessibilityLabel={`${x.short}, ${on ? 'taken today' : 'not taken yet'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 22, borderWidth: 1,
                backgroundColor: on ? c.ok : c.card2, borderColor: on ? c.ok : c.line }}>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? c.accentInk : c.muted} />
              <T v="small" color={on ? c.accentInk : c.text} style={{ fontFamily: f.semi }} numberOfLines={1}>{x.short}</T>
            </Tap>
          );
        })}
      </Row>
      {offer && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, borderRadius: r.md, backgroundColor: tint(dom.protein, 0.8), borderWidth: 1, borderColor: tint(dom.protein, 2) }}>
          <Ionicons name="nutrition" size={18} color={dom.protein} />
          <T v="small" color={c.text} style={{ flex: 1 }} numberOfLines={2}>
            {gentle ? `Log the shake as food at ${slotName(slotNow()).toLowerCase()}?` : `Log the shake as food? +${shake.protein} g protein`}
          </T>
          <Tap onPress={logShake} style={{ height: 44, paddingHorizontal: 14, justifyContent: 'center' }} accessibilityLabel="Log the shake as food">
            <T v="small" color={dom.protein} style={{ fontFamily: f.semi }}>Log it</T>
          </Tap>
        </Animated.View>
      )}
      {logged && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: r.md, backgroundColor: c.card2 }}>
          <Ionicons name="checkmark-circle" size={18} color={c.ok} />
          <T v="small" color={c.text} style={{ flex: 1 }}>{`Shake added to ${slotName(slotNow()).toLowerCase()}`}</T>
          <Tap onPress={() => { removeMeal(logged); setLogged(null); }} style={{ height: 44, paddingHorizontal: 14, justifyContent: 'center' }} accessibilityLabel="Undo">
            <T v="small" color={c.accent} style={{ fontFamily: f.semi }}>Undo</T>
          </Tap>
        </Animated.View>
      )}
    </View>
  );
}
