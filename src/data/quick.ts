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

// All beginner-level. Minutes are work plus rest, rounded.
export const quick: Quick[] = [
  {
    id: 'desk', name: 'Desk reset', minutes: 5, where: ['office'], icon: 'desktop', tags: ['desk', 'mobility'],
    blurb: 'Neck, shoulders, back and wrists, without leaving your chair.',
    slots: [x('Desk_Neck_Tilt', 1, '5/side', 10), x('Desk_Chin_Tuck', 1, '8', 10), x('Shoulder_Circles', 1, '30s', 10), x('Desk_Seated_Twist', 1, '30s/side', 10), x('Desk_Wrist_Stretch', 1, '30s/side', 10)],
  },
  {
    id: 'eyes', name: 'Eye break', minutes: 2, where: ['anywhere'], icon: 'eye', tags: ['eyes', 'desk'],
    blurb: 'Rest screen-tired eyes in two minutes.',
    slots: [x('Eye_20_20_20', 1, '20s', 5), x('Eye_Palming', 1, '30s', 5), x('Eye_Near_Far_Focus', 1, '30s', 5), x('Eye_Slow_Blinks', 1, '8', 5)],
  },
  {
    id: 'jaw', name: 'Jaw and neck release', minutes: 3, where: ['anywhere'], icon: 'happy', tags: ['desk', 'calm'],
    blurb: 'Let go of a clenched jaw and a stiff neck.',
    slots: [x('Jaw_Open_Release', 1, '8', 10), x('Side_Neck_Stretch', 1, '20s/side', 10), x('Desk_Chin_Tuck', 1, '8', 10), x('Shoulder_Circles', 1, '30s', 10)],
  },
  {
    id: 'morning', name: 'Morning wake-up', minutes: 5, where: ['home'], icon: 'sunny', tags: ['morning', 'mobility'],
    blurb: 'Get the blood moving: march, cat-cow, arm circles, squats.',
    slots: [x('March_In_Place', 1, '60s', 15), x('Cat_Stretch', 1, '45s', 15), x('Arm_Circles', 1, '30s', 15), x('Bodyweight_Squat', 2, '10', 20)],
  },
  {
    id: 'burn', name: 'No-equipment burn', minutes: 15, where: ['home'], icon: 'flash', tags: ['cardio', 'strength'],
    blurb: 'Squats, push-ups, lunges, plank and climbers. Short rests.',
    slots: [x('Bodyweight_Squat', 3, '15'), x('Pushups', 3, '10'), x('Bodyweight_Walking_Lunge', 3, '10/side'), x('Plank', 3, '30s'), x('Mountain_Climbers', 3, '30s')],
  },
  {
    id: 'dumbbell', name: 'Dumbbell express', minutes: 15, where: ['home'], icon: 'barbell', tags: ['strength'], gear: ['dumbbell'],
    blurb: 'Squat, row, press and deadlift with one pair of dumbbells.',
    slots: [x('Goblet_Squat', 3, '10', 40), x('One-Arm_Dumbbell_Row', 3, '10/side', 40), x('Standing_Dumbbell_Press', 3, '10', 40), x('Stiff-Legged_Dumbbell_Deadlift', 3, '10', 40)],
  },
  {
    id: 'core', name: 'Core and abs', minutes: 10, where: ['home', 'anywhere'], icon: 'flame', tags: ['core'],
    blurb: 'Four floor moves for a stronger middle. No equipment.',
    slots: [x('Plank', 3, '30s', 15), x('Dead_Bug', 3, '8/side', 15), x('Alternate_Heel_Touchers', 3, '16', 15), x('Flutter_Kicks', 3, '30s', 15)],
  },
  {
    id: 'kegel', name: 'Kegel day', minutes: 10, where: ['anywhere'], icon: 'pulse', tags: ['pelvic', 'calm'],
    blurb: 'Quiet squeezes nobody can see. Lying down or sitting.',
    slots: [x('Diaphragmatic_Breathing', 1, '6 breaths'), x('Kegel_Long_Hold', 2, '10', 30), x('Kegel_Quick_Flick', 2, '15', 30), x('Kegel_Elevator', 1, '5', 30), x('Reverse_Kegel', 1, '8')],
  },
  {
    id: 'calm', name: 'Calm breathing', minutes: 5, where: ['anywhere'], icon: 'leaf', tags: ['calm'],
    blurb: 'Slow your breath and settle your mind.',
    slots: [x('Shoulder_Circles', 1, '30s', 10), x('Diaphragmatic_Breathing', 1, '6 breaths', 15), x('Breath_Box', 2, '60s', 15), x('Eye_Palming', 1, '30s', 0)],
  },
  {
    id: 'period', name: 'Period-friendly', minutes: 12, where: ['home'], icon: 'heart', tags: ['period', 'calm', 'mobility'],
    blurb: 'Gentle movement for heavy or crampy days. Go easy and skip anything that hurts.',
    slots: [x('March_In_Place', 2, '60s', 30), x('Gentle_Hip_Circles', 2, '30s', 20), x('Cat_Stretch', 2, '30s', 15), x('Childs_Pose', 2, '45s', 15), x('Knee_Across_The_Body', 2, '30s/side', 15), x('Hug_Knees_To_Chest', 1, '45s'), x('Diaphragmatic_Breathing', 1, '6 breaths', 0)],
  },
  {
    id: 'mobility', name: 'Mobility flow', minutes: 12, where: ['home', 'anywhere'], icon: 'body', tags: ['mobility', 'calm'],
    blurb: 'Loosen hips, back and shoulders.',
    slots: [x('Cat_Stretch', 2, '30s', 15), x('Childs_Pose', 2, '30s', 15), x('Butt_Lift_Bridge', 2, '10', 15), x('Knee_Across_The_Body', 2, '30s/side', 15), x('Kneeling_Hip_Flexor', 2, '30s/side', 15), x('Arm_Circles', 2, '30s', 15)],
  },
];

export const quickById = Object.fromEntries(quick.map((q) => [q.id, q]));
export const asDay = (q: Quick): Day => ({ name: q.name, focus: q.blurb, slots: q.slots });
