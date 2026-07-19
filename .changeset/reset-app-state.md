---
'@magic-use-case/solid': minor
'@magic-use-case/react': minor
---

Add `resetAppState()`, a protected method on `UseCase`, so a use case can clear
application state — for a log-out, say — and let the next execution bootstrap it
again. It clears state, the event bus's retained copy, the in-flight dedup map
and any bootstrap in flight, then notifies presenters.

Only use cases can trigger it: the method is protected, and calling it outside a
running use case throws.
