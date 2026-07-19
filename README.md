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

class LoadTenants extends UseCase<AppState> {
  protected async isAppStateInitialized() { return this.initialized; }
  protected async initializeState() { return new AppState(); }

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
it into an error at the offending line. Presenters separately receive a fully
readonly view, so the UI cannot write at all.

### Immutable state

Nothing requires the data under the root to be mutable. Keep a stable root
object and replace whole branches with new frozen values:

```ts
class AppState {
  tenants: readonly Tenant[] = Object.freeze([]);
}

class AddTenant extends UseCase<AppState> {
  protected async runLogic(name: string) {
    const state = this.getState();
    state.tenants = Object.freeze([...state.tenants, new Tenant(name)]);
  }
}
```

Each replacement gives presenters a new reference, so identity-based change
detection works. Frozen values are read back through the proxies without issue.

The root itself must stay a stable object — it is adopted once from
`initializeState()` and there is no API to swap it wholesale, so the pattern is
"immutable data under a mutable root" rather than a single replaced state tree.

Two limits are worth knowing:

- **The object you return from `initializeState()` stays writable.** You
  constructed it, so you hold an unproxied reference, and writes through it are
  invisible to the guard. Hand it to the library and read it back via
  `getState()` rather than keeping the reference around.
- **The window is time-based, not call-based.** While a use case awaits, any
  code that happens to run is inside the window and may write. The guard catches
  mistakes; it is not a security boundary.

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
