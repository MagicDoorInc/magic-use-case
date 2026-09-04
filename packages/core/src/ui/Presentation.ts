/**
 * The whole of what a screen needs written by hand: a pure function from
 * application state to the model the view renders. It is called again on every
 * state change, so it must derive its result from `state` alone.
 *
 * Presentations are plain functions, so two screens that need the same rule
 * share it by calling the same function — no class hierarchy, and no presenter
 * constructed inside another presenter. Sharing is by identity: pass the same
 * function and the work is done once for all of them.
 */
export type Presentation<TState, TModel extends object> = (state: TState) => TModel | undefined;
