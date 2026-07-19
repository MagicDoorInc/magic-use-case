---
'@magic-use-case/solid': minor
'@magic-use-case/react': minor
---

**Breaking.** `isAppStateInitialized()` is removed from `UseCase`. Delete your
implementations; core now decides when to bootstrap by checking whether state
exists.

Application state bootstraps exactly once. Previously a use case whose
`isAppStateInitialized()` returned `false` would re-run `initializeState()` and
silently replace live state — easy to hit by extending `UseCase` directly
instead of a project base class. `resetAppState()` is now the only way back to
an uninitialized state.
