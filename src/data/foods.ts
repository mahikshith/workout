export type Diet = 'vegan' | 'vegetarian' | 'eggetarian' | 'pescatarian' | 'non-veg';
type Kind = 'vegan' | 'veg' | 'egg' | 'fish' | 'meat';

const allowed: Record<Diet, Kind[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'veg'],
  eggetarian: ['vegan', 'veg', 'egg'],
  pescatarian: ['vegan', 'veg', 'egg', 'fish'],
  'non-veg': ['vegan', 'veg', 'egg', 'fish', 'meat'],
};

export type Food = { name: string; serving: string; kcal: number; protein: number; kind: Kind; emoji: string };

export const foods: Food[] = [
  { name: 'Oats with milk', serving: '1 bowl', kcal: 300, protein: 12, kind: 'veg', emoji: '🥣' },
  { name: 'Greek yogurt', serving: '170 g', kcal: 100, protein: 17, kind: 'veg', emoji: '🥛' },
  { name: 'Paneer', serving: '100 g', kcal: 265, protein: 18, kind: 'veg', emoji: '🧀' },
  { name: 'Dal + rice', serving: '1 plate', kcal: 420, protein: 15, kind: 'vegan', emoji: '🍛' },
  { name: 'Chole / chickpeas', serving: '1 cup', kcal: 270, protein: 14, kind: 'vegan', emoji: '🫘' },
  { name: 'Rajma', serving: '1 cup', kcal: 230, protein: 15, kind: 'vegan', emoji: '🫘' },
  { name: 'Tofu', serving: '150 g', kcal: 215, protein: 23, kind: 'vegan', emoji: '🍢' },
  { name: 'Soya chunks', serving: '50 g dry', kcal: 170, protein: 26, kind: 'vegan', emoji: '🥘' },
  { name: 'Roti', serving: '2 pieces', kcal: 240, protein: 7, kind: 'vegan', emoji: '🫓' },
  { name: 'Idli + sambar', serving: '3 idli', kcal: 300, protein: 10, kind: 'vegan', emoji: '🍚' },
  { name: 'Peanut butter toast', serving: '2 slices', kcal: 350, protein: 13, kind: 'vegan', emoji: '🥜' },
  { name: 'Banana', serving: '1 medium', kcal: 105, protein: 1, kind: 'vegan', emoji: '🍌' },
  { name: 'Apple', serving: '1 medium', kcal: 95, protein: 0, kind: 'vegan', emoji: '🍎' },
  { name: 'Mixed nuts', serving: '30 g', kcal: 175, protein: 5, kind: 'vegan', emoji: '🌰' },
  { name: 'Soy milk', serving: '250 ml', kcal: 100, protein: 8, kind: 'vegan', emoji: '🥛' },
  { name: 'Pea protein shake', serving: '1 scoop', kcal: 120, protein: 24, kind: 'vegan', emoji: '🥤' },
  { name: 'Whey protein shake', serving: '1 scoop', kcal: 120, protein: 24, kind: 'veg', emoji: '🥤' },
  { name: 'Salad bowl', serving: '1 bowl', kcal: 150, protein: 4, kind: 'vegan', emoji: '🥗' },
  { name: 'Boiled eggs', serving: '2 eggs', kcal: 155, protein: 13, kind: 'egg', emoji: '🥚' },
  { name: 'Omelette', serving: '3 eggs', kcal: 280, protein: 19, kind: 'egg', emoji: '🍳' },
  { name: 'Egg bhurji + roti', serving: '1 plate', kcal: 420, protein: 20, kind: 'egg', emoji: '🍳' },
  { name: 'Grilled fish', serving: '150 g', kcal: 200, protein: 34, kind: 'fish', emoji: '🐟' },
  { name: 'Tuna', serving: '1 can', kcal: 130, protein: 28, kind: 'fish', emoji: '🐟' },
  { name: 'Prawn curry + rice', serving: '1 plate', kcal: 520, protein: 28, kind: 'fish', emoji: '🍤' },
  { name: 'Chicken breast', serving: '150 g', kcal: 250, protein: 46, kind: 'meat', emoji: '🍗' },
  { name: 'Chicken curry + rice', serving: '1 plate', kcal: 600, protein: 35, kind: 'meat', emoji: '🍛' },
  { name: 'Mutton / lamb', serving: '150 g', kcal: 375, protein: 38, kind: 'meat', emoji: '🥩' },
  { name: 'Lean beef', serving: '150 g', kcal: 330, protein: 40, kind: 'meat', emoji: '🥩' },
];

export const foodsFor = (diet: Diet) => foods.filter((f) => allowed[diet].includes(f.kind));
