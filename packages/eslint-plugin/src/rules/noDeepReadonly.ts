import { createRule, nameOf } from '../createRule';

export const noDeepReadonly = createRule({
  name: 'no-deep-readonly',
  meta: {
    type: 'suggestion',
    docs: { description: 'Type a model by its view model type, not by DeepReadonly.' },
    messages: {
      deepReadonly:
        'Do not reach for DeepReadonly. A model from usePresenter is already readonly: type a prop by its view model type (the Presentable… type the presentation returns), or let it be inferred.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportSpecifier(node) {
        if (nameOf(node.imported) === 'DeepReadonly') context.report({ node, messageId: 'deepReadonly' });
      },
      TSTypeReference(node) {
        if (nameOf(node.typeName) === 'DeepReadonly') context.report({ node, messageId: 'deepReadonly' });
      },
      TSTypeAliasDeclaration(node) {
        if (node.id.name === 'DeepReadonly') context.report({ node: node.id, messageId: 'deepReadonly' });
      },
    };
  },
});
