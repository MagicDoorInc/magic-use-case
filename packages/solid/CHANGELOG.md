# @magic-use-case/solid

## 0.1.0

### Minor Changes

- First release of `magic-use-case` — clean-architecture use cases and presenters
  for front-end TypeScript, consolidating the previous `solid-use-case`,
  `solid-use-case-core` and `solid-use-case-react` packages into one project.

  **Use cases and presenters.** `UseCase` holds application logic; `Presenter`
  maps state to a view model. Both are framework-agnostic, bound to your framework
  by a thin adapter: `useUseCase`, `usePresenter`, `ErrorHandler` and `Navigator`.

  **State is only mutable inside a use case.** `getState()` returns a deep proxy
  that accepts writes only while a use case runs. Writing elsewhere throws rather
  than silently desyncing the UI, since such a write emits no state-change event.
  Presenters receive a fully readonly view and can never write.

  **In-place or immutable, your choice.** Mutating state in place and replacing
  branches with new frozen values are both supported, including in the same use
  case. State built with `Object.freeze` reads back correctly.

  **State is adopted, not borrowed.** The object returned from `initializeState()`
  is deep-cloned, so the caller's reference is no longer live state. The clone
  preserves prototypes, keeping class-based state class-based. `#private` fields
  cannot be cloned — use TypeScript `private` or a `_` prefix.

  **Bootstrapping happens exactly once**, decided by the library rather than by
  each use case, so no use case can replace live state by accident.
  `resetAppState()` — protected, callable only from within a running use case — is
  the one way to clear state and bootstrap again.

  **Server-side rendering** is supported for Solid, which ships a bundle compiled
  with Solid's SSR generator. Rendering static markup works; rendering per-user
  state throws, because application state is process-global by design and a server
  process is shared between concurrent requests.

  `@magic-use-case/core` is internal and never published — it is bundled into each
  adapter, so the adapters' exports are the entire supported API surface.
