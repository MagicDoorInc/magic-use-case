import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule';

const WORD = /^[a-z][a-zA-Z-]*$/;

function insideTypeArguments(node: TSESTree.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === AST_NODE_TYPES.TSTypeParameterInstantiation) return true;
  }
  return false;
}

export const noBusinessStringLiterals = createRule({
  name: 'no-business-string-literals',
  meta: {
    type: 'suggestion',
    docs: { description: 'A value the business enumerates is named once, as an enum or `as const` object, not spelled out where it is compared.' },
    messages: {
      literal: 'A value the business enumerates belongs in a types module as an enum or `as const` object, so a typo is a compile error.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const isWord = (node: TSESTree.Node): node is TSESTree.StringLiteral =>
      node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string' && WORD.test(node.value);
    return {
      BinaryExpression(node) {
        if (!/^[!=]==?$/.test(node.operator) || node.left.type === AST_NODE_TYPES.UnaryExpression) return;
        for (const side of [node.left, node.right]) if (isWord(side)) context.report({ node: side, messageId: 'literal' });
      },
      SwitchCase(node) {
        if (node.test && isWord(node.test)) context.report({ node: node.test, messageId: 'literal' });
      },
      TSLiteralType(node) {
        if (
          node.parent.type === AST_NODE_TYPES.TSUnionType &&
          node.literal.type === AST_NODE_TYPES.Literal &&
          typeof node.literal.value === 'string' &&
          !insideTypeArguments(node.parent)
        ) {
          context.report({ node, messageId: 'literal' });
        }
      },
    };
  },
});
