---
'@magic-use-case/solid': minor
---

Fail fast instead of leaking state across server-side requests. Application
state is process-global by design, which is correct in a browser but unsafe on a
server, where concurrent requests share it. The server build now throws when a
use case is executed, use-case state is read, or a `Presenter` is constructed.

Server-side rendering of static markup is unaffected. Client behaviour is
unchanged — the guard is only enabled when Solid reports `isServer`.
