# @magicdoor/eslint-plugin

ESLint rules for front ends built the way [magic-use-case](https://github.com/MagicDoorInc/magic-use-case) recommends:
use cases run behaviour, presentations map state to models, gateways talk to the server, and the UI only asks.

```sh
npm install -D @magicdoor/eslint-plugin
```

It ships three configs. Take the ones that fit:

| Config | What it checks | For |
|---|---|---|
| `configs.recommended` | How the library is used: who constructs a use case, pure presentations, `execute` never caught, no `DeepReadonly`. | Any app using magic-use-case. |
| `configs.base` | ESLint and typescript-eslint recommended, import order and hygiene, unused imports, `name?: T` over `T \| undefined`, no `null`, no `…Dto` names, and exact assertions in tests. | Any TypeScript front end. |
| `architecture(options)` | Everything in `recommended`, plus which layer may import which, no browser APIs outside the UI, no formatting in the UI, private response shapes in gateways, and no gateway stubs in tests. | Apps laid out in layers: use cases, presenters, gateways, state, types, UI. |

```js
// eslint.config.js
import magicdoor, { architecture } from '@magicdoor/eslint-plugin';

export default [
  ...magicdoor.configs.base,
  ...architecture({ folders: { ui: ['components', 'routes'] } }),
];
```

An app that only wants the library rules adds `magicdoor.configs.recommended` on its own.

Each check is a rule of its own rather than a `no-restricted-syntax` selector, so blocks compose: adding a rule for some
files never silently drops the others there.

## `architecture(options)`

The layers are recognised by folder, directly under `src`:

| Layer | Default folders |
|---|---|
| `useCases` | `use-cases` |
| `presenters` | `presenters` (a `types` folder inside holds view model types) |
| `gateways` | `gateways` |
| `state` | `state` |
| `types` | `types`, `entities` |
| `ui` | `components`, `routes`, `screens`, `pages`, `global-contexts` |

Anything else under `src` — `hooks`, `utils`, the app's entry file — belongs to no layer: it may import what it needs,
except application state, which only use cases write.

```js
architecture({
  src: 'src',
  aliases: ['~/', '@/', 'src/'],
  folders: { ui: ['screens'], presenters: 'presentations' },
});
```

`aliases` are the import prefixes that point at `src` — `~/gateways/leaseGateway` is a gateway import. A relative import
is resolved from the file it is in.

## Things the configs leave to your app

- **Import resolution.** `base` resolves imports through TypeScript. An app that maps an alias in its bundler rather than
  in `tsconfig.json` adds its resolver settings, as it does today.
- **Exemptions.** A design-system folder whose props are `'solid' | 'outline'` unions, a date picker that formats, the one
  gateway that owns `localStorage`: turn the rule off for those files in a block after the config.

  ```js
  { files: ['src/gateways/storage/localStorageManager.ts'], rules: { '@magicdoor/no-browser-globals': 'off' } },
  ```

- **Rules about your own stack** — a component library, a date package, generated API clients — stay in your config.

## Rules

### How the library is used — `recommended`

- **no-use-case-outside-use-case** — Only a use case constructs another use case. The UI runs one through
  `useUseCase(SomeUseCase)`; a use case runs another with `await new SomeUseCase().execute()`, which keeps the nested run
  quiet and its caller announcing once. A `new …UseCase()` is allowed only inside a class that extends a `…UseCase`.
- **pure-presentations** — A presentation (a function named `present…`, or typed `Presentation<…>`) maps state to a
  model: no `execute`, `useUseCase`, `usePresenter`, `createUseCase` or `new …UseCase()`.
- **no-catch-on-execute** — The `execute` that `useUseCase` returns never rejects: it resolves to `false` when the run
  failed, and the failure has already been reported. A `catch` around it is dead, and what follows the call runs even when
  the run failed:

  ```tsx
  try {
    await createPaymentMethod(input);
    toast.success(t(TranslationKeys.SUCCESS)); // shown when saving failed, too
  } catch {
    toast.error(t(TranslationKeys.PAYMENT_UNKNOWN_ERROR)); // never runs
  }
  ```

  Branch on the result instead: `if (!(await createPaymentMethod(input))) return;`. An `execute` whose result is used is
  left alone, since the `catch` may be there for something else in the block.
- **no-deep-readonly** — A model from `usePresenter` is already readonly. Type a prop by the view model type the
  presentation returns, or let it be inferred.

### Any TypeScript front end — `base`

- **optional-not-undefined** — `name?: T`, not `name: T | undefined`, on properties and parameters. Fixable on properties.
- **no-dto-names** — The app's own types are not named `…Dto`: the response shape is private to the gateway that reads
  it, and what the app uses is named for what it is.
- **no-loose-assertions** — In tests, assert the exact value with `toBe` or `toEqual`: no `toBeTruthy`, `toContain`,
  `toMatchObject` or `expect.objectContaining`, which let a wrong result pass.
- **no-polling-in-tests** — Advance a fake clock rather than `vi.waitFor` or `vi.waitUntil`.

### Layered apps — `architecture()`

- **layer-boundaries** — The UI imports use cases and presentations, never gateways; from presenters it takes only
  `present…` functions and types. A presentation imports no use case, gateway or UI. A gateway imports no state, use case,
  presentation or UI. Types and entities import no presentation or gateway. Only use cases and state import state other
  than as a type. A `types` folder inside `use-cases` or `presenters` is open to the layers that need it.
- **no-browser-globals** — Use cases, presentations and gateways touch no browser API (`window`, `document`, `navigator`,
  `matchMedia`, …): the UI reads it and passes the value in. `localStorage` and `sessionStorage` go through the one
  gateway that owns storage, everywhere.
- **no-business-string-literals** — A value the business enumerates is an enum or `as const` object, not a string
  compared in place, switched on, or spelled out in a union type.
- **no-ui-formatting** — The UI renders the strings a presentation formatted: no `toFixed`, `toLocale…String` or `Intl`.
- **no-exported-types** — A presenter file exports presentations; its view model types live in the presenters' `types`
  folder.
- **no-raw-json** — A gateway annotates each parsed response with a private type, maps it before returning, and exports
  no `…Json` type. Gateways also get `no-explicit-any` and `explicit-function-return-type` as errors.
- **no-gateway-stubs** — Tests answer the server at the network boundary rather than stubbing a gateway with
  `vi.spyOn` or `vi.mock`, so the gateway's parsing and mapping are tested too.
