import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'dist/', 'out/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
  {
    files: ['src/main/**/*.js', 'src/shared/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // O preload roda em CommonJS (exigência do sandbox do Electron).
    files: ['src/preload/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
];
