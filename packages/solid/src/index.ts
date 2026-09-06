import { setScopeResolver, type Presentation } from '@magicdoor/magic-use-case-core';
import { isServer } from 'solid-js/web';
import { usePresenter as presenterForPresentation } from './hooks/usePresenter';
import { resolveServerScope } from './serverScope';

// A browser runs one process per user, so the single shared scope is correct
// there. A server process serves many users at once, so each request resolves
// its own. `isServer` is false in the client build, which is what leaves the
// browser on the shared scope.
if (isServer) {
  setScopeResolver(resolveServerScope);
}

export { UseCase, Presenter } from '@magicdoor/magic-use-case-core';
export type { DeepReadonly, Presentation } from '@magicdoor/magic-use-case-core';
export { createScope, setScopeResolver } from '@magicdoor/magic-use-case-core';
export { onError, onNavigation } from '@magicdoor/magic-use-case-core';
export { useUseCase } from './hooks/useUseCase';
export { ErrorHandler } from './ui/ErrorHandler';
export { Navigator } from './ui/Navigator';

/**
 * Augmented by the application to name the type its use cases keep state in:
 *
 *     declare module '@magicdoor/magic-use-case-solid' {
 *       interface MagicUseCaseTypes {
 *         state: MyAppState;
 *       }
 *     }
 *
 * Until an application does, presentations go unchecked, which is how one can
 * declare a state type the application never emits and fail only at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MagicUseCaseTypes {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApplicationState = MagicUseCaseTypes extends { state: infer TState } ? TState : any;

/**
 * Declared here rather than re-exported, so an application's augmentation of
 * this module merges with the interface above.
 */
export function usePresenter<TModel extends object>(presentation: Presentation<ApplicationState, TModel>) {
  return presenterForPresentation(presentation);
}
