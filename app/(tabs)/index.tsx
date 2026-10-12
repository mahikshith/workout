import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { cycle, dayKey, postpartumWeek, pregnancyWeek, streak as calcStreak, targets } from '../../src/calc';
import { greeting } from '../../src/coach';
import { available, byId, exercises, title, type Place } from '../../src/data/exercises';
import { challenge, level } from '../../src/data/badges';
import { motivation } from '../../src/data/motivation';
import { planById, type Day } from '../../src/data/plans';
import { asDay, quickById } from '../../src/data/quick';
import { gate, insights, quickFor, suggest } from '../../src/engine';
import { askPermission, hasPermission, reschedule } from '../../src/notify';
import { useStore, type Mood } from '../../src/store';
import { c, r } from '../../src/theme';
import { Button, Chip, Ring, Rise, Row, Screen, T, Tap, Thumb } from '../../src/ui';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MOODS: { v: Mood; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 1, label: 'Drained', icon: 'battery-dead' },
  { v: 2, label: 'Meh', icon: 'cloudy' },
  { v: 3, label: 'Good', icon: 'sunny' },
  { v: 4, label: 'Fired up', icon: 'flash' },
];
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const HYPE = ['Unleash the beast inside you.', 'Ready for a quick warm-up?', 'Today is a good day to get stronger.', 'One session closer to your goal.'];
type Spot = Place | 'office';
const WHERE: Record<string, string> = { office: 'Desk', home: 'Home', gym: 'Gym', anywhere: 'Anywhere' };

export default function Today() {
  const st = useStore();
  const { profile, sessions, active, meals, checkins, start, checkIn, dismiss, setupSkipped } = st;
  const [editMood, setEditMood] = useState(false);
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
  const label = place === 'office' ? 'At your desk' : { plan: `Up next · ${plan.name}`, light: 'Lighter today', rest: 'Recovery', gentle: 'Gentle today' }[sug.kind];
  const cyc = cycle(profile), pw = pregnancyWeek(profile), pp = postpartumWeek(profile);
  const nextPeriod = cyc ? new Date(Date.now() + (cyc.length - cyc.day + 1) * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  const inPeriod = !!st.periods.length && !st.periods[st.periods.length - 1].end && Date.now() - Date.parse(st.periods[st.periods.length - 1].start) < 10 * 86400000;

  const go = (d: Day, pl: Place, planId?: string, dayIndex?: number) => { start(d, pl, planId, dayIndex); router.push('/session'); };
  const startMain = () => (active ? router.push('/session') : place === 'office' && desk ? go(asDay(desk), 'home') : go(sug.day, where, sug.planId, sug.dayIndex));

  return (
    <Screen>
      <Rise>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h1" numberOfLines={2}>{greeting()}{profile.name ? `, ${profile.name}` : ''}</T>
            {!trainedToday && <T v="h3" color={c.accent}>{HYPE[(new Date().getDate() + spin) % HYPE.length]}</T>}
          </View>
          <Row gap={8}>
            <Tap onPress={() => router.push('/history')} style={s.pill}>
              <Ionicons name="flame" size={18} color={c.warm} />
              <T v="h3">{streak}</T>
            </Tap>
            <Tap onPress={() => router.push('/you')} style={[s.avatar, { backgroundColor: c.accent }]}>
              {profile.name ? <T v="h3" color={c.accentInk}>{profile.name[0].toUpperCase()}</T> : <Ionicons name="person" size={18} color={c.accentInk} />}
            </Tap>
          </Row>
        </Row>
        {/* Your week at a glance: a filled day means you trained; the dots show water and food goals met. Tap for history. */}
        <Tap onPress={() => router.push('/history')} scale={0.99} feedback="none">
          <Row style={{ justifyContent: 'space-between', marginTop: 16 }} gap={6}>
            {WEEK.map((w, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i);
              const k = dayKey(d), did = trained.has(k), now = k === today;
              const dayMeals = meals.filter((m) => m.day === k);
              const ate = gentle ? dayMeals.length >= 3 : dayMeals.reduce((a, m) => a + m.protein, 0) >= t.protein * 0.9;
              const drank = (st.water[k] ?? 0) >= t.water;
              return (
                <View key={i} style={[s.wd, now && { borderWidth: 1.5, borderColor: c.text }, did && { backgroundColor: c.accent }]}>
                  <T v="label" color={did ? c.accentInk : now ? c.text : c.muted}>{w}</T>
                  <T v="h3" color={did ? c.accentInk : c.text}>{d.getDate()}</T>
                  <Row gap={3}>
                    <View style={[s.dot, { backgroundColor: drank ? c.blue : did ? 'rgba(0,0,0,0.2)' : c.line }]} />
                    <View style={[s.dot, { backgroundColor: ate ? c.pink : did ? 'rgba(0,0,0,0.2)' : c.line }]} />
                  </Row>
                </View>
              );
            })}
          </Row>
          <Row style={{ marginTop: 8, justifyContent: 'center' }} gap={12}>
            <Row gap={4}><View style={[s.dot, { backgroundColor: c.accent }]} /><T v="small">Trained</T></Row>
            <Row gap={4}><View style={[s.dot, { backgroundColor: c.blue }]} /><T v="small">Water goal</T></Row>
            <Row gap={4}><View style={[s.dot, { backgroundColor: c.pink }]} /><T v="small">{gentle ? '3 meals' : 'Protein goal'}</T></Row>
          </Row>
        </Tap>
      </Rise>

      {!profile.name && setupSkipped && (
        <Rise i={1}>
          <Tap onPress={() => router.push('/onboarding')} style={[s.card, s.row, { marginTop: 16, borderColor: c.accent }]} scale={0.98}>
            <View style={[s.icon, { backgroundColor: c.accent }]}><Ionicons name="sparkles" size={18} color={c.accentInk} /></View>
            <View style={{ flex: 1 }}>
              <T v="h3">Personalize your plan</T>
              <T v="small">One minute. Your workouts, food targets and reminders are built from it.</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Tap>
        </Rise>
      )}

      {notifOff && (
        <Rise i={1}>
          <View style={[s.card, s.row, { marginTop: 12 }]}>
            <View style={[s.icon, { backgroundColor: c.warm + '22' }]}><Ionicons name="notifications-off" size={18} color={c.warm} /></View>
            <View style={{ flex: 1 }}>
              <T v="h3">Reminders are off</T>
              <T v="small">Water, workout and motivation nudges need notifications.</T>
            </View>
            <Button title="Allow" style={{ height: 40, paddingHorizontal: 16 }}
              onPress={async () => { if (await askPermission()) { setNotifOff(false); reschedule(); } }} />
          </View>
        </Rise>
      )}

      {(pw !== null || pp !== null) && (
        <Rise i={1}>
          <View style={[s.card, s.row, { marginTop: 12 }]}>
            <View style={[s.icon, { backgroundColor: c.pink + '22' }]}><Ionicons name="heart" size={18} color={c.pink} /></View>
            <View style={{ flex: 1 }}>
              <T v="h3">{pw !== null ? `Plan calibrated for pregnancy, week ${pw}` : `Plan calibrated for after birth, week ${pp}`}</T>
              <T v="small">Moves that aren't right for you now are hidden or replaced. Follow your doctor where their advice differs.</T>
            </View>
          </View>
        </Rise>
      )}

      {cyc && (
        <Rise i={1}>
          <View style={[s.card, { marginTop: 12, gap: 10 }]}>
            <Row>
              <View style={[s.icon, { backgroundColor: c.pink + '22' }]}><Ionicons name="water" size={18} color={c.pink} /></View>
              <View style={{ flex: 1 }}>
                <T v="h3">Cycle day {cyc.day} · {{ period: 'Period', follicular: 'Building energy', ovulation: 'Peak energy', luteal: 'Before your period' }[cyc.phase]}</T>
                <T v="small">Next period around {nextPeriod}. Today's suggestion takes this into account.</T>
              </View>
            </Row>
            <Button title={inPeriod ? 'My period ended' : 'My period started today'} kind="ghost" style={{ height: 44 }}
              onPress={() => st.logPeriod(inPeriod ? 'end' : 'start')} />
          </View>
        </Rise>
      )}

      <Rise i={2}>
        <Tap onPress={() => setSpin(spin + 1)} scale={0.99} feedback="none" style={s.quote}>
          <View style={[s.quoteBar, { backgroundColor: c.accent }]} />
          <Animated.View key={quote} entering={FadeIn.duration(350).easing(EASE)} style={{ flex: 1 }}>
            <T v="h2">{quote}</T>
          </Animated.View>
        </Tap>
      </Rise>

      <Rise i={3}>
        {mood && !editMood ? (
          <Tap onPress={() => setEditMood(true)} style={[s.card, s.row, { marginTop: 16 }]} scale={0.98}>
            <Ionicons name={MOODS[mood - 1].icon} size={18} color={c.accent} />
            <T v="body" style={{ flex: 1 }}>Feeling {MOODS[mood - 1].label.toLowerCase()} today</T>
            <T v="small">Change</T>
          </Tap>
        ) : (
          <Animated.View entering={FadeIn.duration(250).easing(EASE)} style={[s.card, { marginTop: 16 }]}>
            <T v="h3">How are you feeling?</T>
            <T v="small" style={{ marginTop: 2 }}>Today's suggestion adapts to your answer.</T>
            <Row style={{ marginTop: 14 }} gap={8}>
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
          </Animated.View>
        )}
      </Rise>

      <Rise i={4}>
        <Tap onPress={() => router.push('/fuel')} scale={0.98} style={[s.card, { marginTop: 12 }]}>
          <Row style={{ justifyContent: 'space-around' }}>
            <RingStat progress={trainedToday ? 1 : 0} color={c.accent} icon="barbell" value={trainedToday ? 'Done' : 'To do'} label="Workout" />
            {gentle ? (
              <RingStat progress={new Set(todays.map((m) => m.slot ?? m.id)).size / 4} color={c.pink} icon="restaurant" value={`${new Set(todays.map((m) => m.slot ?? m.id)).size} of 4`} label="Meals" />
            ) : (
              <RingStat progress={protein / t.protein} color={c.pink} icon="nutrition" value={`${protein}/${t.protein}g`} label="Protein" />
            )}
            <RingStat progress={water / t.water} color={c.blue} icon="water" value={`${water}/${t.water}`} label="Water" />
          </Row>
        </Tap>
      </Rise>

      <Rise i={4}>
        {(() => {
          const ch = challenge(st), lv = level(st);
          return (
            <Tap onPress={() => router.push('/progress')} scale={0.98} style={[s.card, { marginTop: 12, gap: 10 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="h3">{ch.done ? 'Weekly challenge complete' : 'This week’s challenge'}</T>
                <T v="small" color={c.accent}>Level {lv.lvl} · {lv.name}</T>
              </Row>
              {ch.goals.map((g) => (
                <View key={g.label} style={{ gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="small" color={c.text}>{g.label}</T>
                    <T v="small">{Math.min(g.have, g.need)}/{g.need}</T>
                  </Row>
                  <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (g.have / g.need) * 100)}%`, backgroundColor: c.accent }]} /></View>
                </View>
              ))}
              <View style={s.track}><View style={[s.fill, { width: `${(lv.into / lv.need) * 100}%`, backgroundColor: c.warm }]} /></View>
              <T v="small">{lv.need - lv.into} XP to level {lv.lvl + 1}. Every workout is 10 XP, every set 1.</T>
            </Tap>
          );
        })()}
      </Rise>

      <Rise i={5}>
        <View style={[s.card, { marginTop: 12, padding: 20 }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label" color={c.accent} numberOfLines={1} style={{ flex: 1 }}>{label}</T>
            {place !== 'office' && (
              <Tap onPress={() => router.push({ pathname: '/plan/[id]', params: { id: sug.planId ?? plan.id } })}><T v="small" color={c.accent}>About this plan</T></Tap>
            )}
          </Row>
          <T v="h1" style={{ marginTop: 6 }}>{day.name}</T>
          <T v="body" color={c.muted}>Trains {muscles || 'your whole body'}. About {place === 'office' && desk ? desk.minutes : sug.minutes} min.</T>
          {place !== 'office' && (
            <Row style={{ marginTop: 10, alignItems: 'flex-start' }} gap={8}>
              <Ionicons name="sparkles" size={16} color={c.accent} style={{ marginTop: 3 }} />
              <T v="body" style={{ flex: 1 }}>{sug.reason}</T>
            </Row>
          )}
          <View style={{ marginTop: 14, gap: 8 }}>
            {day.slots.map((sl, i) => (
              <Tap key={sl.id + i} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: sl.id } })} style={s.row} scale={0.99}>
                <Thumb ex={byId[sl.id]} size={40} />
                <T v="body" style={{ flex: 1 }} numberOfLines={1}>{byId[sl.id]?.name}</T>
                <T v="small" color={c.text}>{sl.sets} × {sl.reps}</T>
              </Tap>
            ))}
          </View>
          <Row style={{ marginTop: 16 }} gap={8}>
            <Chip label="Gym" icon="barbell" on={place === 'gym'} onPress={() => setPlace('gym')} />
            <Chip label="Home" icon="home" on={place === 'home'} onPress={() => setPlace('home')} />
            <Chip label="Office" icon="briefcase" on={place === 'office'} onPress={() => setPlace('office')} />
          </Row>
          {replaced > 0 && place !== 'office' && (
            <T v="small" color={c.warm} style={{ marginTop: 10 }}>
              {replaced} exercise{replaced > 1 ? 's' : ''} will use {place === 'home' ? 'home-friendly' : 'beginner-friendly'} alternatives.
            </T>
          )}
          <Button title={active ? 'Resume your workout' : 'Start'} style={{ marginTop: 16 }} onPress={startMain} />
        </View>
      </Rise>

      {tip && (
        <Rise i={6}>
          <View style={[s.card, { marginTop: 12 }]}>
            <Row style={{ alignItems: 'flex-start' }} gap={12}>
              <View style={[s.icon, { backgroundColor: c.accent + '22' }]}><Ionicons name={tip.icon} size={18} color={c.accent} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">{tip.title}</T>
                <T v="body" color={c.muted}>{tip.body}</T>
              </View>
            </Row>
            <Tap onPress={() => dismiss(tip.id)} style={s.gotIt}><T v="small" color={c.text}>Got it</T></Tap>
          </View>
        </Rise>
      )}

      <Rise i={7}>
        <T v="h3" style={{ marginTop: 26, marginBottom: 12 }}>Quick sessions</T>
        <View style={s.grid}>
          {qs.map((q) => (
            <Tap key={q.id} onPress={() => (active ? router.push('/session') : go(asDay(q), q.where.includes('gym') ? 'gym' : 'home'))} style={s.block} scale={0.97}>
              <View style={[s.icon, { backgroundColor: c.accent + '22' }]}><Ionicons name={q.icon} size={18} color={c.accent} /></View>
              <T v="h3" style={{ marginTop: 10 }} numberOfLines={1}>{q.name}</T>
              <T v="small" numberOfLines={1}>{q.minutes} min · {WHERE[q.where[0]] ?? 'Anywhere'}</T>
            </Tap>
          ))}
        </View>
      </Rise>

      <Rise i={8}>
        <Row style={{ marginTop: 26, marginBottom: 12, justifyContent: 'space-between' }}>
          <T v="h3">No equipment needed</T>
          <Tap onPress={() => router.push({ pathname: '/exercises', params: { equip: 'none' } })}><T v="small" color={c.accent}>See all</T></Tap>
        </Row>
        <View style={s.grid}>
          {anywhere.map((e) => (
            <Tap key={e.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })} style={[s.block, { padding: 0, overflow: 'hidden' }]} scale={0.97}>
              <View style={{ alignItems: 'center', backgroundColor: c.card2 }}><Thumb ex={e} size={110} /></View>
              <View style={{ padding: 10 }}>
                <T v="h3" numberOfLines={1}>{e.name}</T>
                <T v="small">Bodyweight</T>
              </View>
            </Tap>
          ))}
        </View>
      </Rise>
    </Screen>
  );
}

function RingStat({ progress, color, icon, value, label }: { progress: number; color: string; icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Ring size={72} stroke={7} progress={progress} color={color}>
        <Ionicons name={icon} size={20} color={color} />
      </Ring>
      <T v="h3" numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T v="label">{label}</T>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card2, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.line },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  wd: { flex: 1, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.card },
  quote: { marginTop: 18, flexDirection: 'row', gap: 14, paddingVertical: 4 },
  quoteBar: { width: 3, borderRadius: 2 },
  mood: { flex: 1, height: 68, borderRadius: r.md, backgroundColor: c.card2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gotIt: { alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: c.card2, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  block: { width: '48%', flexGrow: 1, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
});
