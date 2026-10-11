// Lets CI serve the web build from GitHub Pages under /workout.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
