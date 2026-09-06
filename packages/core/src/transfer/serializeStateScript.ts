import { serialize } from 'seroval';
import { currentScope } from '../usecase/appScope';
import { STATE_GLOBAL } from './stateGlobal';

/**
 * The state this request rendered from, as a script the browser runs before it
 * renders. Serialized rather than JSON-encoded: application state holds sets,
 * maps, dates and shared references, none of which survive JSON, and all of
 * which the emitted source rebuilds.
 *
 * seroval writes `<` as `\x3C`, so a string in state cannot close the tag.
 *
 * Server-side only. The browser never needs to deserialize anything — the
 * script it runs *is* the value.
 */
export function serializedStateScript(): string {
  const { state } = currentScope();

  // Nothing ran, so there is nothing the browser could not work out for itself.
  if (state === undefined) {
    return '';
  }

  return `<script>window.${STATE_GLOBAL}=${serializedOrExplained(state)}</script>`;
}

/**
 * Application state crosses to the browser as data, so everything in it has to
 * be data: objects, arrays, sets, maps, dates, primitives. A class instance has
 * a prototype, and no serializer can send one — the failure is worth naming
 * here, because the one the serializer raises names a type, not a rule.
 */
function serializedOrExplained(state: unknown): string {
  try {
    return serialize(state);
  } catch (error) {
    throw new Error(
      '[magic-use-case] Application state cannot be handed to the browser.\n\n' +
        'Everything in it has to be data — objects, arrays, sets, maps, dates and ' +
        'primitives. A class instance cannot cross, because its prototype cannot: ' +
        'the browser would receive the fields and none of the behavior.\n\n' +
        `The serializer refused: ${String(error)}`,
    );
  }
}
