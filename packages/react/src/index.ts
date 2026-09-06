import { adoptSerializedState, type Presentation } from '@magicdoor/magic-use-case-core';
import { usePresenter as presenterForPresentation } from './hooks/usePresenter';

// A page the server rendered with data left that state behind for the browser.
// Adopting it before anything renders is what keeps hydration from finding one
// tree on the server and a different, empty one here.
adoptSerializedState();

export { useUseCase } from './hooks/useUseCase';
export { UseCase, Presenter } from '@magicdoor/magic-use-case-core';
export { createScope, setScopeResolver } from '@magicdoor/magic-use-case-core';
export { onError, onNavigation } from '@magicdoor/magic-use-case-core';
export type { DeepReadonly, Presentation } from '@magicdoor/magic-use-case-core';
export { ErrorHandler } from './ui/ErrorHandler';
export { Navigator } from './ui/Navigator';

/**
 * Augmented by the application to name the type its use cases keep state in:
 *
 *     declare module '@magicdoor/magic-use-case-react' {
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
