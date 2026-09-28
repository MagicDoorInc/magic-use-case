import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, nameOf } from '../createRule';

const LOOSE_MATCHERS = new Set(['toBeTruthy', 'toBeFalsy', 'toBeDefined', 'toContain', 'toContainEqual', 'toMatch', 'toMatchObject']);
const LOOSE_HELPERS = new Set(['arrayContaining', 'stringContaining', 'objectContaining']);

export const noLooseAssertions = createRule({
  name: 'no-loose-assertions',
  meta: {
    type: 'suggestion',
    docs: { description: 'A test states the exact value it expects.' },
    messages: {
      loose: 'Assert the exact value: toBe or toEqual with the whole expected value, so a wrong result cannot pass.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.MemberExpression && LOOSE_MATCHERS.has(nameOf(node.callee) ?? '')) {
          context.report({ node, messageId: 'loose' });
        }
      },
      MemberExpression(node) {
        if (nameOf(node.object) === 'expect' && LOOSE_HELPERS.has(nameOf(node) ?? '')) {
          context.report({ node, messageId: 'loose' });
        }
      },
    };
  },
});
