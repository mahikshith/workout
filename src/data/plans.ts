import type { Place } from './exercises';

export type Slot = { id: string; sets: number; reps: string; rest: number };
export type Day = { name: string; focus: string; slots: Slot[] };
export type Category = 'Strength' | 'Muscle' | 'One muscle' | 'Fat loss' | 'Cardio' | 'Functional' | 'Home' | 'Women' | 'Recovery';
export type Plan = {
  id: string;
  name: string;
  tagline: string;
  place: Place | 'any';
  level: 'beginner' | 'intermediate';
  tags: string[];
  color: string; // kept for older screens; always '' so screens use the accent
  days: Day[];
  category: Category;
  about: string; // what it does to your body
  who: string;
  why: string; // why this many days
  benefits: string[];
  tips: string[]; // food, protein and supplements in plain words
  week: (number | null)[]; // Monday..Sunday: index into days, null = rest
  weeks: number; // suggested program length
};

export const CATEGORIES: Category[] = ['Muscle', 'Strength', 'One muscle', 'Fat loss', 'Cardio', 'Functional', 'Home', 'Women', 'Recovery'];

// reps is a string so plans can say "8-12", "30s", "10/side" or "20 min".
// Each day runs big compound lifts first, then isolation, then core, then conditioning or stretches.
const x = (id: string, sets: number, reps: string, rest = 90): Slot => ({ id, sets, reps, rest });

const PROTEIN = 'Aim for about 1.6 g of protein per kg of body weight a day, spread over 3 or 4 meals.';
const CREATINE = 'Creatine monohydrate, 3-5 g a day, is one of the best-studied supplements for strength and size. Take it daily, any time.';
const WHEY = 'Whey or plant protein powder is just convenient food. Use it only when your meals fall short on protein.';
const SLEEP = 'Sleep 7-9 hours. Most of your recovery and muscle growth happens at night.';
const WATER = 'Drink water through the day. Pale yellow urine means you are on track.';
const CARBS = 'Eat some carbs like rice, oats, bread or fruit 1-2 hours before training for energy.';
const DEFICIT = 'Eat about 300-500 kcal less than you burn. Bigger cuts cost muscle, mood and energy.';
const FIBRE = 'Fill half your plate with vegetables. Fibre and protein keep you full on fewer calories.';
const SURPLUS = 'Eat about 200-300 kcal more than you burn and aim to gain about 1 kg a month. Faster gain is mostly fat.';
const CAFFEINE = 'Coffee before training can help you push, but skip it after mid-afternoon so you sleep well.';

export const plans: Plan[] = [
  {
    id: 'full-body-gym', name: 'Full Body Foundations', tagline: 'Three days a week. Learn the big lifts.',
    place: 'gym', level: 'beginner', tags: ['build muscle', 'stay fit', 'get stronger'], color: '', category: 'Muscle',
    about: 'Every session trains your legs, chest, back and shoulders with a few big lifts. Your muscles get used to lifting, your joints get stronger and your technique sets in.',
    who: 'New to the gym, or back after a long break.',
    why: 'Three full-body days give each muscle work three times a week with a rest day in between. That is plenty for a beginner to grow.',
    benefits: ['Learn the main lifts safely', 'Muscle and strength from week one', 'Short sessions, about 45 minutes'],
    tips: [PROTEIN, CREATINE, SLEEP, 'Swap A and B each week: A-B-A, then B-A-B.'],
    week: [0, null, 1, null, 0, null, null], weeks: 8,
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
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger'], color: '', category: 'Muscle',
    about: 'Pushing muscles, pulling muscles and legs each get their own day, so you can do more work for each group. More work per muscle, done well, means more growth.',
    who: 'Lifters with 6 months or more of steady training who can train most days.',
    why: 'Six days runs the cycle twice, so every muscle is trained twice a week, which works better for growth than once.',
    benefits: ['Each muscle trained twice a week', 'High volume for size', 'Clear focus every session'],
    tips: [PROTEIN, CREATINE, WHEY, SLEEP, 'Short on time? Run it three days a week; you will still progress, just slower.'],
    week: [0, 1, 2, 0, 1, 2, null], weeks: 8,
    days: [
      { name: 'Push Day', focus: 'Chest · Shoulders · Triceps', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '6-8', 150), x('Standing_Military_Press', 3, '8-10', 120),
        x('Incline_Dumbbell_Press', 3, '8-12'), x('Side_Lateral_Raise', 3, '12-15', 60),
        x('Cable_Crossover', 2, '12-15', 60), x('Triceps_Pushdown', 3, '10-12', 60) ] },
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
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger', 'stay fit'], color: '', category: 'Strength',
    about: 'One heavy and one lighter day for the upper body, and the same for the legs. Heavy days build strength, lighter days add size.',
    who: 'Anyone past the beginner stage who wants strength and muscle together.',
    why: 'Four days trains each half of the body twice a week and leaves three full rest days for recovery.',
    benefits: ['Strength and size in one plan', 'Three rest days a week', 'Easy to fit around work'],
    tips: [PROTEIN, CREATINE, CARBS, SLEEP],
    week: [0, 1, null, 2, 3, null, null], weeks: 8,
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
    id: 'bro-split', name: 'Bro Split', tagline: 'One muscle group a day, five days a week.',
    place: 'gym', level: 'intermediate', tags: ['build muscle'], color: '', category: 'Muscle',
    about: 'Each day hits one or two muscle groups with lots of sets from different angles. The long focus on one area gives a big pump and lots of work for each muscle.',
    who: 'Lifters with a year or more behind them who enjoy long sessions on one body part.',
    why: 'Five days lets each muscle group have its own day and a full week to recover before you hit it again.',
    benefits: ['Lots of sets for each muscle', 'Full recovery between sessions', 'Simple to follow'],
    tips: [PROTEIN, CREATINE, WHEY, SLEEP, CARBS],
    week: [0, 1, 2, 3, 4, null, null], weeks: 8,
    days: [
      { name: 'Chest Day', focus: 'Chest · Abs', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '6-8', 150), x('Incline_Dumbbell_Press', 3, '8-10', 120),
        x('Dips_-_Chest_Version', 3, '8-12'), x('Dumbbell_Flyes', 3, '12', 60), x('Cable_Crossover', 2, '12-15', 60),
        x('Cable_Crunch', 3, '15', 60) ] },
      { name: 'Back Day', focus: 'Lats · Upper back', slots: [
        x('Barbell_Deadlift', 3, '5', 180), x('Pullups', 3, '6-10', 120), x('Bent_Over_Barbell_Row', 3, '8', 120),
        x('Seated_Cable_Rows', 3, '10-12'), x('Straight-Arm_Pulldown', 2, '12-15', 60) ] },
      { name: 'Shoulder Day', focus: 'Shoulders · Traps · Abs', slots: [
        x('Standing_Military_Press', 4, '6-8', 150), x('Face_Pull', 3, '15', 60), x('Barbell_Shrug', 3, '10-12', 60),
        x('Side_Lateral_Raise', 4, '12-15', 60), x('Reverse_Machine_Flyes', 3, '12-15', 60), x('Plank', 3, '45s', 60) ] },
      { name: 'Leg Day', focus: 'Quads · Hamstrings · Calves', slots: [
        x('Barbell_Squat', 4, '6-8', 180), x('Romanian_Deadlift', 3, '8-10', 120), x('Leg_Press', 3, '10-12', 120),
        x('Lying_Leg_Curls', 3, '12', 60), x('Leg_Extensions', 3, '15', 60), x('Standing_Calf_Raises', 4, '12-15', 60) ] },
      { name: 'Arm Day', focus: 'Biceps · Triceps · Abs', slots: [
        x('Close-Grip_Barbell_Bench_Press', 3, '8', 120), x('Barbell_Curl', 3, '8-10'), x('Triceps_Pushdown', 3, '10-12', 60),
        x('Incline_Dumbbell_Curl', 3, '10-12', 60), x('Triceps_Overhead_Extension_with_Rope', 2, '12', 60), x('Hammer_Curls', 2, '12', 60),
        x('wg_hanging-knee-raise', 3, '12', 60) ] },
    ],
  },
  {
    id: 'arnold-split', name: 'Arnold Split', tagline: 'Chest and back, shoulders and arms, legs. Twice a week.',
    place: 'gym', level: 'intermediate', tags: ['build muscle'], color: '', category: 'Muscle',
    about: 'Opposite muscles share a day, so chest rests while back works and the reverse. You train hard and often, which builds size fast if you eat and sleep well.',
    who: 'Experienced lifters with time for six sessions a week and the appetite to match.',
    why: 'Six days runs the three-day cycle twice, so every muscle gets two hard sessions a week.',
    benefits: ['Every muscle twice a week', 'Supersets save time', 'High volume for size'],
    tips: [PROTEIN, CREATINE, WHEY, SURPLUS, SLEEP],
    week: [0, 1, 2, 0, 1, 2, null], weeks: 8,
    days: [
      { name: 'Chest & Back', focus: 'Press then pull, back and forth', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '8', 120), x('Pullups', 4, '6-10', 120), x('Incline_Dumbbell_Press', 3, '10'),
        x('Bent_Over_Barbell_Row', 3, '10'), x('Dumbbell_Flyes', 3, '12', 60), x('Straight-Arm_Pulldown', 3, '12', 60),
        x('Reverse_Crunch', 3, '15', 45) ] },
      { name: 'Shoulders & Arms', focus: 'Delts · Biceps · Triceps', slots: [
        x('Standing_Military_Press', 4, '8', 120), x('Close-Grip_Barbell_Bench_Press', 3, '8-10', 120), x('Barbell_Curl', 3, '10'),
        x('Side_Lateral_Raise', 4, '12-15', 60), x('Lying_Triceps_Press', 3, '10', 60), x('Incline_Dumbbell_Curl', 3, '10-12', 60),
        x('Reverse_Machine_Flyes', 3, '15', 60) ] },
      { name: 'Legs & Abs', focus: 'Quads · Hamstrings · Calves · Abs', slots: [
        x('Barbell_Squat', 4, '8', 180), x('Romanian_Deadlift', 3, '10', 120), x('Dumbbell_Lunges', 3, '10/side'),
        x('Lying_Leg_Curls', 3, '12', 60), x('Standing_Calf_Raises', 4, '15', 60), x('Cable_Crunch', 3, '15', 60) ] },
    ],
  },
  {
    id: 'phul', name: 'PHUL', tagline: 'Power and size: two heavy days, two pump days.',
    place: 'gym', level: 'intermediate', tags: ['get stronger', 'build muscle'], color: '', category: 'Strength',
    about: 'Power days use heavy weights for few reps to build strength. Hypertrophy days use moderate weights for more reps to build muscle, so each kind of training helps the other.',
    who: 'Intermediate lifters who want to get stronger and bigger at the same time.',
    why: 'Four days gives two heavy and two lighter sessions, each half of the body twice a week, with rest days to recover from the heavy work.',
    benefits: ['Strength and muscle together', 'Heavy lifts stay heavy', 'Three rest days'],
    tips: [PROTEIN, CREATINE, CARBS, CAFFEINE, SLEEP],
    week: [0, 1, null, 2, 3, null, null], weeks: 8,
    days: [
      { name: 'Upper Power', focus: 'Heavy press and row', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '3-5', 180), x('Bent_Over_Barbell_Row', 4, '3-5', 180), x('Incline_Dumbbell_Press', 3, '6-10', 120),
        x('Wide-Grip_Lat_Pulldown', 3, '6-10', 120), x('Standing_Military_Press', 2, '5-8', 120), x('Barbell_Curl', 2, '6-10'),
        x('Lying_Triceps_Press', 2, '6-10') ] },
      { name: 'Lower Power', focus: 'Heavy squat and deadlift', slots: [
        x('Barbell_Squat', 4, '3-5', 180), x('Barbell_Deadlift', 3, '3-5', 180), x('Leg_Press', 3, '10-15', 120),
        x('Lying_Leg_Curls', 3, '6-10'), x('Standing_Calf_Raises', 4, '6-10', 60) ] },
      { name: 'Upper Hypertrophy', focus: 'Moderate weight, more reps', slots: [
        x('Incline_Dumbbell_Press', 3, '8-12'), x('Seated_Cable_Rows', 3, '8-12'), x('One-Arm_Dumbbell_Row', 3, '8-12/side'),
        x('Dumbbell_Flyes', 3, '8-12', 60), x('Side_Lateral_Raise', 3, '10-12', 60), x('Incline_Dumbbell_Curl', 3, '8-12', 60),
        x('Triceps_Overhead_Extension_with_Rope', 3, '8-12', 60) ] },
      { name: 'Lower Hypertrophy', focus: 'Moderate weight, more reps', slots: [
        x('Hack_Squat', 3, '8-12', 120), x('Romanian_Deadlift', 3, '10', 120), x('Dumbbell_Lunges', 3, '10/side'),
        x('Seated_Leg_Curl', 3, '10-15', 60), x('Leg_Extensions', 3, '10-15', 60), x('Seated_Calf_Raise', 4, '10-15', 60) ] },
    ],
  },
  {
    id: 'strength-5x5', name: '5x5 Strength', tagline: 'Three lifts a day, five sets of five. Add weight every week.',
    place: 'gym', level: 'beginner', tags: ['get stronger'], color: '', category: 'Strength',
    about: 'Heavy sets of five on the squat, bench, row, press and deadlift teach your nerves and muscles to work together. Strength climbs quickly in the first months.',
    who: 'Beginners and returners who want to get strong with a barbell and like simple numbers.',
    why: 'Three days lets you squat every session and still recover between them, which is how the weights keep going up.',
    benefits: ['Fast early strength gains', 'Few exercises, easy to track', 'Builds a solid base for any sport'],
    tips: [PROTEIN, CREATINE, CARBS, SLEEP, 'Add 2.5 kg to each lift when you hit all five sets of five. Miss twice? Drop 10% and build back.'],
    week: [0, null, 1, null, 0, null, null], weeks: 12,
    days: [
      { name: 'Workout A', focus: 'Squat · Bench · Row', slots: [
        x('Barbell_Squat', 5, '5', 180), x('Barbell_Bench_Press_-_Medium_Grip', 5, '5', 180), x('Bent_Over_Barbell_Row', 5, '5', 150),
        x('Plank', 3, '30s', 60) ] },
      { name: 'Workout B', focus: 'Squat · Press · Deadlift', slots: [
        x('Barbell_Squat', 5, '5', 180), x('Standing_Military_Press', 5, '5', 150), x('Barbell_Deadlift', 1, '5', 180),
        x('Dead_Bug', 3, '10/side', 60) ] },
    ],
  },
  {
    id: 'lean-gain', name: 'Lean Weight Gain', tagline: 'Gain muscle, not just weight. Three full-body days.',
    place: 'gym', level: 'beginner', tags: ['build muscle', 'get stronger'], color: '', category: 'Muscle',
    about: 'Big lifts plus a small calorie surplus turn extra food into muscle instead of fat. You get bigger and stronger at a steady pace.',
    who: 'Slim people and hard gainers who want to put on healthy weight.',
    why: 'Three days is enough to signal growth while keeping calories and energy for building, not burning.',
    benefits: ['Healthy weight gain', 'Stronger on the big lifts', 'Low cardio, more energy to grow'],
    tips: [SURPLUS, PROTEIN, 'Add easy calories: milk, nuts, peanut butter, rice, bananas and olive oil.', CREATINE, WHEY],
    week: [0, null, 1, null, 2, null, null], weeks: 12,
    days: [
      { name: 'Gain A', focus: 'Squat · Bench · Row', slots: [
        x('Barbell_Squat', 4, '6-8', 150), x('Barbell_Bench_Press_-_Medium_Grip', 4, '6-8', 150), x('Seated_Cable_Rows', 3, '10'),
        x('Side_Lateral_Raise', 3, '12-15', 60), x('Barbell_Curl', 2, '10', 60), x('Plank', 3, '30s', 60) ] },
      { name: 'Gain B', focus: 'Hinge · Press · Pull', slots: [
        x('Romanian_Deadlift', 4, '8', 150), x('Standing_Military_Press', 3, '8', 120), x('Wide-Grip_Lat_Pulldown', 3, '10'),
        x('Incline_Dumbbell_Press', 3, '10'), x('Triceps_Pushdown', 2, '12', 60), x('Dead_Bug', 3, '10/side', 60) ] },
      { name: 'Gain C', focus: 'Legs · Chest · Back', slots: [
        x('Leg_Press', 4, '10', 120), x('Dumbbell_Bench_Press', 3, '10'), x('One-Arm_Dumbbell_Row', 3, '10/side'),
        x('Lying_Leg_Curls', 3, '12', 60), x('Hammer_Curls', 2, '12', 60), x('Standing_Calf_Raises', 3, '15', 60),
        x('Cable_Crunch', 3, '15', 60) ] },
    ],
  },
  {
    id: 'fat-loss-gym', name: 'Fat Loss Circuit', tagline: 'Weights in a circuit plus steady cardio.',
    place: 'gym', level: 'beginner', tags: ['lose fat', 'stay fit'], color: '', category: 'Fat loss',
    about: 'Lifting keeps your muscle while you eat less, and short rests keep your heart rate up. The cardio days add calorie burn without wearing out your legs.',
    who: 'Anyone who wants to lose fat in the gym and keep their shape.',
    why: 'Two circuit days and two cardio days burn plenty while leaving rest days, which stops hunger and tiredness piling up.',
    benefits: ['Keeps muscle while losing fat', 'Better fitness and stamina', 'Sessions under 45 minutes'],
    tips: [DEFICIT, PROTEIN, FIBRE, WATER, 'Do one set of each move, then the next. Rest 60-90 seconds after each round.'],
    week: [0, 2, null, 1, null, 2, null], weeks: 8,
    days: [
      { name: 'Circuit A', focus: 'Full body, short rests', slots: [
        x('Goblet_Squat', 3, '12', 30), x('Seated_Cable_Rows', 3, '12', 30), x('Dumbbell_Lunges', 3, '10/side', 30),
        x('Seated_Dumbbell_Press', 3, '12', 30), x('wg_kettlebell-swing', 3, '15', 30), x('Mountain_Climbers', 3, '30s', 60) ] },
      { name: 'Circuit B', focus: 'Full body, short rests', slots: [
        x('Stiff-Legged_Dumbbell_Deadlift', 3, '12', 30), x('Dumbbell_Bench_Press', 3, '12', 30), x('Leg_Press', 3, '15', 30),
        x('Wide-Grip_Lat_Pulldown', 3, '12', 30), x('Plank', 3, '30s', 30), x('Battling_Ropes', 3, '30s', 60) ] },
      { name: 'Steady Cardio', focus: 'Incline walk and bike', slots: [
        x('wg_treadmill-incline-walk', 1, '25 min', 60), x('Bicycling_Stationary', 1, '10 min', 60),
        x('Calf_Stretch_Hands_Against_Wall', 1, '30s', 15) ] },
    ],
  },
  {
    id: 'cardio-aerobic', name: 'Cardio & Aerobic', tagline: 'Walk, ride, row and run by the clock.',
    place: 'gym', level: 'beginner', tags: ['lose fat', 'stay fit'], color: '', category: 'Cardio',
    about: 'Easy steady work grows your heart and lung fitness, and short hard intervals raise your top gear. You recover faster and everyday life feels easier.',
    who: 'Anyone who wants a stronger heart, more stamina or to train for a first 5 km.',
    why: 'Four days mixes two easy and two harder sessions. Easy days build the base; rest days stop sore knees and shins.',
    benefits: ['Healthier heart and blood pressure', 'More stamina every day', 'Burns calories without heavy lifting'],
    tips: [WATER, CARBS, 'Easy pace means you can still talk in full sentences. Most of your cardio should feel like that.', 'Eat a meal with protein and carbs after long sessions to refuel.'],
    week: [0, 1, null, 2, null, 3, null], weeks: 8,
    days: [
      { name: 'Easy Walk', focus: 'Steady, talking pace', slots: [
        x('Walking_Treadmill', 1, '5 min', 30), x('wg_treadmill-incline-walk', 1, '25 min', 60), x('Calf_Stretch_Hands_Against_Wall', 1, '30s', 15) ] },
      { name: 'Bike Intervals', focus: '1 minute hard, 90 seconds easy', slots: [
        x('Recumbent_Bike', 1, '5 min', 30), x('Bicycling_Stationary', 8, '60s', 90), x('wg_hamstring-stretch', 1, '30s', 15) ] },
      { name: 'Row & Elliptical', focus: 'Steady row, then easy glide', slots: [
        x('Rowing_Stationary', 5, '3 min', 60), x('Elliptical_Trainer', 1, '15 min', 60), x('Kneeling_Hip_Flexor', 1, '30s/side', 15) ] },
      { name: 'Run-Walk', focus: 'Run 2 minutes, walk 1', slots: [
        x('Walking_Treadmill', 1, '5 min', 30), x('Running_Treadmill', 6, '2 min', 60), x('Calf_Stretch_Hands_Against_Wall', 1, '30s', 15) ] },
    ],
  },
  {
    id: 'functional', name: 'Functional Conditioning', tagline: 'Kettlebells, burpees, rows and boxes against the clock.',
    place: 'gym', level: 'intermediate', tags: ['lose fat', 'stay fit', 'get stronger'], color: '', category: 'Functional',
    about: 'A short strength part, then a fast workout of the day mixing lifting, jumping and rowing. You get strong, fit and quick at the same time.',
    who: 'People who like variety and intensity and already move well.',
    why: 'Three days because hard mixed sessions need about 48 hours to recover from. Daily intensity leads to injuries.',
    benefits: ['Strength and fitness together', 'Burns lots of calories', 'Never the same session twice'],
    tips: [PROTEIN, CARBS, WATER, CREATINE, 'Scale before you fail: fewer reps or a lighter bell keeps good form.'],
    week: [0, null, 1, null, 2, null, null], weeks: 6,
    days: [
      { name: 'Swing & Burpee', focus: 'Squat, then 5 fast rounds', slots: [
        x('Goblet_Squat', 3, '10', 90), x('wg_kettlebell-swing', 5, '15', 30), x('Pushups', 5, '10', 30),
        x('wg_burpee', 5, '10', 30), x('Rowing_Stationary', 5, '60s', 60) ] },
      { name: 'Box & Row', focus: 'Pull, then box and row rounds', slots: [
        x('Pullups', 4, '6-8', 120), x('Dumbbell_Step_Ups', 4, '10/side', 30), x('Plank', 3, '45s', 30),
        x('Front_Box_Jump', 4, '5', 60), x('Rowing_Stationary', 4, '90s', 60), x('wg_bear-crawl', 4, '30s', 30) ] },
      { name: 'Carry & Ropes', focus: 'Carry, then a 12-minute burner', slots: [
        x('Farmers_Walk', 4, '40s', 90), x('Goblet_Squat', 4, '12', 30), x('One-Arm_Dumbbell_Row', 4, '10/side', 30),
        x('Battling_Ropes', 4, '30s', 30), x('Mountain_Climbers', 4, '30s', 30), x('wg_jumping-jack', 4, '30s', 30) ] },
    ],
  },
  {
    id: 'glutes-legs-gym', name: 'Lower Body Sculpt', tagline: 'Glutes and legs three times, upper body twice.',
    place: 'gym', level: 'beginner', tags: ['build muscle', 'stay fit', 'lose fat'], color: '', category: 'Women',
    about: 'Hip thrusts, hinges and squats build rounder, stronger glutes and legs. Lighter upper days keep your back, shoulders and arms toned.',
    who: 'Women who want shape in the glutes and legs and a strong, balanced body.',
    why: 'Five days lets glutes and legs train three times a week with upper body twice, and two rest days.',
    benefits: ['Stronger, shapelier glutes', 'Better posture', 'Protects knees and lower back'],
    tips: [PROTEIN, CREATINE, 'Iron-rich foods like lentils, spinach, eggs and red meat help, especially around your period.', SLEEP],
    week: [0, 1, 2, null, 0, 1, null], weeks: 8,
    days: [
      { name: 'Glute Focus', focus: 'Thrust · Hinge · Kickback', slots: [
        x('Barbell_Hip_Thrust', 4, '8-10', 120), x('Romanian_Deadlift', 3, '10', 120), x('One-Legged_Cable_Kickback', 3, '12/side', 60),
        x('Thigh_Abductor', 3, '15', 60), x('Plank', 3, '30s', 60) ] },
      { name: 'Upper Tone', focus: 'Back · Shoulders · Arms', slots: [
        x('Wide-Grip_Lat_Pulldown', 3, '12'), x('Dumbbell_Shoulder_Press', 3, '10'), x('Seated_Cable_Rows', 3, '12'),
        x('Side_Lateral_Raise', 3, '15', 60), x('Triceps_Pushdown', 2, '12', 60), x('Dumbbell_Bicep_Curl', 2, '12', 60) ] },
      { name: 'Leg Day', focus: 'Quads · Glutes · Hamstrings', slots: [
        x('Goblet_Squat', 4, '10', 120), x('Leg_Press', 3, '12', 120), x('Dumbbell_Lunges', 3, '10/side'),
        x('Lying_Leg_Curls', 3, '12', 60), x('Thigh_Adductor', 2, '15', 60), x('Standing_Calf_Raises', 3, '15', 60) ] },
    ],
  },
  {
    id: 'pregnancy-safe', name: 'Pregnancy-Safe Strength', tagline: 'Standing and seated strength, walks and pelvic floor.',
    place: 'any', level: 'beginner', tags: ['stay fit'], color: '', category: 'Women',
    about: 'Gentle strength work keeps your back, hips and legs ready for the growing bump, and pelvic floor training prepares you for birth. No lying flat, no jumps and no heavy straining.',
    who: 'Pregnant women with a normal pregnancy and their doctor or midwife on board.',
    why: 'Two strength days and two walks meet the usual advice of about 150 minutes of easy activity a week, with rest in between.',
    benefits: ['Less back and hip pain', 'Better mood and sleep', 'Stronger pelvic floor for birth and after'],
    tips: [
      'Take the prenatal vitamin your doctor suggests (folic acid, iron, iodine). Ask before adding any other supplement.',
      'From the second trimester you need only about 300 extra kcal a day, about one snack, not double portions.',
      'Keep a water bottle close and drink before you feel thirsty, especially when it is warm.',
      'Eat protein at each meal: eggs, yogurt, beans, lentils, fish low in mercury or chicken.',
    ],
    week: [0, 2, null, 1, null, 2, null], weeks: 12,
    days: [
      { name: 'Strength A', focus: 'Standing squat, push and pull', slots: [
        x('Goblet_Squat', 3, '10'), x('wg_wall-push-up', 3, '10', 60), x('wg_banded-row', 3, '12', 60),
        x('Seated_Dumbbell_Press', 2, '10', 60), x('wg_banded-standing-hip-abduction', 2, '12/side', 45), x('Kegel_Long_Hold', 2, '10', 30) ] },
      { name: 'Strength B', focus: 'Seated and standing, gentle core', slots: [
        x('Plie_Dumbbell_Squat', 3, '10'), x('One-Arm_Dumbbell_Row', 3, '10/side', 60), x('Incline_Push-Up', 2, '10', 60),
        x('Side_Lateral_Raise', 2, '12', 45), x('wg_banded-pallof-press', 2, '10/side', 45), x('wg_bird-dog', 2, '8/side', 45),
        x('Kegel_Quick_Flick', 2, '10', 30) ] },
      { name: 'Walk & Breathe', focus: 'Easy walk, breathing, stretches', slots: [
        x('Walking_Treadmill', 1, '20 min', 60), x('Diaphragmatic_Breathing', 1, '6 breaths', 20), x('Kegel_Elevator', 2, '5', 30),
        x('Cat_Stretch', 2, '30s', 15), x('Calf_Stretch_Hands_Against_Wall', 1, '30s', 15) ] },
    ],
  },
  {
    id: 'after-birth', name: 'After Birth Recovery', tagline: 'Weeks 0-12: breathe, reconnect, walk, rebuild.',
    place: 'any', level: 'beginner', tags: ['stay fit'], color: '', category: 'Women',
    about: 'Breathing and pelvic floor work help your core and pelvic floor heal and switch back on. Walking and gentle core work rebuild your strength step by step.',
    who: 'New mums in the first 12 weeks after birth. After a C-section or a hard birth, wait for your doctor first.',
    why: 'Short sessions most days work better than long ones now. Ten minutes fits around feeding and sleep.',
    benefits: ['Helps the pelvic floor and core heal', 'Less leaking and back pain', 'More energy and a better mood'],
    tips: [
      'Breastfeeding uses about 400-500 kcal a day. Eat regular meals and keep water nearby when you feed.',
      'Protein and iron help you heal: eggs, lentils, meat, fish, beans and leafy greens.',
      'Keep taking your prenatal vitamin while breastfeeding if your doctor advises it.',
      'Do not diet hard now. Slow weight loss protects your milk and your energy.',
    ],
    week: [0, 1, 2, 1, 0, 1, null], weeks: 12,
    days: [
      { name: 'Breathe & Reconnect', focus: 'Breathing and pelvic floor', slots: [
        x('Diaphragmatic_Breathing', 1, '6 breaths', 20), x('Kegel_Long_Hold', 3, '10', 30), x('Kegel_Quick_Flick', 2, '10', 30),
        x('Standing_Pelvic_Tilt', 2, '10', 20), x('Reverse_Kegel', 2, '8', 20) ] },
      { name: 'Walk', focus: 'Start with 10 minutes, add 5 each week', slots: [
        x('March_In_Place', 1, '3 min', 30), x('Walking_Treadmill', 1, '15 min', 60), x('Calf_Stretch_Hands_Against_Wall', 1, '30s', 15) ] },
      { name: 'Gentle Core', focus: 'From week 6, once you feel ready', slots: [
        x('Butt_Lift_Bridge', 3, '10', 45), x('wg_clamshell', 2, '12/side', 30), x('wg_bird-dog', 2, '8/side', 30),
        x('Dead_Bug', 2, '8/side', 30), x('Kegel_Elevator', 2, '5', 30) ] },
    ],
  },
  {
    id: 'home-beginner', name: 'Beginner Full Body at Home', tagline: 'Your first workouts. A wall, a door and the floor.',
    place: 'home', level: 'beginner', tags: ['stay fit', 'lose fat', 'build muscle'], color: '', category: 'Home',
    about: 'Easy versions of squats, push-ups and rows wake up every big muscle without soreness that puts you off. Each week you get a little stronger and it feels easier.',
    who: 'Complete beginners, older adults and anyone nervous about starting.',
    why: 'Three short sessions with rest days between lets your body adapt and makes the habit stick.',
    benefits: ['No equipment needed', 'Gentle on joints', 'Builds a habit in 20 minutes'],
    tips: [PROTEIN, WATER, SLEEP, 'Too easy? Move to Home, No Equipment next.'],
    week: [0, null, 1, null, 0, null, null], weeks: 4,
    days: [
      { name: 'Home Start A', focus: 'Squat · Push · Row', slots: [
        x('Bodyweight_Squat', 2, '10', 60), x('wg_wall-push-up', 2, '10', 60), x('wg_doorway-row', 2, '10', 60),
        x('Butt_Lift_Bridge', 2, '12', 45), x('wg_calf-raise', 2, '15', 45), x('Dead_Bug', 2, '8/side', 45) ] },
      { name: 'Home Start B', focus: 'Hold · Push · Row · Core', slots: [
        x('wg_knee-push-up', 2, '8', 60), x('wg_towel-row', 2, '10', 60), x('wg_wall-sit', 2, '20s', 60),
        x('Single_Leg_Glute_Bridge', 2, '8/side', 45), x('wg_bird-dog', 2, '8/side', 45), x('Plank', 2, '20s', 45) ] },
    ],
  },
  {
    id: 'home-bodyweight', name: 'Home, No Equipment', tagline: 'Just you and the floor. Twenty-five minutes.',
    place: 'home', level: 'beginner', tags: ['stay fit', 'lose fat', 'build muscle'], color: '', category: 'Home',
    about: 'Squats, push-ups, lunges and bridges work your whole body with your own weight. You build strength and fitness without leaving the house.',
    who: 'Anyone training at home with no equipment who has done a few weeks of exercise.',
    why: 'Three days with rest between gives your muscles time to recover and still builds a steady habit.',
    benefits: ['No equipment, no travel', 'Full body in 25 minutes', 'Strength and fitness together'],
    tips: [PROTEIN, WATER, SLEEP, 'Make it harder by slowing down: 3 seconds down, 1 second up.'],
    week: [0, null, 1, null, 0, null, null], weeks: 6,
    days: [
      { name: 'Home Full Body A', focus: 'Legs · Push · Core', slots: [
        x('Bodyweight_Squat', 3, '15', 60), x('Pushups', 3, '8-12', 60), x('Bodyweight_Walking_Lunge', 3, '10/side', 60),
        x('Butt_Lift_Bridge', 3, '15', 45), x('Plank', 3, '30s', 45), x('Mountain_Climbers', 3, '30s', 45) ] },
      { name: 'Home Full Body B', focus: 'Glutes · Back · Core', slots: [
        x('Step-up_with_Knee_Raise', 3, '10/side', 60), x('Incline_Push-Up', 3, '12', 60), x('Bench_Dips', 3, '10', 60),
        x('Hyperextensions_With_No_Hyperextension_Bench', 3, '12', 45), x('Single_Leg_Glute_Bridge', 3, '10/side', 45), x('Dead_Bug', 3, '10/side', 45) ] },
    ],
  },
  {
    id: 'home-dumbbell', name: 'Home Dumbbells & Bands', tagline: 'Real strength work with a pair of dumbbells.',
    place: 'home', level: 'beginner', tags: ['build muscle', 'get stronger', 'stay fit'], color: '', category: 'Home',
    about: 'Dumbbells and a band cover every main movement, so you can build real muscle at home. Upper and lower days keep sessions short and focused.',
    who: 'Home trainers with a pair of dumbbells and a resistance band.',
    why: 'Four days trains upper and lower body twice a week each, with rest days to recover.',
    benefits: ['Gym-style results at home', 'Each muscle twice a week', 'Short, focused sessions'],
    tips: [PROTEIN, CREATINE, WHEY, 'When 12 reps feels easy, slow the lowering or get heavier dumbbells.'],
    week: [0, 1, null, 0, 1, null, null], weeks: 8,
    days: [
      { name: 'Home Upper', focus: 'Chest · Back · Shoulders · Arms', slots: [
        x('Dumbbell_Bench_Press', 3, '10'), x('One-Arm_Dumbbell_Row', 3, '10/side'), x('Dumbbell_Shoulder_Press', 3, '10'),
        x('Hammer_Curls', 3, '12', 60), x('Band_Pull_Apart', 3, '15', 45), x('Standing_Dumbbell_Triceps_Extension', 3, '12', 60) ] },
      { name: 'Home Lower', focus: 'Quads · Glutes · Hamstrings', slots: [
        x('Goblet_Squat', 4, '12'), x('Stiff-Legged_Dumbbell_Deadlift', 3, '10'), x('Split_Squat_with_Dumbbells', 3, '10/side'),
        x('Hip_Lift_with_Band', 3, '15', 45), x('Calf_Raise_On_A_Dumbbell', 3, '15', 45), x('Russian_Twist', 3, '20', 45) ] },
    ],
  },
  {
    id: 'fat-burn-home', name: 'Sweat Circuit', tagline: 'Short rests, high heart rate, anywhere.',
    place: 'home', level: 'beginner', tags: ['lose fat', 'stay fit'], color: '', category: 'Fat loss',
    about: 'Fast bodyweight moves with short rests push your heart rate up and burn calories. Core days strengthen your middle and give your legs a break.',
    who: 'People who want to lose fat at home and enjoy a sweaty session.',
    why: 'Three days: two hard circuits and one core day, with rest days so you come back fresh.',
    benefits: ['Burns calories fast', 'No equipment needed', 'Better stamina'],
    tips: [DEFICIT, PROTEIN, FIBRE, WATER],
    week: [0, null, 1, null, 0, null, null], weeks: 6,
    days: [
      { name: 'Cardio Blast', focus: 'Conditioning circuit', slots: [
        x('Pushups', 4, '30s', 30), x('Air_Bike', 4, '30s', 30), x('Freehand_Jump_Squat', 4, '30s', 30),
        x('Mountain_Climbers', 4, '30s', 30), x('Scissors_Jump', 4, '30s', 30) ] },
      { name: 'Core Burner', focus: 'Abs and obliques', slots: [
        x('Flutter_Kicks', 3, '30s', 30), x('Plank', 3, '40s', 30), x('Russian_Twist', 3, '20', 30),
        x('Leg_Pull-In', 3, '15', 30), x('Dead_Bug', 3, '10/side', 30) ] },
    ],
  },
  {
    id: 'pelvic-floor', name: 'Pelvic Floor & Kegels', tagline: 'Ten quiet minutes a day. For everyone.',
    place: 'any', level: 'beginner', tags: ['stay fit', 'desk'], color: '', category: 'Recovery',
    about: 'Squeezing and fully relaxing the pelvic floor makes these hidden muscles stronger and better controlled. That helps bladder control, core strength and sex for both women and men.',
    who: 'Everyone, especially after birth, with age, or if you sit a lot. You can do it at your desk.',
    why: 'Daily short practice works best for small muscles like these. Results show in about 6-12 weeks.',
    benefits: ['Better bladder control', 'Stronger core', 'Can be done anywhere, unseen'],
    tips: [WATER, FIBRE, 'Fibre keeps you regular, which avoids straining that weakens the pelvic floor.'],
    week: [0, 0, 0, 0, 0, 0, 0], weeks: 8,
    days: [
      { name: 'Kegel Day', focus: 'Pelvic floor strength and control', slots: [
        x('Diaphragmatic_Breathing', 1, '6 breaths', 20), x('Kegel_Long_Hold', 3, '10', 30), x('Kegel_Quick_Flick', 3, '15', 30),
        x('Kegel_Elevator', 2, '5', 30), x('Butt_Lift_Bridge', 2, '12', 45), x('Reverse_Kegel', 2, '8', 20) ] },
    ],
  },
  {
    id: 'mobility', name: 'Mobility Reset', tagline: 'Loosen hips, back and shoulders on rest days.',
    place: 'any', level: 'beginner', tags: ['stay fit'], color: '', category: 'Recovery',
    about: 'Slow stretches and movement help stiff hips, back and shoulders move freely again. Better range of motion makes your lifts feel smoother and safer.',
    who: 'Anyone who feels stiff, sits a lot or wants an easy rest-day session.',
    why: 'Three short sessions on rest days are enough to feel looser without getting in the way of training.',
    benefits: ['Less stiffness', 'Better squat and overhead positions', 'Calm, relaxing session'],
    tips: [WATER, SLEEP],
    week: [null, 0, null, 0, null, 0, null], weeks: 4,
    days: [
      { name: 'Mobility Flow', focus: 'Stretch and breathe', slots: [
        x('Cat_Stretch', 2, '30s', 15), x('Childs_Pose', 2, '30s', 15), x('Pelvic_Tilt_Into_Bridge', 2, '10', 15),
        x('IT_Band_and_Glute_Stretch', 2, '30s/side', 15), x('Calf_Stretch_Hands_Against_Wall', 2, '30s', 15) ] },
    ],
  },
  {
    id: 'desk-reset', name: 'Desk Reset', tagline: 'Five minutes at your desk, every workday.',
    place: 'any', level: 'beginner', tags: ['stay fit', 'desk', 'office'], color: '', category: 'Recovery',
    about: 'Gentle neck, back, wrist and hip moves undo the stiffness of sitting, and eye breaks rest your eyes from screens. You finish the day less sore and more awake.',
    who: 'Office workers, students and anyone at a screen for hours.',
    why: 'Every workday, because stiffness from sitting comes back daily. Five minutes is easy to fit in.',
    benefits: ['Less neck and back pain', 'Rested eyes', 'No change of clothes needed'],
    tips: [WATER, 'Stand up and move for two minutes every hour; a reminder helps.', 'Keep a fruit or nuts at your desk instead of the biscuit tin.'],
    week: [0, 0, 0, 0, 0, null, null], weeks: 4,
    days: [
      { name: 'Desk Reset', focus: 'Neck · Back · Wrists · Hips · Eyes', slots: [
        x('Desk_Neck_Tilt', 1, '5/side', 10), x('Desk_Chin_Tuck', 1, '8', 10), x('Desk_Seated_Twist', 1, '30s/side', 10),
        x('Desk_Wrist_Stretch', 1, '30s/side', 10), x('Desk_Figure_Four', 1, '30s/side', 10), x('Eye_20_20_20', 1, '20s', 10) ] },
    ],
  },
  // One muscle: add-on days for one group. Never picked as a main plan (see coach.ts).
  {
    id: 'chest-day', name: 'Chest Day', tagline: 'One session for the chest, twice a week.',
    place: 'gym', level: 'intermediate', tags: ['build muscle'], color: '', category: 'One muscle',
    about: 'Presses from flat and incline angles work the whole chest, then flyes stretch and squeeze it. Push-ups at the end use up what is left.',
    who: 'Lifters who want a bigger, stronger chest, or to bring it up next to their main plan.',
    why: 'Two sessions with two or three rest days between gives the chest work twice a week and time to recover.',
    benefits: ['Bigger, stronger chest', 'Better bench press', 'Done in about 45 minutes'],
    tips: [PROTEIN, CREATINE, SLEEP, 'Keep your shoulder blades pulled back and down on every press.'],
    week: [0, null, null, 0, null, null, null], weeks: 8,
    days: [
      { name: 'Chest Day', focus: 'Flat · Incline · Fly', slots: [
        x('Barbell_Bench_Press_-_Medium_Grip', 4, '6-8', 150), x('Incline_Dumbbell_Press', 3, '8-10', 120),
        x('Dips_-_Chest_Version', 3, '8-12'), x('Cable_Crossover', 3, '12-15', 60), x('Butterfly', 2, '12-15', 60),
        x('Pushups', 2, '10-15', 60) ] },
    ],
  },
  {
    id: 'back-day', name: 'Back Day', tagline: 'Pull-ups, rows and pulldowns for a wide, thick back.',
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger'], color: '', category: 'One muscle',
    about: 'Vertical pulls widen your back and rows thicken it. Face pulls finish the job for your rear shoulders and posture.',
    who: 'Lifters who want a stronger back and better posture.',
    why: 'Two sessions with two or three rest days between lets the back grow without sore, tired grip on the next one.',
    benefits: ['Wider, thicker back', 'Better posture', 'Stronger grip and pull-ups'],
    tips: [PROTEIN, CREATINE, SLEEP, 'Pull with your elbows, not your hands. Squeeze your shoulder blades at the top.'],
    week: [null, 0, null, null, 0, null, null], weeks: 8,
    days: [
      { name: 'Back Day', focus: 'Pull-ups · Rows · Pulldowns', slots: [
        x('Pullups', 4, '6-10', 120), x('Bent_Over_Barbell_Row', 4, '8', 120), x('Wide-Grip_Lat_Pulldown', 3, '10-12'),
        x('Seated_Cable_Rows', 3, '10-12'), x('Straight-Arm_Pulldown', 2, '12-15', 60), x('Face_Pull', 2, '15', 60) ] },
    ],
  },
  {
    id: 'shoulder-day', name: 'Shoulder Day', tagline: 'Press, then raises from every side.',
    place: 'gym', level: 'intermediate', tags: ['build muscle'], color: '', category: 'One muscle',
    about: 'A heavy press builds the whole shoulder, then raises hit the front, side and rear on their own. Rounder shoulders make your waist look smaller.',
    who: 'Lifters who want broader shoulders.',
    why: 'Two sessions with two or three rest days between. Shoulders also work in every press, so more would be too much.',
    benefits: ['Broader, rounder shoulders', 'Stronger overhead press', 'Healthier shoulder joints'],
    tips: [PROTEIN, CREATINE, SLEEP, 'Go light on raises. Slow and controlled beats heavy and swinging.'],
    week: [null, null, 0, null, null, 0, null], weeks: 8,
    days: [
      { name: 'Shoulder Day', focus: 'Front · Side · Rear', slots: [
        x('Standing_Military_Press', 4, '6-8', 150), x('Arnold_Dumbbell_Press', 3, '10', 120), x('Side_Lateral_Raise', 4, '12-15', 60),
        x('Reverse_Machine_Flyes', 3, '12-15', 60), x('Front_Dumbbell_Raise', 2, '12', 60), x('Face_Pull', 2, '15', 60) ] },
    ],
  },
  {
    id: 'arm-day', name: 'Arm Day', tagline: 'Biceps and triceps, back and forth.',
    place: 'gym', level: 'beginner', tags: ['build muscle'], color: '', category: 'One muscle',
    about: 'Triceps make up most of your upper arm, so they get the heavy press. Curls and extensions take turns, so one side rests while the other works.',
    who: 'Anyone who wants bigger, stronger arms.',
    why: 'Two sessions with two or three rest days between. Arms are small and recover fast, but they also work on chest and back days.',
    benefits: ['Bigger arms', 'Stronger presses and pulls', 'Quick, simple session'],
    tips: [PROTEIN, CREATINE, SLEEP, 'Keep your elbows still on curls and extensions. If they swing, the weight is too heavy.'],
    week: [null, null, 0, null, null, 0, null], weeks: 8,
    days: [
      { name: 'Arm Day', focus: 'Biceps · Triceps', slots: [
        x('Close-Grip_Barbell_Bench_Press', 3, '8', 120), x('Barbell_Curl', 3, '8-10'), x('EZ-Bar_Skullcrusher', 3, '10', 60),
        x('Incline_Dumbbell_Curl', 3, '10-12', 60), x('Triceps_Pushdown', 3, '12', 60), x('Hammer_Curls', 2, '12', 60) ] },
    ],
  },
  {
    id: 'leg-day', name: 'Leg Day', tagline: 'Quads, hamstrings and calves in one hard session.',
    place: 'gym', level: 'intermediate', tags: ['build muscle', 'get stronger'], color: '', category: 'One muscle',
    about: 'Squats and Romanian deadlifts load the biggest muscles you have, then machines finish each one off. Strong legs carry every other lift.',
    who: 'Lifters who want stronger, bigger legs.',
    why: 'Once a week, because a hard leg day takes several days to recover from. Add a second if you still feel fresh after four days.',
    benefits: ['Stronger, bigger legs', 'Better squat', 'Burns lots of calories'],
    tips: [PROTEIN, CREATINE, CARBS, SLEEP, 'Warm up with two light sets of squats before your working sets.'],
    week: [null, null, null, null, null, 0, null], weeks: 8,
    days: [
      { name: 'Leg Day', focus: 'Quads · Hamstrings · Calves', slots: [
        x('Barbell_Squat', 4, '6-8', 180), x('Romanian_Deadlift', 3, '8-10', 120), x('Leg_Press', 3, '10-12', 120),
        x('Lying_Leg_Curls', 3, '12', 60), x('Leg_Extensions', 3, '15', 60), x('Standing_Calf_Raises', 4, '12-15', 60) ] },
    ],
  },
  {
    id: 'glute-day', name: 'Glute Day', tagline: 'Lunges, bridges and side work. Anywhere.',
    place: 'any', level: 'beginner', tags: ['build muscle', 'stay fit'], color: '', category: 'One muscle',
    about: 'Lunges and step-ups work the glutes with your legs, then bridges and clamshells work them on their own. Stronger glutes protect your knees and lower back.',
    who: 'Anyone who wants stronger, rounder glutes, at home or in the gym.',
    why: 'Two sessions with two or three rest days between gives the glutes time to recover and grow.',
    benefits: ['Stronger, shapelier glutes', 'Less knee and back pain', 'No equipment needed'],
    tips: [PROTEIN, SLEEP, 'In the gym, swap the bridges for barbell hip thrusts and hold dumbbells on lunges and step-ups.'],
    week: [0, null, null, 0, null, null, null], weeks: 8,
    days: [
      { name: 'Glute Day', focus: 'Lunge · Bridge · Side', slots: [
        x('Bodyweight_Walking_Lunge', 3, '12/side'), x('Step-up_with_Knee_Raise', 3, '10/side'), x('Single_Leg_Glute_Bridge', 3, '12/side', 60),
        x('Hyperextensions_With_No_Hyperextension_Bench', 3, '12', 60), x('wg_clamshell', 3, '15/side', 45), x('Butt_Lift_Bridge', 2, '20', 45) ] },
    ],
  },
  {
    id: 'core-day', name: 'Core Day', tagline: 'Abs, obliques and lower back. Twenty minutes.',
    place: 'any', level: 'beginner', tags: ['stay fit', 'lose fat'], color: '', category: 'One muscle',
    about: 'Holds teach your middle to stay still under load, and crunches and twists work the abs and sides. A strong core makes every lift and carry safer.',
    who: 'Anyone who wants a stronger middle or a healthier lower back.',
    why: 'Two sessions with two or three rest days between. Your core also works in most lifts, so more is not needed.',
    benefits: ['Stronger, steadier core', 'Healthier lower back', 'No equipment needed'],
    tips: [WATER, FIBRE, 'Visible abs come from lower body fat, not more crunches. Food matters more than reps here.'],
    week: [null, 0, null, null, 0, null, null], weeks: 6,
    days: [
      { name: 'Core Day', focus: 'Hold · Crunch · Twist', slots: [
        x('Plank', 3, '45s', 45), x('Dead_Bug', 3, '10/side', 45), x('Reverse_Crunch', 3, '15', 45),
        x('Russian_Twist', 3, '20', 45), x('wg_bird-dog', 2, '8/side', 45), x('Flutter_Kicks', 2, '30s', 45) ] },
    ],
  },
];

export const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
export const perWeek = (p: Plan) => p.week.filter((d) => d !== null).length;
