import js from '@eslint/js';
import type { TSESLint } from '@typescript-eslint/utils';
import importPlugin from 'eslint-plugin-import';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';
import { layerSettings, SETTINGS_KEY, type ArchitectureOptions, type Layer } from './layers';

type Config = TSESLint.FlatConfig.Config;

const SOURCE_FILES = '**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TEST_FILES = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**/*.{ts,tsx}', '**/tests/**/*.{ts,tsx}'];

export const LIBRARY_RULES: Config['rules'] = {
  '@magicdoor/no-use-case-outside-use-case': 'error',
  '@magicdoor/pure-presentations': 'error',
  '@magicdoor/no-catch-on-execute': 'error',
  '@magicdoor/no-deep-readonly': 'error',
};

export function recommendedConfig(plugin: TSESLint.FlatConfig.Plugin): Config {
  return { plugins: { '@magicdoor': plugin }, rules: LIBRARY_RULES };
}

export function baseConfig(plugin: TSESLint.FlatConfig.Plugin): Config[] {
  return [
    js.configs.recommended as Config,
    ...(tseslint.configs.recommended as Config[]),
    {
      files: [SOURCE_FILES],
      plugins: {
        '@magicdoor': plugin,
        import: importPlugin as TSESLint.FlatConfig.Plugin,
        'unused-imports': unusedImports as TSESLint.FlatConfig.Plugin,
        unicorn: unicorn as TSESLint.FlatConfig.Plugin,
      },
      settings: {
        'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] },
        'import/resolver': {
          typescript: { alwaysTryTypes: true },
          node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
        },
      },
      rules: {
        'no-case-declarations': 'off',
        'no-unused-vars': 'off',
        'no-redeclare': 'off',
        'no-import-assign': 'error',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-duplicate-enum-values': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'unused-imports/no-unused-imports': 'error',
        'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
        'import/no-unresolved': ['error', { caseSensitive: true }],
        'import/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object'],
            'newlines-between': 'never',
            alphabetize: { order: 'asc' },
          },
        ],
        'unicorn/no-null': ['error', { checkStrictEquality: true }],
        '@magicdoor/optional-not-undefined': 'error',
        '@magicdoor/no-dto-names': 'error',
      },
    },
    {
      files: TEST_FILES,
      plugins: { '@magicdoor': plugin },
      rules: {
        '@magicdoor/no-loose-assertions': 'error',
        '@magicdoor/no-polling-in-tests': 'error',
      },
    },
  ];
}

export function architectureConfig(plugin: TSESLint.FlatConfig.Plugin, options: ArchitectureOptions = {}): Config[] {
  const layers = layerSettings(options);
  const filesOf = (layer: Layer) =>
    layers.folders[layer].map((folder) =>
      /\.[a-z]+$/.test(folder) ? `**/${layers.src}/${folder}` : `**/${layers.src}/${folder}/**/*.{ts,tsx}`,
    );
  const presentationTypes = layers.folders.presenters.map((folder) => `**/${layers.src}/${folder}/types/**`);

  return [
    {
      files: [`**/${layers.src}/**/*.{ts,tsx}`],
      plugins: { '@magicdoor': plugin },
      settings: { [SETTINGS_KEY]: { layers } },
      rules: {
        ...LIBRARY_RULES,
        '@magicdoor/layer-boundaries': 'error',
        '@magicdoor/no-browser-globals': 'error',
        '@magicdoor/no-business-string-literals': 'error',
      },
    },
    {
      files: filesOf('ui'),
      plugins: { '@magicdoor': plugin },
      rules: { '@magicdoor/no-ui-formatting': 'error' },
    },
    {
      files: filesOf('presenters'),
      ignores: presentationTypes,
      plugins: { '@magicdoor': plugin },
      rules: {
        '@magicdoor/no-exported-types': [
          'error',
          {
            interface: 'A view model belongs in the presenters’ types folder, one type per file named after it.',
            type: 'A view model belongs in the presenters’ types folder, one type per file named after it.',
            enum: 'A value the business enumerates belongs in a types module, not in a presentation.',
          },
        ],
      },
    },
    {
      files: filesOf('gateways'),
      plugins: { '@magicdoor': plugin },
      rules: {
        '@magicdoor/no-raw-json': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-function-return-type': 'error',
      },
    },
    {
      files: TEST_FILES,
      plugins: { '@magicdoor': plugin },
      rules: { '@magicdoor/no-gateway-stubs': 'error' },
    },
  ];
}
