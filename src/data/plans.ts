import type { Place } from './exercises';

export type Slot = { id: string; sets: number; reps: string; rest: number };
export type Day = { name: string; focus: string; slots: Slot[] };
export type Plan = {
  id: string;
  name: string;
  tagline: string;
  place: Place | 'any';
  level: 'beginner' | 'intermediate';
  tags: string[];
  color: string;
  days: Day[];
};

// reps is a string so plans can say "8-12", "30s" or "10/side".
const x = (id: string, sets: number, reps: string, rest = 90): Slot => ({ id, sets, reps, rest });

export const plans: Plan[] = [
  {
    id: 'full-body-gym', name: 'Full Body Foundations', tagline: 'Three days a week. Learn the big lifts.',
    place: 'gym', level: 'beginner', tags: ['build muscle', 'stay fit', 'get stronger'], color: '#C5F04A',
    days: [
      { name: 'Full Body A', focus: 'Squat · Push · Pull', slots: [
        x('Goblet_Squat', 3, '10'), x('Dumbbell_Bench_Press', 3, '10'), x('Seated_Cable_Rows', 3, '12'),
        x('Dumbbell_Shoulder_Press', 2, '10'), x('Plank', 3, '30s', 60) ] },
      { name: 'Full Body B', focus: 'Hinge · Press · Pull', slots: [
        x('Romanian_Deadlift', 3, '10', 120), x('Incline_Dumbbell_Press', 3, '10'), x('Wide-Grip_Lat_Pulldown', 3, '12'),
        x('Dumbbell_Lunges', 2, '10/side'), x('Dead_Bug', 3, '10/side', 60) ] },
    ],
  },
  {
    id: 'ppl-gym', name: 'Push Pull Legs', tagline: 'The classic split for steady muscle gain.',
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger'], color: '#5AC8FA',
    days: [
      { name: 'Push Day', focus: 'Chest · Shoulders · Triceps', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '6-8', 150), x('Incline_Dumbbell_Press', 3, '8-12'),
        x('Standing_Military_Press', 3, '8-10', 120), x('Side_Lateral_Raise', 3, '12-15', 60),
        x('Triceps_Pushdown', 3, '10-12', 60), x('Cable_Crossover', 2, '12-15', 60) ] },
      { name: 'Pull Day', focus: 'Back · Biceps', slots: [
        x('Barbell_Deadlift', 3, '5', 180), x('Pullups', 3, '6-10', 120), x('Bent_Over_Barbell_Row', 3, '8-10', 120),
        x('Face_Pull', 3, '15', 60), x('Barbell_Curl', 3, '10', 60), x('Hammer_Curls', 2, '12', 60) ] },
      { name: 'Leg Day', focus: 'Quads · Hamstrings · Glutes · Calves', slots: [
        x('Barbell_Squat', 4, '6-8', 180), x('Romanian_Deadlift', 3, '8-10', 120), x('Leg_Press', 3, '10-12', 120),
        x('Lying_Leg_Curls', 3, '12', 60), x('Leg_Extensions', 2, '15', 60), x('Standing_Calf_Raises', 4, '12-15', 60) ] },
    ],
  },
  {
    id: 'upper-lower-gym', name: 'Upper / Lower', tagline: 'Four days, balanced strength and size.',
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger', 'stay fit'], color: '#FF8A3D',
    days: [
      { name: 'Upper Strength', focus: 'Heavy press and row', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '5', 150), x('Bent_Over_Barbell_Row', 4, '6', 120),
        x('Dumbbell_Shoulder_Press', 3, '8'), x('Chin-Up', 3, '6-8', 120), x('Lying_Triceps_Press', 2, '10', 60) ] },
      { name: 'Lower Strength', focus: 'Squat and hinge', slots: [
        x('Barbell_Squat', 4, '5', 180), x('Romanian_Deadlift', 3, '8', 120), x('Dumbbell_Step_Ups', 3, '10/side'),
        x('Seated_Calf_Raise', 3, '15', 60), x('Plank', 3, '45s', 60) ] },
      { name: 'Upper Volume', focus: 'Pump work', slots: [
        x('Incline_Dumbbell_Press', 3, '10-12'), x('Seated_Cable_Rows', 3, '10-12'), x('Arnold_Dumbbell_Press', 3, '12'),
        x('Wide-Grip_Lat_Pulldown', 3, '12'), x('Dumbbell_Bicep_Curl', 3, '12', 60), x('Triceps_Pushdown', 3, '12', 60) ] },
      { name: 'Lower Volume', focus: 'Glutes and legs', slots: [
        x('Leg_Press', 4, '12', 120), x('Barbell_Hip_Thrust', 3, '10', 120), x('Split_Squat_with_Dumbbells', 3, '10/side'),
        x('Lying_Leg_Curls', 3, '12', 60), x('Standing_Calf_Raises', 3, '15', 60) ] },
    ],
  },
  {
    id: 'glutes-legs-gym', name: 'Lower Body Sculpt', tagline: 'Glutes and legs three times, upper body twice.',
    place: 'gym', level: 'beginner', tags: ['build muscle', 'stay fit', 'lose fat'], color: '#FF5C8A',
    days: [
      { name: 'Glute Focus', focus: 'Thrust · Hinge · Kickback', slots: [
        x('Barbell_Hip_Thrust', 4, '8-10', 120), x('Romanian_Deadlift', 3, '10', 120), x('One-Legged_Cable_Kickback', 3, '12/side', 60),
        x('Thigh_Abductor', 3, '15', 60), x('Plank', 3, '30s', 60) ] },
      { name: 'Upper Tone', focus: 'Back · Shoulders · Arms', slots: [
        x('Wide-Grip_Lat_Pulldown', 3, '12'), x('Seated_Cable_Rows', 3, '12'), x('Dumbbell_Shoulder_Press', 3, '10'),
        x('Side_Lateral_Raise', 3, '15', 60), x('Triceps_Pushdown', 2, '12', 60), x('Dumbbell_Bicep_Curl', 2, '12', 60) ] },
      { name: 'Leg Day', focus: 'Quads · Glutes · Hamstrings', slots: [
        x('Goblet_Squat', 4, '10', 120), x('Leg_Press', 3, '12', 120), x('Dumbbell_Lunges', 3, '10/side'),
        x('Lying_Leg_Curls', 3, '12', 60), x('Thigh_Adductor', 2, '15', 60), x('Standing_Calf_Raises', 3, '15', 60) ] },
    ],
  },
  {
    id: 'home-bodyweight', name: 'Home, No Equipment', tagline: 'Just you and the floor. Twenty-five minutes.',
    place: 'home', level: 'beginner', tags: ['stay fit', 'lose fat', 'build muscle'], color: '#C5F04A',
    days: [
      { name: 'Home Full Body A', focus: 'Legs · Push · Core', slots: [
        x('Bodyweight_Squat', 3, '15', 60), x('Pushups', 3, '8-12', 60), x('Butt_Lift_Bridge', 3, '15', 45),
        x('Bodyweight_Walking_Lunge', 3, '10/side', 60), x('Plank', 3, '30s', 45), x('Mountain_Climbers', 3, '30s', 45) ] },
      { name: 'Home Full Body B', focus: 'Glutes · Back · Core', slots: [
        x('Step-up_with_Knee_Raise', 3, '10/side', 60), x('Incline_Push-Up', 3, '12', 60), x('Single_Leg_Glute_Bridge', 3, '10/side', 45),
        x('Hyperextensions_With_No_Hyperextension_Bench', 3, '12', 45), x('Bench_Dips', 3, '10', 60), x('Dead_Bug', 3, '10/side', 45) ] },
    ],
  },
  {
    id: 'home-dumbbell', name: 'Home Dumbbells & Bands', tagline: 'Real strength work with a pair of dumbbells.',
    place: 'home', level: 'beginner', tags: ['build muscle', 'get stronger', 'stay fit'], color: '#5AC8FA',
    days: [
      { name: 'Home Upper', focus: 'Chest · Back · Shoulders · Arms', slots: [
        x('Dumbbell_Bench_Press', 3, '10'), x('One-Arm_Dumbbell_Row', 3, '10/side'), x('Dumbbell_Shoulder_Press', 3, '10'),
        x('Band_Pull_Apart', 3, '15', 45), x('Hammer_Curls', 3, '12', 60), x('Standing_Dumbbell_Triceps_Extension', 3, '12', 60) ] },
      { name: 'Home Lower', focus: 'Quads · Glutes · Hamstrings', slots: [
        x('Goblet_Squat', 4, '12'), x('Stiff-Legged_Dumbbell_Deadlift', 3, '10'), x('Split_Squat_with_Dumbbells', 3, '10/side'),
        x('Hip_Lift_with_Band', 3, '15', 45), x('Calf_Raise_On_A_Dumbbell', 3, '15', 45), x('Russian_Twist', 3, '20', 45) ] },
    ],
  },
  {
    id: 'fat-burn-home', name: 'Sweat Circuit', tagline: 'Short rests, high heart rate, anywhere.',
    place: 'home', level: 'beginner', tags: ['lose fat', 'stay fit'], color: '#FF8A3D',
    days: [
      { name: 'Cardio Blast', focus: 'Conditioning circuit', slots: [
        x('Freehand_Jump_Squat', 4, '30s', 30), x('Mountain_Climbers', 4, '30s', 30), x('Pushups', 4, '30s', 30),
        x('Scissors_Jump', 4, '30s', 30), x('Air_Bike', 4, '30s', 30) ] },
      { name: 'Core Burner', focus: 'Abs and obliques', slots: [
        x('Plank', 3, '40s', 30), x('Russian_Twist', 3, '20', 30), x('Flutter_Kicks', 3, '30s', 30),
        x('Leg_Pull-In', 3, '15', 30), x('Dead_Bug', 3, '10/side', 30) ] },
    ],
  },
  {
    id: 'pelvic-floor', name: 'Pelvic Floor & Kegels', tagline: 'Ten quiet minutes a day. For everyone.',
    place: 'any', level: 'beginner', tags: ['stay fit'], color: '#BF8CFF',
    days: [
      { name: 'Kegel Day', focus: 'Pelvic floor strength and control', slots: [
        x('Diaphragmatic_Breathing', 1, '6 breaths', 20), x('Kegel_Long_Hold', 3, '10', 30), x('Kegel_Quick_Flick', 3, '15', 30),
        x('Kegel_Elevator', 2, '5', 30), x('Butt_Lift_Bridge', 2, '12', 45), x('Reverse_Kegel', 2, '8', 20) ] },
    ],
  },
  {
    id: 'mobility', name: 'Mobility Reset', tagline: 'Loosen hips, back and shoulders on rest days.',
    place: 'any', level: 'beginner', tags: ['stay fit'], color: '#30D158',
    days: [
      { name: 'Mobility Flow', focus: 'Stretch and breathe', slots: [
        x('Cat_Stretch', 2, '30s', 15), x('Childs_Pose', 2, '30s', 15), x('Pelvic_Tilt_Into_Bridge', 2, '10', 15),
        x('IT_Band_and_Glute_Stretch', 2, '30s/side', 15), x('Calf_Stretch_Hands_Against_Wall', 2, '30s', 15) ] },
    ],
  },
];

export const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
