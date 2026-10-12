import { postpartumWeek, pregnancyWeek } from '../calc';
import type { MealSlot, Profile } from '../store';
import { fits, type Diet, type Kind } from './foods';

export type Group = 'Fat loss' | 'Muscle gain' | 'Weight gain' | 'Pregnancy-friendly' | 'Quick and easy';
export const GROUPS: Group[] = ['Fat loss', 'Muscle gain', 'Weight gain', 'Pregnancy-friendly', 'Quick and easy'];
// [name, amount, kcal, protein g] for the whole recipe. Honest approximations; raw weights unless it says cooked.
export type Ing = [string, string, number, number];
// noPreg: protein powder or high-mercury fish, so it is left out for pregnant users.
export type Recipe = { id: string; name: string; group: Group; kind: Kind; serves: number; minutes: number; slots: MealSlot[]; why: string; ing: Ing[]; steps: string[]; noPreg?: boolean };

export const RECIPES: Recipe[] = [
  // Fat loss
  { id: 'paneer-tikka-salad', name: 'Paneer tikka salad', group: 'Fat loss', kind: 'veg', serves: 1, minutes: 20, slots: ['lunch', 'dinner'],
    why: 'Lots of protein and crunch for few calories, so it fills you up.',
    ing: [['Low-fat paneer', '100 g', 200, 20], ['Hung curd', '50 g', 50, 5], ['Capsicum and onion', '1 cup', 40, 1], ['Lettuce and cucumber', '2 cups', 25, 2], ['Oil', '1 tsp', 45, 0], ['Lemon and tikka spices', 'to taste', 5, 0]],
    steps: ['Mix the hung curd with tikka spices and a pinch of salt.', 'Cut the paneer, capsicum and onion into cubes and coat them in the curd.', 'Cook on a hot pan with the oil for 6 to 8 minutes, turning once.', 'Put it on the lettuce and cucumber, and squeeze lemon on top.'] },
  { id: 'moong-dal-chilla', name: 'Moong dal chilla', group: 'Fat loss', kind: 'vegan', serves: 2, minutes: 25, slots: ['breakfast', 'dinner'],
    why: 'A high-protein, high-fibre breakfast that keeps you full until lunch.',
    ing: [['Yellow moong dal, soaked', '100 g dry', 350, 24], ['Onion, tomato and chilli, chopped', '1 cup', 50, 2], ['Oil', '2 tsp', 90, 0], ['Mint chutney', '2 tbsp', 15, 1]],
    steps: ['Soak the dal for 3 hours or overnight, then drain.', 'Blend it with a little water, ginger and salt into a thick batter.', 'Stir in the chopped vegetables.', 'Spread a ladle of batter on a hot oiled pan and cook 2 minutes on each side.', 'Makes 4 chillas. Serve with the chutney.'] },
  { id: 'chicken-salad-bowl', name: 'Chicken salad bowl', group: 'Fat loss', kind: 'meat', serves: 1, minutes: 25, slots: ['lunch', 'dinner'],
    why: 'Lean chicken and chickpeas give lots of protein in a big, light bowl.',
    ing: [['Chicken breast', '150 g', 165, 35], ['Boiled chickpeas', '1/2 cup', 135, 7], ['Mixed salad', '2 cups', 40, 2], ['Curd and lemon dressing', '3 tbsp', 30, 2], ['Olive oil', '1 tsp', 40, 0]],
    steps: ['Rub the chicken with salt, pepper and a little oil.', 'Cook in a hot pan for 6 to 7 minutes each side until cooked through.', 'Rest for 3 minutes, then slice.', 'Toss the salad and chickpeas with the dressing and put the chicken on top.'] },
  { id: 'tofu-stir-fry', name: 'Tofu stir-fry', group: 'Fat loss', kind: 'vegan', serves: 2, minutes: 20, slots: ['lunch', 'dinner'],
    why: 'Tofu and lots of vegetables make a big plate that is light on calories.',
    ing: [['Firm tofu', '200 g', 290, 34], ['Broccoli, capsicum and beans', '2 cups', 100, 6], ['Soy sauce, garlic and ginger', '1 tbsp', 15, 1], ['Oil', '2 tsp', 90, 0]],
    steps: ['Press the tofu with a towel and cut it into cubes.', 'Fry the tofu in the oil until golden, about 6 minutes, then take it out.', 'Stir-fry the garlic, ginger and vegetables for 4 minutes.', 'Add the tofu and soy sauce back in and toss for 1 minute.'] },
  { id: 'veggie-egg-white-omelette', name: 'Veggie egg white omelette', group: 'Fat loss', kind: 'egg', serves: 1, minutes: 10, slots: ['breakfast', 'dinner'],
    why: 'Extra egg whites add protein with almost no extra calories.',
    ing: [['Whole eggs', '2', 145, 13], ['Egg whites', '3', 50, 11], ['Spinach, onion and tomato', '1 cup', 35, 2], ['Oil', '1 tsp', 45, 0], ['Wholegrain toast', '1 slice', 75, 4]],
    steps: ['Beat the eggs and whites with salt and pepper.', 'Soften the vegetables in the oil for 2 minutes.', 'Pour in the eggs and cook on low heat until set.', 'Fold and serve with the toast.'] },
  { id: 'grilled-fish-veg', name: 'Grilled fish with vegetables', group: 'Fat loss', kind: 'fish', serves: 1, minutes: 25, slots: ['lunch', 'dinner'],
    why: 'White fish is one of the leanest proteins there is.',
    ing: [['White fish fillet', '150 g', 145, 26], ['Mixed vegetables', '2 cups', 80, 4], ['Oil', '2 tsp', 90, 0], ['Lemon, garlic and herbs', 'to taste', 10, 0]],
    steps: ['Rub the fish with garlic, herbs, salt and half the oil.', 'Grill or pan-cook 4 minutes each side until it flakes easily.', 'Saute the vegetables in the rest of the oil for 5 minutes.', 'Serve with lemon.'] },
  { id: 'sprouts-chaat', name: 'Sprouts chaat', group: 'Fat loss', kind: 'vegan', serves: 1, minutes: 10, slots: ['snack', 'breakfast'],
    why: 'A crunchy, filling snack with protein and fibre.',
    ing: [['Sprouted moong', '1 cup (100 g)', 105, 7], ['Onion, tomato and cucumber', '1 cup', 40, 2], ['Roasted peanuts', '1 tbsp', 55, 3], ['Lemon and chaat masala', 'to taste', 5, 0]],
    steps: ['Steam the sprouts for 5 minutes if you like them soft.', 'Chop the vegetables small.', 'Mix everything with lemon, chaat masala and salt.'] },

  // Muscle gain
  { id: 'soya-chunk-curry', name: 'Soya chunk curry', group: 'Muscle gain', kind: 'vegan', serves: 2, minutes: 30, slots: ['lunch', 'dinner'],
    why: 'Soya chunks are one of the cheapest, richest plant proteins.',
    ing: [['Soya chunks', '100 g dry', 345, 52], ['Onion', '1 medium', 45, 1], ['Tomatoes', '2 medium', 45, 2], ['Oil', '2 tsp', 90, 0], ['Ginger, garlic and spices', 'to taste', 15, 1]],
    steps: ['Boil the soya chunks for 5 minutes, then squeeze out the water.', 'Fry the onion in the oil until golden, then add ginger and garlic.', 'Add chopped tomatoes and spices and cook until soft.', 'Add the soya chunks and a cup of water and simmer for 10 minutes.', 'Serve with rice or roti.'] },
  { id: 'chicken-rice-bowl', name: 'Chicken rice bowl', group: 'Muscle gain', kind: 'meat', serves: 1, minutes: 30, slots: ['lunch', 'dinner'],
    why: 'Protein to build muscle and rice to refuel after training.',
    ing: [['Chicken breast', '150 g', 165, 35], ['Cooked rice', '1 cup', 205, 4], ['Mixed vegetables', '1 cup', 50, 3], ['Curd', '100 g', 60, 4], ['Oil', '1 tsp', 45, 0]],
    steps: ['Cut the chicken into pieces and season with salt, chilli and turmeric.', 'Cook in the oil for 8 to 10 minutes until cooked through.', 'Add the vegetables and cook 3 more minutes.', 'Serve over the rice with the curd on the side.'] },
  { id: 'paneer-bhurji-roti', name: 'Paneer bhurji with roti', group: 'Muscle gain', kind: 'veg', serves: 1, minutes: 15, slots: ['breakfast', 'dinner'],
    why: 'Paneer gives slow-digesting protein, and roti adds energy for training.',
    ing: [['Paneer, crumbled', '100 g', 265, 18], ['Onion, tomato and capsicum', '1 cup', 50, 2], ['Oil', '1 tsp', 45, 0], ['Whole wheat roti', '2', 240, 7]],
    steps: ['Fry the onion in the oil for 2 minutes.', 'Add tomato, capsicum, turmeric and salt and cook until soft.', 'Add the paneer and stir for 2 minutes.', 'Serve with hot roti.'] },
  { id: 'overnight-oats-whey', name: 'Overnight oats with whey', group: 'Muscle gain', kind: 'veg', serves: 1, minutes: 5, slots: ['breakfast', 'snack'], noPreg: true,
    why: 'Ready in the fridge, with a big dose of protein for the morning.',
    ing: [['Rolled oats', '50 g', 190, 7], ['Milk', '200 ml', 120, 7], ['Whey protein', '1 scoop', 120, 24], ['Chia seeds', '1 tbsp', 60, 2], ['Banana', '1/2', 50, 1]],
    steps: ['Mix the oats, milk, whey and chia in a jar.', 'Close it and leave in the fridge overnight.', 'In the morning, top with sliced banana.'] },
  { id: 'egg-bhurji-wrap', name: 'Egg bhurji wrap', group: 'Muscle gain', kind: 'egg', serves: 1, minutes: 15, slots: ['breakfast', 'snack', 'dinner'],
    why: 'Three eggs give quality protein, wrapped up to eat on the go.',
    ing: [['Eggs', '3', 215, 19], ['Onion and tomato', '1/2 cup', 25, 1], ['Oil', '1 tsp', 45, 0], ['Whole wheat roti or wrap', '2', 240, 7]],
    steps: ['Fry the onion and tomato in the oil for 2 minutes.', 'Crack in the eggs with salt, turmeric and chilli.', 'Stir until fully cooked.', 'Fill the rotis and roll them up.'] },
  { id: 'fish-curry-rice', name: 'Fish curry with rice', group: 'Muscle gain', kind: 'fish', serves: 2, minutes: 35, slots: ['lunch', 'dinner'],
    why: 'Fish gives lean protein and healthy fats, and rice refuels you.',
    ing: [['Fish pieces (rohu or basa)', '300 g', 290, 52], ['Onion and tomato', '1 each', 70, 2], ['Light coconut milk', '100 ml', 70, 1], ['Oil', '1 tbsp', 120, 0], ['Cooked rice', '2 cups', 410, 8]],
    steps: ['Rub the fish with salt and turmeric.', 'Fry the onion in the oil, then add tomato and curry spices.', 'Add the coconut milk and a little water and bring to a simmer.', 'Add the fish and cook gently for 8 to 10 minutes until it flakes.', 'Serve with the rice.'] },
  { id: 'greek-yogurt-bowl', name: 'Greek yogurt protein bowl', group: 'Muscle gain', kind: 'veg', serves: 1, minutes: 5, slots: ['snack', 'breakfast'],
    why: 'A quick protein snack before or after training.',
    ing: [['Greek yogurt or hung curd', '200 g', 120, 20], ['Berries or banana', '1/2 cup', 40, 1], ['Almonds', '10', 80, 3], ['Honey', '1 tsp', 20, 0]],
    steps: ['Spoon the yogurt into a bowl.', 'Top with fruit and chopped almonds.', 'Drizzle the honey on top.'] },
  { id: 'soy-banana-shake', name: 'Soy milk banana protein shake', group: 'Muscle gain', kind: 'vegan', serves: 1, minutes: 5, slots: ['snack', 'breakfast'], noPreg: true,
    why: 'An easy plant-based shake for after training.',
    ing: [['Soy milk', '300 ml', 120, 10], ['Pea protein', '1 scoop', 120, 24], ['Banana', '1', 105, 1]],
    steps: ['Peel and break up the banana.', 'Put everything in a blender with a few ice cubes.', 'Blend for 30 seconds and drink it within an hour of training.'] },

  // Weight gain
  { id: 'peanut-banana-smoothie', name: 'Peanut banana smoothie', group: 'Weight gain', kind: 'veg', serves: 1, minutes: 5, slots: ['breakfast', 'snack'],
    why: 'A lot of good energy in one glass, easy to drink even when you are not hungry.',
    ing: [['Full-cream milk', '300 ml', 190, 10], ['Bananas', '2', 210, 3], ['Peanut butter', '2 tbsp', 190, 8], ['Oats', '30 g', 115, 4], ['Honey', '1 tbsp', 60, 0]],
    steps: ['Put everything in a blender.', 'Blend until smooth, about 1 minute.', 'Drink it between meals, not instead of one.'] },
  { id: 'dates-almond-shake', name: 'Dates, oats and almond shake', group: 'Weight gain', kind: 'vegan', serves: 1, minutes: 5, slots: ['breakfast', 'snack'],
    why: 'A plant-based shake packed with energy from dates, oats and nuts.',
    ing: [['Soy milk', '300 ml', 120, 10], ['Oats', '40 g', 150, 5], ['Dates', '4', 95, 1], ['Almonds', '15', 115, 4], ['Peanut butter', '1 tbsp', 95, 4]],
    steps: ['Soak the dates and almonds in warm water for 10 minutes.', 'Blend everything until smooth.', 'Add more milk if it is too thick.'] },
  { id: 'paneer-paratha', name: 'Paneer paratha with curd', group: 'Weight gain', kind: 'veg', serves: 1, minutes: 30, slots: ['breakfast', 'lunch'],
    why: 'Filling, energy-dense and full of protein.',
    ing: [['Whole wheat flour', '80 g', 270, 10], ['Paneer, grated', '75 g', 200, 14], ['Ghee', '2 tsp', 90, 0], ['Curd', '100 g', 60, 4]],
    steps: ['Knead the flour with water and a pinch of salt into a soft dough.', 'Mix the paneer with salt, chilli and coriander.', 'Roll out a ball of dough, put filling in the middle, fold and roll again.', 'Cook on a hot pan with ghee until golden on both sides.', 'Makes 2. Serve with the curd.'] },
  { id: 'chicken-egg-fried-rice', name: 'Chicken and egg fried rice', group: 'Weight gain', kind: 'meat', serves: 2, minutes: 25, slots: ['lunch', 'dinner'],
    why: 'Rice, chicken and eggs give lots of energy and protein in one pan.',
    ing: [['Cooked rice', '2 cups', 410, 8], ['Chicken thigh, boneless', '150 g', 180, 29], ['Eggs', '2', 145, 13], ['Mixed vegetables', '1 cup', 50, 3], ['Oil', '1 tbsp', 120, 0], ['Soy sauce', '1 tbsp', 10, 1]],
    steps: ['Cook the chicken pieces in half the oil until done, then take them out.', 'Scramble the eggs in the same pan and take them out.', 'Stir-fry the vegetables in the rest of the oil for 3 minutes.', 'Add the rice, chicken, eggs and soy sauce and toss on high heat for 3 minutes.'] },
  { id: 'rajma-chawal', name: 'Rajma chawal', group: 'Weight gain', kind: 'vegan', serves: 2, minutes: 40, slots: ['lunch', 'dinner'],
    why: 'A hearty, energy-rich plate with plant protein.',
    ing: [['Rajma, boiled', '1.5 cups', 340, 22], ['Cooked rice', '2 cups', 410, 8], ['Onion and tomato', '1 each', 70, 2], ['Oil', '1 tbsp', 120, 0]],
    steps: ['Soak the rajma overnight and pressure-cook until soft (or use canned).', 'Fry the onion in the oil, then add tomato, ginger, garlic and spices.', 'Add the rajma with some of its water and simmer for 15 minutes.', 'Mash a few beans to thicken it, and serve with the rice.'] },
  { id: 'egg-sandwich', name: 'Egg and potato sandwich', group: 'Weight gain', kind: 'egg', serves: 1, minutes: 15, slots: ['breakfast', 'snack'],
    why: 'An easy, filling snack between meals.',
    ing: [['Whole wheat bread', '4 slices', 300, 14], ['Boiled eggs', '2', 145, 13], ['Boiled potato', '1 small', 110, 3], ['Butter', '1 tsp', 35, 0]],
    steps: ['Mash the eggs and potato with salt, pepper and a little chilli.', 'Butter the bread.', 'Fill to make 2 sandwiches and toast them if you like.'] },

  // Pregnancy-friendly: no raw fish, raw eggs, unpasteurised cheese or liver.
  { id: 'palak-paneer-roti', name: 'Palak paneer with roti', group: 'Pregnancy-friendly', kind: 'veg', serves: 2, minutes: 30, slots: ['lunch', 'dinner'],
    why: 'Spinach gives iron and folate, and paneer gives protein and calcium.',
    ing: [['Spinach', '250 g', 60, 7], ['Paneer, from pasteurised milk', '150 g', 400, 27], ['Onion and tomato', '1 each', 70, 2], ['Oil', '2 tsp', 90, 0], ['Whole wheat roti', '4', 480, 14]],
    steps: ['Blanch the spinach in boiling water for 2 minutes, then blend it.', 'Fry the onion in the oil, then add tomato, ginger and spices.', 'Add the spinach and simmer for 5 minutes.', 'Add the paneer cubes and cook 3 more minutes.', 'Serve with roti.'] },
  { id: 'curd-rice', name: 'Curd rice', group: 'Pregnancy-friendly', kind: 'veg', serves: 1, minutes: 15, slots: ['lunch', 'snack', 'dinner'],
    why: 'Gentle on the stomach, with calcium and good bacteria from the curd.',
    ing: [['Cooked rice', '1.5 cups', 310, 6], ['Curd, from pasteurised milk', '200 g', 120, 7], ['Oil, mustard seeds and curry leaves', '1 tsp', 45, 0], ['Pomegranate', '2 tbsp', 25, 1], ['Cucumber, grated', '1/2', 15, 1]],
    steps: ['Mash the rice a little while it is still warm, then let it cool.', 'Mix in the curd and salt.', 'Heat the oil, add mustard seeds and curry leaves, and pour it over.', 'Top with pomegranate and cucumber.'] },
  { id: 'spinach-egg-scramble', name: 'Spinach egg scramble on toast', group: 'Pregnancy-friendly', kind: 'egg', serves: 1, minutes: 10, slots: ['breakfast', 'dinner'],
    why: 'Eggs give protein and choline, and spinach adds iron.',
    ing: [['Eggs', '2', 145, 13], ['Spinach', '1 cup', 10, 1], ['Onion and tomato', '1/2 cup', 25, 1], ['Oil', '1 tsp', 45, 0], ['Whole wheat toast', '2 slices', 150, 7]],
    steps: ['Soften the onion, tomato and spinach in the oil.', 'Add the beaten eggs.', 'Stir until the eggs are fully firm, with no runny parts.', 'Serve on the toast.'] },
  { id: 'ragi-porridge', name: 'Ragi porridge with dates', group: 'Pregnancy-friendly', kind: 'veg', serves: 1, minutes: 10, slots: ['breakfast', 'snack'],
    why: 'Ragi is rich in calcium and iron, and it is easy to eat when you feel sick.',
    ing: [['Ragi flour', '30 g', 100, 2], ['Milk', '250 ml', 150, 8], ['Dates, chopped', '2', 45, 1], ['Almonds, chopped', '6', 50, 2]],
    steps: ['Mix the ragi flour with a little cold milk so there are no lumps.', 'Add the rest of the milk and cook on low heat, stirring, for 5 to 6 minutes.', 'Top with dates and almonds.'] },
  { id: 'moong-khichdi', name: 'Moong dal khichdi', group: 'Pregnancy-friendly', kind: 'vegan', serves: 2, minutes: 30, slots: ['lunch', 'dinner'],
    why: 'Soft, warm and easy to digest, with protein from the dal.',
    ing: [['Rice', '75 g dry', 270, 5], ['Yellow moong dal', '75 g dry', 260, 18], ['Mixed vegetables', '1.5 cups', 75, 4], ['Oil or ghee', '2 tsp', 90, 0]],
    steps: ['Wash the rice and dal together.', 'Heat the oil with cumin, then add the vegetables.', 'Add the rice, dal, turmeric, salt and 4 cups of water.', 'Pressure-cook for 3 whistles, or simmer covered for 25 minutes.'] },
  { id: 'chicken-veg-stew', name: 'Chicken and vegetable stew', group: 'Pregnancy-friendly', kind: 'meat', serves: 2, minutes: 40, slots: ['lunch', 'dinner'],
    why: 'Well-cooked chicken gives protein and iron in a light, warming bowl.',
    ing: [['Chicken thigh, boneless', '200 g', 240, 39], ['Potato', '1 medium', 110, 3], ['Carrot and beans', '1 cup', 50, 2], ['Onion', '1', 45, 1], ['Oil', '2 tsp', 90, 0], ['Light coconut milk', '100 ml', 70, 1]],
    steps: ['Fry the onion in the oil with ginger and whole spices.', 'Add the chicken and brown it on all sides.', 'Add the vegetables and 1 cup of water, cover and cook for 20 minutes.', 'Stir in the coconut milk and simmer 5 minutes. Check the chicken is cooked all the way through.'] },
  { id: 'chana-fruit-bowl', name: 'Roasted chana and fruit bowl', group: 'Pregnancy-friendly', kind: 'vegan', serves: 1, minutes: 5, slots: ['snack'],
    why: 'Iron and fibre from chana, and vitamin C from fruit to help absorb it.',
    ing: [['Roasted chana', '30 g', 110, 6], ['Guava or orange', '1', 70, 2], ['Roasted peanuts', '15 g', 85, 4]],
    steps: ['Wash and cut the fruit.', 'Mix it with the chana and peanuts.', 'Add a pinch of chaat masala if you like.'] },

  // Quick and easy
  { id: 'chickpea-salad', name: 'Chickpea salad', group: 'Quick and easy', kind: 'vegan', serves: 1, minutes: 10, slots: ['lunch', 'snack'],
    why: 'No cooking, ready in minutes, with protein and fibre.',
    ing: [['Boiled chickpeas', '1 cup', 270, 15], ['Cucumber, tomato and onion', '1 cup', 40, 2], ['Olive oil', '1 tsp', 40, 0], ['Lemon and coriander', 'to taste', 5, 0]],
    steps: ['Rinse the chickpeas if canned.', 'Chop the vegetables small.', 'Mix everything with lemon, salt and pepper.'] },
  { id: 'pb-banana-toast', name: 'Peanut butter banana toast', group: 'Quick and easy', kind: 'vegan', serves: 1, minutes: 5, slots: ['breakfast', 'snack'],
    why: 'Five minutes, and it keeps you going for hours.',
    ing: [['Wholegrain bread', '2 slices', 150, 7], ['Peanut butter', '1.5 tbsp', 145, 6], ['Banana', '1', 105, 1]],
    steps: ['Toast the bread.', 'Spread the peanut butter.', 'Top with sliced banana.'] },
  { id: 'poha-peanuts', name: 'Poha with peanuts', group: 'Quick and easy', kind: 'vegan', serves: 1, minutes: 15, slots: ['breakfast', 'snack'],
    why: 'A light, quick breakfast that is easy on the stomach.',
    ing: [['Poha', '60 g', 210, 4], ['Peanuts', '15 g', 85, 4], ['Onion and peas', '1/2 cup', 60, 3], ['Oil', '1 tsp', 45, 0]],
    steps: ['Rinse the poha in a sieve and let it soften for 5 minutes.', 'Fry the peanuts in the oil, then add mustard seeds, onion and peas.', 'Add the poha, turmeric and salt and mix gently for 2 minutes.', 'Finish with lemon and coriander.'] },
  { id: 'tuna-sandwich', name: 'Tuna sandwich', group: 'Quick and easy', kind: 'fish', serves: 1, minutes: 5, slots: ['lunch', 'snack'], noPreg: true,
    why: 'Lean protein from a can in five minutes.',
    ing: [['Tuna in water, drained', '1 can', 130, 28], ['Curd', '2 tbsp', 20, 1], ['Whole wheat bread', '2 slices', 150, 7], ['Cucumber and lettuce', 'a few slices', 10, 1]],
    steps: ['Mix the tuna with the curd, salt and pepper.', 'Spread it on the bread.', 'Add cucumber and lettuce and close the sandwich.'] },
  { id: 'masala-oats-paneer', name: 'Masala oats with paneer', group: 'Quick and easy', kind: 'veg', serves: 1, minutes: 10, slots: ['breakfast', 'dinner'],
    why: 'Warm and savoury, with paneer for protein.',
    ing: [['Oats', '50 g', 190, 7], ['Paneer, cubed', '50 g', 130, 9], ['Mixed vegetables', '1/2 cup', 25, 2], ['Oil', '1 tsp', 45, 0]],
    steps: ['Saute the vegetables in the oil with cumin and spices.', 'Add the oats and 1.5 cups of water.', 'Cook for 3 to 4 minutes, stirring.', 'Stir in the paneer and serve.'] },
  { id: 'egg-chaat', name: 'Boiled egg chaat', group: 'Quick and easy', kind: 'egg', serves: 1, minutes: 12, slots: ['snack', 'breakfast'],
    why: 'A tangy snack full of protein.',
    ing: [['Eggs, hard-boiled', '3', 215, 19], ['Onion and tomato', '1/2 cup', 25, 1], ['Lemon, chaat masala and coriander', 'to taste', 5, 0]],
    steps: ['Boil the eggs for 10 minutes, then cool them in cold water.', 'Peel and cut into quarters.', 'Mix with the onion, tomato, lemon and masala.'] },
  { id: 'chicken-wrap', name: 'Leftover chicken wrap', group: 'Quick and easy', kind: 'meat', serves: 1, minutes: 5, slots: ['lunch', 'snack'],
    why: 'Turns leftover chicken into a high-protein lunch.',
    ing: [['Cooked chicken', '100 g', 165, 31], ['Whole wheat wrap', '1 large', 140, 4], ['Mint curd dip', '3 tbsp', 30, 2], ['Salad leaves and onion', 'a handful', 15, 1]],
    steps: ['Warm the wrap and the chicken.', 'Spread the dip on the wrap.', 'Add the chicken and salad and roll it up.'] },
];

export const recipeById: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const totals = (r: Recipe) => r.ing.reduce((a, x) => ({ kcal: a.kcal + x[2], protein: a.protein + x[3] }), { kcal: 0, protein: 0 });
export const perServing = (r: Recipe) => { const t = totals(r); return { kcal: Math.round(t.kcal / r.serves), protein: Math.round(t.protein / r.serves) }; };

const busy = (p: Profile) => pregnancyWeek(p) !== null || postpartumWeek(p) !== null;
export const recipesFor = (p: Profile) => RECIPES.filter((r) => fits(p.diet, r.kind) && !(r.noPreg && busy(p)));

// Which recipe group fits this person. Gentle mode never gets a fat-loss or weight-gain plan.
export function groupFor(p: Profile, gentle: boolean): Group {
  if (busy(p)) return 'Pregnancy-friendly';
  if (gentle) return 'Quick and easy';
  if (p.goal === 'lose fat') return 'Fat loss';
  if (p.goalWeightKg - p.weightKg >= 2 || p.weightKg / (p.heightCm / 100) ** 2 < 18.5) return 'Weight gain';
  if (p.goal === 'build muscle' || p.goal === 'get stronger') return 'Muscle gain';
  return 'Quick and easy';
}

// n recipes for a slot: the plan's group first, then any other recipe that fits. skip gives a second snack different picks.
export function suggest(p: Profile, group: Group, slot: MealSlot, n = 2, skip = 0) {
  const ok = recipesFor(p).filter((r) => r.slots.includes(slot));
  const safe = busy(p) ? ok.filter((r) => r.group === 'Pregnancy-friendly' || r.group === 'Quick and easy') : ok;
  const pool = [...safe.filter((r) => r.group === group), ...safe.filter((r) => r.group !== group)];
  const out = pool.slice(skip, skip + n);
  return out.length === n ? out : pool.slice(0, n);
}

const SRC: Record<Diet, string> = {
  vegan: 'tofu, soya, dal or chickpeas', vegetarian: 'paneer, curd, dal or soya', eggetarian: 'eggs, paneer, curd or dal',
  pescatarian: 'fish, eggs, paneer or dal', 'non-veg': 'chicken, eggs, fish or dal',
};
export type PlanItem = { slot: MealSlot; name: string; text: string };

// Today's meal plan from the goal, adapted to diet and to pregnancy or postpartum. No numbers, so gentle mode can show it too.
export function mealPlan(p: Profile, gentle: boolean): { group: Group; title: string; note?: string; items: PlanItem[] } {
  const group = groupFor(p, gentle), src = SRC[p.diet], vegan = p.diet === 'vegan';
  const curd = vegan ? 'soy curd' : 'curd', milk = vegan ? 'soy milk' : 'milk';
  const egg = p.diet === 'vegan' || p.diet === 'vegetarian' ? 'besan chilla' : 'a well-cooked egg';
  const it = (slot: MealSlot, name: string, text: string): PlanItem => ({ slot, name, text });
  const pw = pregnancyWeek(p);
  if (pw !== null) return {
    group, title: '3 small meals and 2 snacks',
    note: `${pw < 14 ? 'In the first months you do not need to eat more, just eat well.' : pw < 28 ? 'Now you need about one extra snack a day.' : 'Now you need about one extra small meal a day.'} Cook eggs, meat and fish well, and avoid raw fish, liver and unpasteurised cheese. Check with your doctor about your needs.`,
    items: [
      it('breakfast', 'Easy breakfast', `Something gentle if you feel sick: toast, poha, ragi or ${egg}.`),
      it('snack', 'Mid-morning snack', `Fruit, nuts, ${curd} or roasted chana. Small and often helps with nausea.`),
      it('lunch', 'Lunch', `Dal or ${src}, leafy greens for iron, and rice or roti.`),
      it('snack', 'Evening snack', `A glass of ${milk}, or a handful of nuts and dates.`),
      it('dinner', 'Light dinner', 'A well-cooked, lighter meal. Eat a couple of hours before bed if you get heartburn.'),
    ],
  };
  if (postpartumWeek(p) !== null) return {
    group, title: '3 meals and 1 snack, or more',
    note: 'If you are breastfeeding, have a glass of water each time you feed and add an extra snack. Check with your doctor about your needs.',
    items: [
      it('breakfast', 'Quick breakfast', `Something filling you can eat one-handed: oats, poha, ${egg} or a paratha.`),
      it('lunch', 'Lunch', `Dal or ${src}, vegetables, and rice or roti.`),
      it('snack', 'Snack within reach', `Nuts, fruit, ${curd} or a smoothie.`),
      it('dinner', 'Warm dinner', 'A warm, well-cooked meal like khichdi, or a curry with roti.'),
    ],
  };
  if (group === 'Fat loss') return {
    group, title: '3 meals and 1 snack',
    items: [
      it('breakfast', 'High-protein breakfast', `Start with protein: ${src}. It keeps you full until lunch.`),
      it('lunch', 'Salad-based lunch', `Half the plate salad or vegetables, some ${src}, and a little rice or 1 roti.`),
      it('snack', 'Light snack', vegan ? 'Fruit, sprouts, roasted chana or a few nuts.' : 'Fruit, sprouts, buttermilk or a few nuts.'),
      it('dinner', 'Light dinner', `Vegetables with ${src}. Keep the rice or roti small at night.`),
    ],
  };
  if (group === 'Muscle gain') return {
    group, title: '3 meals and a workout snack',
    items: [
      it('breakfast', 'Protein breakfast', `Protein first: ${src}, with oats, roti or bread.`),
      it('lunch', 'Protein lunch', `A good portion of ${src}, rice or roti, and vegetables.`),
      it('snack', 'Before or after training', `Before: a banana or toast. After: something with protein, like a shake, ${curd} or ${src.split(', ')[0]}.`),
      it('dinner', 'Protein dinner', `Protein again: ${src}, with vegetables and some rice or roti.`),
    ],
  };
  if (group === 'Weight gain') return {
    group, title: '3 meals and 2 snacks',
    items: [
      it('breakfast', 'Big breakfast', `Oats, parathas or toast, with ${milk}, peanut butter or ${src}.`),
      it('snack', 'Mid-morning snack', 'A shake or smoothie with banana, oats and peanut butter.'),
      it('lunch', 'Full lunch', `Rice and roti, dal or ${src}, and a spoon of ghee or oil.`),
      it('snack', 'Evening snack', 'Nuts, dates, a sandwich or chikki. Energy-rich and easy to eat.'),
      it('dinner', 'Full dinner', `A full plate with ${src}. Add ${curd} or a glass of ${milk} before bed.`),
    ],
  };
  return {
    group, title: '3 meals and 1 snack',
    items: [
      it('breakfast', 'Breakfast', `Something with protein, like ${src}, plus some fruit.`),
      it('lunch', 'Lunch', `Half vegetables, some ${src}, and rice or roti.`),
      it('snack', 'Snack', `Fruit, nuts, ${curd} or a small sandwich.`),
      it('dinner', 'Dinner', 'A meal like lunch, with whatever you enjoy.'),
    ],
  };
}
