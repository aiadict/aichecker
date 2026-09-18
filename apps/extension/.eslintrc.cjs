module.exports = {
  root: true,
  env: { browser: true, es2021: true, webextensions: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  settings: { react: { version: "detect" } },
  rules: {
    // TypeScript already enforces this at compile time (tsc --noEmit runs
    // as its own separate CI step) - the base JS rule just duplicates that
    // and false-positives on types/interfaces.
    "no-undef": "off",
    // Lets an intentionally-unused callback arg (e.g. a listener's event
    // object nobody needs) be named `_foo` instead of flagged.
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
};
