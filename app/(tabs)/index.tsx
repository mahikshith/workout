import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { cycle, dayKey, doneToday, postpartumWeek, pregnancyWeek, streak as calcStreak, targets } from '../../src/calc';
import { greeting } from '../../src/coach';
import { available, byId, exercises, title, type Place } from '../../src/data/exercises';
import { challenge, level } from '../../src/data/badges';
import { motivation } from '../../src/data/motivation';
import { planById, type Day } from '../../src/data/plans';
import { cardioFor } from '../../src/data/cardio';
import { asDay, quickById } from '../../src/data/quick';
import { gate, insights, quickFor, suggest } from '../../src/engine';
import { askPermission, hasPermission, reschedule } from '../../src/notify';
import { useStore, type Mood } from '../../src/store';
import { c, r } from '../../src/theme';
import { Avatar, Banner, Button, Fold, IconBox, Rise, Row, Screen, Section, T, Tap, Thumb, Tile } from '../../src/ui';

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
  const { profile, sessions, active, meals, checkins, start, checkIn, dismiss, setupSkipped } = st;
  const [editMood, setEditMood] = useState(false);
  const [showList, setShowList] = useState(false);
  const [spin, setSpin] = useState(0);
  const [place, setPlace] = useState<Spot>(profile.place === 'home' || profile.place === 'office' ? profile.place : 'gym');
  const [notifOff, setNotifOff] = useState(false);
  useEffect(() => { if (Platform.OS !== 'web') hasPermission().then((ok) => setNotifOff(!ok)); }, []);

  const today = dayKey();
  const mood = checkins[today];
  const sug = suggest(st);
  const tip = insights(st)[0];
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
  const anywhere = exercises.filter((e) => e.art && e.equipment === 'body only' && e.level === 'beginner' && e.category === 'strength').slice(0, 4);
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
  const ch = challenge(st), lv = level(st);
  const minutes = place === 'office' && desk ? desk.minutes : sug.minutes;
  const cardio = cardioFor(profile, sessions);

  return (
    <Screen>
      {/* Header: who and when on the left, streak and profile on the right (the first two stops of a Z read). */}
      <Rise>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small">{greeting()}</T>
            <T v="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{profile.name || 'Ready to train'}</T>
          </View>
          <Row gap={8}>
            <Tap onPress={() => router.push('/history')} style={s.pill}>
              <Ionicons name="flame" size={18} color={c.warm} />
              <T v="h3">{streak}</T>
            </Tap>
            <Avatar />
          </Row>
        </Row>
        <Tap onPress={() => router.push('/history')} scale={0.99} feedback="none">
          <Row style={{ justifyContent: 'space-between', marginTop: 20 }} gap={6}>
            {WEEK.map((w, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i);
              const k = dayKey(d), did = trained.has(k), now = k === today;
              return (
                <View key={i} style={[s.wd, now && { borderWidth: 1.5, borderColor: c.accent }, did && { backgroundColor: c.accent }]}>
                  <T v="label" color={did ? c.accentInk : now ? c.text : c.muted}>{w}</T>
                  {did ? <Ionicons name="checkmark" size={18} color={c.accentInk} /> : <T v="h3" color={now ? c.text : c.muted}>{d.getDate()}</T>}
                </View>
              );
            })}
          </Row>
        </Tap>
      </Rise>

      {/* Only what needs a decision today, one line each. */}
      {(setupNeeded || notifOff || pw !== null || pp !== null || cyc) && (
        <Rise i={1} style={{ marginTop: 20, gap: 8 }}>
          {setupNeeded && <Banner icon="sparkles" title="Personalize your plan" action="1 min" onPress={() => router.push('/onboarding')} />}
          {notifOff && <Banner icon="notifications-off" color={c.warm} title="Reminders are off" action="Allow"
            onPress={async () => { if (await askPermission()) { setNotifOff(false); reschedule(); } }} />}
          {(pw !== null || pp !== null) && <Banner icon="heart" color={c.pink} title={pw !== null ? `Pregnancy · week ${pw} · plan adjusted` : `After birth · week ${pp} · plan adjusted`} />}
          {cyc && <Banner icon="water" color={c.pink} title={`Cycle day ${cyc.day} · ${{ period: 'Period', follicular: 'Energy rising', ovulation: 'Peak energy', luteal: 'Pre-period' }[cyc.phase]}`}
            action={inPeriod ? 'Period ended' : 'Period started'} onPress={() => st.logPeriod(inPeriod ? 'end' : 'start')} />}
        </Rise>
      )}

      {/* Mood, once a day: four icons, one word each. */}
      {(!mood || editMood) && (
        <Rise i={2} style={{ marginTop: 20 }}>
          <T v="h3" style={{ marginBottom: 10 }}>How do you feel?</T>
          <Row gap={8}>
            {MOODS.map((m) => {
              const on = mood === m.v;
              return (
                <Tap key={m.v} onPress={() => { checkIn(m.v); setEditMood(false); }} style={[s.mood, on && { backgroundColor: c.accent, borderColor: c.accent }]} scale={0.95}>
                  <Ionicons name={m.icon} size={22} color={on ? c.accentInk : c.text} />
                  <T v="small" color={on ? c.accentInk : c.text} numberOfLines={1}>{m.label}</T>
                </Tap>
              );
            })}
          </Row>
        </Rise>
      )}

      {/* Hero: today's workout. The one thing this screen is for. */}
      <Rise i={3}>
        <View style={[s.hero, { borderColor: c.accent + '55' }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={[s.tag, { backgroundColor: c.accent + '22' }]}><T v="label" color={c.accent} numberOfLines={1}>{label}</T></View>
            {mood && !editMood && (
              <Tap onPress={() => setEditMood(true)} style={s.moodChip} scale={0.95}>
                <Ionicons name={MOODS[mood - 1].icon} size={16} color={c.text} />
                <T v="small" color={c.text}>{MOODS[mood - 1].label}</T>
              </Tap>
            )}
          </Row>
          <T v="h1" style={{ marginTop: 12 }} numberOfLines={2}>{day.name}</T>
          <Row gap={16} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <Meta icon="time-outline" text={`${minutes} min`} />
            <Meta icon="barbell-outline" text={`${day.slots.length} exercises`} />
            {!!muscles && <Meta icon="body-outline" text={muscles.split(', ').slice(0, 2).join(', ')} />}
          </Row>

          <Tap onPress={() => setShowList(!showList)} scale={0.99} feedback="none" style={{ marginTop: 16 }}>
            {showList ? (
              <View style={{ gap: 8 }}>
                {day.slots.map((sl, i) => (
                  <Tap key={sl.id + i} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.exRow} scale={0.99}>
                    <Thumb ex={byId[sl.id]} size={40} />
                    <T v="body" style={{ flex: 1 }} numberOfLines={1} color={done.has(sl.id) ? c.muted : c.text}>{byId[sl.id]?.name}</T>
                    {done.has(sl.id) ? <Ionicons name="checkmark-circle" size={20} color={c.ok} /> : <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>}
                  </Tap>
                ))}
                <Row gap={4} style={{ alignSelf: 'center', marginTop: 4 }}><T v="small">Hide</T><Ionicons name="chevron-up" size={14} color={c.muted} /></Row>
              </View>
            ) : (
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={0}>
                  {day.slots.slice(0, 5).map((sl, i) => (
                    <View key={sl.id + i} style={[s.stack, { zIndex: 10 - i, marginLeft: i ? -10 : 0 }]}><Thumb ex={byId[sl.id]} size={40} /></View>
                  ))}
                </Row>
                <Row gap={4}><T v="small" color={c.text}>See all</T><Ionicons name="chevron-down" size={14} color={c.text} /></Row>
              </Row>
            )}
          </Tap>

          <Row style={{ marginTop: 16 }} gap={8}>
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
          <Button title={active ? 'Resume workout' : 'Start workout'} icon="play" style={{ marginTop: 16 }} onPress={startMain} />
          {place !== 'office' && (
            <Tap onPress={() => router.push({ pathname: '/plan/[id]', params: { id: sug.planId ?? plan.id } })} style={{ alignSelf: 'center', marginTop: 12, paddingVertical: 4 }}>
              <T v="small">{plan.name} ›</T>
            </Tap>
          )}
        </View>
      </Rise>

      {/* Today at a glance: four tiles, numbers only. */}
      <Rise i={4}>
        <Section title="Today" action="Fuel" onAction={() => router.push('/fuel')}>
          <Row gap={12}>
            <Tile icon="barbell" value={trainedToday ? 'Done' : 'To do'} label="Workout" progress={trainedToday ? 1 : 0} />
            {gentle
              ? <Tile icon="restaurant" color={c.pink} value={`${mealsIn}/4`} label="Meals" progress={mealsIn / 4} onPress={() => router.push('/fuel')} />
              : <Tile icon="nutrition" color={c.pink} value={`${protein}`} unit={`/ ${t.protein} g`} label="Protein" progress={protein / t.protein} onPress={() => router.push('/fuel')} />}
          </Row>
          <Row gap={12} style={{ marginTop: 12 }}>
            <Tile icon="water" color={c.blue} value={`${water}`} unit={`/ ${t.water}`} label="Glasses of water" progress={water / t.water} onPress={() => router.push('/fuel')} />
            {gentle
              ? <Tile icon="flame" color={c.warm} value={streak} label="Streak" onPress={() => router.push('/history')} />
              : <Tile icon="scale-outline" color={c.text} value={lw ? lw.kg.toFixed(1) : '-'} unit={lw ? 'kg' : undefined}
                  label={!lw ? 'Log weight' : ago === 0 ? 'Weighed today' : `${ago}d ago`} onPress={() => router.push('/progress')} />}
          </Row>
        </Section>
      </Rise>

      {/* Cardio: picked by the engine from the Base > Build > Push > Peak ladder. */}
      <Rise i={5}>
        <Section title="Cardio" action={`${cardio.name} · ${cardio.stage}/4`} onAction={() => router.push({ pathname: '/exercises', params: { muscle: 'cardio' } })}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }} style={{ marginHorizontal: -12, paddingLeft: 12 }}>
            {cardio.picks.map((q) => (
              <Tap key={q.id} onPress={() => (active ? router.push('/session') : go(asDay(q), q.at === 'gym' ? 'gym' : 'home'))} style={s.quick} scale={0.97}>
                <IconBox icon={q.icon} color={c.blue} />
                <View>
                  <T v="h3" numberOfLines={1}>{q.name}</T>
                  <T v="small" numberOfLines={1}>{q.minutes} min · {q.impact === 'low' ? 'Low impact' : 'High impact'}</T>
                </View>
              </Tap>
            ))}
            {cardio.next && (
              <View style={[s.quick, { opacity: 0.6 }]}>
                <IconBox icon="lock-closed" color={c.muted} />
                <View>
                  <T v="h3" numberOfLines={1}>{cardio.next.name}</T>
                  <T v="small" numberOfLines={1}>Opens in {cardio.toNext} sessions</T>
                </View>
              </View>
            )}
          </ScrollView>
        </Section>
      </Rise>

      {/* This week: three goals as bars, level underneath. */}
      <Rise i={5}>
        <Section title="This week" action={`Level ${lv.lvl}`} onAction={() => router.push('/progress')}>
          <Tap onPress={() => router.push('/progress')} scale={0.99} style={[s.card, { gap: 14 }]}>
            {ch.goals.map((g, i) => (
              <Row key={g.label} gap={12}>
                <IconBox icon={(['barbell', 'water', 'restaurant'] as const)[i] ?? 'checkmark'} color={g.have >= g.need ? c.ok : c.accent} size={32} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="body" color={c.text} numberOfLines={1}>{g.label}</T>
                    <T v="small" color={g.have >= g.need ? c.ok : c.text}>{Math.min(g.have, g.need)}/{g.need}</T>
                  </Row>
                  <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (g.have / g.need) * 100)}%`, backgroundColor: g.have >= g.need ? c.ok : c.accent }]} /></View>
                </View>
              </Row>
            ))}
          </Tap>
        </Section>
      </Rise>

      {tip && (
        <Rise i={6} style={{ marginTop: 32 }}>
          <Fold title={tip.title} icon={tip.icon}>
            <T v="body" color={c.muted}>{tip.body}</T>
            <Tap onPress={() => dismiss(tip.id)} style={s.gotIt}><T v="small" color={c.text}>Got it</T></Tap>
          </Fold>
        </Rise>
      )}

      <Rise i={7}>
        <Section title="Quick sessions">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }} style={{ marginHorizontal: -12, paddingLeft: 12 }}>
            {qs.map((q) => (
              <Tap key={q.id} onPress={() => (active ? router.push('/session') : go(asDay(q), q.where.includes('gym') ? 'gym' : 'home'))} style={s.quick} scale={0.97}>
                <IconBox icon={q.icon} />
                <View>
                  <T v="h3" numberOfLines={1}>{q.name}</T>
                  <T v="small" numberOfLines={1}>{q.minutes} min</T>
                </View>
              </Tap>
            ))}
          </ScrollView>
        </Section>
      </Rise>

      <Rise i={8}>
        <Section title="No equipment" action="See all" onAction={() => router.push({ pathname: '/exercises', params: { equip: 'none' } })}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }} style={{ marginHorizontal: -12, paddingLeft: 12 }}>
            {anywhere.map((e) => (
              <Tap key={e.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })} style={s.media} scale={0.97}>
                <View style={{ alignItems: 'center', backgroundColor: c.card2 }}><Thumb ex={e} size={128} /></View>
                <T v="h3" numberOfLines={1} style={{ padding: 10 }}>{e.name}</T>
              </Tap>
            ))}
          </ScrollView>
        </Section>
      </Rise>

      {/* A line to end on. Tap for another. */}
      <Rise i={9}>
        <Tap onPress={() => setSpin(spin + 1)} scale={0.99} feedback="none" style={s.quote}>
          <View style={[s.quoteBar, { backgroundColor: c.accent }]} />
          <Animated.View key={quote} entering={FadeIn.duration(350).easing(EASE)} style={{ flex: 1 }}>
            <T v="body" color={c.muted}>{quote}</T>
          </Animated.View>
        </Tap>
      </Rise>
    </Screen>
  );
}

const Meta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
  <Row gap={6}><Ionicons name={icon} size={16} color={c.muted} /><T v="small" color={c.text}>{text}</T></Row>
);

const s = StyleSheet.create({
  card: { padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  hero: { marginTop: 20, padding: 20, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1 },
  tag: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', maxWidth: '70%' },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: c.card2 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stack: { borderRadius: 16, borderWidth: 2, borderColor: c.card, overflow: 'hidden' },
  seg: { flex: 1, height: 36, borderRadius: 18, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card2, paddingHorizontal: 14, height: 40, borderRadius: 20 },
  track: { height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  wd: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.card },
  quote: { marginTop: 32, flexDirection: 'row', gap: 12, paddingVertical: 2 },
  quoteBar: { width: 3, borderRadius: 2 },
  mood: { flex: 1, height: 68, borderRadius: r.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  gotIt: { alignSelf: 'flex-start', paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: c.card2, justifyContent: 'center' },
  quick: { width: 176, gap: 12, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  media: { width: 150, borderRadius: r.lg, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
});
