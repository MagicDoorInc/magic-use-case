# @magicdoor/magic-use-case-solid

## 0.1.0

### Minor Changes

- First release of `magic-use-case` — clean-architecture use cases and
  presentations for front-end TypeScript, consolidating the previous
  `solid-use-case`, `solid-use-case-core` and `solid-use-case-react` packages
  into one project.

  **Use cases and presentations.** `UseCase` holds application logic; a
  `Presentation` — a pure function from state to a view model — is what a screen
  renders. Both are framework-agnostic, bound to your framework by a thin
  adapter: `useUseCase`, `usePresenter`, `ErrorHandler` and `Navigator`.

  **A presentation is a value, not a subclass.** `usePresenter(presentTenants)`
  takes the function itself, so two screens that need the same rule share it by
  calling the same function, and one presentation can back several presenters.
  `Presenter` is exported as infrastructure — it holds a presentation and reruns
  it on every state change — not as a base class to extend. Presenters given the
  same presentation share one run of it: the model is built once per state
  change and handed to all of them. Sharing is by the identity of the function
  object, so it survives minification, which mangles names and can leave two
  unrelated functions sharing one. The model handed to a component is readonly —
  `usePresenter` returns `DeepReadonly<TModel>`, enforced by the compiler and at
  runtime — since one model is shared by every screen using that presentation. A
  presentation is only ever called with state: `resetAppState()` empties every
  model directly, rather than asking each presentation to map an absence. One that throws anyway
  is reported to the console and leaves its model empty, rather than failing the
  render or the emit that other screens are waiting on.

  **A use case can run other use cases.** State changes are announced when no
  use case is running: a nested run stays silent, and the outermost run
  announces everything written beneath it, once. Navigation is not held back, so
  a nested use case still moves the screen the moment it decides to.

  **Failures propagate.** `execute()` rejects, so a nested failure aborts its
  caller and a sequence of steps is a sequence. The failure reaches `onError`
  exactly once, from the outermost run. A caller that catches decides what the
  failure means and only what it throws is reported; a caller that handles it
  reports nothing, and `report()` is there for the case that recovers but still
  wants the screen to know. A use case that writes state and then throws still
  announces what it wrote.

  **State is only mutable inside a use case.** `getState()` returns a deep proxy
  that accepts writes only while a use case runs. Writing elsewhere throws rather
  than silently desyncing the UI, since such a write emits no state-change event.
  A presentation receives a fully readonly view and can never write.

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
  state throws. Everything that makes up a running application — state, its
  bookkeeping, the mutation window, the event bus, and each presentation's model
  — lives in one scope, resolved through an indirection. A browser resolves
  a single scope; a server process serving concurrent requests would need one per
  request, and until a build installs a resolver that does that, the operations
  which would share state across requests refuse to run. `createScope()` hands
  back an opaque handle: the only thing an application can do with a scope is
  give it to `setScopeResolver()`, since the bus and the state inside it are the
  library's own.

  `@magicdoor/magic-use-case-core` is internal and never published — it is bundled into each
  adapter, so the adapters' exports are the entire supported API surface.
