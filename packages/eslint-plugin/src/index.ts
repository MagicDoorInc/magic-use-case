import { noCatchOnExecute } from './rules/noCatchOnExecute';
import { noDeepReadonly } from './rules/noDeepReadonly';
import { noUseCaseOutsideUseCase } from './rules/noUseCaseOutsideUseCase';
import { purePresentations } from './rules/purePresentations';

const rules = {
  'no-use-case-outside-use-case': noUseCaseOutsideUseCase,
  'pure-presentations': purePresentations,
  'no-catch-on-execute': noCatchOnExecute,
  'no-deep-readonly': noDeepReadonly,
};

const plugin = {
  meta: { name: '@magicdoor/eslint-plugin-magic-use-case' },
  rules,
  configs: {} as Record<string, unknown>,
};

plugin.configs.recommended = {
  plugins: { 'magic-use-case': plugin },
  rules: {
    'magic-use-case/no-use-case-outside-use-case': 'error',
    'magic-use-case/pure-presentations': 'error',
    'magic-use-case/no-catch-on-execute': 'error',
    'magic-use-case/no-deep-readonly': 'error',
  },
};

export default plugin;
