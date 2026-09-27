import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule, isFunction, nameOf, USE_CASE_NAME } from '../createRule';

const PRESENTATION_NAME = /^present[A-Z0-9_]/;
const RUNNERS = new Set(['execute', 'useUseCase', 'usePresenter', 'createUseCase']);

function declaresPresentationType(id: TSESTree.Node): boolean {
  if (id.type !== AST_NODE_TYPES.Identifier) return false;
  const annotation = id.typeAnnotation?.typeAnnotation;
  return annotation?.type === AST_NODE_TYPES.TSTypeReference && nameOf(annotation.typeName) === 'Presentation';
}

function isPresentation(node: TSESTree.Node): boolean {
  if (!isFunction(node)) return false;
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) return PRESENTATION_NAME.test(node.id?.name ?? '');
  const parent = node.parent;
  if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return false;
  return PRESENTATION_NAME.test(nameOf(parent.id) ?? '') || declaresPresentationType(parent.id);
}

function insidePresentation(node: TSESTree.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (isPresentation(ancestor)) return true;
  }
  return false;
}

export const purePresentations = createRule({
  name: 'pure-presentations',
  meta: {
    type: 'problem',
    docs: { description: 'A presentation maps state to a model; it never runs a use case.' },
    messages: {
      run: 'A presentation only maps state to a model. `{{ name }}` belongs in a component or a use case.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const name = nameOf(node.callee);
        if (!name || !RUNNERS.has(name) || !insidePresentation(node)) return;
        context.report({ node, messageId: 'run', data: { name } });
      },
      NewExpression(node) {
        const name = nameOf(node.callee);
        if (!name || !USE_CASE_NAME.test(name) || !insidePresentation(node)) return;
        context.report({ node, messageId: 'run', data: { name: `new ${name}()` } });
      },
    };
  },
});
