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

class LoadTenants extends UseCase<TenantState> {
  protected async runLogic() {
    const tenants = await api.getTenants();
    this.setState({ tenants });
  }
}

function TenantList() {
  const { execute, isLoading } = useUseCase(LoadTenants);
  const { model } = usePresenter(TenantPresenter);
  // ...
}
```

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
