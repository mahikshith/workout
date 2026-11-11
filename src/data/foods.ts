import type { Ionicons } from '@expo/vector-icons';

export type Diet = 'vegan' | 'vegetarian' | 'eggetarian' | 'pescatarian' | 'non-veg';
export type Kind = 'vegan' | 'veg' | 'egg' | 'fish' | 'meat';

const allowed: Record<Diet, Kind[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'veg'],
  eggetarian: ['vegan', 'veg', 'egg'],
  pescatarian: ['vegan', 'veg', 'egg', 'fish'],
  'non-veg': ['vegan', 'veg', 'egg', 'fish', 'meat'],
};

// Values are honest approximations per serving. shake: protein powder, left out of the best-protein picks so real food leads.
// light: filling for few calories, offered to people whose goal is to lose fat.
export type Food = { name: string; serving: string; kcal: number; protein: number; kind: Kind; icon: keyof typeof Ionicons.glyphMap; shake?: boolean; light?: boolean };

export const foods: Food[] = [
  { name: 'Oats with milk', serving: '1 bowl', kcal: 300, protein: 12, kind: 'veg', icon: 'cafe' },
  { name: 'Greek yogurt', serving: '170 g', kcal: 100, protein: 17, kind: 'veg', icon: 'ice-cream', light: true },
  { name: 'Curd / dahi', serving: '1 cup (200 g)', kcal: 120, protein: 7, kind: 'veg', icon: 'ice-cream' },
  { name: 'Milk', serving: '250 ml', kcal: 150, protein: 8, kind: 'veg', icon: 'beaker' },
  { name: 'Cottage cheese', serving: '1 cup (225 g)', kcal: 185, protein: 24, kind: 'veg', icon: 'cube' },
  { name: 'Paneer', serving: '100 g', kcal: 265, protein: 18, kind: 'veg', icon: 'cube' },
  { name: 'Low-fat paneer', serving: '100 g', kcal: 200, protein: 20, kind: 'veg', icon: 'cube' },
  { name: 'Paneer tikka', serving: '150 g', kcal: 350, protein: 24, kind: 'veg', icon: 'flame' },
  { name: 'Paneer bhurji + roti', serving: '1 plate', kcal: 450, protein: 22, kind: 'veg', icon: 'restaurant' },
  { name: 'Dal + rice', serving: '1 plate', kcal: 420, protein: 15, kind: 'vegan', icon: 'restaurant' },
  { name: 'Chole / chickpeas', serving: '1 cup', kcal: 270, protein: 14, kind: 'vegan', icon: 'leaf' },
  { name: 'Rajma', serving: '1 cup', kcal: 230, protein: 15, kind: 'vegan', icon: 'leaf' },
  { name: 'Moong dal', serving: '1 bowl', kcal: 220, protein: 12, kind: 'vegan', icon: 'restaurant' },
  { name: 'Lentil soup', serving: '1 bowl', kcal: 180, protein: 11, kind: 'vegan', icon: 'cafe' },
  { name: 'Sprouts salad', serving: '1 bowl (150 g)', kcal: 150, protein: 11, kind: 'vegan', icon: 'leaf', light: true },
  { name: 'Besan chilla', serving: '2 pieces', kcal: 240, protein: 11, kind: 'vegan', icon: 'disc' },
  { name: 'Roasted chana', serving: '30 g', kcal: 110, protein: 6, kind: 'vegan', icon: 'leaf' },
  { name: 'Tofu', serving: '150 g', kcal: 215, protein: 23, kind: 'vegan', icon: 'cube' },
  { name: 'Soya chunks', serving: '50 g dry', kcal: 170, protein: 26, kind: 'vegan', icon: 'nutrition' },
  { name: 'Tempeh', serving: '100 g', kcal: 195, protein: 20, kind: 'vegan', icon: 'cube' },
  { name: 'Seitan', serving: '100 g', kcal: 140, protein: 25, kind: 'vegan', icon: 'cube' },
  { name: 'Edamame', serving: '1 cup shelled', kcal: 190, protein: 17, kind: 'vegan', icon: 'leaf' },
  { name: 'Roti', serving: '2 pieces', kcal: 240, protein: 7, kind: 'vegan', icon: 'disc' },
  { name: 'Idli + sambar', serving: '3 idli', kcal: 300, protein: 10, kind: 'vegan', icon: 'restaurant' },
  { name: 'Peanut butter toast', serving: '2 slices', kcal: 350, protein: 13, kind: 'vegan', icon: 'fast-food' },
  { name: 'Banana', serving: '1 medium', kcal: 105, protein: 1, kind: 'vegan', icon: 'nutrition' },
  { name: 'Apple', serving: '1 medium', kcal: 95, protein: 0, kind: 'vegan', icon: 'nutrition' },
  { name: 'Mixed nuts', serving: '30 g', kcal: 175, protein: 5, kind: 'vegan', icon: 'leaf' },
  { name: 'Roasted peanuts', serving: '30 g', kcal: 170, protein: 8, kind: 'vegan', icon: 'leaf' },
  { name: 'Soy milk', serving: '250 ml', kcal: 100, protein: 8, kind: 'vegan', icon: 'beaker' },
  { name: 'Pea protein shake', serving: '1 scoop', kcal: 120, protein: 24, kind: 'vegan', icon: 'flask', shake: true },
  { name: 'Whey protein shake', serving: '1 scoop', kcal: 120, protein: 24, kind: 'veg', icon: 'flask', shake: true },
  { name: 'Salad bowl', serving: '1 bowl', kcal: 150, protein: 4, kind: 'vegan', icon: 'leaf' },
  { name: 'Cucumber', serving: '1 large (300 g)', kcal: 45, protein: 2, kind: 'vegan', icon: 'leaf', light: true },
  { name: 'Watermelon', serving: '2 cups (300 g)', kcal: 90, protein: 2, kind: 'vegan', icon: 'nutrition', light: true },
  { name: 'Berries', serving: '1 cup', kcal: 70, protein: 1, kind: 'vegan', icon: 'nutrition', light: true },
  { name: 'Clear vegetable soup', serving: '1 bowl', kcal: 60, protein: 2, kind: 'vegan', icon: 'cafe', light: true },
  { name: 'Popcorn, no butter', serving: '3 cups', kcal: 95, protein: 3, kind: 'vegan', icon: 'fast-food', light: true },
  { name: 'Buttermilk / chaas', serving: '1 glass (250 ml)', kcal: 50, protein: 3, kind: 'veg', icon: 'beaker', light: true },
  { name: 'Boiled eggs', serving: '2 eggs', kcal: 155, protein: 13, kind: 'egg', icon: 'egg' },
  { name: 'Egg whites', serving: '4 whites', kcal: 70, protein: 14, kind: 'egg', icon: 'egg', light: true },
  { name: 'Omelette', serving: '3 eggs', kcal: 280, protein: 19, kind: 'egg', icon: 'egg' },
  { name: 'Egg bhurji + roti', serving: '1 plate', kcal: 420, protein: 20, kind: 'egg', icon: 'egg' },
  { name: 'Grilled fish', serving: '150 g', kcal: 200, protein: 34, kind: 'fish', icon: 'fish' },
  { name: 'Tuna', serving: '1 can', kcal: 130, protein: 28, kind: 'fish', icon: 'fish' },
  { name: 'Prawn curry + rice', serving: '1 plate', kcal: 520, protein: 28, kind: 'fish', icon: 'fish' },
  { name: 'Chicken breast', serving: '150 g', kcal: 250, protein: 46, kind: 'meat', icon: 'flame' },
  { name: 'Chicken tikka', serving: '150 g', kcal: 240, protein: 36, kind: 'meat', icon: 'flame' },
  { name: 'Chicken curry + rice', serving: '1 plate', kcal: 600, protein: 35, kind: 'meat', icon: 'restaurant' },
  { name: 'Mutton / lamb', serving: '150 g', kcal: 375, protein: 38, kind: 'meat', icon: 'restaurant' },
  { name: 'Lean beef', serving: '150 g', kcal: 330, protein: 40, kind: 'meat', icon: 'flame' },
];

export const fits = (diet: Diet, kind: Kind) => allowed[diet].includes(kind);
export const foodsFor = (diet: Diet) => foods.filter((f) => fits(diet, f.kind));

// Most protein for the calories first. Shakes are left out so real food leads.
export const proteinPicks = (diet: Diet, n = 5) =>
  foodsFor(diet).filter((f) => !f.shake).sort((a, b) => b.protein / b.kcal - a.protein / a.kcal).slice(0, n);

// Supplements and daily habits (round 13): what people take regularly, each with a sensible default reminder time and
// one line of safe, plain guidance. `name` is the key stored in State.supplements and State.supplementReminders (the
// first two keep their old names so earlier ticks still count). Anything else the person types is a custom entry.
// strong: creatine, pre-workout and citrulline are hidden for under-18s and in pregnancy or after birth.
// caffeine: warn when the reminder is within about 6 hours of bedtime. shake: ticking it offers to log it as food.
export type Supplement = {
  name: string; short: string; dose: string; note: string; icon: keyof typeof Ionicons.glyphMap; hour: number; minute: number;
  strong?: boolean; caffeine?: boolean; shake?: boolean;
};
export const SUPPLEMENTS: Supplement[] = [
  { name: 'Whey or pea protein', short: 'Protein shake', dose: '1 scoop', icon: 'flask', hour: 17, minute: 0, shake: true,
    note: 'It is food: it counts toward your protein. Tick it and log it in one go.' },
  { name: 'Creatine monohydrate', short: 'Creatine', dose: '3 to 5 g', icon: 'fitness', hour: 9, minute: 0, strong: true,
    note: '3 to 5 g every day, any time. Taking it daily matters more than when.' },
  { name: 'Coffee or caffeine', short: 'Caffeine', dose: '1 cup', icon: 'cafe', hour: 8, minute: 0, caffeine: true,
    note: 'Stop about 6 hours before bed. Most adults stay under about 400 mg a day (around 4 cups of coffee).' },
  { name: 'Pre-workout', short: 'Pre-workout', dose: '1 scoop', icon: 'flash', hour: 17, minute: 30, caffeine: true, strong: true,
    note: 'About 30 minutes before training. It counts toward your caffeine, so skip it within about 6 hours of bed.' },
  { name: 'Multivitamin', short: 'Multivitamin', dose: '1 tablet', icon: 'medical', hour: 9, minute: 0,
    note: 'With a meal. It fills gaps; food still comes first.' },
  { name: 'Omega-3', short: 'Omega-3', dose: '1 capsule', icon: 'fish', hour: 13, minute: 0,
    note: 'With a meal that has some fat in it, so it is absorbed better.' },
  { name: 'Vitamin D', short: 'Vitamin D', dose: '1 tablet', icon: 'sunny', hour: 9, minute: 0,
    note: 'With a meal. Ask a doctor or pharmacist what dose is right for you.' },
  { name: 'Electrolytes', short: 'Electrolytes', dose: '1 sachet', icon: 'water', hour: 17, minute: 0,
    note: 'Useful on long or very sweaty sessions. Most days, water and food are enough.' },
  { name: 'Citrulline malate', short: 'Citrulline', dose: '6 to 8 g', icon: 'leaf', hour: 17, minute: 0, strong: true,
    note: 'About 45 minutes before training. Mixed evidence: some people feel less tired.' },
];
export const supplementByName = (name: string) => SUPPLEMENTS.find((x) => x.name === name);
export const shortName = (name: string) => supplementByName(name)?.short ?? name;
// The shake that fits the diet, as a food to log.
export const shakeFood = (diet: Diet) => foods.find((f) => f.shake && fits(diet, f.kind)) ?? foods.find((f) => f.shake)!;

export const BLOATING: { food: string; fix: string }[] = [
  { food: 'Beans and lentils (rajma, chole, dal)', fix: 'Soak overnight, pressure-cook, and add them to your meals slowly.' },
  { food: 'Cabbage, broccoli, cauliflower', fix: 'Cook them well. Start with smaller portions.' },
  { food: 'Onions and garlic', fix: 'Cooked is easier on the stomach than raw.' },
  { food: 'Fizzy drinks', fix: 'Have water instead.' },
  { food: 'Sugar-free sweets and some protein bars', fix: 'Sorbitol and xylitol can cause gas. Check the labels.' },
  { food: 'Milk and whey, if lactose bothers you', fix: 'Try curd, lactose-free milk or whey isolate.' },
  { food: 'Eating fast or chewing gum', fix: 'Slow down, and take a 10-minute walk after meals.' },
];
