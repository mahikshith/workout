// Challenges, shared by the catalogue (app/challenges.tsx), the detail page (app/challenge/[id].tsx), Today's pane
// (Card.tsx) and Train: the running challenge worked out from real data, today's task actions, and the day grid.
// The rules themselves (what each day asks, done / missed / rest) live in src/data/challenges.ts.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { dayKey, targets } from '../calc';
import { cardioFor } from '../data/cardio';
import {
  challengeById, GOAL_COLOR, type GoalTag, MILESTONES, milestoneKey, newMilestone, progress, recommend, taskIcon, taskSub, taskTitle, taskDomain,
  type Challenge, type Ctx, type DayInfo, type Progress, type Task, type TaskState,
} from '../data/challenges';
import { asDay, type Quick } from '../data/quick';
import { FoodSheet, isGentle } from '../foodsheet';
import { openWorkout, useToday } from '../kit';
import { Sheet } from '../sheet';
import { useStore } from '../store';
import { c, dom, r, tint } from '../theme';
import { useTracker } from '../tracker';
import { Button, haptic, IconBox, Row, T, Tap } from '../ui';

type Icon = keyof typeof Ionicons.glyphMap;

// Everything the day rules read, from the main store and the watch store.
export function useCtx(): Ctx {
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const water = useStore((s) => s.water);
  const prefs = useStore((s) => s.waterPrefs);
  const profile = useStore((s) => s.profile);
  const excused = useStore((s) => s.excuses);
  const daily = useTracker((s) => s.daily);
  const workouts = useTracker((s) => s.workouts);
  return useMemo(() => ({
    sessions, meals, water, glassMl: prefs?.glassMl || 250, waterGoalMl: prefs?.goalMl || 2500,
    proteinTarget: targets(profile).protein, gentle: isGentle(profile),
    steps: Object.fromEntries(Object.entries(daily).map(([k, d]) => [k, d.steps])),
    watch: Object.values(workouts).map((w) => ({ start: w.start, durationS: w.durationS })), excused,
  }), [sessions, meals, water, prefs, profile, daily, workouts, excused]);
}

// The running challenge and where it stands today, or nulls.
export function useRun(): { ch: Challenge | null; prog: Progress | null; ctx: Ctx } {
  const run = useStore((s) => s.challenge);
  const ctx = useCtx();
  const today = dayKey();
  return useMemo(() => {
    const ch = run ? challengeById[run.id] ?? null : null;
    return { ch, prog: ch && run ? progress(ch, run, ctx, today) : null, ctx };
  }, [run, ctx, today]);
}

export function useRecommended() {
  const profile = useStore((s) => s.profile);
  const n = useStore((s) => s.sessions.length);
  return useMemo(() => recommend(profile, n), [profile, n]);
}

// Goal colours, with Cardio on the steps green so its chip and pills don't read as HIIT (both are heart work in
// GOAL_COLOR, and there are more goals than domain colours).
export const goalTint = (g: GoalTag) => (g === 'Cardio' ? dom.steps : dom[GOAL_COLOR[g]]);
export const goalColor = (ch: Challenge) => goalTint(ch.goal);
// Small facts worth knowing before joining: the kit it needs and who it is made for.
const KIT: Record<string, string> = { dumbbell: 'Dumbbells', kettlebells: 'Kettlebell', 'pull-up bar': 'Pull-up bar' };
export const extraPills = (ch: Challenge): { icon: Icon; text: string }[] => [
  ...(ch.needs ?? []).map((g) => ({ icon: 'barbell-outline' as Icon, text: KIT[g] ?? g.charAt(0).toUpperCase() + g.slice(1) })),
  ...(ch.who ? [{ icon: 'people-outline' as Icon, text: ch.who === '55+' ? 'Made for 55+' : 'Made for after birth' }] : []),
];
export const openChallenge = (id: string) => router.push({ pathname: '/challenge/[id]', params: { id } });

// What a task's button does. Workouts open ready (clock stopped) exactly like Start on Today; an open workout is
// resumed, never replaced. Steps have no button: the watch counts them, or the person ticks the day.
export type Action = { label: string; short: string; icon: Icon; go: () => void };
export function useTaskActions() {
  const today = useToday();
  const [food, setFood] = useState(false);
  const active = useStore((s) => !!s.active);
  const startQuick = (q: Quick) => {
    const st = useStore.getState();
    if (!st.active) {
      haptic('medium');
      const place = q.where.includes('gym') && st.profile.place !== 'home' ? 'gym' : st.profile.place === 'gym' ? 'gym' : 'home';
      st.start(asDay(q), place);
    }
    openWorkout();
  };
  const act = (t: Task): Action | null => {
    const resume = active ? { label: 'Resume workout', short: 'Resume', icon: 'play' as Icon } : null;
    switch (t.kind) {
      case 'workout': return { ...(resume ?? { label: "Start today's workout", short: 'Start', icon: 'play' }), go: today.start };
      case 'session': return { ...(resume ?? { label: t.q.name.length <= 18 ? `Start ${t.q.name}` : 'Start session', short: 'Start', icon: 'play' }), go: () => startQuick(t.q) };
      case 'cardio': return {
        ...(resume ?? { label: 'Start cardio', short: 'Start', icon: 'play' }),
        go: () => { const st = useStore.getState(); const pick = cardioFor(st.profile, st.sessions).picks[0]; if (pick) startQuick(pick); else today.start(); },
      };
      case 'protein': return { label: 'Log food', short: 'Log', icon: 'add', go: () => setFood(true) };
      case 'water': return {
        label: `Add a glass · ${useStore.getState().waterPrefs?.glassMl || 250} ml`, short: 'Glass', icon: 'add',
        go: () => { haptic('success'); useStore.getState().addWater(1); },
      };
      case 'steps': return null;
    }
  };
  return { act, sheet: <FoodSheet open={food} onClose={() => setFood(false)} /> };
}

// Ticks (or unticks) a day of the running challenge by hand.
export const tick = (key: string, on: boolean) => {
  if (on) haptic('success');
  useStore.getState().tickChallenge(key, on);
};

// The first thing still to do today and its button, if any.
export function nextUp(day: DayInfo | undefined, act: (t: Task) => Action | null) {
  const todo = day?.tasks.find((t) => !t.done && act(t.task));
  return todo ? { state: todo, action: act(todo.task)! } : null;
}

// One task of a day: icon, what it is, how far along, a tick when done. `action` shows a small button on the right.
export function TaskRow({ s, gentle, action }: { s: TaskState; gentle?: boolean; action?: Action | null }) {
  const ctx = useCtx();
  const col = dom[taskDomain(s.task)];
  return (
    <Row gap={12} style={{ minHeight: 48 }}>
      <IconBox icon={taskIcon(s.task)} color={col} size={40} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="h3" numberOfLines={1}>{taskTitle(s.task, ctx)}</T>
        <T v="small" numberOfLines={1} color={s.done ? c.ok : c.muted}>{s.done && s.task.kind !== 'water' && s.task.kind !== 'protein' && s.task.kind !== 'steps' ? 'Done' : taskSub(s, gentle)}</T>
      </View>
      {s.done ? <Ionicons name="checkmark-circle" size={26} color={c.ok} accessibilityLabel="Done" />
        : action ? (
          <Tap onPress={action.go} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tint(col, 1.1) }} scale={0.94}
            accessibilityLabel={action.label}>
            <Ionicons name={action.icon} size={16} color={col} />
            <T v="small" color={col} style={{ fontSize: 15 }}>{action.short}</T>
          </Tap>
        ) : null}
    </Row>
  );
}

// Today's tasks with one primary button for the next thing to do, and "Mark today done" for what the app can't see.
// primary false: no big button (the rows carry small ones).
export function TodayTasks({ prog, act, primary = true, showMakeUp = true }: { prog: Progress; act: (t: Task) => Action | null; primary?: boolean; showMakeUp?: boolean }) {
  const day = prog.today;
  const gentle = useCtx().gentle;
  if (!day) return null;
  const next = nextUp(day, act);
  const many = day.tasks.length > 1;
  const partial = day.ticked && !day.tasks.every((t) => t.done);
  const makeUp = showMakeUp && prog.makeUp && <MakeUp day={prog.makeUp} act={act} primary={primary && (day.done || !day.tasks.length)} />;
  if (!day.tasks.length) {
    return (
      <View style={{ gap: 12 }}>
        <Row gap={12}>
          <IconBox icon="moon" color={dom.sleep} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{day.excused ? 'Excused today' : 'Rest day'}</T>
            <T v="small">{prog.makeUp ? 'A good day to make up the one you missed.' : 'Recovery is part of the plan. It counts as done.'}</T>
          </View>
        </Row>
        {makeUp}
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {day.rest && <T v="small" color={c.muted}>Rest from training today.</T>}
      {day.tasks.map((s, k) => <TaskRow key={k} s={s} gentle={gentle} action={many || !primary ? act(s.task) : null} />)}
      {day.done ? (
        <Row gap={8} style={{ paddingTop: 4 }}>
          <Ionicons name="sparkles" size={16} color={c.ok} />
          <T v="small" color={c.ok} style={{ flex: 1 }}>{partial ? 'Marked done for today' : 'Done for today'}</T>
          {partial && (
            <Tap onPress={() => tick(day.key, false)} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8 }} feedback="none"><T v="small" color={c.muted}>Undo</T></Tap>
          )}
        </Row>
      ) : (
        <View style={{ gap: 4 }}>
          {primary && next && !many && <Button title={next.action.label} icon={next.action.icon} onPress={next.action.go} />}
          {primary && !next && <Button title="Mark today done" icon="checkmark" onPress={() => tick(day.key, true)} />}
          {(next || !primary) && (
            <Tap onPress={() => tick(day.key, true)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }} feedback="none">
              <T v="small" color={c.muted}>{next ? 'Did it without the app? Mark today done' : 'Mark today done'}</T>
            </Tap>
          )}
        </View>
      )}
      {makeUp}
    </View>
  );
}

// A missed day that can still be made up (yesterday or the day before): its tasks with their buttons. Doing one again
// today, on top of today's own, makes it up (src/data/challenges.ts makeUps).
function MakeUp({ day, act, primary }: { day: DayInfo; act: (t: Task) => Action | null; primary?: boolean }) {
  const gentle = useCtx().gentle;
  const todo = day.tasks.filter((t) => !t.done);
  const first = todo.map((t) => act(t.task)).find(Boolean);
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: r.md, backgroundColor: c.card2 }}>
      <Row gap={8}>
        <Ionicons name="refresh" size={16} color={c.warm} />
        <T v="h3" style={{ flex: 1, fontSize: 15 }}>{`Make up day ${day.i + 1}`}</T>
      </Row>
      <T v="small" style={{ marginTop: -6 }}>Missed it? Do it again today and it still counts.</T>
      {todo.map((s, k) => <TaskRow key={k} s={s} gentle={gentle} action={primary && todo.length === 1 ? null : act(s.task)} />)}
      {primary && todo.length === 1 && first && <Button title={first.label} icon={first.icon} onPress={first.go} />}
      <Tap onPress={() => tick(day.key, true)} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }} feedback="none">
        <T v="small" color={c.muted}>{`Did it already? Mark day ${day.i + 1} done`}</T>
      </Tap>
    </View>
  );
}

// --- The day grid: one square per day, 7 to a row. Done is filled green, missed is red, rest is a
// moon, today has a ring. Weekly challenges show each week's count above its row instead of missing days.
const STATE_LABEL: Record<string, string> = { done: 'done', missed: 'missed', rest: 'rest day', today: 'today', upcoming: 'coming up', open: 'no workout' };
export function DayGrid({ ch, prog, onDay }: { ch: Challenge; prog?: Progress | null; onDay?: (d: DayInfo) => void }) {
  const cells: { i: number; state: string; day?: DayInfo }[] = prog
    ? prog.days.map((d) => ({ i: d.i, state: d.state, day: d }))
    : Array.from({ length: ch.days }, (_, i) => ({ i, state: ch.day(i).tasks.length ? 'upcoming' : 'rest' }));
  const rows: (typeof cells)[] = [];
  for (let k = 0; k < cells.length; k += 7) rows.push(cells.slice(k, k + 7));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, w) => (
        <View key={w} style={{ gap: 6 }}>
          {ch.weekly && (
            <Row gap={6}>
              <T v="small" color={c.muted} style={{ flex: 1 }}>{`Week ${w + 1}`}</T>
              {prog?.weeks?.[w] && (
                <T v="small" color={prog.weeks[w].state === 'done' ? c.ok : prog.weeks[w].state === 'missed' ? c.danger : c.muted}>
                  {`${Math.min(prog.weeks[w].have, prog.weeks[w].need)} of ${prog.weeks[w].need}${prog.weeks[w].state === 'done' ? ' ✓' : ''}`}
                </T>
              )}
            </Row>
          )}
          <Row gap={5}>
            {row.map(({ i, state, day }) => {
              const can = !!onDay && !!day && i <= (prog?.todayIdx ?? -1) && day.tasks.length > 0;
              const bg = state === 'done' ? c.ok : state === 'missed' ? tint(c.danger, 1.1) : c.card2;
              const fg = state === 'done' ? c.accentInk : state === 'missed' ? c.danger : state === 'today' ? c.text : state === 'open' ? c.muted : c.dim;
              const body = (
                <View style={{ flex: 1, aspectRatio: 1, maxHeight: 48, borderRadius: r.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'today' ? c.card : bg,
                  borderWidth: state === 'today' ? 2 : 0, borderColor: c.accent }}>
                  {state === 'done' ? <Ionicons name="checkmark" size={18} color={fg} />
                    : state === 'rest' ? <Ionicons name="moon" size={13} color={c.dim} />
                    : <T v={state === 'today' ? 'h3' : 'small'} color={fg} style={{ fontSize: 14 }}>{i + 1}</T>}
                </View>
              );
              const label = `Day ${i + 1}, ${STATE_LABEL[state]}`;
              return can
                ? <Tap key={i} onPress={() => onDay!(day!)} scale={0.9} feedback="none" style={{ flex: 1 }} accessibilityLabel={label}>{body}</Tap>
                : <View key={i} style={{ flex: 1 }} accessibilityLabel={label}>{body}</View>;
            })}
            {row.length < 7 && Array.from({ length: 7 - row.length }, (_, k) => <View key={`f${k}`} style={{ flex: 1 }} />)}
          </Row>
        </View>
      ))}
      <Row gap={14} style={{ flexWrap: 'wrap', marginTop: 4 }}>
        {[
          { label: 'Done', node: <View style={[legend, { backgroundColor: c.ok }]} /> },
          ...(ch.weekly ? [] : [{ label: 'Missed', node: <View style={[legend, { backgroundColor: tint(c.danger, 1.4) }]} /> }]),
          ...(cells.some((x) => x.state === 'rest') ? [{ label: 'Rest', node: <Ionicons name="moon" size={12} color={c.dim} /> }] : []),
          ...(prog && !prog.over ? [{ label: 'Today', node: <View style={[legend, { borderWidth: 2, borderColor: c.accent }]} /> }] : []),
        ].map((x) => <Row key={x.label} gap={6}>{x.node}<T v="small" color={c.muted} style={{ fontSize: 13 }}>{x.label}</T></Row>)}
      </Row>
    </View>
  );
}
const legend = { width: 12, height: 12, borderRadius: 3 };

// A past or today's day, opened from the grid: what it asked, what counted, and a hand tick for what the app missed.
export function DaySheet({ ch, day, onClose }: { ch: Challenge; day: DayInfo | null; onClose: () => void }) {
  const gentle = useCtx().gentle;
  const [shown, setShown] = useState<DayInfo | null>(day);
  if (day && day !== shown) setShown(day);
  const d = day ?? shown;
  const auto = !!d && d.tasks.length > 0 && d.tasks.every((t) => t.done);
  const date = d ? new Date(d.key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : '';
  return (
    <Sheet open={!!day} onClose={onClose}>
      {d && (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{`Day ${d.i + 1} of ${ch.days}`}</T>
            <T v="small">{date}</T>
          </View>
          {d.tasks.map((s, k) => <TaskRow key={k} s={s} gentle={gentle} />)}
          {d.madeUp ? <T v="small" color={c.ok}>Made up on a later day. It counts.</T>
            : d.excused ? <T v="small" color={c.muted}>Excused on Today: it counts like a rest day.</T>
            : auto ? <T v="small" color={c.ok}>Counted from what you logged.</T>
            : d.ticked ? <Button title="Unmark this day" kind="ghost" onPress={() => { tick(d.key, false); onClose(); }} />
            : <Button title="Mark this day done" icon="checkmark" onPress={() => { tick(d.key, true); onClose(); }} />}
          {!auto && !d.ticked && !d.madeUp && <T v="small" color={c.muted} style={{ textAlign: 'center' }}>{d.makeUp ? 'Or make it up today: do it again on top of today’s task.' : 'For days you did it but the app couldn’t see it.'}</T>}
        </View>
      )}
    </Sheet>
  );
}

// Small pill used on hero cards: level, days, effort.
export const Pill = ({ icon, text, color = c.soft, bg = c.card2, shrink }: { icon?: Icon; text: string; color?: string; bg?: string; shrink?: boolean }): ReactNode => (
  <Row gap={4} style={[{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: bg }, shrink && { flexShrink: 1, minWidth: 0 }]}>
    {icon && <Ionicons name={icon} size={13} color={color} />}
    <T v="small" color={color} style={[{ fontSize: 13 }, shrink && { flexShrink: 1 }]} numberOfLines={1}>{text}</T>
  </Row>
);

// Milestone stars (a quarter, half, three quarters) and the trophy at the finish.
export function Stars({ prog, size = 18 }: { prog: Progress; size?: number }) {
  return (
    <View accessible accessibilityLabel={`${MILESTONES.filter((m) => prog.pct >= m.at).length} of 3 milestone stars`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {MILESTONES.map((m) => <Ionicons key={m.at} name={prog.pct >= m.at ? 'star' : 'star-outline'} size={size} color={prog.pct >= m.at ? dom.streak : c.dim} />)}
      <Ionicons name={prog.completed ? 'trophy' : 'trophy-outline'} size={size} color={prog.completed ? dom.streak : c.dim} />
    </View>
  );
}

// A milestone just reached: a small celebration, shown once per milestone per run.
export function MilestoneSheet({ prog }: { prog: Progress | null }) {
  const hints = useStore((s) => s.hints);
  const m = prog ? newMilestone(prog, hints) : null;
  const [shown, setShown] = useState(m);
  if (m && m.k !== shown?.k) setShown(m);
  const close = () => {
    if (prog && m) for (let k = 0; k <= m.k; k++) if (!hints[milestoneKey(prog.run, k)]) useStore.getState().seeHint(milestoneKey(prog.run, k));
  };
  const x = m ?? shown;
  const left = prog ? prog.ch.days - prog.todayIdx - 1 : 0;
  return (
    <Sheet open={!!m} onClose={close}>
      {x && prog && (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(dom.streak, 1.5) }}>
            <Ionicons name="star" size={44} color={dom.streak} />
          </Animated.View>
          <T v="h1" style={{ textAlign: 'center' }}>{`${x.label}!`}</T>
          <T v="body" color={c.soft} style={{ textAlign: 'center' }}>
            {`${Math.round(prog.pct * 100)}% of ${prog.ch.name} done. ${x.k === 2 ? 'The finish line is in sight.' : x.k === 1 ? 'This is where habits stick.' : 'The start is the hardest part, and it’s behind you.'}`}
          </T>
          <Stars prog={prog} size={24} />
          <Button title={left > 0 ? 'Keep going' : 'Nearly there'} onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      )}
    </Sheet>
  );
}
