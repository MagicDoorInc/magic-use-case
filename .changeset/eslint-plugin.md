---
"@magicdoor/eslint-plugin": minor
---

The first release, with three configs.

- `configs.recommended` checks how the library is used: `no-use-case-outside-use-case`, `pure-presentations`, `no-catch-on-execute` and `no-deep-readonly`.
- `configs.base` is hygiene for any TypeScript front end: ESLint and typescript-eslint recommended, import order and resolution, unused imports, `unicorn/no-null`, and `optional-not-undefined`, `no-dto-names`, `no-loose-assertions` and `no-polling-in-tests`.
- `architecture(options)` adds the layer rules for apps laid out as use cases, presenters, gateways, state, types and UI: `layer-boundaries`, `no-browser-globals`, `no-business-string-literals`, `no-ui-formatting`, `no-exported-types`, `no-raw-json` and `no-gateway-stubs`. The folders are options, with defaults for the layout this library's README describes.

Every check is a rule of its own rather than a `no-restricted-syntax` selector, so config blocks compose instead of replacing one another.
