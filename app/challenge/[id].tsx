import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  challengeById, challenges, cheer, LEVELS, recommend, summary, taskIcon, taskTitle, taskDomain, type Challenge, type DayInfo, type Task,
} from '../../src/data/challenges';
import { Ambient, GlassBar } from '../../src/glass';
import { Empty, Header, toToday, useMiniBarSpace } from '../../src/kit';
import { Sheet } from '../../src/sheet';
import {
  DayGrid, DaySheet, extraPills, goalColor, MilestoneSheet, Pill, Stars, TodayTasks, useCtx, useRun, useTaskActions,
} from '../../src/challenges/use';
import { SafetyNote } from '../../src/safety';
import { useStore } from '../../src/store';
import { c, dom, r, tint } from '../../src/theme';
import { Banner, Button, haptic, IconBox, Ring, Row, Screen, Section, T, Tap } from '../../src/ui';
import { Enter } from '../library';

// One challenge: what it is and asks (hero, what you'll do, the days, the rules) and Join; once joined, where you
// stand (ring, streak, stars), today's task with its one button, and the day grid. Leave: "Need a break?" row and ⋯.

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ch = challengeById[String(id)];
  const ins = useSafeAreaInsets();
  const mini = useMiniBarSpace();
  const { ch: mine, prog: runProg } = useRun();
  const past = useStore((s) => s.pastChallenges);
  const { act, sheet } = useTaskActions();
  const [menu, setMenu] = useState<'menu' | 'leave' | null>(null);
  const [switching, setSwitching] = useState(false);
  const [day, setDay] = useState<DayInfo | null>(null);
  const [won, setWon] = useState<Challenge | null>(null);

  if (!ch) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Challenge" /><Empty icon="trophy-outline" title="This challenge is no longer here" action="Back to Today" onPress={toToday} /></View>;

  const col = goalColor(ch);
  const prog = mine?.id === ch.id ? runProg : null;
  const other = mine && mine.id !== ch.id ? { ch: mine, prog: runProg } : null;
  const win = [...past].reverse().find((x) => x.id === ch.id && x.completed);

  const join = () => {
    if (other && !switching) { setSwitching(true); return; }
    setSwitching(false);
    haptic('success');
    useStore.getState().joinChallenge(ch.id);
  };
  const collect = () => {
    if (!prog) return;
    haptic('success');
    useStore.getState().leaveChallenge(prog.completed);
    if (prog.completed) setWon(ch);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient colors={[c.accent, dom.streak, dom.train]} />
      <Header title={ch.name} actionIcon={prog ? 'ellipsis-horizontal' : undefined} onAction={prog ? () => setMenu('menu') : undefined} />
      <Screen top={4} bottom={prog ? 0 : 130}>
        {/* Hero: where you stand, the finish, or what this is. */}
        <Enter>
          <View style={[s.hero, { borderColor: tint(col, 1.6) }]}>
            <LinearGradient colors={[tint(col, 1.5), c.card]} locations={[0, 0.75]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            {prog && prog.over ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Animated.View entering={ZoomIn.springify().damping(12)} style={[s.medal, { backgroundColor: tint(prog.completed ? dom.streak : col, 1.6) }]}>
                  <Ionicons name={prog.completed ? 'trophy' : 'flag'} size={44} color={prog.completed ? dom.streak : col} />
                </Animated.View>
                <T v="label" color={prog.completed ? dom.streak : col}>{prog.completed ? 'Badge unlocked' : 'Challenge over'}</T>
                <T v="h1" style={{ textAlign: 'center' }}>{prog.completed ? ch.badge : `${prog.done} of ${prog.required} ${ch.weekly ? 'workouts' : 'days'}`}</T>
                <T v="body" color={c.soft} style={{ textAlign: 'center' }}>
                  {prog.completed ? `All ${ch.days} days, done. That’s a habit now.` : 'Every one of those counted. Go again and beat it.'}
                </T>
                <Stars prog={prog} size={22} />
                <Button title={prog.completed ? 'Collect your badge' : 'Finish challenge'} icon={prog.completed ? 'trophy' : 'checkmark'} onPress={collect} style={{ alignSelf: 'stretch', marginTop: 6 }} />
                {!prog.completed && (
                  <Tap onPress={() => { useStore.getState().leaveChallenge(false); useStore.getState().joinChallenge(ch.id); }} style={s.link} feedback="none">
                    <T v="small" color={c.text}>Go again from today</T>
                  </Tap>
                )}
              </View>
            ) : prog ? (
              <>
                <Row gap={16}>
                  <Ring size={104} stroke={10} progress={prog.pct} color={col}>
                    <T v="small" style={{ fontSize: 12, lineHeight: 14 }}>Day</T>
                    <T v="h1" style={{ lineHeight: 28 }}>{prog.todayIdx + 1}</T>
                    <T v="small" style={{ fontSize: 12, lineHeight: 14 }}>{`of ${ch.days}`}</T>
                  </Ring>
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <T v="label" color={col} numberOfLines={1}>{`${ch.level} · ${ch.goal}`}</T>
                    <T v="h2" numberOfLines={2}>{ch.name}</T>
                    <T v="small" color={c.soft} numberOfLines={3}>{cheer(prog)}</T>
                  </View>
                </Row>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {prog.streak > 0 && <Pill icon="flame" text={`${prog.streak} ${ch.weekly ? (prog.streak === 1 ? 'week' : 'weeks') : (prog.streak === 1 ? 'day' : 'days')} in a row`} color={dom.streak} bg={tint(dom.streak, 1.1)} />}
                  <Pill icon="shield-checkmark-outline" text={prog.freeLeft === 0 ? 'Free misses used' : `${prog.freeLeft} free miss${prog.freeLeft === 1 ? '' : 'es'} left`} />
                  <Pill icon="pie-chart-outline" text={`${Math.round(prog.pct * 100)}% done`} />
                </Row>
                <Stars prog={prog} />
              </>
            ) : (
              <>
                <Row gap={14}>
                  <IconBox icon={ch.icon} color={col} size={56} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <T v="label" color={col} numberOfLines={1}>{`${ch.level} · ${ch.goal}`}</T>
                    <T v="h1" numberOfLines={2}>{ch.name}</T>
                  </View>
                </Row>
                <T v="body" color={c.soft}>{ch.tagline}</T>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <Pill icon="calendar-outline" text={`${ch.days} days`} />
                  <Pill icon="time-outline" text={ch.effort} />
                  {ch.gear === 'gym' && <Pill icon="barbell-outline" text="Gym" />}
                  {extraPills(ch).map((x) => <Pill key={x.text} icon={x.icon} text={x.text} />)}
                </Row>
                <T v="small" color={c.muted}>{ch.why}</T>
              </>
            )}
          </View>
        </Enter>

        {win && !prog && (
          <Enter i={1} style={{ marginTop: 12 }}>
            <Banner icon="trophy" color={dom.streak} title={`You earned ${ch.badge} on ${new Date((win.endedAt ?? win.start) + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} />
          </Enter>
        )}

        {/* Today: the task and its one button. */}
        {prog && !prog.over && prog.today && (
          <Enter i={1}>
            <Section title={`Today · day ${prog.todayIdx + 1}`}>
              <View style={s.card}><TodayTasks prog={prog} act={act} /></View>
            </Section>
          </Enter>
        )}

        <Enter i={2}>
          <Section title={prog ? 'Your days' : `The ${ch.days} days`}>
            <View style={s.card}>
              <DayGrid ch={ch} prog={prog} onDay={prog ? setDay : undefined} />
            </View>
            {prog && !prog.over && <T v="small" color={c.muted} style={{ marginTop: 8 }}>Tap a day to see it, or mark one you did without the app.</T>}
          </Section>
        </Enter>

        {/* Taking a break is the person's call: a plain, visible way out (also in ⋯), never a guilt trip. */}
        {prog && !prog.over && (
          <Tap onPress={() => setMenu('leave')} style={s.breakRow} scale={0.98} accessibilityLabel="Take a break or leave this challenge">
            <Ionicons name="pause-circle-outline" size={20} color={c.muted} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h3">Need a break?</T>
              <T v="small">Leave any time. Your done days stay, and you can start again later.</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Tap>
        )}

        <Enter i={3}>
          <Section title="What you’ll do">
            <View style={[s.card, { gap: 14 }]}><Plan ch={ch} /></View>
          </Section>
        </Enter>

        <Enter i={4}>
          <Section title="Rules">
            <View style={[s.card, { gap: 12 }]}><Rules ch={ch} /></View>
          </Section>
        </Enter>
      </Screen>

      {/* Join: one button in thumb reach. */}
      {!prog && (
        <GlassBar edge="bottom" inset={false} style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: ins.bottom + 12 + mini }}>
          <Button title={win ? 'Go again · starts today' : 'Join · starts today'} icon="flag" onPress={join} />
          <SafetyNote text="Leave any time. General fitness ideas, not medical advice." center />
        </GlassBar>
      )}

      {sheet}
      {prog && !prog.over && <MilestoneSheet prog={prog} />}
      {prog && <DaySheet ch={ch} day={day} onClose={() => setDay(null)} />}

      {/* ⋯ menu, then the leave confirmation in the same sheet. */}
      <Sheet open={!!menu} onClose={() => setMenu(null)}>
        {menu === 'leave' && prog ? (
          <View style={{ gap: 12 }}>
            <T v="h2">{`Take a break from ${ch.name}?`}</T>
            <T v="body" color={c.muted}>{`No problem. Your ${prog.done} done ${prog.done === 1 ? 'day stays' : 'days stay'} in your past challenges, and you can start again any time.`}</T>
            <Button title="Leave challenge" onPress={() => { useStore.getState().leaveChallenge(false); setMenu(null); }} style={{ marginTop: 4 }} />
            <Button title="Keep going" kind="ghost" onPress={() => setMenu(null)} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <T v="h2" style={{ marginBottom: 4 }}>{ch.name}</T>
            <MenuRow icon="list-outline" text="All challenges" onPress={() => { setMenu(null); router.push('/challenges'); }} />
            <MenuRow icon="exit-outline" text="Leave challenge" danger onPress={() => setMenu('leave')} />
          </View>
        )}
      </Sheet>

      {/* Joining while another runs: say what happens to it first. */}
      <Sheet open={switching} onClose={() => setSwitching(false)}>
        {other && (
          <View style={{ gap: 12 }}>
            <T v="h2">Switch challenge?</T>
            <T v="body" color={c.muted}>
              {`You’re on day ${(other.prog?.todayIdx ?? 0) + 1} of ${other.ch.name}. One challenge runs at a time: it moves to your past challenges and ${ch.name} starts today.`}
            </T>
            <Button title={`Switch to ${ch.name.length > 16 ? 'this one' : ch.name}`} onPress={join} style={{ marginTop: 4 }} />
            <Button title={`Keep ${other.ch.name.length > 16 ? 'my current one' : other.ch.name}`} kind="ghost" onPress={() => setSwitching(false)} />
          </View>
        )}
      </Sheet>

      <Celebrate ch={won} onClose={() => setWon(null)} />
    </View>
  );
}

const MenuRow = ({ icon, text, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; text: string; danger?: boolean; onPress: () => void }) => (
  <Tap onPress={onPress} style={s.menuRow} scale={0.98}>
    <Ionicons name={icon} size={20} color={danger ? c.danger : c.text} />
    <T v="h3" color={danger ? c.danger : c.text} style={{ flex: 1 }}>{text}</T>
  </Tap>
);

// What the whole challenge asks, counted.
function Plan({ ch }: { ch: Challenge }) {
  const ctx = useCtx();
  const { rows, rest } = summary(ch);
  const sub = (t: Task) => (t.kind === 'session' ? `${t.q.minutes} min · ${t.q.blurb}` : t.kind === 'workout' ? 'Today’s workout from your plan' : t.kind === 'cardio' ? 'A cardio session, or a watch workout'
    : t.kind === 'steps' ? 'Counted by your watch' : t.kind === 'protein' ? (ctx.gentle ? 'Logged in Fuel' : 'Your daily target, logged in Fuel') : 'Logged a glass at a time');
  return (
    <>
      {ch.weekly && <T v="body">{`${ch.weekly} workouts every week, on any days you like.`}</T>}
      {rows.map(({ task, n }, k) => (
        <Row key={k} gap={12} style={{ alignItems: 'flex-start' }}>
          <IconBox icon={taskIcon(task)} color={dom[taskDomain(task)]} size={36} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T v="h3" numberOfLines={1}>{taskTitle(task, ctx)}</T>
            <T v="small" numberOfLines={2}>{sub(task)}</T>
          </View>
          {!ch.weekly && <T v="h3" color={c.muted}>{`×${n}`}</T>}
        </Row>
      ))}
      {rest > 0 && (
        <Row gap={12}>
          <IconBox icon="moon" color={dom.sleep} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">Rest days</T>
            <T v="small">They count as done</T>
          </View>
          <T v="h3" color={c.muted}>{`×${rest}`}</T>
        </Row>
      )}
    </>
  );
}

function Rules({ ch }: { ch: Challenge }) {
  const kinds = new Set<string>();
  for (let i = 0; i < ch.days; i++) for (const t of ch.day(i).tasks) kinds.add(t.kind);
  const auto = [
    (kinds.has('workout') || kinds.has('session') || kinds.has('cardio')) && 'Workouts tick the day when you finish them.',
    kinds.has('steps') && 'Steps come from your watch, or mark the day done yourself.',
    (kinds.has('protein') || kinds.has('water')) && `${[kinds.has('protein') && 'Food', kinds.has('water') && 'water'].filter(Boolean).join(' and ')} you log in Fuel count automatically.`,
  ].filter(Boolean) as string[];
  const lines: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    ...auto.map((text) => ({ icon: 'sync-outline' as const, text })),
    ch.weekly
      ? { icon: 'shield-checkmark-outline', text: `${ch.free} free week. A short week doesn’t end the challenge.` }
      : { icon: 'shield-checkmark-outline', text: `${ch.free} free miss${ch.free > 1 ? 'es' : ''}. Life happens.` },
    ...(!ch.weekly ? [{ icon: 'refresh' as const, text: 'Missed a day? Make it up within two days and it counts.' }] : []),
    { icon: 'pause-circle-outline', text: 'Sick or travelling? Excuse the day on Today and it counts as rest.' },
    { icon: 'star-outline', text: 'A star at a quarter, half and three quarters.' },
    { icon: 'trophy-outline', text: `Finish within your free ${ch.weekly ? 'week' : 'misses'} to earn the ${ch.badge} badge.` },
  ];
  return <>{lines.map((l) => (
    <Row key={l.text} gap={12} style={{ alignItems: 'flex-start' }}>
      <Ionicons name={l.icon} size={18} color={c.muted} style={{ marginTop: 2 }} />
      <T v="body" style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{l.text}</T>
    </Row>
  ))}</>;
}

// Right after collecting the badge: the moment, and the next step up.
function Celebrate({ ch, onClose }: { ch: Challenge | null; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const [shown, setShown] = useState(ch);
  if (ch && ch !== shown) setShown(ch);
  const x = ch ?? shown;
  const up = x && (challenges.find((y) => y.goal === x.goal && LEVELS.indexOf(y.level) === LEVELS.indexOf(x.level) + 1)
    ?? recommend(profile).find((y) => y.id !== x.id));
  return (
    <Sheet open={!!ch} onClose={onClose}>
      {x && (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <Animated.View entering={ZoomIn.springify().damping(10)} style={[s.medal, { width: 104, height: 104, borderRadius: 52, backgroundColor: tint(dom.streak, 1.6) }]}>
            <Ionicons name="trophy" size={52} color={dom.streak} />
          </Animated.View>
          <T v="label" color={dom.streak}>Badge unlocked</T>
          <T v="h1" style={{ textAlign: 'center' }}>{x.badge}</T>
          <T v="body" color={c.soft} style={{ textAlign: 'center' }}>{`You finished ${x.name}. It’s on your badge shelf in Challenges.`}</T>
          {up && <Button title={`Up next: ${up.name}`} icon="arrow-forward" onPress={() => { onClose(); router.replace({ pathname: '/challenge/[id]', params: { id: up.id } }); }} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
          <Tap onPress={onClose} style={s.link} feedback="none"><T v="small" color={c.text}>Done</T></Tap>
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  hero: { gap: 14, padding: 18, borderRadius: r.xl, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  card: { padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  medal: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  link: { height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, marginTop: 24, padding: 14, borderRadius: r.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, paddingHorizontal: 4 },
});
