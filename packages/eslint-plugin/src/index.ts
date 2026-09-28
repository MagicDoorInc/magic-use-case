import type { TSESLint } from '@typescript-eslint/utils';
import { architectureConfig, baseConfig, recommendedConfig } from './configs';
import type { ArchitectureOptions } from './layers';
import { layerBoundaries } from './rules/layerBoundaries';
import { noBrowserGlobals } from './rules/noBrowserGlobals';
import { noBusinessStringLiterals } from './rules/noBusinessStringLiterals';
import { noCatchOnExecute } from './rules/noCatchOnExecute';
import { noDeepReadonly } from './rules/noDeepReadonly';
import { noDtoNames } from './rules/noDtoNames';
import { noExportedTypes } from './rules/noExportedTypes';
import { noGatewayStubs } from './rules/noGatewayStubs';
import { noLooseAssertions } from './rules/noLooseAssertions';
import { noPollingInTests } from './rules/noPollingInTests';
import { noRawJson } from './rules/noRawJson';
import { noUiFormatting } from './rules/noUiFormatting';
import { noUseCaseOutsideUseCase } from './rules/noUseCaseOutsideUseCase';
import { optionalNotUndefined } from './rules/optionalNotUndefined';
import { purePresentations } from './rules/purePresentations';

export type { ArchitectureOptions, Layer } from './layers';

const rules = {
  'no-use-case-outside-use-case': noUseCaseOutsideUseCase,
  'pure-presentations': purePresentations,
  'no-catch-on-execute': noCatchOnExecute,
  'no-deep-readonly': noDeepReadonly,
  'layer-boundaries': layerBoundaries,
  'no-browser-globals': noBrowserGlobals,
  'no-business-string-literals': noBusinessStringLiterals,
  'no-ui-formatting': noUiFormatting,
  'no-exported-types': noExportedTypes,
  'no-raw-json': noRawJson,
  'no-gateway-stubs': noGatewayStubs,
  'optional-not-undefined': optionalNotUndefined,
  'no-dto-names': noDtoNames,
  'no-loose-assertions': noLooseAssertions,
  'no-polling-in-tests': noPollingInTests,
};

interface Plugin extends TSESLint.FlatConfig.Plugin {
  rules: typeof rules;
  configs: {
    recommended: TSESLint.FlatConfig.Config;
    base: TSESLint.FlatConfig.Config[];
  };
}

const plugin: Plugin = {
  meta: { name: '@magicdoor/eslint-plugin' },
  rules,
  configs: { recommended: {}, base: [] },
};

plugin.configs.recommended = recommendedConfig(plugin);
plugin.configs.base = baseConfig(plugin);

export function architecture(options?: ArchitectureOptions): TSESLint.FlatConfig.Config[] {
  return architectureConfig(plugin, options);
}

export default plugin;
