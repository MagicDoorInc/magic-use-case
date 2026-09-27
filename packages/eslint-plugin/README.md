# @magicdoor/eslint-plugin-magic-use-case

ESLint rules for [magic-use-case](https://github.com/MagicDoorInc/magic-use-case): use cases run behaviour,
presentations map state to models, and the UI only asks for either.

```sh
npm install -D @magicdoor/eslint-plugin-magic-use-case
```

```js
// eslint.config.js
import magicUseCase from '@magicdoor/eslint-plugin-magic-use-case';

export default [
  // …your other config
  { files: ['src/**/*.{ts,tsx}'], ...magicUseCase.configs.recommended },
];
```

The rules read TypeScript, so the files they cover need `@typescript-eslint/parser` — which a TypeScript project has
already. `recommended` turns every rule on as an error.

## Rules

### no-use-case-outside-use-case

Only a use case constructs another use case. The UI runs one through `useUseCase(SomeUseCase)`; a use case runs another
with `await new SomeUseCase().execute()`, which is what keeps the nested run quiet and its caller announcing once.

A use case is recognised by name: a `new …UseCase()` is allowed only inside a class that extends a `…UseCase` —
`UseCase`, `BaseUseCase`, `MagicUseCase`.

### pure-presentations

A presentation maps state to a model and nothing else: no `execute`, no `useUseCase`, `usePresenter` or `createUseCase`,
no `new …UseCase()`. A presentation is a function named `present…`, or one typed `Presentation<…>`.

### no-catch-on-execute

The `execute` that `useUseCase` returns never rejects. It resolves to `false` when the run failed, and the failure has
already gone to `ErrorHandler`. A `catch` around it is dead code, and what follows the call runs even when the run
failed:

```tsx
try {
  await createPaymentMethod(input);
  toast.success(t(TranslationKeys.SUCCESS)); // shown when saving the card failed, too
} catch {
  toast.error(t(TranslationKeys.PAYMENT_UNKNOWN_ERROR)); // never runs
}
```

Branch on the result instead: `if (!(await createPaymentMethod(input))) return;`. The rule reports a `.catch()` on
`execute`, and an `execute` inside a `try` with a `catch` whose result is thrown away. One whose result is used is left
alone, since the `catch` may be there for something else in the block.

### no-deep-readonly

A model from `usePresenter` is already readonly. Type a prop by the view model type the presentation returns, or let it
be inferred — naming `DeepReadonly`, or writing one, is reported.
