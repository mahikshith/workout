// Exercises whose movement data did not look right on the 3D figure when every distinct movement was checked on picture
// sheets (scripts/anatomy3d/sheet.cjs). They keep their animation, photo and video until the movement is fixed.
export const NO_3D = new Set<string>([
  'wg_swimming', 'Skating', // shown as running on the spot
  'Cable_Incline_Pushdown', // shown lying flat, the bench should be inclined
  'Sled_Row', 'Suspended_Row', 'Bodyweight_Mid_Row', // shown leaning on a wall that is not part of the exercise
]);
