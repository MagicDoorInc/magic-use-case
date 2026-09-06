/**
 * Where a server render leaves the state it rendered from, for the browser to
 * pick up before it renders anything of its own.
 */
export const STATE_GLOBAL = '__MAGIC_USE_CASE_STATE__';

export function transferredState(): unknown {
  return (globalThis as Record<string, unknown>)[STATE_GLOBAL];
}
