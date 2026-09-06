import { serializedStateScript } from '@magicdoor/magic-use-case-core';
import { isServer, ssr, useAssets } from 'solid-js/web';

/**
 * Hands the state this request rendered from to the browser, so its first
 * render reads what the server rendered rather than an empty scope.
 *
 * Rendered once, anywhere in the tree. `useAssets` takes a thunk that runs when
 * the document is assembled, which is after the use cases have finished — so it
 * carries the state as it ended up, not as it was when this component ran. The
 * script lands in the head, outside the hydrated tree, where an extra node
 * cannot be a hydration mismatch.
 *
 * Renders nothing in a browser: `isServer` is false there, so neither the call
 * nor the serializer survives the client build.
 */
export const StateTransfer = () => {
  if (isServer) {
    useAssets(() => ssr(serializedStateScript()) as unknown as string);
  }

  return null;
};
