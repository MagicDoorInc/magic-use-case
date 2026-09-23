---
"@magicdoor/magic-use-case-react": minor
"@magicdoor/magic-use-case-solid": minor
---

Remove `didSucceed` from `useUseCase`. `execute` now resolves to `true` when the run succeeded and `false` when it failed, so a follow-up to a run goes after the `await` in the handler that started it, instead of in an effect watching a flag. Replace `useEffect(() => { if (didSucceed) … }, [didSucceed])` with `if (await execute(params)) …`; for whether something loaded, render from a presentation's model.

A `File` or `Blob` in application state is handed out as itself rather than behind the readonly proxy, so it can be passed to `FormData`, `fetch`, `URL.createObjectURL` and `structuredClone`. It is also kept as the same object when state is adopted, and in React a different file now replaces the one on screen instead of comparing equal to it.
