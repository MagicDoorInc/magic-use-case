import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule';
import { layerOfFile, layerOfImport, readLayerSettings, type Layer } from '../layers';

type MessageId =
  | 'uiToGateway'
  | 'uiToPresenter'
  | 'toStateValue'
  | 'presenterToUseCase'
  | 'presenterToGateway'
  | 'presenterToUi'
  | 'gatewayToState'
  | 'gatewayToUseCase'
  | 'gatewayToUi'
  | 'typesToOuter';

const PRESENTATION_NAME = /^present/;

type ImportLike = TSESTree.ImportDeclaration | TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ImportExpression;

function valueNames(node: TSESTree.ImportDeclaration): (string | undefined)[] {
  return node.specifiers
    .filter((specifier) => !(specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type'))
    .map((specifier) =>
      specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.imported.type === AST_NODE_TYPES.Identifier
        ? specifier.imported.name
        : undefined,
    );
}

function isTypeOnly(node: ImportLike): boolean {
  if (node.type === AST_NODE_TYPES.ImportExpression) return false;
  if (node.type === AST_NODE_TYPES.ImportDeclaration) {
    return node.importKind === 'type' || (node.specifiers.length > 0 && valueNames(node).length === 0);
  }
  return node.exportKind === 'type';
}

export const layerBoundaries = createRule<[], MessageId>({
  name: 'layer-boundaries',
  meta: {
    type: 'problem',
    docs: { description: 'Each layer imports only what it may: the UI asks use cases and presentations, presentations read state, gateways talk to the server.' },
    messages: {
      uiToGateway: 'The UI never touches a gateway. Run a use case for behaviour and read state through a presentation.',
      uiToPresenter: 'The UI reads state only through usePresenter(present…): import presentation functions or types from here, nothing else.',
      toStateValue: 'Only use cases write application state. Import its types here, and read it through a presentation or receive it as a parameter.',
      presenterToUseCase: 'A presentation only reads state; it never runs a use case.',
      presenterToGateway: 'A presentation never touches a gateway; it maps state that a use case has already fetched.',
      presenterToUi: 'A presentation does not depend on the UI.',
      gatewayToState: 'A gateway never reads or writes application state; it returns data to the use case that called it.',
      gatewayToUseCase: 'A gateway never runs a use case.',
      gatewayToUi: 'A gateway never touches the UI or a presentation.',
      typesToOuter: 'Types and entities are the innermost layer: they do not depend on presentations or gateways.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const settings = readLayerSettings(context.settings);
    const { layer: from, inSrc } = layerOfFile(settings, context.filename, context.cwd);
    if (!inSrc) return {};

    const check = (node: ImportLike, source: string) => {
      const target = layerOfImport(settings, source, context.filename, context.cwd);
      if (!target) return;
      const to: Layer = target.layer;
      const typeOnly = isTypeOnly(node);
      const intoTypesFolder = target.rest[0] === 'types';
      const report = (messageId: MessageId) => context.report({ node, messageId });

      switch (from) {
        case 'useCases':
        case 'state':
          return;
        case 'gateways':
          if (to === 'state') return report('gatewayToState');
          if (to === 'useCases' && !intoTypesFolder) return report('gatewayToUseCase');
          if (to === 'ui' || to === 'presenters') return report('gatewayToUi');
          return;
        case 'presenters':
          if (to === 'useCases' && !intoTypesFolder) return report('presenterToUseCase');
          if (to === 'gateways') return report('presenterToGateway');
          if (to === 'ui') return report('presenterToUi');
          break;
        case 'ui':
          if (to === 'gateways') return report('uiToGateway');
          if (to === 'presenters' && !intoTypesFolder && !typeOnly) {
            const names = node.type === AST_NODE_TYPES.ImportDeclaration ? valueNames(node) : [undefined];
            if (names.some((name) => !name || !PRESENTATION_NAME.test(name))) return report('uiToPresenter');
          }
          break;
        case 'types':
          if (to === 'presenters' || to === 'gateways') return report('typesToOuter');
          break;
      }
      if (to === 'state' && !typeOnly) report('toStateValue');
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === AST_NODE_TYPES.Literal && typeof node.source.value === 'string') check(node, node.source.value);
      },
    };
  },
});
