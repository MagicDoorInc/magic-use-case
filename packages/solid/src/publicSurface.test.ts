import { describe, it, expect } from 'vitest';
import * as api from './index';
import * as serverApi from './server';

/** The adapters' exports are the whole of the supported API: core is never resolvable. */
describe('the package entry', () => {
  it('exports the surface the README documents', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'ErrorHandler',
        'Navigator',
        'Presenter',
        'StateTransfer',
        'UseCase',
        'createScope',
        'onError',
        'onNavigation',
        'setScopeResolver',
        'usePresenter',
        'useUseCase',
      ].sort()
    );
  });

  it('exports the same surface from the server build, which one set of types describes', async () => {
    expect(Object.keys(serverApi).sort()).toEqual(Object.keys(api).sort());
  });
});
