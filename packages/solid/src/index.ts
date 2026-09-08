import { adoptSerializedState, setScopeResolver } from '@magicdoor/magic-use-case-core';
import { isServer } from 'solid-js/web';
import { resolveServerScope } from './serverScope';

// A browser runs one process per user, so the single shared scope is correct
// there. A server process serves many users at once, so each request resolves
// its own. `isServer` is false in the client build, which is what leaves the
// browser on the shared scope.
if (isServer) {
  setScopeResolver(resolveServerScope);
} else {
  // A page the server rendered with data left that state behind. Adopting it
  // before anything renders is what keeps hydration from finding one tree on
  // the server and a different, empty one here.
  adoptSerializedState();
}

export { UseCase, Presenter } from '@magicdoor/magic-use-case-core';
export type { DeepReadonly, Presentation } from '@magicdoor/magic-use-case-core';
export { createScope, setScopeResolver } from '@magicdoor/magic-use-case-core';
export { onError, onNavigation } from '@magicdoor/magic-use-case-core';
export { useUseCase } from './hooks/useUseCase';
export { usePresenter } from './hooks/usePresenter';
export { ErrorHandler } from './ui/ErrorHandler';
export { Navigator } from './ui/Navigator';
export { StateTransfer } from './ui/StateTransfer.browser';
