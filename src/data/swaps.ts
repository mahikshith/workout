// Ingredient swaps for allergies, diet or an empty cupboard. Matched on words in the ingredient name.
const SWAPS: [RegExp, string][] = [
  [/paneer/i, 'tofu, or soya chunks (dairy-free); chicken if you eat meat'],
  [/tofu/i, 'paneer, or chickpeas (soy allergy)'],
  [/curd|yogh?urt/i, 'plant yogurt (dairy-free), or skip and add a squeeze of lemon'],
  [/milk/i, 'soy or oat milk (dairy-free); almond milk is lighter but has less protein'],
  [/egg white/i, 'more whole eggs, or crumbled tofu (egg-free)'],
  [/\beggs?\b/i, 'tofu scramble or besan batter (egg-free)'],
  [/chicken/i, 'paneer, tofu or soya chunks (vegetarian); fish works too'],
  [/fish|salmon|tuna/i, 'chicken, or chickpeas and tofu (vegetarian)'],
  [/peanut/i, 'sunflower or pumpkin seeds (nut allergy)'],
  [/almond|cashew|walnut|nut butter/i, 'sunflower or pumpkin seeds (nut allergy)'],
  [/whey|protein powder/i, 'pea protein (dairy-free), or a cup of Greek yogurt'],
  [/oats/i, 'quinoa flakes or millet (gluten-free if you need it)'],
  [/bread|toast|roti|wrap|tortilla|paratha/i, 'gluten-free bread or a millet roti'],
  [/rice/i, 'quinoa, millet or cauliflower rice (lighter)'],
  [/pasta|noodle/i, 'whole-wheat or lentil pasta, or zucchini noodles'],
  [/cheese/i, 'nutritional yeast or a dairy-free cheese'],
  [/butter|ghee/i, 'olive or rapeseed oil'],
  [/honey|sugar|jaggery/i, 'a few dates, or leave it out'],
  [/soy sauce/i, 'coconut aminos (soy-free)'],
];

export const swapFor = (ingredient: string) => SWAPS.find(([re]) => re.test(ingredient))?.[1] ?? null;
