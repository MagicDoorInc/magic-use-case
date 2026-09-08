---
"@magicdoor/magic-use-case-react": minor
"@magicdoor/magic-use-case-solid": minor
---

**`MagicUseCaseTypes` is gone.** `usePresenter` no longer reads the application's state type from a module augmentation; it infers it from the presentation it is given, as it did before 0.1.1.

A presentation is already checked against the state type it declares — `Presentation<AppState, TModel>` — and that is the check that matters. The augmentation only rejected a presentation deliberately annotated with a different state type, which nobody does by accident, at the cost of a `declare module` block every application had to know about.

An application that added the block removes it; the compiler points at it. An application that never did sees no change.
