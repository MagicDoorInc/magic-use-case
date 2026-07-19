import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    plugins: { import: importPlugin, 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // The adapters may only import core's public entry — never its internals.
      // Core is bundled in at build time and has no supported API surface.
      'import/no-internal-modules': [
        'error',
        { allow: ['solid-js/*', 'react/*', '**/src/**'] },
      ],
    },
  },
  prettier,
  { ignores: ['**/dist/**', '**/node_modules/**'] },
);
