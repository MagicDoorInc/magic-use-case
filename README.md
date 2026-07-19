# magic-use-case

Clean-architecture use cases and presenters for front-end TypeScript — a small,
extensible structure for organising application logic outside your UI framework.

Your business logic lives in framework-agnostic `UseCase` and `Presenter`
classes. A thin adapter binds them to your framework's reactivity.

| Package | Framework | Version |
| --- | --- | --- |
| [`@magic-use-case/react`](./packages/react) | React ≥17 | `0.1.0` |
| [`@magic-use-case/solid`](./packages/solid) | SolidJS >1.9.3 | `0.1.0` |

```bash
npm install @magic-use-case/react   # or @magic-use-case/solid
```

## Example

```tsx
import { UseCase, Presenter, useUseCase, usePresenter } from '@magic-use-case/react';

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

function TenantList() {
  const { execute, isLoading } = useUseCase(LoadTenants);
  const { model } = usePresenter(TenantPresenter);
  // ...
}
```

## State may only be mutated inside a use case

`getState()` returns a deep proxy that accepts writes only while a use case is
running. Anywhere else — a component, a presenter, a module holding a reference —
the write throws:

```
[magic-use-case] Cannot call .push() on Array outside a use case.
```

This exists because a write made outside a use case emits no state-change event,
so presenters keep rendering stale data. That is a silent desync; the guard turns
it into an error at the offending line.

Presenters are covered by a second, stricter rule: `createModel` receives a fully
readonly view, and anything it passes through to the view model stays readonly.
That view never accepts a write, independently of whether a use case happens to
be running — so a presenter cannot write state even when a nested use case has
left the mutation window open.

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

The two styles differ in how presenters detect change. An in-place mutation
keeps the branch's identity, so a presenter comparing references sees nothing
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
reset — a component or presenter has no access to it. Put it in a use case that
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
one behind resurrects the old state. Presenters are notified so the UI clears,
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

## Server-side rendering

`@magic-use-case/solid` ships two bundles: `dist/index.js` compiled with Solid's
DOM generator, and `dist/server.js` compiled with its SSR generator. The exports
map routes `node`, `deno`, and `worker` to the server build automatically, so
`renderToString` works with no configuration.

Rendering static markup on the server is supported. Rendering **per-user state**
is not, and the server build enforces that rather than leaving it to convention:

```
Error: [magic-use-case] Executing a use case is not available during
server-side rendering.
```

Application state is process-global by design — `UseCase` keeps state in a
`static` field and the event bus is a module singleton. In a browser, where
there is one process per user, that is exactly right. On a server one process
serves many concurrent requests, so those globals would be shared and one user
could be served another user's data. On the server build, executing a use case,
reading use-case state, or constructing a `Presenter` throws immediately.

Fetch per-user data in your server framework and render it on the client, or
wait for request-scoped state (`AsyncLocalStorage`), which would lift this
restriction.

## Repository layout

```
packages/
  core/    private — shared logic, bundled into each adapter at build time
  solid/   published
  react/   published
```

`@magic-use-case/core` is intentionally **not published**. It is inlined into
each adapter at build time, so the adapters' public exports are the entire
supported API surface. This keeps internals — the event bus, the use-case
factory — free to change without a breaking release. CI enforces that no
published bundle references core.

## Development

```bash
npm install
npm run build        # build all packages
npm test             # vitest
npm run lint
npm run type-check
```

Releases are managed with [changesets](https://github.com/changesets/changesets).
Add one with `npm run changeset`; merging the generated "Version Packages" PR
publishes to npm with provenance.

## License

Apache-2.0
