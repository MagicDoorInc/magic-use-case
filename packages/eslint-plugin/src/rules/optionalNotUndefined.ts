import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { createRule, isFunction } from '../createRule';

type Holder = TSESTree.TSPropertySignature | TSESTree.PropertyDefinition | TSESTree.Identifier;

function holderOf(union: TSESTree.TSUnionType): Holder | undefined {
  const annotation = union.parent;
  if (annotation?.type !== AST_NODE_TYPES.TSTypeAnnotation) return undefined;
  const holder = annotation.parent;
  if (!holder) return undefined;
  if (holder.type === AST_NODE_TYPES.TSPropertySignature || holder.type === AST_NODE_TYPES.PropertyDefinition) return holder;
  if (holder.type !== AST_NODE_TYPES.Identifier) return undefined;
  const owner = holder.parent;
  if (!owner) return undefined;
  if (
    isFunction(owner) ||
    owner.type === AST_NODE_TYPES.TSParameterProperty ||
    owner.type === AST_NODE_TYPES.TSFunctionType ||
    owner.type === AST_NODE_TYPES.TSMethodSignature ||
    owner.type === AST_NODE_TYPES.TSDeclareFunction ||
    (owner.type === AST_NODE_TYPES.AssignmentPattern && owner.parent !== undefined && isFunction(owner.parent))
  ) {
    return holder;
  }
  return undefined;
}

export const optionalNotUndefined = createRule({
  name: 'optional-not-undefined',
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: { description: 'Write `name?: T`, not `name: T | undefined`.' },
    messages: {
      optional: 'Write `name?: T`, not `name: T | undefined`.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const { sourceCode } = context;
    return {
      TSUndefinedKeyword(node) {
        const union = node.parent;
        if (union?.type !== AST_NODE_TYPES.TSUnionType) return;
        const holder = holderOf(union);
        if (!holder) return;
        const fixable =
          (holder.type === AST_NODE_TYPES.TSPropertySignature ||
            (holder.type === AST_NODE_TYPES.PropertyDefinition && !holder.value)) &&
          !holder.optional &&
          !holder.computed;
        context.report({
          node,
          messageId: 'optional',
          fix: fixable
            ? (fixer): TSESLint.RuleFix[] => {
                const rest = union.types.filter((type) => type !== node).map((type) => sourceCode.getText(type));
                return [
                  fixer.insertTextAfter(holder.key, '?'),
                  fixer.replaceText(union, rest.join(' | ')),
                ];
              }
            : null,
        });
      },
    };
  },
});
