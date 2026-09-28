import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule, nameOf } from '../createRule';

function isJsonCall(node: TSESTree.Node | null | undefined): node is TSESTree.CallExpression {
  return node?.type === AST_NODE_TYPES.CallExpression && node.callee.type === AST_NODE_TYPES.MemberExpression && nameOf(node.callee) === 'json';
}

export const noRawJson = createRule({
  name: 'no-raw-json',
  meta: {
    type: 'problem',
    docs: { description: 'A gateway types each response privately and maps it to the app’s own types before returning.' },
    messages: {
      returned: 'Parse the response into its private JSON type and map it to the app’s own type before returning it.',
      untyped: 'Annotate the parsed response with its private JSON type.',
      exported: 'A response shape stays private to the gateway that reads it.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (!isJsonCall(node)) return;
        const parent = node.parent;
        const awaited = parent.type === AST_NODE_TYPES.AwaitExpression ? parent : undefined;
        const holder = awaited ? awaited.parent : parent;
        if (parent.type === AST_NODE_TYPES.ReturnStatement || (awaited && holder?.type === AST_NODE_TYPES.ReturnStatement)) {
          context.report({ node, messageId: 'returned' });
        } else if (parent.type === AST_NODE_TYPES.ArrowFunctionExpression && parent.body === node) {
          context.report({ node, messageId: 'returned' });
        } else if (
          awaited &&
          holder?.type === AST_NODE_TYPES.VariableDeclarator &&
          holder.id.type === AST_NODE_TYPES.Identifier &&
          !holder.id.typeAnnotation
        ) {
          context.report({ node, messageId: 'untyped' });
        }
      },
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (
          (declaration?.type === AST_NODE_TYPES.TSInterfaceDeclaration || declaration?.type === AST_NODE_TYPES.TSTypeAliasDeclaration) &&
          /Json$/.test(declaration.id.name)
        ) {
          context.report({ node: declaration.id, messageId: 'exported' });
        }
      },
    };
  },
});
