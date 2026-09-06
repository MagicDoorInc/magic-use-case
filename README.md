# magic-use-case

Clean-architecture use cases and presentations for front-end TypeScript — a
small, extensible structure for organising application logic outside your UI
framework.

Your business logic lives in framework-agnostic `UseCase` classes, and what the
screen renders is a `Presentation`: a pure function from state to a view model.
A thin adapter binds them to your framework's reactivity.

| Package | Framework | Version |
| --- | --- | --- |
| [`@magicdoor/magic-use-case-react`](./packages/react) | React ≥17 | `0.1.0` |
| [`@magicdoor/magic-use-case-solid`](./packages/solid) | SolidJS >1.9.3 | `0.1.0` |

```bash
npm install @magicdoor/magic-use-case-react   # or @magicdoor/magic-use-case-solid
```

## Example

```tsx
import { UseCase, type Presentation, useUseCase, usePresenter } from '@magicdoor/magic-use-case-react';

// One base class per app supplies the initial state; every use case extends it.
abstract class AppUseCase extends UseCase<AppState> {
  protected async initializeState() { return new AppState(); }
}

class LoadTenants extends AppUseCase {
  protected async runLogic() {
    // Application state is mutated in place, and only here: writes outside a
    // running use case throw.
    this.getState().tenants = await api.getTenants();
  }
}

// A presentation is a plain function, so screens that need the same rule share
// it by calling the same function.
const presentTenants: Presentation<AppState, { names: string[] }> = (state) => ({
  names: state.tenants.map((tenant) => tenant.name),
});

function TenantList() {
  const { execute, isLoading } = useUseCase(LoadTenants);
  const { model } = usePresenter(presentTenants);
  // ...
}
```

## One presentation, one run

Ten screens rendering the same presentation do not run it ten times. Presenters
given the same presentation share a single run of it: the model is built once
per state change and handed to all of them, and the last presenter to be
destroyed releases it.

Sharing is by the identity of the function you pass, which is the one thing
about it a bundler leaves alone — names are mangled, and two unrelated functions
can end up sharing one. So export presentations at module scope and pass them by
reference:

```ts
// shared: every screen passes the same function object
export const presentTenants: Presentation<AppState, PresentableTenants> = (state) => ({ … });
usePresenter(presentTenants);

// not shared: a new function on every render, and it captures stale props
usePresenter((state) => ({ names: state.tenants.map(() => props.format) }));
```

An inline presentation still works, it just runs on its own and sees only the
props of the render that created it. A presentation derives its model from state
alone, so there is rarely a reason to write one.

### The model is readonly

One model is shared by every screen using that presentation, so a component that
wrote to it would be rewriting what the others are rendering. `usePresenter`
returns `DeepReadonly<TModel>`, enforced by the compiler and by the same proxy at
runtime.

`DeepReadonly` describes the model as the screen sees it, not as a mapped copy of
it. A `Map` or `Set` becomes a `ReadonlyMap` or `ReadonlySet` whose reads still
work — `size`, `has`, `get`, iteration — while `set`, `add`, `delete` and `clear`
throw. Arrays become `readonly` arrays. Methods pass through untouched, so a
model may carry an object with behaviour and still be callable; the object is
recognisable too, `constructor` and `instanceof` answering the way they would
without the proxy. Only writes are refused.

## State may only be mutated inside a use case

`getState()` returns a deep proxy that accepts writes only while a use case is
running. Anywhere else — a component, a presentation, a module holding a reference —
the write throws:

```
[magic-use-case] Cannot call .push() on Array outside a use case.
```

This exists because a write made outside a use case emits no state-change event,
so presentations keep rendering stale data. That is a silent desync; the guard turns
it into an error at the offending line.

Presentations are covered by a second, stricter rule: one receives a fully
readonly view, and anything it passes through to the view model stays readonly.
That view never accepts a write, independently of whether a use case happens to
be running — so a presentation cannot write state even when a nested use case has
left the mutation window open.

The model is readonly too, in the other direction. One model is shared by every
screen using that presentation, so a component writing to it would rewrite what
the others are rendering — and the next state change would silently undo it.
`usePresenter` returns `DeepReadonly<TModel>`, so that is a compile error, not
just a runtime one:

```ts
const { model } = usePresenter(presentTenants);

model.count = 99;             // Cannot assign to 'count' because it is read-only
model.names.push('mallory');  // Property 'push' does not exist on 'readonly string[]'

readsOnly(model.names);       // fine, where readsOnly takes `readonly string[]`
wantsMutable([...model.names]);  // fine: a copy, and the callee may do as it likes
```

A helper that only reads should say so — `readonly T[]` — and one whose signature
you do not own gets an explicit copy. Derive what a screen needs in the
presentation; hold what only that screen needs in the component.

A presentation is only ever called with state. `resetAppState()` empties every
model directly, so a presentation never has to guard against the absence of the
state its signature promises. One that throws anyway is reported to the console
and leaves its model empty, rather than failing the render or the emit that
other screens are waiting on.

### Mutate in place, or replace immutably — your choice

The library takes no position on how state is shaped. Mutating in place is fully
supported, and so is a Redux-style approach where branches are replaced with new
values. Both are allowed in the same state tree, even in the same use case:

```ts
class AppState {
  log: string[] = [];                                   // mutated in place
  tenants: readonly Tenant[] = Object.freeze([]);       // replaced wholesale
}

class AddTenant extends UseCase<AppState> {
  protected async runLogic(name: string) {
    const state = this.getState();

    state.log.push(`adding ${name}`);
    state.tenants = Object.freeze([...state.tenants, new Tenant(name)]);
  }
}
```

The only rule is the one above: the write happens inside a use case.

The two styles differ in how presentations detect change. An in-place mutation
keeps the branch's identity, so a presentation comparing references sees nothing
and must diff structurally — which is what the reconciled store does. A
replacement yields a new reference, so reference comparison is enough.

The root object itself stays stable either way: it is adopted once from
`initializeState()`, and there is no API to swap it wholesale.

### Bootstrapping

`initializeState()` is declared on `UseCase` but called exactly once per app
run — by whichever use case executes first. Put it on a single base class that
every use case extends, and you write it once.

Core decides when to bootstrap, by checking whether state exists. A use case
cannot force a re-initialization and replace live state; concurrent first
executions bootstrap once between them. `resetAppState()` is the only way back
to an uninitialized state.

### Resetting state

`resetAppState()` is `protected` on `UseCase`, so only a use case can trigger a
reset — a component or presentation has no access to it. Put it in a use case that
represents the event:

```ts
class LogOut extends AppUseCase {
  protected async runLogic() {
    await api.logOut();
    this.resetAppState();
  }
}
```

It clears application state, the event bus's retained copy, the in-flight
deduplication map, and any bootstrap still in flight — all four, since leaving
one behind resurrects the old state. Presentations are rerun so the UI clears,
and the next `execute()` bootstraps through `initializeState()` again.

`protected` is a compile-time boundary, so JavaScript can still reach the
method. Calling it outside a running use case throws, which is the same
mutation window that governs every other write.

### State is adopted, not borrowed

The object returned from `initializeState()` is deep-cloned. The caller keeps
their reference, but it is no longer application state — writing to it has no
effect and emits nothing:

```ts
const original = new AppState();
// ...after the use case has run
original.tenants.push(tenant);   // legal, but changes nothing
```

`getState()` is the only way to reach live state. The clone preserves
prototypes, so class-based state stays class-based: `instanceof` holds and
methods still work.

> [!NOTE]
> **`#private` fields cannot be cloned.** There is no reflection for them, so a
> method reading `this.#field` on the clone throws `Cannot read private member`.
> Use TypeScript's `private` or a `_` prefix — both are ordinary properties and
> clone correctly.

One limit remains: **the mutation window is time-based, not call-based.** While
a use case awaits, any code that happens to run is inside the window and may
write. The guard catches mistakes; it is not a security boundary.

## Use cases that run other use cases

A flow that needs several steps is a use case that runs them:

```ts
class InitializeApp extends AppUseCase {
  protected async runLogic() {
    await new LoadCompany().execute();
    await new LoadTenants().execute();
  }
}
```

**State changes are announced when no use case is running.** A nested run stays
silent, so the ten screens watching do not rerender once per step; the outermost
run announces everything written beneath it, once, when it finishes. Two
unrelated top-level runs overlapping are announced together, when the later one
finishes.

Navigation is not held back. A nested use case that calls `navigate()` moves the
screen immediately, which is usually the point: route first, and let the data
that is still loading fill in.

### When a use case fails

`execute()` rejects. A nested failure therefore aborts its caller, which is what
makes the sequence above a sequence rather than a list of attempts.

The failure is reported to `onError` exactly once, by the outermost run, so the
screen hears about it whether it happened at the top or five levels down. A
caller that catches decides what the failure means, and only what it throws is
reported:

```ts
try {
  await new ValidateAccount().execute(id);
} catch (error) {
  if (error instanceof AccountInvalid) throw new PaymentNotPossible();
  throw error;
}
```

Catching and *not* rethrowing reports nothing at all — the failure was handled.
When a use case recovers but the screen should still hear about it, that is what
`report()` is for:

```ts
try {
  await new ResolveImages().execute(ids);
} catch (error) {
  this.report(error as Error);   // the images failed; the page still loads
}
```

A use case that writes state and then throws still announces what it wrote, so a
`failed` flag set on the way out reaches the screen.

### Listening from outside a component

`ErrorHandler` and `Navigator` cover the two things an application does with
these events, and both are built on the same pair of subscriptions the library
exports:

```ts
const stopListening = onError((error) => report(error));
const stopNavigating = onNavigation((url) => router.go(url));
```

They hand back an unsubscribe function and nothing else — there is no way to
reach the bus itself, or to emit on it. A use case emits by calling `navigate()`
or `report()`; everything else listens. Tests use the same pair, so what they
observe is what a screen would have been told.

## Server-side rendering

`@magicdoor/magic-use-case-solid` ships two bundles: `dist/index.js` compiled with Solid's
DOM generator, and `dist/server.js` compiled with its SSR generator. The exports
map routes `node`, `deno`, and `worker` to the server build automatically, so
`renderToString` works with no configuration.

Rendering static markup on the server is supported. Rendering **per-user state**
is not, and the server build enforces that rather than leaving it to convention:

```
Error: [magic-use-case] Executing a use case is not available during
server-side rendering.
```

Everything that makes up a running application lives in one scope: state itself,
the bootstrap and deduplication bookkeeping, the mutation window, the event bus,
and the model built for each presentation. A browser resolves one scope for the
life of the page, which is exactly right where there is one process per user. A
server process serves many concurrent requests, and sharing any one of those six
would serve one user another user's data.

The scope is resolved through an indirection, so a server build can hand out a
scope per request rather than the single shared one:

```ts
const scope = createScope(initialState);   // initialState is optional
setScopeResolver(() => scope);
```

`createScope` returns an opaque handle. Giving it to `setScopeResolver` is the
only thing an application can do with a scope — the state, the bookkeeping and
the event bus inside it belong to the library.

Until a resolver is installed, the server build refuses the operations that
would read or write shared state: executing a use case, reading use-case state,
or constructing the presenter behind `usePresenter`.

So today: fetch per-user data in your server framework and render it on the
client. The remaining work to lift that is a resolver backed by
`AsyncLocalStorage`, plus a way to hand the server's state to the client for
hydration.

## Repository layout

```
packages/
  core/    private — shared logic, bundled into each adapter at build time
  solid/   published
  react/   published
```

`@magicdoor/magic-use-case-core` is intentionally **not published**. It is inlined into
each adapter at build time, so the adapters' public exports are the entire
supported API surface. This keeps internals — the event bus, the use-case
factory — free to change without a breaking release. CI enforces that no
published bundle references core.

## Development

```bash
npm install
npm run build        # build all packages
npm test             # vitest
npm run coverage       # vitest with coverage, which CI gates on at 100%
npm run lint
npm run type-check
npm run check-package  # how the published tarball resolves, before it exists
```

Releases are managed with [changesets](https://github.com/changesets/changesets).
Add one with `npm run changeset`; merging the generated "Version Packages" PR
publishes to npm with provenance.

## Credits

Created by Norbert Nemes.

## License

Apache-2.0 © MagicDoor, Inc.
