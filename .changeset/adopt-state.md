---
'@magic-use-case/solid': minor
'@magic-use-case/react': minor
---

Deep-clone the object returned from `initializeState()`. Application state is
now adopted rather than borrowed: the caller keeps their reference, but it is no
longer live state, so writes through it have no effect and emit nothing. This
closes the last route to mutating state from outside a use case.

The clone preserves prototypes, so class-based state keeps `instanceof` and its
methods. `#private` fields are the exception — they cannot be cloned by any
userland clone; use TypeScript `private` or a `_` prefix instead.
