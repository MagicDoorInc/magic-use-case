import { adoptSerializedState } from '@magicdoor/magic-use-case-core';

// A page the server rendered with data left that state behind for the browser.
// Adopting it before anything renders is what keeps hydration from finding one
// tree on the server and a different, empty one here.
adoptSerializedState();

export { useUseCase } from './hooks/useUseCase';
export { usePresenter } from './hooks/usePresenter';
export { UseCase, Presenter } from '@magicdoor/magic-use-case-core';
export { createScope, setScopeResolver } from '@magicdoor/magic-use-case-core';
export { onError, onNavigation } from '@magicdoor/magic-use-case-core';
export type { DeepReadonly, Presentation } from '@magicdoor/magic-use-case-core';
export { ErrorHandler } from './ui/ErrorHandler';
export { Navigator } from './ui/Navigator';
