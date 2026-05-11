const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.js"],
  },

  // Base JS rules (for config files, etc.)
  {
    files: ["**/*.{js,cjs,mjs}"],
    ...js.configs.recommended,
  },

  // TypeScript rules (non-type-aware), only for src/**/*.ts
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["src/**/*.ts"],
  })),

  // Prettier compatibility (turn off stylistic rules)
  eslintConfigPrettier,

  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
