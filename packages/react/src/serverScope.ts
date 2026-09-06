import { AsyncLocalStorage } from 'node:async_hooks';
import { createScope, type ScopeHandle } from '@magicdoor/magic-use-case-core';

/**
 * React has no request context of its own, so the scope for a request is kept
 * here and follows the asynchronous work the render does. The host opens one
 * per request; everything rendered inside resolves to it, however many times
 * it awaits.
 */
const requestScopes = new AsyncLocalStorage<ScopeHandle>();

/**
 * Runs a server render in a scope of its own.
 *
 * A browser runs one process per user, so the single shared scope is correct
 * there. A server process serves many users at once, so each request owns its
 * own — sharing one would serve a user another user's data.
 */
export function runInRequestScope<T>(render: () => T): T {
  return requestScopes.run(createScope(), render);
}

export function resolveServerScope(): ScopeHandle {
  const scope = requestScopes.getStore();

  if (!scope) {
    throw new Error(
      '[magic-use-case] No request scope is available.\n\n' +
        'On a server, application state belongs to the request being served, so that ' +
        'concurrent requests never share it. Wrap the render in runInRequestScope() to ' +
        'open one — falling back to a shared scope would serve a user another ' +
        "user's data.",
    );
  }

  return scope;
}
