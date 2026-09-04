import { ConcreteEventEmitter, type EventEmitter, type EventHandler } from './eventEmitter';
import type { PresentationSource } from '../ui/presentationSource';

declare const scopeBrand: unique symbol;

/**
 * A scope, as everything outside the library sees it: a value to hand back to
 * `setScopeResolver`, and nothing more. The bus, the state and the bookkeeping
 * are the library's own.
 */
export interface ScopeHandle {
  readonly [scopeBrand]?: never;
}

/**
 * Everything that makes up one running application: its state, the bookkeeping
 * that keeps state consistent, the event bus that announces changes, and the
 * models built from it.
 *
 * A browser runs exactly one of these, which is why they were five separate
 * module-level values for so long. Naming them as one thing is what allows a
 * second one to exist — a server process serving concurrent requests needs a
 * scope per request, since sharing any one of these five would serve one user
 * another user's data.
 */
export interface AppScope extends ScopeHandle {
  /** Application state itself, adopted from `initializeState()`. */
  state: unknown;
  /** The bootstrap in flight, so concurrent first executions await one. */
  initialStatePromise?: Promise<void>;
  /** Executions in flight, keyed by use case and params, for deduplication. */
  runningUseCases: Map<object, Map<string, Promise<void>>>;
  /** The bus carrying state changes, navigation and errors. */
  emitter: EventEmitter;
  /** One model per presentation, shared by every presenter holding it. */
  sources: Map<object, PresentationSource>;
  /** Depth of running use cases, which is what makes state writable. */
  openMutationWindows: number;
  /** Depth of running use cases that have a caller, which is what keeps them quiet. */
  attachedRuns: number;
}

export function createScope(initialState?: unknown): ScopeHandle {
  const scope: AppScope = {
    state: initialState,
    initialStatePromise: undefined,
    runningUseCases: new Map(),
    emitter: new ConcreteEventEmitter(),
    sources: new Map(),
    openMutationWindows: 0,
    attachedRuns: 0,
  };
  return scope;
}

// The browser's single scope. Resolving it is a property read, so nothing pays
// for the indirection that a server would use to resolve a scope per request.
const browserScope = createScope() as AppScope;
let resolveScope: () => AppScope = () => browserScope;

export function currentScope(): AppScope {
  return resolveScope();
}

/**
 * Installed by the server build to resolve a scope per request. Left alone,
 * every caller shares the one browser scope.
 */
export function setScopeResolver(resolver: () => ScopeHandle): void {
  resolveScope = resolver as () => AppScope;
}

export function onError(handler: (error: Error) => void): () => void {
  const { emitter } = currentScope();
  const wrapper: EventHandler = (data?: unknown) => {
    if (data instanceof Error) handler(data);
  };
  emitter.registerForErrors(wrapper);
  return () => emitter.unregisterFromErrors(wrapper);
}

export function onNavigation(handler: (url: string) => void): () => void {
  const { emitter } = currentScope();
  const wrapper: EventHandler = (data?: unknown) => {
    if (typeof data === 'string') handler(data);
  };
  emitter.registerForNavigation(wrapper);
  return () => emitter.unregisterFromNavigation(wrapper);
}
