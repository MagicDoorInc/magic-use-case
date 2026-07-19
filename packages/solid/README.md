# @magic-use-case/solid

SolidJS >1.9.3 bindings for [magic-use-case](https://github.com/MagicDoorInc/magic-use-case) —
clean-architecture use cases and presenters for front-end TypeScript.

```bash
npm install @magic-use-case/solid
```

## Exports

- `UseCase` — base class for your application logic
- `Presenter` — maps use-case state to a view model
- `useUseCase` — execute a use case, with loading and progress state
- `usePresenter` — subscribe a component to a presenter's model
- `ErrorHandler` — error boundary wired to the use-case error channel
- `Navigator` — bridges use-case navigation events to your router

See the [main README](https://github.com/MagicDoorInc/magic-use-case#readme)
for usage and examples.

## License

Apache-2.0
