import type { TSESLint } from '@typescript-eslint/utils';
import { createRule } from '../createRule';
import { layerOfFile, readLayerSettings } from '../layers';

export const BROWSER_GLOBALS = [
  'window',
  'document',
  'location',
  'history',
  'navigator',
  'screen',
  'alert',
  'confirm',
  'prompt',
  'matchMedia',
  'requestAnimationFrame',
  'getComputedStyle',
  'indexedDB',
  'caches',
];

export const STORAGE_GLOBALS = ['localStorage', 'sessionStorage'];

export const noBrowserGlobals = createRule({
  name: 'no-browser-globals',
  meta: {
    type: 'problem',
    docs: { description: 'Use cases, presentations and gateways stay free of the browser; storage goes through a gateway.' },
    messages: {
      browser: '`{{ name }}` is a browser API. Use cases, presentations and gateways never touch it: read it in the UI and pass the value in.',
      storage: '`{{ name }}` goes through the one gateway that owns storage, so the rest of the app can be tested and run without a browser.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const settings = readLayerSettings(context.settings);
    const { layer, inSrc } = layerOfFile(settings, context.filename, context.cwd);
    if (!inSrc) return {};
    const restricted = layer === 'useCases' || layer === 'presenters' || layer === 'gateways';
    const names = restricted ? [...BROWSER_GLOBALS, ...STORAGE_GLOBALS] : STORAGE_GLOBALS;

    return {
      'Program:exit'(program) {
        const globalScope = context.sourceCode.getScope(program);
        const references: TSESLint.Scope.Reference[] = [...globalScope.through];
        for (const name of names) references.push(...(globalScope.set.get(name)?.references ?? []));
        const seen = new Set<unknown>();
        for (const reference of references) {
          const { name } = reference.identifier;
          if (!names.includes(name) || seen.has(reference.identifier)) continue;
          seen.add(reference.identifier);
          context.report({
            node: reference.identifier,
            messageId: STORAGE_GLOBALS.includes(name) ? 'storage' : 'browser',
            data: { name },
          });
        }
      },
    };
  },
});
