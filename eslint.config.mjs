import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  { ignores: ['dist', 'dist-electron', 'release', 'node_modules', 'projects'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.electron.json', './tsconfig.node.json']
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  // Electron main process + Vite config run in Node with CommonJS output.
  {
    files: ['electron/**/*.ts', 'vite.config.mts'],
    languageOptions: {
      globals: globals.node
    }
  },
  // Build scripts are plain CommonJS run by `node`, not bundled.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: {
      // These are `node script.cjs` entrypoints — require() is the correct
      // import mechanism there, so the TS-ESLint rule doesn't apply.
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off'
    }
  },
  // The renderer runs in a browser context.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    }
  }
];