---
'@magic-use-case/solid': patch
'@magic-use-case/react': patch
---

Fix a `TypeError` when reading state built with `Object.freeze`. A Proxy `get`
trap must return the target's exact value for a non-writable, non-configurable
property, so frozen properties are now handed back unwrapped instead of being
proxied. This makes immutable state patterns — a stable root whose branches are
replaced with new frozen values — usable.
