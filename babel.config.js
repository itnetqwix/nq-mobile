/**
 * babel-preset-expo picks the right Reanimated/Worklets plugin:
 * - If `react-native-worklets` is installed → `react-native-worklets/plugin` only (Reanimated 4).
 * - Else if `react-native-reanimated` → `react-native-reanimated/plugin`.
 * Do NOT add `react-native-reanimated/plugin` here manually — it conflicts with the worklets plugin.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
