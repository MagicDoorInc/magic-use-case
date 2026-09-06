import { createScope, type ScopeHandle } from '@magicdoor/magic-use-case-core';
import { getRequestEvent } from 'solid-js/web';

/**
 * Keyed by the request event rather than stored on it: only the server build's
 * `RequestEvent` carries a `locals` bag, and a map keyed on the event collides
 * with nothing an application keeps there. The entry lives exactly as long as
 * the request — once the event is collected, its scope goes with it.
 */
const scopes = new WeakMap<object, ScopeHandle>();

/**
 * Resolves the scope for the request being rendered, creating it the first time
 * that request asks.
 *
 * A browser runs one process per user, so a single shared scope is correct
 * there. A server process serves many people at once, so each request owns its
 * own — sharing one would serve a user another user's data.
 */
export function resolveServerScope(): ScopeHandle {
  const event = getRequestEvent();

  if (!event) {
    throw new Error(
      '[magic-use-case] No request scope is available.\n\n' +
        'On a server, application state belongs to the request being served, so that ' +
        'concurrent requests never share it. This ran on a server but outside a request, ' +
        'so there is no request to resolve a scope from — and falling back to a shared ' +
        "one would serve a user another user's data.",
    );
  }

  const existing = scopes.get(event);
  if (existing) {
    return existing;
  }

  const scope = createScope();
  scopes.set(event, scope);
  return scope;
}
