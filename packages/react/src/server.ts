import { setScopeResolver } from '@magicdoor/magic-use-case-core';
import { resolveServerScope } from './serverScope';

/**
 * The server half of the adapter, kept behind its own entry point because it
 * reaches for `node:async_hooks`, which no browser bundle should carry.
 *
 * Importing it is what makes application state belong to the request being
 * rendered rather than to the process. Open one per request:
 *
 *     import { runInRequestScope } from '@magicdoor/magic-use-case-react/server';
 *
 *     await runInRequestScope(() => renderToString(<App />));
 */
setScopeResolver(resolveServerScope);

export { runInRequestScope } from './serverScope';
export { serializedStateScript } from '@magicdoor/magic-use-case-core';
