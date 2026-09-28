import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, nameOf } from '../createRule';

export const noPollingInTests = createRule({
  name: 'no-polling-in-tests',
  meta: {
    type: 'suggestion',
    docs: { description: 'A test moves time forward itself instead of polling until something happens.' },
    messages: {
      poll: 'Advance a fake clock instead of polling: vi.useFakeTimers() and await vi.advanceTimersByTimeAsync(…).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          nameOf(node.callee.object) === 'vi' &&
          /^(waitFor|waitUntil)$/.test(nameOf(node.callee) ?? '')
        ) {
          context.report({ node, messageId: 'poll' });
        }
      },
    };
  },
});
