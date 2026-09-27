import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule, nameOf, USE_CASE_NAME } from '../createRule';

function insideUseCase(node: TSESTree.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (
      (ancestor.type === AST_NODE_TYPES.ClassDeclaration || ancestor.type === AST_NODE_TYPES.ClassExpression) &&
      USE_CASE_NAME.test(nameOf(ancestor.superClass) ?? '')
    ) {
      return true;
    }
  }
  return false;
}

export const noUseCaseOutsideUseCase = createRule({
  name: 'no-use-case-outside-use-case',
  meta: {
    type: 'problem',
    docs: { description: 'Only a use case constructs another use case; the UI runs them through useUseCase.' },
    messages: {
      construct:
        'Only a use case constructs another use case. Run it from the UI through useUseCase({{ name }}), or from a use case with `await new {{ name }}().execute()`.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        const name = nameOf(node.callee);
        if (!name || !USE_CASE_NAME.test(name) || insideUseCase(node)) return;
        context.report({ node, messageId: 'construct', data: { name } });
      },
    };
  },
});
