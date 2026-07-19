---
'@magic-use-case/solid': minor
---

Add server-side rendering support. The package now ships a second bundle
compiled with Solid's SSR generator, and its exports map routes `node`, `deno`,
and `worker` to it.

Note that application state is still process-global rather than request-scoped,
so a shared server process must not be used to render per-user state yet.
