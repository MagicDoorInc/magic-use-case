import { createScope, setScopeResolver } from '../usecase/appScope';
import { transferredState } from './stateGlobal';

/**
 * Adopts the state a server render left behind, so the browser's first render
 * reads what the server rendered instead of an empty scope — which is what
 * keeps hydration from finding two different trees.
 *
 * Does nothing when there is no transferred state, which is every page that was
 * not server-rendered with data.
 */
export function adoptSerializedState(): boolean {
  const state = transferredState();

  if (state === undefined) {
    return false;
  }

  const scope = createScope(state);
  setScopeResolver(() => scope);
  return true;
}
