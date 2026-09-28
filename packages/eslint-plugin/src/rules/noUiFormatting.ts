import type { TSESLint } from '@typescript-eslint/utils';
import { createRule, nameOf } from '../createRule';

const FORMATTING_METHODS = new Set(['toFixed', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']);

export const noUiFormatting = createRule({
  name: 'no-ui-formatting',
  meta: {
    type: 'suggestion',
    docs: { description: 'The UI renders what a presentation formatted; it never formats itself.' },
    messages: {
      format: 'Formatting belongs in a presentation, which hands the component a finished string.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const name = nameOf(node.callee);
        if (node.callee.type === 'MemberExpression' && name && FORMATTING_METHODS.has(name)) {
          context.report({ node, messageId: 'format' });
        }
      },
      'Program:exit'(program) {
        const globalScope = context.sourceCode.getScope(program);
        const references: TSESLint.Scope.Reference[] = [
          ...globalScope.through,
          ...(globalScope.set.get('Intl')?.references ?? []),
        ];
        const seen = new Set<unknown>();
        for (const reference of references) {
          if (reference.identifier.name !== 'Intl' || seen.has(reference.identifier)) continue;
          seen.add(reference.identifier);
          context.report({ node: reference.identifier, messageId: 'format' });
        }
      },
    };
  },
});
