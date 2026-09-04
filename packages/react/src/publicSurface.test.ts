import { describe, it, expect } from 'vitest';
import * as api from './index';

/** The adapters' exports are the whole of the supported API: core is never resolvable. */
describe('the package entry', () => {
  it('exports the surface the README documents', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'ErrorHandler',
        'Navigator',
        'Presenter',
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
});
