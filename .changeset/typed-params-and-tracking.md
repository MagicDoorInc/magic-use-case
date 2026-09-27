---
"@magicdoor/magic-use-case-react": minor
"@magicdoor/magic-use-case-solid": minor
---

**Breaking: a use case declares the params it takes, and `execute` checks them.** `UseCase<TState, TParams = void>` types `runLogic`, `execute` and `detach`, and the `execute` that `useUseCase` returns, so `pay("oops")` or `pay()` on a use case that takes a `PaymentRequest` no longer compiles. A params type that admits `undefined` (`runLogic(id?: string)`) keeps the argument optional.

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
