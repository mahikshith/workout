// Original motivation lines in a fight-movie spirit (no film quotes: those are copyrighted), grouped by what is going on
// in someone's life. Lines for people who ticked "complicated relationship with food" never mention weight or numbers.
import { postpartumWeek, pregnancyWeek } from '../calc';
import type { Profile } from '../store';

const LINES = {
  grit: [
    "Nobody's coming to do the reps for you. Good. That means the win is all yours.",
    'The bell rang. You can stay in the corner or walk to the middle. Walk.',
    'Tired is a feeling. Done is a decision. Decide later.',
    'Champions are just people who kept showing up after it stopped being fun.',
    'Your body hears everything your mind says. Talk like a winner.',
    "The rep you don't want to do is the one that changes you.",
    'Get knocked down. Get back up. Add a little weight.',
    "You don't rise to the moment. You fall to your training. So train.",
    "Discipline is remembering what you want when you'd rather forget.",
    'Sweat now. Smile later.',
    'One more round. There is always one more round in you.',
    'Hard days build the person easy days are waiting for.',
  ],
  breakup: [
    'Pour it into the work. Heartbreak lifts heavier than you think.',
    'You lost a person, not yourself. Go find more of you today.',
    'The best comeback is quiet, strong, and entirely for you.',
    'Build the version of you that never doubts their worth.',
    'Today is about one person. You.',
  ],
  stressed: [
    "You don't have to feel ready. Ten minutes is enough today.",
    "Breathe in. Move a little. That's a win.",
    'Heavy days need light steps. Take one.',
    'Moving your body is a kindness, not a punishment.',
    'You have survived every hard day so far. Add a short walk to this one.',
  ],
  body: [
    'Every body can get stronger, including yours, starting today.',
    'Strong first. The mirror catches up.',
    "You're not starting over. You're starting smarter.",
    'Progress hides for weeks, then shows up all at once. Keep going.',
    'Firm comes from muscle, and muscle comes from showing up.',
  ],
  food: [
    'Food is fuel for the things you love doing.',
    'Regular meals are part of the training plan.',
    'Strong is a feeling, not a number.',
    "Be as kind to yourself as you'd be to a friend.",
  ],
  comeback: [
    'Missed a few days? The streak starts again with one rep.',
    'Restarting is a power move.',
    "It doesn't matter how long you stopped. It matters that you're back.",
  ],
  care: [
    'Your body is doing something amazing. Gentle counts.',
    "Strength looks different right now, and that's strong too.",
    'Rest is part of the work this season.',
  ],
};
export type MotivationKind = keyof typeof LINES;

// What mindset to build: short, practical habits, shown as tips and in nudges.
export const MINDSET = [
  { title: 'Be someone who trains', body: 'Goals end. Identity sticks. Every session is a vote for the person you are becoming.' },
  { title: 'Never miss twice', body: 'Missing one day is life. Missing two is the start of a new habit. Show up tomorrow.' },
  { title: 'Start with two minutes', body: 'Put your shoes on and do one exercise. Starting is the hardest part.' },
  { title: 'Progress over perfection', body: 'A messy workout beats a perfect plan you never start.' },
  { title: 'Sleep is training', body: 'Muscles grow while you sleep. Aim for seven to nine hours.' },
  { title: 'Control the controllables', body: 'You cannot control the scale today. You can control your next meal and your next set.' },
];

export function kinds(p: Profile, daysOff = 0): MotivationKind[] {
  if (pregnancyWeek(p) !== null || postpartumWeek(p) !== null) return ['care'];
  if (p.concerns?.includes('food')) return ['food', 'stressed'];
  const out: MotivationKind[] = [];
  if (daysOff >= 3) out.push('comeback');
  if (p.concerns?.includes('breakup')) out.push('breakup');
  if (p.concerns?.includes('stressed')) out.push('stressed');
  if (p.concerns?.some((x) => x === 'lose-weight' || x === 'tone')) out.push('body');
  if (!p.concerns?.includes('stressed')) out.push('grit');
  return out;
}

// A line that fits this person; `seed` keeps it stable for a while (e.g. the day plus a 3-hour slot).
export function motivation(p: Profile, daysOff = 0, seed = 0): string {
  const pool = kinds(p, daysOff).flatMap((k) => LINES[k]);
  return pool[Math.abs(seed) % pool.length];
}
