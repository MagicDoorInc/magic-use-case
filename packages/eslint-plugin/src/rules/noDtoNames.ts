import type { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule';

export const noDtoNames = createRule({
  name: 'no-dto-names',
  meta: {
    type: 'suggestion',
    docs: { description: 'The app’s own types are not named after the wire format.' },
    messages: {
      dto: 'The app’s own types are not named …Dto. Declare the response shape privately in the gateway that reads it, and map it to a type named for what it is.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const check = (id: TSESTree.Identifier | null | undefined) => {
      if (id && /Dto$/.test(id.name)) context.report({ node: id, messageId: 'dto' });
    };
    return {
      TSInterfaceDeclaration: (node) => check(node.id),
      TSTypeAliasDeclaration: (node) => check(node.id),
      TSEnumDeclaration: (node) => check(node.id),
      ClassDeclaration: (node) => check(node.id),
    };
  },
});
