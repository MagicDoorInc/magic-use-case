# @magicdoor/magic-use-case-solid

SolidJS >1.9.3 bindings for [magic-use-case](https://github.com/MagicDoorInc/magic-use-case) —
clean-architecture use cases and presentations for front-end TypeScript.

```bash
npm install @magicdoor/magic-use-case-solid
```

## Exports

- `UseCase` — base class for your application logic
- `Presentation` — the type of a function mapping state to a view model
- `DeepReadonly` — the type of a model as a screen sees it
- `useUseCase` — execute a use case, with loading, progress and success state
- `usePresenter` — subscribe a component to a presentation's model
- `Presenter` — the presentation holder behind `usePresenter`, for wiring of your own
- `ErrorHandler` — error boundary wired to the use-case error channel
- `Navigator` — bridges use-case navigation events to your router
- `onError` / `onNavigation` — subscribe to those two channels directly
- `createScope` / `setScopeResolver` — one scope per request, for server rendering
- `StateTransfer` — hands the state a server rendered with to the browser, so the page it hydrates starts from it

The server build is selected by export condition — `node`, `deno` and `worker` resolve to it — so there is no separate
entry point to import. It is what gives each request a scope of its own.

New to it? The [main README](https://github.com/MagicDoorInc/magic-use-case#readme)
introduces the five players, walks a complete feature in five steps, and sets out
the rules the library is built around.

## Credits

Created by Norbert Nemes.

## License

Apache-2.0 © MagicDoor, Inc.
