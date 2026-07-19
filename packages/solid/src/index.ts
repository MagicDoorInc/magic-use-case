import { enableServerGuard } from '@magic-use-case/core';
import { isServer } from 'solid-js/web';

// Application state is process-global by design — correct in a browser, unsafe
// on a server where concurrent requests would share it. `isServer` is false in
// the client build, so the guard is never enabled there.
if (isServer) {
  enableServerGuard();
}

export { UseCase, Presenter } from '@magic-use-case/core';
export { usePresenter } from './hooks/usePresenter';
export { useUseCase } from './hooks/useUseCase';
export { ErrorHandler } from './ui/ErrorHandler';
export { Navigator } from './ui/Navigator';
