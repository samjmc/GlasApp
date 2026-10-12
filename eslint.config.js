// ESLint (flat config). `npm run lint`.
//
// Every rule is a WARNING for now: the first run reports what is already in the code, and CI shows
// the result without failing on it. Fix the warnings, then turn the severity up (drop `warnOnly`)
// and make the CI step fail. Not type-aware on purpose (no `parserOptions.project`): `npm run check`
// is the type check, and this stays fast.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const toWarn = (setting) => (Array.isArray(setting) ? ['warn', ...setting.slice(1)] : setting === 'off' || setting === 0 ? setting : 'warn');

/** The same configs with every error turned into a warning. */
const warnOnly = (configs) =>
  configs.map((config) =>
    config.rules ? { ...config, rules: Object.fromEntries(Object.entries(config.rules).map(([rule, setting]) => [rule, toWarn(setting)])) } : config,
  );

export default [
  { ignores: ['dist/**', 'node_modules/**', 'drizzle/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'client/public/**', 'public/**'] },
  ...warnOnly([js.configs.recommended, ...tseslint.configs.recommended]),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
