import { describe } from 'vitest';
import { layerBoundaries } from '../../src/rules/layerBoundaries';
import { fileIn, tester } from './tester';

const presenter = fileIn('src/presenters/LeasePresenter.ts');
const component = fileIn('src/components/LeaseCard.tsx');
const gateway = fileIn('src/gateways/leaseGateway.ts');
const useCase = fileIn('src/use-cases/getLeasesUseCase.ts');
const types = fileIn('src/types/Lease.ts');
const util = fileIn('src/utils/date.ts');

describe('layer-boundaries', () => {
  tester.run('layer-boundaries', layerBoundaries, {
    valid: [
      { filename: component, code: `import { presentLeases } from '~/presenters/LeasePresenter';` },
      { filename: component, code: `import type { LeaseModel } from '~/presenters/LeasePresenter';` },
      { filename: component, code: `import { LeaseModel } from '~/presenters/types/LeaseModel';` },
      { filename: component, code: `import type { MainAppState } from '~/state/mainAppState';` },
      { filename: presenter, code: `import type { MainAppState } from '~/state/mainAppState';` },
      { filename: presenter, code: `import { LeaseStatus } from '~/use-cases/types/LeaseStatus';` },
      { filename: useCase, code: `import { mainAppState } from '~/state/mainAppState'; import { leaseGateway } from '~/gateways/leaseGateway';` },
      { filename: gateway, code: `import { LeaseStatus } from '~/use-cases/types/LeaseStatus'; import { Lease } from '../types/Lease';` },
      { filename: fileIn('tools/script.ts'), code: `import { leaseGateway } from '~/gateways/leaseGateway';` },
      { filename: component, code: `import { Button } from '@acme/ui/components';` },
      { filename: component, code: `import { formatDay } from '~/utils/date';` },
      { filename: component, code: `import { queryClient } from '..';` },
      { filename: types, code: `import { LeaseStatus } from './LeaseStatus';` },
    ],
    invalid: [
      { filename: component, code: `import { leaseGateway } from '~/gateways/leaseGateway';`, errors: [{ messageId: 'uiToGateway' }] },
      { filename: component, code: `import { sortLeases } from '~/presenters/LeasePresenter';`, errors: [{ messageId: 'uiToPresenter' }] },
      { filename: component, code: `import * as presenters from '~/presenters/LeasePresenter';`, errors: [{ messageId: 'uiToPresenter' }] },
      { filename: component, code: `import { mainAppState } from '~/state/mainAppState';`, errors: [{ messageId: 'toStateValue' }] },
      { filename: util, code: `import { mainAppState } from '../state/mainAppState';`, errors: [{ messageId: 'toStateValue' }] },
      { filename: presenter, code: `import { GetLeasesUseCase } from '~/use-cases/getLeasesUseCase';`, errors: [{ messageId: 'presenterToUseCase' }] },
      { filename: presenter, code: `import { leaseGateway } from '../gateways/leaseGateway';`, errors: [{ messageId: 'presenterToGateway' }] },
      { filename: presenter, code: `import { LeaseCard } from '~/components/LeaseCard';`, errors: [{ messageId: 'presenterToUi' }] },
      { filename: gateway, code: `import type { MainAppState } from '~/state/mainAppState';`, errors: [{ messageId: 'gatewayToState' }] },
      { filename: gateway, code: `import { GetLeasesUseCase } from '~/use-cases/getLeasesUseCase';`, errors: [{ messageId: 'gatewayToUseCase' }] },
      { filename: gateway, code: `import { presentLeases } from '~/presenters/LeasePresenter';`, errors: [{ messageId: 'gatewayToUi' }] },
      { filename: types, code: `export { leaseGateway } from '~/gateways/leaseGateway';`, errors: [{ messageId: 'typesToOuter' }] },
      { filename: types, code: `export * from '~/presenters/LeasePresenter';`, errors: [{ messageId: 'typesToOuter' }] },
      { filename: component, code: `const loadPresenter = () => import('~/presenters/LeasePresenter');`, errors: [{ messageId: 'uiToPresenter' }] },
      {
        filename: fileIn('src/screens/Leases.tsx'),
        settings: { '@magicdoor': { layers: { src: 'src', aliases: ['~/'], folders: { useCases: ['use-cases'], presenters: ['presenters'], gateways: ['gateways'], state: ['state'], types: ['types'], ui: ['screens'] } } } },
        code: `const load = () => import('~/gateways/leaseGateway');`,
        errors: [{ messageId: 'uiToGateway' }],
      },
    ],
  });
});
