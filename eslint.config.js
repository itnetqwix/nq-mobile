// @ts-check
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    files: ["src/features/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../../theme",
              importNames: ["colors"],
              message:
                "Use useThemeColors() or useThemedStyles() for runtime theming. Static `colors` is light-only.",
            },
            {
              name: "../../../theme",
              importNames: ["colors"],
              message:
                "Use useThemeColors() or useThemedStyles() for runtime theming. Static `colors` is light-only.",
            },
            {
              name: "../../../../theme",
              importNames: ["colors"],
              message:
                "Use useThemeColors() or useThemedStyles() for runtime theming. Static `colors` is light-only.",
            },
          ],
          patterns: [
            {
              group: ["**/theme", "@/theme"],
              importNames: ["colors"],
              message:
                "Use useThemeColors() or useThemedStyles() in features. Import typography/space/radii from theme is OK.",
            },
          ],
        },
      ],
    },
  },
];
