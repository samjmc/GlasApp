// ESLint (flat config). `npm run lint`; CI fails on any error.
//
// Not type-aware on purpose (no `parserOptions.project`): `npm run check` is the type check, and
// this stays fast.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'drizzle/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'client/public/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // A field dropped with `{ field: _x, ...rest }` and a parameter a signature requires (Express's
      // four-argument error handler) are unused on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Express request fields are declared by augmenting its global namespace.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
