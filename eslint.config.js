import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Every modal in this codebase seeds its form state from props in an
      // `isOpen` effect, and CLAUDE.md documents that as the pattern to follow.
      // This rule (new in eslint-plugin-react-hooks v7's React Compiler set) wants
      // remounting via a `key` prop instead — a ~20-modal refactor with real
      // regression risk in forms holding unsaved input, tracked separately on the
      // roadmap. It flagged pre-existing code, not a regression.
      'react-hooks/set-state-in-effect': 'off',

      // The codebase already uses a leading underscore to mean "bound on purpose,
      // never read" — destructure-to-drop (`const { price: _p, ...rest } = h`),
      // placeholder callback params, ignored catch bindings. Honour that convention
      // rather than rewriting the sites that rely on it.
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
])
