---
'@magic-use-case/solid': minor
'@magic-use-case/react': minor
---

Confine application state mutation to use cases. `getState()` now returns a deep
proxy that permits writes only while a use case is running; writes from anywhere
else throw instead of silently desyncing the UI, which previously happened
because no state-change event was emitted.

This is a behavioural change: code that mutated state outside a use case now
fails loudly. Presenters are unaffected — they already received a readonly view.
