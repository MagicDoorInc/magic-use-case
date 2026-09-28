import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule, isFunction, nameOf } from '../createRule';

function isUseUseCaseCall(node: TSESTree.Node | null | undefined): boolean {
  return node?.type === AST_NODE_TYPES.CallExpression && nameOf(node.callee) === 'useUseCase';
}

function insideTryWithCatch(node: TSESTree.Node): boolean {
  let child: TSESTree.Node = node;
  for (let ancestor = node.parent; ancestor && !isFunction(ancestor); ancestor = ancestor.parent) {
    if (ancestor.type === AST_NODE_TYPES.TryStatement && ancestor.block === child && ancestor.handler) return true;
    child = ancestor;
  }
  return false;
}

function resultIsDiscarded(node: TSESTree.CallExpression): boolean {
  const used = node.parent?.type === AST_NODE_TYPES.AwaitExpression ? node.parent : node;
  return used.parent?.type === AST_NODE_TYPES.ExpressionStatement;
}

export const noCatchOnExecute = createRule({
  name: 'no-catch-on-execute',
  meta: {
    type: 'problem',
    docs: { description: "The execute useUseCase returns never rejects; branch on the boolean it resolves to." },
    messages: {
      catch:
        '`{{ name }}` never rejects: it resolves to false when the run failed, and the failure has already been reported. Branch on `await {{ name }}(…)` instead of catching.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const executes = new Set<string>();
    const hooks = new Set<string>();

    const isExecuteCall = (node: TSESTree.Node): node is TSESTree.CallExpression => {
      if (node.type !== AST_NODE_TYPES.CallExpression) return false;
      const { callee } = node;
      if (callee.type === AST_NODE_TYPES.Identifier) return executes.has(callee.name);
      if (callee.type !== AST_NODE_TYPES.MemberExpression || nameOf(callee) !== 'execute') return false;
      return isUseUseCaseCall(callee.object) || (callee.object.type === AST_NODE_TYPES.Identifier && hooks.has(callee.object.name));
    };

    const calledName = (node: TSESTree.CallExpression) => context.sourceCode.getText(node.callee);

    return {
      VariableDeclarator(node) {
        if (!isUseUseCaseCall(node.init)) return;
        if (node.id.type === AST_NODE_TYPES.Identifier) {
          hooks.add(node.id.name);
        } else if (node.id.type === AST_NODE_TYPES.ObjectPattern) {
          for (const property of node.id.properties) {
            if (property.type !== AST_NODE_TYPES.Property || nameOf(property.key) !== 'execute') continue;
            if (property.value.type === AST_NODE_TYPES.Identifier) executes.add(property.value.name);
          }
        }
      },
      CallExpression(node) {
        if (nameOf(node.callee) === 'catch' && node.callee.type === AST_NODE_TYPES.MemberExpression && isExecuteCall(node.callee.object)) {
          context.report({ node, messageId: 'catch', data: { name: calledName(node.callee.object) } });
          return;
        }
        if (isExecuteCall(node) && resultIsDiscarded(node) && insideTryWithCatch(node)) {
          context.report({ node, messageId: 'catch', data: { name: calledName(node) } });
        }
      },
    };
  },
});
