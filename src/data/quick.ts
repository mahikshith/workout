import type { Ionicons } from '@expo/vector-icons';
import type { Day, Slot } from './plans';

export type Where = 'home' | 'office' | 'gym' | 'anywhere';
export type QuickTag = 'desk' | 'eyes' | 'calm' | 'core' | 'pelvic' | 'period' | 'morning' | 'cardio' | 'strength' | 'mobility';

// Short sessions for Today and for missed-workout nudges. `gear` lists equipment needed beyond the body.
export type Quick = {
  id: string; name: string; minutes: number; where: Where[]; icon: keyof typeof Ionicons.glyphMap;
  blurb: string; tags: QuickTag[]; gear?: string[]; slots: Slot[];
};

const x = (id: string, sets: number, reps: string, rest = 20): Slot => ({ id, sets, reps, rest });

export const quick: Quick[] = [
  {
    id: 'kegel', name: 'Kegel day', minutes: 10, where: ['anywhere'], icon: 'pulse', tags: ['pelvic', 'calm'],
    blurb: 'Quiet pelvic floor work nobody can see.',
    slots: [x('Diaphragmatic_Breathing', 1, '6 breaths'), x('Kegel_Long_Hold', 3, '10', 30), x('Kegel_Quick_Flick', 3, '15', 30), x('Kegel_Elevator', 2, '5', 30), x('Reverse_Kegel', 2, '8')],
  },
  {
    id: 'core', name: 'Core and abs', minutes: 10, where: ['home', 'anywhere'], icon: 'flame', tags: ['core'],
    blurb: 'Five moves, no equipment.',
    slots: [x('Plank', 3, '30s', 30), x('Dead_Bug', 3, '10/side', 30), x('Russian_Twist', 3, '20', 30), x('Flutter_Kicks', 3, '30s', 30)],
  },
  {
    id: 'mobility', name: 'Mobility flow', minutes: 12, where: ['home', 'anywhere'], icon: 'body', tags: ['mobility', 'calm'],
    blurb: 'Loosen hips, back and shoulders.',
    slots: [x('Cat_Stretch', 2, '30s', 15), x('Childs_Pose', 2, '30s', 15), x('Pelvic_Tilt_Into_Bridge', 2, '10', 15), x('IT_Band_and_Glute_Stretch', 2, '30s/side', 15)],
  },
  {
    id: 'burn', name: 'No-equipment burn', minutes: 15, where: ['home'], icon: 'flash', tags: ['cardio', 'strength'],
    blurb: 'Squats, push-ups, lunges, plank.',
    slots: [x('Bodyweight_Squat', 3, '15', 30), x('Pushups', 3, '10', 30), x('Bodyweight_Walking_Lunge', 3, '10/side', 30), x('Plank', 3, '30s', 30), x('Mountain_Climbers', 3, '30s', 30)],
  },
];

export const quickById = Object.fromEntries(quick.map((q) => [q.id, q]));
export const asDay = (q: Quick): Day => ({ name: q.name, focus: q.blurb, slots: q.slots });
