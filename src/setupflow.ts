// Setup's "See the full plan" opens the plan page as a preview without saving anything yet. The setup screen leaves
// its finish step here, so the preview's Start this plan finishes setup, while Back returns to the plan step.
let pending: (() => void) | null = null;
export const setSetupFinish = (fn: (() => void) | null) => { pending = fn; };
export const runSetupFinish = () => { const fn = pending; pending = null; if (fn) { fn(); return true; } return false; };
