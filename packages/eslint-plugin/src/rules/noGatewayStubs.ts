import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule, nameOf } from '../createRule';

const GATEWAY_NAME = /Gateway$/;
const GATEWAY_PATH = /(^|\/)gateways(\/|$)/;

function isViCall(node: TSESTree.CallExpression, methods: RegExp): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.MemberExpression &&
    nameOf(node.callee.object) === 'vi' &&
    methods.test(nameOf(node.callee) ?? '')
  );
}

export const noGatewayStubs = createRule({
  name: 'no-gateway-stubs',
  meta: {
    type: 'problem',
    docs: { description: 'Tests answer the server at the network boundary; they never stub a gateway.' },
    messages: {
      stub: 'Never stub a gateway: answer the request at the network boundary, so the gateway’s parsing and mapping are tested too.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const [first] = node.arguments;
        if (!first) return;
        if (isViCall(node, /^spyOn$/)) {
          const stubbed =
            (first.type === AST_NODE_TYPES.Identifier && GATEWAY_NAME.test(first.name)) ||
            (first.type === AST_NODE_TYPES.MemberExpression &&
              GATEWAY_NAME.test(nameOf(first.object) ?? '') &&
              nameOf(first) === 'prototype');
          if (stubbed) context.report({ node, messageId: 'stub' });
        } else if (isViCall(node, /^(mock|doMock)$/)) {
          if (first.type === AST_NODE_TYPES.Literal && typeof first.value === 'string' && GATEWAY_PATH.test(first.value)) {
            context.report({ node, messageId: 'stub' });
          }
        }
      },
    };
  },
});
