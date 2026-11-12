// React hooks over the recommendation engine (src/reco/index.ts). Narrow store selectors, memoised: the engine runs
// again only when the profile, the logged sessions, today's check-in, the plan or the watch data change.
import { useMemo } from 'react';
import { useStore } from '../store';
import { useTracker } from '../tracker';
import { buildPerson, recommend, type Person, type Recommendation } from './index';

// planId: pass `null` to ask "what would you suggest if I had no plan?" (today becomes a built session).
export function usePerson(opts: { planId?: string | null } = {}): Person {
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const checkins = useStore((s) => s.checkins);
  const storePlan = useStore((s) => s.planId);
  const nextDay = useStore((s) => s.nextDay);
  const planStart = useStore((s) => s.planStart);
  const daily = useTracker((s) => s.daily);
  const strapHrv = useTracker((s) => s.strapHrv);
  const planId = opts.planId === null ? undefined : opts.planId ?? storePlan;
  return useMemo(
    () => buildPerson({ profile, sessions, checkins, planId, nextDay, planStart, tracker: { daily, strapHrv } }),
    [profile, sessions, checkins, planId, nextDay, planStart, daily, strapHrv],
  );
}

// Everything Home and the Plans tab need: today's workout with reasons, every plan ranked, exercises for a muscle,
// and what to do instead.
export function useReco(opts: { planId?: string | null } = {}): Recommendation {
  const person = usePerson(opts);
  return useMemo(() => recommend(person), [person]);
}
