import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule } from '../createRule';

type Options = [{ interface?: string; type?: string; enum?: string }];

const KINDS = {
  [AST_NODE_TYPES.TSInterfaceDeclaration]: 'interface',
  [AST_NODE_TYPES.TSTypeAliasDeclaration]: 'type',
  [AST_NODE_TYPES.TSEnumDeclaration]: 'enum',
} as const;

export const noExportedTypes = createRule<Options, 'exported'>({
  name: 'no-exported-types',
  meta: {
    type: 'suggestion',
    docs: { description: 'Keep exported interfaces, types or enums out of a module, pointing to where they belong instead.' },
    messages: { exported: '{{ message }}' },
    schema: [
      {
        type: 'object',
        properties: { interface: { type: 'string' }, type: { type: 'string' }, enum: { type: 'string' } },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [options]) {
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (!declaration || !(declaration.type in KINDS)) return;
        const kind = KINDS[declaration.type as keyof typeof KINDS];
        const message = options[kind];
        if (message && 'id' in declaration && declaration.id) context.report({ node: declaration.id, messageId: 'exported', data: { message } });
      },
    };
  },
});
