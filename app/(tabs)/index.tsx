import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { cycle, dayKey, doneToday, postpartumWeek, pregnancyWeek, streak as calcStreak, targets } from '../../src/calc';
import { greeting } from '../../src/coach';
import { available, byId, title, type Place } from '../../src/data/exercises';
import { motivation } from '../../src/data/motivation';
import { planById, type Day } from '../../src/data/plans';
import { cardioFor } from '../../src/data/cardio';
import { asDay, quickById } from '../../src/data/quick';
import { gate, quickFor, suggest } from '../../src/engine';
import { askPermission, hasPermission, reschedule } from '../../src/notify';
import { useStore, type Mood } from '../../src/store';
import { Rings } from '../../src/rings';
import { c, f, r } from '../../src/theme';
import { Avatar, Banner, Button, haptic, IconBox, ListRow, Rise, Row, Section, T, Tap, Thumb } from '../../src/ui';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MOODS: { v: Mood; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 1, label: 'Drained', icon: 'battery-dead' },
  { v: 2, label: 'Meh', icon: 'cloudy' },
  { v: 3, label: 'Good', icon: 'sunny' },
  { v: 4, label: 'Fired up', icon: 'flash' },
];
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
type Spot = Place | 'office';

export default function Today() {
  const st = useStore();
  const { profile, sessions, active, meals, checkins, start, checkIn, setupSkipped, addWater } = st;
  const ins = useSafeAreaInsets();
  const [showList, setShowList] = useState(false);
  const [spin, setSpin] = useState(0);
  const [place, setPlace] = useState<Spot>(profile.place === 'home' || profile.place === 'office' ? profile.place : 'gym');
  const [notifOff, setNotifOff] = useState(false);
  useEffect(() => { if (Platform.OS !== 'web') hasPermission().then((ok) => setNotifOff(!ok)); }, []);

  const today = dayKey();
  const mood = checkins[today];
  const sug = suggest(st);
  const plan = planById[st.planId] ?? planById['full-body-gym'];
  const streak = calcStreak(sessions);
  const t = targets(profile);
  const gentle = profile.gentle || profile.concerns?.includes('food');
  const todays = meals.filter((m) => m.day === today);
  const protein = todays.reduce((a, m) => a + m.protein, 0);
  const water = st.water[today] ?? 0;
  const trainedToday = sessions.some((s) => dayKey(s.startedAt) === today);
  const trained = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const done = doneToday(sessions);
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const desk = quickById.desk;
  const day = place === 'office' && desk ? asDay(desk) : sug.day;
  const where: Place = place === 'office' ? 'home' : place;
  const replaced = day.slots.filter((sl) => !available(byId[sl.id], where, profile.gear) || gate(byId[sl.id], profile, sessions.length).locked).length;
  const muscles = [...new Set(day.slots.map((sl) => byId[sl.id]?.primary[0]).filter(Boolean))].slice(0, 4).map(title).join(', ');
  const qs = quickFor(profile).slice(0, 6);
  const lastAt = sessions[sessions.length - 1]?.startedAt;
  const daysOff = lastAt ? Math.floor((Date.now() - lastAt) / 86400000) : 0;
  const quote = motivation(profile, daysOff, Math.floor(Date.now() / (3 * 3600000)) + spin);
  const label = place === 'office' ? 'At your desk' : { plan: 'Up next', light: 'Lighter today', rest: 'Recovery day', gentle: 'Gentle today' }[sug.kind];
  const setupNeeded = !profile.name && setupSkipped;
  const cyc = cycle(profile), pw = pregnancyWeek(profile), pp = postpartumWeek(profile);
  const nextPeriod = cyc ? new Date(Date.now() + (cyc.length - cyc.day + 1) * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  const inPeriod = !!st.periods.length && !st.periods[st.periods.length - 1].end && Date.now() - Date.parse(st.periods[st.periods.length - 1].start) < 10 * 86400000;

  const go = (d: Day, pl: Place, planId?: string, dayIndex?: number) => { start(d, pl, planId, dayIndex); router.push('/session'); };
  const startMain = () => (active ? router.push('/session') : place === 'office' && desk ? go(asDay(desk), 'home') : go(sug.day, where, sug.planId, sug.dayIndex));
  const ws = [...st.weights].sort((a, b) => a.day.localeCompare(b.day));
  const lw = ws[ws.length - 1];
  const ago = lw ? Math.round((Date.parse(today + 'T12:00:00') - Date.parse(lw.day + 'T12:00:00')) / 86400000) : 0;
  const mealsIn = new Set(todays.map((m) => m.slot ?? m.id)).size;
  const minutes = place === 'office' && desk ? desk.minutes : sug.minutes;
  const cardio = cardioFor(profile, sessions);
  // The daily loop: three things to close today. Training counts on rest days when the recovery session is done.
  const eat = gentle ? mealsIn / 3 : protein / t.protein;
  const drink = water / t.water;
  const closed = [trainedToday, eat >= 1, drink >= 1].filter(Boolean).length;
  const picks = [...cardio.picks.slice(0, 2).map((q) => ({ q, cardio: true })), ...qs.slice(0, 4).map((q) => ({ q, cardio: false }))];

  // Camera: the big header drifts up and fades as you scroll, a slim bar fades in, the hero moves a touch slower.
  const still = useReducedMotion(); // reduced motion: no drift or parallax, just the fade
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const bigHead = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 70], [1, 0], 'clamp'), transform: [{ translateY: still ? 0 : y.value * 0.35 }] }));
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [50, 90], [0, 1], 'clamp') }));
  const hero = useAnimatedStyle(() => (still ? {} : { transform: [{ translateY: interpolate(y.value, [-120, 0, 400], [30, 0, -24], 'clamp') }, { scale: interpolate(y.value, [-120, 0], [1.03, 1], 'clamp') }] }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: ins.top + 12, paddingHorizontal: 12, paddingBottom: ins.bottom + 120 }}>
        {/* 1. Who and the streak. */}
        <Animated.View style={bigHead}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="small">{greeting()}</T>
              <T v="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{profile.name || 'Ready to train'}</T>
            </View>
            <Row gap={8}>
              <Tap onPress={() => router.push('/history')} style={s.pill}>
                <Ionicons name="flame" size={18} color={streak ? c.warm : c.muted} />
                <Count v={streak} style={s.pillNum} />
              </Tap>
              <Avatar />
            </Row>
          </Row>
        </Animated.View>

        {/* 2. Today's loop: one ring, three things to close. */}
        <Rise i={1}>
          <View style={[s.card, s.loop]}>
            <Rings size={132} stroke={11} rings={[{ progress: trainedToday ? 1 : 0, color: c.accent }, { progress: eat, color: c.pink }, { progress: drink, color: c.blue }]}>
              <Text style={s.loopNum}>{closed}<Text style={s.loopOf}>/3</Text></Text>
            </Rings>
            <View style={{ flex: 1, gap: 12 }}>
              <Goal icon="barbell" color={c.accent} label="Train" done={trainedToday} value={trainedToday ? 'Done' : `${minutes} min`} onPress={startMain} />
              <Goal icon={gentle ? 'restaurant' : 'nutrition'} color={c.pink} label={gentle ? 'Meals' : 'Protein'} done={eat >= 1}
                value={gentle ? `${mealsIn}/3` : `${protein}/${t.protein} g`} onPress={() => router.push('/fuel')} />
              <Goal icon="water" color={c.blue} label="Water" done={drink >= 1} value={`${water}/${t.water}`} onPress={() => { addWater(1); haptic(); }} action="+1" />
            </View>
          </View>
          {/* This week at a glance: a dot per day, filled when you trained. Tap for the calendar. */}
          <Tap onPress={() => router.push('/history')} scale={0.99} feedback="none" style={s.week}>
            {WEEK.map((w, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i);
              const k = dayKey(d), did = trained.has(k), now = k === today;
              return (
                <View key={i} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                  <T v="label" color={now ? c.text : c.muted}>{w}</T>
                  <View style={[s.dot, did && { backgroundColor: c.accent, borderColor: c.accent }, now && !did && { borderColor: c.accent }]} />
                </View>
              );
            })}
          </Tap>
          <T v="small" style={{ marginTop: 8, textAlign: 'center' }}>
            {closed === 3 ? 'Day closed. Streak safe.' : 'Close all three to keep your streak'}
          </T>
        </Rise>

        {/* 3. The workout. One button. */}
        <Rise i={2}>
          <Animated.View style={[s.hero, hero, { borderColor: c.accent + '55' }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={[s.tag, { backgroundColor: c.accent + '22' }]}><T v="label" color={c.accent} numberOfLines={1}>{label}</T></View>
              <Row gap={4}>
                {MOODS.map((m) => {
                  const on = mood === m.v;
                  return (
                    <Tap key={m.v} onPress={() => checkIn(m.v)} scale={0.9} style={[s.moodDot, on && { backgroundColor: c.accent }]}>
                      <Ionicons name={m.icon} size={15} color={on ? c.accentInk : mood ? c.dim : c.muted} />
                    </Tap>
                  );
                })}
              </Row>
            </Row>
            <T v="h1" style={{ marginTop: 12 }} numberOfLines={2}>{day.name}</T>
            <Row gap={16} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Meta icon="time-outline" text={`${minutes} min`} />
              <Meta icon="barbell-outline" text={`${day.slots.length} moves`} />
              {!!muscles && <Meta icon="body-outline" text={muscles.split(', ').slice(0, 2).join(', ')} />}
            </Row>
            <Tap onPress={() => setShowList(!showList)} scale={0.99} feedback="none" style={{ marginTop: 16 }}>
              {showList ? (
                <Animated.View entering={FadeIn.duration(220)} style={{ gap: 8 }}>
                  {day.slots.map((sl, i) => (
                    <Tap key={sl.id + i} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.exRow} scale={0.99}>
                      <Thumb ex={byId[sl.id]} size={40} />
                      <T v="body" style={{ flex: 1 }} numberOfLines={1} color={done.has(sl.id) ? c.muted : c.text}>{byId[sl.id]?.name}</T>
                      {done.has(sl.id) ? <Ionicons name="checkmark-circle" size={20} color={c.ok} /> : <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>}
                    </Tap>
                  ))}
                </Animated.View>
              ) : (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={0}>
                    {day.slots.slice(0, 5).map((sl, i) => (
                      <View key={sl.id + i} style={[s.stack, { zIndex: 10 - i, marginLeft: i ? -10 : 0 }]}><Thumb ex={byId[sl.id]} size={40} /></View>
                    ))}
                  </Row>
                  <Ionicons name="chevron-down" size={18} color={c.muted} />
                </Row>
              )}
            </Tap>
            <Row style={{ marginTop: 16 }} gap={6}>
              {(['gym', 'home', 'office'] as const).map((k) => (
                <Tap key={k} onPress={() => setPlace(k)} scale={0.96} style={[s.seg, place === k && { backgroundColor: c.text }]}>
                  <Ionicons name={k === 'gym' ? 'barbell' : k === 'home' ? 'home' : 'briefcase'} size={14} color={place === k ? c.bg : c.muted} />
                  <T v="small" color={place === k ? c.bg : c.muted}>{k === 'gym' ? 'Gym' : k === 'home' ? 'Home' : 'Office'}</T>
                </Tap>
              ))}
            </Row>
            {replaced > 0 && place !== 'office' && (
              <Row gap={6} style={{ marginTop: 10 }}>
                <Ionicons name="swap-horizontal" size={14} color={c.warm} />
                <T v="small" color={c.warm}>{replaced} swapped for {place === 'home' ? 'home' : 'beginner'} versions</T>
              </Row>
            )}
            <Button title={active ? 'Resume workout' : trainedToday ? 'Train again' : 'Start workout'} icon="play" style={{ marginTop: 16 }} onPress={startMain} />
          </Animated.View>
        </Rise>

        {/* Only what needs a decision today, one line each. */}
        {(setupNeeded || notifOff || pw !== null || pp !== null || cyc) && (
          <Rise i={3} style={{ marginTop: 16, gap: 8 }}>
            {setupNeeded && <Banner icon="sparkles" title="Personalize your plan" action="1 min" onPress={() => router.push('/onboarding')} />}
            {notifOff && <Banner icon="notifications-off" color={c.warm} title="Reminders are off" action="Allow"
              onPress={async () => { if (await askPermission()) { setNotifOff(false); reschedule(); } }} />}
            {(pw !== null || pp !== null) && <Banner icon="heart" color={c.pink} title={pw !== null ? `Pregnancy · week ${pw} · plan adjusted` : `After birth · week ${pp} · plan adjusted`} />}
            {cyc && <Banner icon="water" color={c.pink} title={`Cycle day ${cyc.day} · ${{ period: 'Period', follicular: 'Energy rising', ovulation: 'Peak energy', luteal: 'Pre-period' }[cyc.phase]}`}
              action={inPeriod ? 'Period ended' : 'Period started'} onPress={() => st.logPeriod(inPeriod ? 'end' : 'start')} />}
          </Rise>
        )}

        {/* 4. Short extras: cardio from the ladder, then quick sessions. One swipeable row. */}
        <Rise i={4}>
          <Section title="Quick picks" action={`Cardio ${cardio.name}`} onAction={() => router.push({ pathname: '/exercises', params: { muscle: 'cardio' } })}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 24 }} style={{ marginHorizontal: -12, paddingLeft: 12 }}>
              {picks.map(({ q, cardio: isCardio }) => (
                <Tap key={q.id} onPress={() => (active ? router.push('/session') : go(asDay(q), q.where.includes('gym') ? 'gym' : 'home'))} style={s.quick} scale={0.97}>
                  <IconBox icon={q.icon} color={isCardio ? c.blue : c.accent} />
                  <View>
                    <T v="h3" numberOfLines={1}>{q.name}</T>
                    <T v="small" numberOfLines={1}>{q.minutes} min{isCardio ? ' · cardio' : ''}</T>
                  </View>
                </Tap>
              ))}
            </ScrollView>
          </Section>
        </Rise>

        {/* 5. Body weight in one line, so a weigh-in visibly lands. */}
        {!gentle && (
          <Rise i={5} style={{ marginTop: 32 }}>
            <ListRow icon="scale-outline" title={lw ? `${lw.kg.toFixed(1)} kg` : 'Log your weight'}
              sub={lw ? (ago === 0 ? 'Weighed today' : `Weighed ${ago} day${ago > 1 ? 's' : ''} ago`) : 'Once a week is enough'} onPress={() => router.push('/progress')} />
          </Rise>
        )}

        {/* A line to end on. Tap for another. */}
        <Rise i={6}>
          <Tap onPress={() => setSpin(spin + 1)} scale={0.99} feedback="none" style={s.quote}>
            <View style={[s.quoteBar, { backgroundColor: c.accent }]} />
            <Animated.View key={quote} entering={FadeIn.duration(350).easing(EASE)} style={{ flex: 1 }}>
              <T v="body" color={c.muted}>{quote}</T>
            </Animated.View>
          </Tap>
        </Rise>
      </Animated.ScrollView>

      {/* The slim bar that takes over once the big header has scrolled away. */}
      <Animated.View pointerEvents="none" style={[s.bar, { paddingTop: ins.top + 6 }, bar]}>
        <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{profile.name || 'Today'}</T>
        <Row gap={6}><Ionicons name="flame" size={16} color={streak ? c.warm : c.muted} /><T v="h3">{streak}</T></Row>
        <Text style={[s.barRing, { color: closed === 3 ? c.ok : c.text }]}>{closed}/3</Text>
      </Animated.View>
    </View>
  );
}

// One of today's three goals: icon, name, progress value, tap to act.
function Goal({ icon, color, label, value, done, onPress, action }: {
  icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; done: boolean; onPress: () => void; action?: string;
}) {
  return (
    <Tap onPress={onPress} scale={0.97} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? color : color + '22' }}>
        <Ionicons name={done ? 'checkmark' : icon} size={15} color={done ? c.accentInk : color} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="small">{label}</T>
        <T v="h3" numberOfLines={1}>{value}</T>
      </View>
      {action && !done && <View style={[s.plus, { borderColor: color + '66' }]}><T v="small" color={color}>{action}</T></View>}
    </Tap>
  );
}

// A number that counts up when it changes.
function Count({ v, style }: { v: number; style: object }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const from = n, t0 = Date.now();
    let raf = 0;
    const step = () => { const k = Math.min(1, (Date.now() - t0) / 600); setN(Math.round(from + (v - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <Text style={style}>{n}</Text>;
}

const Meta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
  <Row gap={6}><Ionicons name={icon} size={16} color={c.muted} /><T v="small" color={c.text}>{text}</T></Row>
);

const s = StyleSheet.create({
  card: { padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  loop: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18 },
  loopNum: { fontFamily: f.display, fontSize: 34, color: c.text },
  loopOf: { fontFamily: f.semi, fontSize: 15, color: c.muted },
  plus: { paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1, justifyContent: 'center' },
  hero: { marginTop: 20, padding: 20, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1 },
  tag: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', maxWidth: '55%' },
  moodDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stack: { borderRadius: 16, borderWidth: 2, borderColor: c.card, overflow: 'hidden' },
  seg: { flex: 1, height: 36, borderRadius: 18, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, height: 40, borderRadius: 20 },
  pillNum: { fontFamily: f.semi, fontSize: 17, color: c.text },
  quote: { marginTop: 32, flexDirection: 'row', gap: 12, paddingVertical: 2 },
  quoteBar: { width: 3, borderRadius: 2 },
  quick: { width: 176, gap: 12, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'rgba(10,10,11,0.94)', borderBottomWidth: 1, borderBottomColor: c.line },
  week: { flexDirection: 'row', marginTop: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.line },
  barRing: { fontFamily: f.semi, fontSize: 15 },
});
