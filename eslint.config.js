import js from '@eslint/js';

const browserGlobals = {
  chrome: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Intl: 'readonly',
  Date: 'readonly',
  Math: 'readonly',
  Set: 'readonly',
  Map: 'readonly'
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  URL: 'readonly'
};

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // Content script is injected as a classic script (no ES modules).
    files: ['src/content.js'],
    languageOptions: {
      sourceType: 'script'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: nodeGlobals
    }
  }
];
