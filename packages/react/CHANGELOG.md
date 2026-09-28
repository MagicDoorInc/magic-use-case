# @magicdoor/magic-use-case-react

## 0.3.1

### Patch Changes

- **A write to an element reached through an array method now reaches presenters.** Inside a use case, `find`, `filter`, `map`, `forEach`, `for…of`, spread and the other array methods handed back the raw elements, so `state.rows.find((row) => row.id === id)!.amount = 10` changed state without any presenter re-running. They now hand back the same writable view as indexing does.

  **`indexOf`, `lastIndexOf` and `includes` find an element read from state.** Searching an array for an element read through `getState()` or a presentation returned `-1` or `false`; it now matches whether the element is a view or the raw object.

  **State stores objects, not views of them.** Assigning, pushing, splicing, filling, `Map.set`, `Set.add` and `defineProperty` stored the view they were handed, so `state.selected = state.rows[0]` left `state.selected` a different object from the row. The object itself is now stored, including inside a new array, object, `Map` or `Set` built from state. A frozen, sealed or non-extensible container is copied only when a read-only slot has to change, and keeps its integrity level.

  **Maps and Sets keyed by objects from state.** `get`, `has` and `delete` find a key read from state, `keys()` and `forEach` hand out keys as views, `Set.prototype.entries()` yields `[value, value]` pairs, and what `union`, `intersection` and the other `Set` and `Map` methods return is wrapped like everything else.

## 0.3.0

### Minor Changes

- 2e7874f: **Breaking: a use case declares the params it takes, and `execute` checks them.** `UseCase<TState, TParams = void>` types `runLogic`, `execute` and `detach`, and the `execute` that `useUseCase` returns, so `pay("oops")` or `pay()` on a use case that takes a `PaymentRequest` no longer compiles. A params type that admits `undefined` (`runLogic(id?: string)`) keeps the argument optional.

  To upgrade, make your base class pass the params through, and declare them on each use case that takes any:

  ```ts
  export abstract class BaseUseCase<TParams = void> extends UseCase<AppState, TParams> { … }

  class PayUseCase extends BaseUseCase<PaymentRequest> {
    protected async runLogic(request: PaymentRequest) { … }
  }
  ```

  A use case that takes nothing is unchanged. The compiler points at every use case that takes params without declaring them, and at every call that passes the wrong thing.

  **A presentation re-runs only when something it read has changed.** The library records what each presentation reads and what each run writes, so a keystroke in a form re-runs that form's presentation and skips the reconcile for every other screen, instead of rebuilding them all. Nothing needs declaring. A method called on an object in state, or a getter or setter, counts as reading or writing all of that object. Array methods inside a presentation (`map`, `filter`, spread) now read through the readonly view, so the elements they hand back are readonly too.

  **A run that changed nothing no longer announces.** A use case that only read state, or wrote back the value already there, used to re-run every mounted presentation anyway. Writes are seen wherever they happen through `getState()`. A write made through a reference kept outside `getState()` is not seen: once an object is in state, reach it through `getState()`.

  **A model can hold part of state as it is.** `{ profile: state.user.profile }` made Solid throw `Cannot define property 'Symbol(solid-proxy)' on readonly object`, and React never showed a change made to that part of state in place. Whatever a model holds of state is now copied out of it once per state change.

  **Runs with files, sets or maps in their params are told apart.** A `File` or `Blob` serialized to `{}`, so an upload made while another was in flight joined it and its file was dropped; files are now compared by identity. A `Set` or `Map` also serialized to `{}`; they are now compared by what they hold. Nothing needs configuring.

  **Frozen state behaves.**
  - Reading a function held by a frozen object — `Object.freeze({ format: (n) => … })`, or a frozen instance with an arrow-function field — no longer throws `'get' on proxy: property … is a read-only and non-configurable data property`.
  - Frozen arrays, maps and sets returned from `initializeState()` stay frozen, as frozen objects already did.
  - A write that frozen or sealed state refuses says so — `Cannot set 'theme': the object is frozen. Replace it in state instead of changing it.` — instead of `'set' on proxy: trap returned falsish`.

  **`report()` accepts anything a `catch` hands you,** so `this.report(error)` needs no cast; a value that is not an `Error` is reported as one.

## 0.2.0

### Minor Changes

- f884538: Remove `didSucceed` from `useUseCase`. `execute` now resolves to `true` when the run succeeded and `false` when it failed, so a follow-up to a run goes after the `await` in the handler that started it, instead of in an effect watching a flag. Replace `useEffect(() => { if (didSucceed) … }, [didSucceed])` with `if (await execute(params)) …`; for whether something loaded, render from a presentation's model.

  A `File` or `Blob` in application state is handed out as itself rather than behind the readonly proxy, so it can be passed to `FormData`, `fetch`, `URL.createObjectURL` and `structuredClone`. It is also kept as the same object when state is adopted, and in React a different file now replaces the one on screen instead of comparing equal to it.

## 0.1.2

### Patch Changes

- d37aebe: **`MagicUseCaseTypes` is gone.** `usePresenter` no longer reads the application's state type from a module augmentation; it infers it from the presentation it is given, as it did before 0.1.1.

  A presentation is already checked against the state type it declares — `Presentation<AppState, TModel>` — and that is the check that matters. The augmentation only rejected a presentation deliberately annotated with a different state type, which nobody does by accident, at the cost of a `declare module` block every application had to know about.

  An application that added the block removes it; the compiler points at it. An application that never did sees no change.

## 0.1.1

### Patch Changes

- Close a use case's mutation window on the scope it opened, rather than on
  whichever scope is current when it finishes.

  A run can outlive the scope it started in — a detached one, or one still in
  flight when a request ends. Resolving the scope again at closing time made that
  run decrement a scope it never belonged to, shutting a window another run was
  depending on: the second run's next write to application state failed with
  "Cannot set property … outside a use case" even though it was squarely inside
  `runLogic`. On a server it was worse than a wrong count, since resolving a scope
  with no request in progress throws, and it threw from inside a `finally`.

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

  **A use case can run other use cases.** A run announces its work unless
  somebody is waiting on it: a nested run stays silent and its caller announces
  everything written beneath it, once. Two flows a screen started independently
  announce independently, so a long initialization never holds back the fetch a
  page made for itself. Navigation is not held back either, so a nested use case
  still moves the screen the moment it decides to.

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

  **The state type is pinned to the application's.** An application names its
  state type once by augmenting `MagicUseCaseTypes`, and `usePresenter` then
  accepts only presentations written against it. Without that, a presentation's
  state type is whatever the presentation claims, and one written against the
  wrong shape compiles cleanly and fails on the screen.

  **Server-side rendering** resolves a scope per request, so two requests never
  share state, the event bus, or a presentation's model. Everything that makes
  up a running application lives in one scope, and on a server that scope
  belongs to the request being served. Solid needs nothing from you: its server
  build reads the request from `getRequestEvent()` and keeps that request's
  scope beside it. React has no request context of its own, so
  `@magicdoor/magic-use-case-react/server` exports `runInRequestScope()`, which
  the host opens once per request; the subpath is what keeps `node:async_hooks`
  out of browser bundles. Rendering outside a request throws rather than falling
  back to a shared scope, because a silent fallback is the leak this prevents.

  **State can travel to the browser**, so a page rendered with data is not
  fetched again while it hydrates. It is opt-in and it is one line: Solid
  renders `<StateTransfer />` once in its tree, React puts
  `serializedStateScript()` in its document, and the browser adopts what it
  finds as the package loads. Application state has to be data — objects,
  arrays, sets, maps, dates, primitives — since a class instance cannot cross
  without its prototype. Two things to weigh: everything in state reaches the
  page in plain text, and the payload is an inline script, so a strict
  `script-src` needs a nonce.

  `createScope()` hands back an opaque handle: the only thing an application can
  do with a scope is give it to `setScopeResolver()`, since the bus and the
  state inside it are the library's own.

  `@magicdoor/magic-use-case-core` is internal and never published — it is bundled into each
  adapter, so the adapters' exports are the entire supported API surface.
