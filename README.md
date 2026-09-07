# magic-use-case

Clean-architecture use cases and presentations for front-end TypeScript — a small, extensible structure for organizing
application logic outside your UI framework.

The idea is one sentence: **your application's behavior should not live in your components.** What the app _does_ goes
in a use case, what the screen _shows_ comes from a presentation, and the component draws pixels and forwards clicks.
The library makes that separation real — several of the rules below are enforced by the compiler and at runtime, not
left to review.

| Package                                               | Framework      | Version |
| ----------------------------------------------------- | -------------- | ------- |
| `[@magicdoor/magic-use-case-react](./packages/react)` | React ≥17      | `0.1.0` |
| `[@magicdoor/magic-use-case-solid](./packages/solid)` | SolidJS >1.9.3 | `0.1.0` |

```bash
npm install @magicdoor/magic-use-case-react   # or @magicdoor/magic-use-case-solid
```

Requires Node ≥18. The two adapters share one core and behave identically. The examples below are React; in Solid the
only differences are the import, the JSX, and that what the hooks return are accessors — `model()` and `isLoading()`
rather than `model` and `isLoading`.

## The shape of a feature

Every feature is the same loop, in both directions:

```text
┌─────────────────────────────────────────────────────────────────┐
│                           COMPONENT                             │
│               draws the screen, forwards the click              │
└──────┬─────────────────────────────────────────────────┬────────┘
       │ useUseCase(...)                usePresenter(...)│
       ▼                                                 │
┌──────────────┐        ┌──────────────┐         ┌───────┴─────────┐
│   USE CASE   │─writes▶│  APP STATE   │─read by▶│  PRESENTATION   │
│ decides what │        │  one truth   │         │ turns state into│
│should happen │        │              │         │  what is shown  │
└──┬────────▲──┘        └──────────────┘         └─────────────────┘
   │        │
   │ asks   │ returns data
   ▼        │
┌──────────────┐
│   GATEWAY    │   your code: HTTP, storage, SDKs
└──────┬───────┘
       ▼
   the outside world
```

Read it as a story: _the user clicks Load → the component calls a use case → the use case asks a gateway for the data
→ the gateway returns your own types → the use case writes them into state → the presentation formats them → the
component renders it._

Two arrows are the ones people get wrong. The gateway **returns data to the use case**; it never writes state and
never touches the UI. And there is **no arrow from the component to the gateway** — that shortcut does not exist.

Five kinds of thing, each with one job:

| Layer            | May                                           | May not                                                          |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| **Component**    | call use cases, render a model                | touch state, call a gateway, format, filter, hold business state |
| **Presentation** | read state, derive what is shown              | run a use case, cause a side effect, write anything              |
| **Use case**     | write state, decide, sequence, call gateways  | touch the DOM or browser APIs                                    |
| **Gateway**      | cross the process boundary, return your types | write state, touch the UI                                        |
| **State**        | be the one truth                              | be written from anywhere but a use case                          |

A numbered chapter each follows, in that order. [Quick start](#quick-start) then builds one feature out of all five.

## 1. Components

Draws the screen and forwards the click. There is deliberately very little to say about it, and that is the point:

```tsx
const { execute: pay, isLoading, didSucceed } = useUseCase(PayUseCase);
const { model } = usePresenter(presentPayment);
```

Those two hooks are the whole of the component's API:

- `useUseCase(SomeUseCase)` gives you `execute`, plus `isLoading` (true while the run it started is in flight),
  `didSucceed` (false until a run finishes without throwing, and false again the moment the next one starts) and
  `progress` (see [Progress](#progress-for-work-the-user-watches)). They describe *that* run — not the use case
  globally, and not anything a nested or detached run does.
- `usePresenter(somePresentation)` gives you `model`, which is `undefined` until state exists and readonly thereafter.

**It holds** markup, layout, and local view state that nothing else could care about — which tab is open, whether a
menu is expanded, an uncommitted keystroke on its way to an edit use case.

**It does not hold** a `fetch`, a format, a filter, a sort, a business rule, a try/catch, or a decision about what the
app should do next. Every one of those has a home, and it is not here.

**It never touches application state.** Not a read, not a write — a component has no access to it at all. It asks for
a change by executing a use case, and it learns what happened by rendering a presentation's model. That is the whole
of its relationship with state, and it is why the two hooks above are the entire API: there is no third one that
reaches the state itself.

It is also the only part of your application that knows which UI framework you use — which is why it is the part you
rewrite when you move to another one, and the part with no tests worth writing.

## 2. Presentations

Turns state into exactly what a screen shows. A pure function, nothing else: no side effects, no use-case calls, no
writes. Every format, filter, sort and label happens here, so the component receives values it can render directly.

```ts
const presentPayment: Presentation<AppState, PresentablePayment> = (state) => ({
  total: currency(state.payment.total), // "$1,240.00", not 1240
  canSubmit: state.payment.methodId !== undefined,
});
```

How one behaves — the work shared between screens, how little of the screen a change touches, how models compose, and
why the one you are handed is readonly:

Ten screens rendering the same presentation do not run it ten times. Presenters given the same presentation share a
single run of it: the model is built once per state change and handed to all of them, and the last presenter to be
destroyed releases it.

Sharing is keyed on the **identity** of the function you pass — the object itself, not its name. That is deliberate: a
minifier renames `presentTenants` to `e`, and two unrelated presentations with identical bodies can end up with the
same name, so keying on the name would silently merge them. Identity survives any squeezing a bundler does.

Which means: export presentations at module scope and pass them by reference.

```ts
// shared: every screen passes the same function object
export const presentTenants: Presentation<AppState, PresentableTenants> = (state) => ({ … });
usePresenter(presentTenants);

// not shared: a new function on every render, and it captures stale props.
// do this and I will look for you, I will find you, and I will explain the
// difference — I have a special set of skills and a slightly Irish accent.
usePresenter((state) => ({ names: state.tenants.map(() => props.format) }));
```

**Never write one inline.** A presentation derives its model from state alone, so an inline one gains nothing and
loses two things: it runs on its own instead of sharing the single model every other screen is reading, and it closes
over the props of the render that created it, so it is stale the moment they change. There is no case where the
inline version is the right answer — give it a name, export it, and pass the name.

> [!NOTE] **`Presenter` is exported too**, and it is what `usePresenter` is built on: it holds a presentation, reruns
> it on every state change, and hands the model to whoever subscribed. Reach for it only to wire a presentation into
> something that is not a component — another framework, a canvas, a worker. It is infrastructure, not a base class:
> do not extend it, and do not construct one inside a presentation.

> [!NOTE] `usePresenter` **reads the presentation once**, when the component first runs — the same way a component
> keeps the store it created. Passing a different function on a later render does not swap it, so
> `usePresenter(isAdmin ? presentAdmin : presentUser)` keeps whichever was there first. Choose the presentation with
> the component, not inside it: render a different component, or make the branch part of the model.
>
> Or hold all of them. Declare a presenter for each and read whichever the moment calls for:
>
> ```ts
> const { model: admin } = usePresenter(presentAdmin);
> const { model: user } = usePresenter(presentUser);
> // ...then render from admin or user, branching as often as you like
> ```
>
> Nothing is wasted by holding two or three. Each model is built once per state change and shared with every other
> screen reading the same presentation, so a second presenter adds a subscription, not a second run.

### A model is rebuilt, but the screen is not

---

A presentation runs again on every state change and returns a whole new object. That sounds expensive, and it would be
if the object went straight to the renderer. It does not: `usePresenter` puts it through a **reconciled store**, which
compares the new model against the one on screen and keeps the parts that did not change.

What that means in each adapter:

- **Solid** — the model backs a store updated with `reconcile`, so only the signals whose values actually changed
  fire. Add one tenant to a list of two hundred and one row is created; the other 199 rows and every unchanged field
  are never touched.
- **React** — unchanged sub-trees come back as the _same object_, so `React.memo`, `useMemo` and dependency arrays all
  see an unchanged reference and skip. If nothing at all changed, the store returns the previous state and React does
  not re-render.

So there are three separate reasons the UI does less work than the naive reading suggests, and they stack:

1. **A run announces only if nobody is waiting on it** — a flow of ten nested steps produces one announcement, not
   ten.
2. **One run per presentation**, however many screens hold it.
3. **One rebuild per changed value**, because the reconciled store keeps the rest.

The practical consequence for you: write presentations plainly. Map, sort, format, derive a label — do it every time,
on the whole model, without memoizing by hand. The identity work that makes rendering cheap has already been done
underneath you, and hand-rolled caching on top of it is where the stale value comes from.

### View models compose

---

A view model is not one flat object per screen. Build it from smaller ones, the same way the screen is built from
smaller components:

```ts
export interface PresentableUnit {
  name: string;
  address: string;
  bedrooms: string; // "2 bed", not 2
}

export interface PresentableLease {
  displayName: string;
  unit: PresentableUnit; // a view model inside a view model
  rent: string;
  statusLabel: string;
}

export interface PresentableDashboard {
  greeting: string;
  leases: PresentableLease[];
}
```

And the presentations that build them are plain functions, so they compose by being called:

```ts
const presentUnit = (unit: Unit): PresentableUnit => ({
  name: unit.name,
  address: formatAddress(unit.address),
  bedrooms: `${unit.bedrooms} bed`,
});

const presentLease = (lease: Lease): PresentableLease => ({
  displayName: lease.displayName,
  unit: presentUnit(lease.unit), // just a call
  rent: currency(lease.rent),
  statusLabel: labelFor(lease.status),
});

export const presentDashboard: Presentation<AppState, PresentableDashboard> = (
  state,
) => ({
  greeting: `Hello, ${state.user.firstName}`,
  leases: state.leases.map(presentLease),
});
```

Two things this buys you. **A formatting rule is written once** — every screen showing a lease shows the same rent
format and the same status label, because they all go through `presentLease`. And **a nested model is what a child
component takes as a prop**, so a `<LeaseCard lease={model.leases[0]} />` needs nothing from state and nothing
formatted at the call site.

> [!NOTE] Compose by **calling a function**, never by constructing a `Presenter` inside a presentation. `usePresenter`
> is what shares work between screens, keyed on the identity of the function you hand it; a presentation calling
> another is an ordinary call, computed as part of the outer run.

A child component's prop type is the nested model wrapped in `DeepReadonly`, since that is what it receives:

```tsx
function LeaseCard({ lease }: { lease: DeepReadonly<PresentableLease> }) { … }
```

### The model is readonly

---

One model is shared by every screen using that presentation, so a component that wrote to it would be rewriting what
the others are rendering. `usePresenter` returns `DeepReadonly<TModel>`, enforced by the compiler and by the same
proxy at runtime.

`DeepReadonly` describes the model as the screen sees it, not as a mapped copy of it. A `Map` or `Set` becomes a
`ReadonlyMap` or `ReadonlySet` whose reads still work — `size`, `has`, `get`, iteration — while `set`, `add`, `delete`
and `clear` throw. Arrays become `readonly` arrays. Methods pass through untouched, so a model may carry an object
with behavior and still be callable; the object is recognizable too, `constructor` and `instanceof` answering the way
they would without the proxy. Only writes are refused.

## 3. Use cases

Decides what happens. It is the only thing allowed to write application state, the only thing that calls gateways, and
the place every business rule lives — validation, sequencing, what a failure means, where to navigate next.

```ts
class PayUseCase extends BaseUseCase {
  protected async runLogic(request: PaymentRequest) {
    this.getState().receipt = await paymentGateway.pay(request);
  }
}
```

One use case is one thing the app does. A flow that needs several is [a use case that runs
them](#higher-order-use-cases).

### Where the gateways come from

---

`paymentGateway` above is simply imported. A use case takes **no dependencies through its constructor** — the only
argument it accepts is the progress reporter — so gateways are not injected into it. They are module singletons,
constructed once where they are declared and imported by whichever use cases need them:

```ts
// paymentGateway.ts — constructed once, with its own dependencies injected
export const paymentGateway = new PaymentGateway(networkManager, tokenStore);
```

```ts
// payUseCase.ts
import { paymentGateway } from '~/gateways/paymentGateway';
```

That looks like the thing dependency injection exists to avoid, and it would be — except that **the seam is one layer
lower**. Every gateway is built on the shared [network manager](#every-gateway-is-built-on-one-network-manager), and
that is what a test replaces. Stubbing it answers the server for every gateway at once while each one still runs its
real code, so nothing is gained by making the use case take its gateways as parameters, and something is lost: every
call site would have to name them.

So the injection happens once, at the `export const` line, and the use case just imports. Two rules keep that honest:

- **Construct the gateway with its dependencies**, never reaching for them inside. `new PaymentGateway(networkManager,
  tokenStore)` is what lets the gateway be pointed somewhere else — a different transport on the server, a fake token
  store in a test.
- **Import the singleton, do not construct one.** A second instance is a second configuration, and only one of them is
  the one your tests stubbed.

What follows is what a single `execute()` does — when it runs, when it does not, and how it reports progress — and then
how use cases compose when a flow needs several.

### One run, not five

---

Running the same use case with the same parameters while it is already running does not start a second one. The later
callers join the run in flight and get its outcome — including its failure:

```ts
await Promise.all([
  new LoadTenantsUseCase().execute("lease-1"),
  new LoadTenantsUseCase().execute("lease-1"),
  new LoadTenantsUseCase().execute("lease-1"),
]);
// one execution, one request, three callers satisfied
```

Three components mounting at once, a click that fires twice, a retry racing the original — none of them need a guard
in the component, because the de-duplication is in the library. Runs are keyed by the use case and its parameters, and
the key is dropped when the run ends, so this is **de-duplication, not caching**: calling it again afterwards runs it
again, as it should.

A caller that joins a run already in flight is still a caller: if nobody is waiting on it, it announces when the run
it joined completes. That matters when the run it joined was nested inside something else and therefore silent —
without it, a screen asking for something another flow was already fetching would never be told it arrived.

#### Different parameters are different work — so await them


De-duplication is keyed on the parameters, so different ones mean two real runs:

```ts
await new LoadLeaseUseCase().execute("lease-1");
await new LoadLeaseUseCase().execute("lease-2"); // runs after the first finished
```

**Await, and the order is yours.** Each run completes before the next begins, so the last one you started is the last
to write, and the state you end up with is the state you asked for last. That is almost always what you want, and it
is the default you should reach for.

The trouble starts when nothing awaits:

```ts
void new LoadLeaseUseCase().execute("lease-1");
void new LoadLeaseUseCase().execute("lease-2"); // both in flight at once
```

Now they overlap, and if they write the same place in state **whichever finishes last is what remains** — which is the
slower request, not the one you started last. Switch tabs quickly enough and the screen settles on the tab you left.

So: `await` **your use cases.** `void execute(...)` is for the cases that genuinely do not need an answer, and it
costs you ordering.

Awaiting is not always available, though — two components each running their own use case cannot await each other.
When runs really are concurrent, fix it inside the use case rather than in the component:

- **Key the state by what it describes.** `state.leases[leaseId] = …` rather than `state.selectedLease = …`. Two runs
  then cannot overwrite each other at all, and the presentation reads the entry for whatever is selected now.
- **Re-read the subject after each** `await`**.** If what the run was started for has changed, stop:

```ts
protected async runLogic(leaseId: string) {
  this.getState().selectedLeaseId = leaseId;                 // what is wanted, recorded before the wait
  const lease = await leaseGateway.get(leaseId);
  if (this.getState().selectedLeaseId !== leaseId) return;   // something else is wanted now; drop it
  this.getState().selectedLease = lease;                     // what has arrived
}
```

Two fields, and both earn their place: the id is what the screen is asking for, the lease is what has been loaded for
it. Comparing `selectedLease?.id` instead would not work — at that point it still holds the *previous* lease, so the
run that should win would drop its own result.

Reach for those rather than a request id or a cancellation token: the problem is not knowing _which_ run you are, it
is writing somewhere two runs share.

#### Two screens, one use case, different filters

The common shape of all this: two screens showing the same data filtered differently, each loading it for itself.

```ts
// the open-requests screen                 // the closed-requests screen
loadRequests({ status: "open" });           loadRequests({ status: "closed" });
```

**They do not coalesce.** Different parameters are a different key, so both runs happen and both requests go out —
which is what you want, because they are asking for different things.

What they do share is where the answer lands. Both writing `state.requests` means the second overwrites the first, and
whichever screen's request was slower is the one showing the other's data — no error, and a screen that looks merely
out of date rather than wrong. So key the state by the question each run asked:

```ts
protected async runLogic(filter: RequestFilter) {
  const requests = await requestGateway.list(filter);
  this.getState().requestsByStatus[filter.status] = requests; // one entry per question
}
```

Each presentation then reads its own entry, the two runs never touch the same place, and the order they finish in
stops mattering.

> [!WARNING] **Do not put a** `Set` **or a** `Map` **in a filter.** The de-duplication key is `JSON.stringify(params)`,
> and both stringify to `{}` — so `{ statuses: new Set(["open"]) }` and `{ statuses: new Set(["closed"]) }` are the
> same key, the second screen joins the first run instead of making its own, and it renders data it never asked for.
> Filters are where this bites, because a set of selected values is such a natural thing to pass. Use an array — and
> sort it, so the same selection made in a different order is the same key.

### Progress, for work the user watches

---

`useUseCase` returns a `progress` number alongside `isLoading`, and the use case is what moves it. A use case receives
an optional reporter as its constructor argument and calls it:

```ts
class CreateRequestUseCase extends BaseUseCase {
  private done = 0;

  protected async runLogic(request: NewRequest) {
    // one step for the request itself, one per file
    const step = 100 / ((request.files?.length ?? 0) + 1);

    this.onProgress?.(0);
    const { id } = await requestGateway.create(request);
    this.advance(step);

    for (const file of request.files ?? []) {
      await requestGateway.upload(id, file);
      this.advance(step); // the bar moves per file, not per byte
    }
  }

  private advance(step: number) {
    this.done = Math.round(this.done + step);
    this.onProgress?.(this.done);
  }
}
```

```tsx
const {
  execute: submit,
  isLoading,
  progress,
} = useUseCase(CreateRequestUseCase);

{
  isLoading && <ProgressBar percent={progress} />;
}
```

`isLoading` answers _whether_, `progress` answers _how far_. Use both: a bar that sits at 0 for four seconds and then
jumps to 100 is worse than a spinner, so report the first step before any work starts, as the `onProgress?.(0)` above
does.

**Thread it through a higher-order use case.** Nested use cases are constructed by hand, so a flow that wants the
inner steps to drive the bar passes its own reporter down:

```ts
class SubmitRequestUseCase extends BaseUseCase {
  protected async runLogic() {
    …
    await new CreateRequestUseCase(this.onProgress).execute(values);
  }
}
```

That works for one inner step. **Hand the same reporter to several and the bar restarts for each**, because what a
use case reports is absolute — the number it passes is the number the screen shows, and the last one to report wins.
Five steps each counting themselves from 0 to 100 give you five bars, played in sequence.

So give each step the slice of the bar it owns, and let it go on counting itself from 0 to 100 in ignorance of the
rest:

```ts
class SubmitRequestUseCase extends BaseUseCase {
  protected async runLogic(values: RequestValues) {
    await new ValidateRequestUseCase(this.share(0, 10)).execute(values);
    await new CreateRequestUseCase(this.share(10, 70)).execute(values);
    await new AttachFilesUseCase(this.share(70, 95)).execute(values);
    await new NotifyManagerUseCase(this.share(95, 100)).execute(values);
  }

  /** One step's reporter: its own 0-100 becomes the part of the bar it was given. */
  private share(from: number, to: number) {
    return (percent: number) => this.onProgress?.(Math.round(from + ((to - from) * percent) / 100));
  }
}
```

Each child stays unaware it is part of anything larger, which is what lets it be used on its own screen too. The
widths are a guess at how long each step takes, not an equal split between them — the bar's job is to move at a rate
the user believes, so give the slow step the room it needs. A step that reports nothing at all simply leaves the bar
where the step before it finished.

That is the one thing progress needs that state does not: it is not global, it belongs to the run the screen started,
so it travels by constructor rather than through the scope.

**Detached runs have no progress**, because nobody is waiting on them — see [Work the caller does not wait
for](#work-the-caller-does-not-wait-for). Work the user watches is work you await.

### Higher-order use cases

---

A flow that needs several steps **is itself a use case** — one that sequences lower-order ones and branches on what
they leave in state. Not a hook, not a page-state object, not a component effect:

```ts
class InitializeAppUseCase extends BaseUseCase {
  protected async runLogic() {
    await new LoadCompanyUseCase().execute();
    await new LoadTenantsUseCase().execute();
  }
}
```

The trigger is concrete: you are about to `await` a second use case and branch on what the first one did. That branch
is a business rule, and a component is the wrong place for it. Two things follow from putting it here:

- **The screen reads one loading state.** `useUseCase(InitializeAppUseCase)` gives you `isLoading` and `didSucceed`
  for the whole flow. Do not hand-assemble it from the inner ones — `isLoadingA() || isLoadingB() || …` is the smell
  that the sequencing is in the wrong layer.
- **Staleness is handled inside**, not in the component. Key state by what it describes so two runs cannot overwrite
  each other, and re-read the subject after each `await` so a run whose subject changed can stop.

#### Not a context

The temptation, when several use cases belong to one screen, is to wrap them in a context and expose them as one
object:

```tsx
// don't
const CheckoutContext = createContext();

function CheckoutProvider({ children }) {
  const { execute: validate } = useUseCase(ValidateAccountUseCase);
  const { execute: quote } = useUseCase(GetQuoteUseCase);
  const { execute: pay } = useUseCase(PayUseCase);

  const checkout = async (request) => {
    // ← the flow, in the UI layer
    await validate(request.accountId);
    await quote(request);
    if (needsConfirmation) return;
    await pay(request);
  };

  return (
    <CheckoutContext.Provider value={{ checkout }}>
      {children}
    </CheckoutContext.Provider>
  );
}
```

That is a higher-order use case wearing a provider costume. The ordering and the branch are business rules, and
putting them here costs you all four things this architecture is for: they cannot be tested without rendering, they
cannot run from anywhere but inside that tree, they do not travel to another framework, and the failure of one step no
longer aborts the rest — each `execute` came from a hook, and hooks swallow.

Write the flow as a use case and let the screen call one thing:

```ts
class CheckoutUseCase extends BaseUseCase {
  protected async runLogic(request: CheckoutRequest) {
    await new ValidateAccountUseCase().execute(request.accountId);
    await new GetQuoteUseCase().execute(request);

    if (this.getState().checkout.needsConfirmation) return; // a business rule, stated once
    await new PayUseCase().execute(request);
  }
}
```

```tsx
const {
  execute: checkout,
  isLoading,
  didSucceed,
} = useUseCase(CheckoutUseCase);
```

Contexts are still the right tool for what they are for — a theme, a locale, a router. They are not a place to keep
application behavior.

**A nested use case does not update the screen.** It writes state exactly as it always does — `getState()` works, the
mutation window is open, everything it writes is real — but it announces nothing. Its caller does, once, when it
finishes, carrying everything written beneath it.

How the library tells the difference is worth knowing, because you choose it at the call site: a use case you
construct yourself has a caller and stays quiet, while one an adapter created — `useUseCase`, or `detach` — has
none, and announces.

```ts
class InitializeAppUseCase extends BaseUseCase {
  protected async runLogic() {
    await new LoadCompanyUseCase().execute(); // writes state, announces nothing
    await new LoadTenantsUseCase().execute(); // writes state, announces nothing
  }
} // ← one announcement, here
```

Which is why the ten screens watching rerender once rather than once per step, and why a flow does not flash through
half-loaded states on the way to its result. **Writing and announcing are different things**, and only the second is
held back.

**A detached run does announce, though**, because it is not nested — nobody is waiting on it, so there is no caller
for it to stay quiet on behalf of. It announces its own work when it lands, separately from the run that started it:

```ts
class SubmitRequestUseCase extends BaseUseCase {
  protected async runLogic() {
    this.detach(CreateRequestUseCase, values); // announces when it finishes, later
    this.getState().form = emptyForm();
  }
} // ← announces the cleared form, now
```

The screen clears immediately and the new row appears when the work lands: two updates, which is exactly what you
asked for by detaching. See [Work the caller does not wait for](#work-the-caller-does-not-wait-for).

**Runs that are not nested in each other do not wait for each other.** Two flows a screen started independently —
an initialization still going, and the page's own fetch landing underneath it — each announce when they finish. The
screen hears about the leases when the leases arrive, not when everything else happens to be done.

**Navigation and failures are never held back.** A nested use case that calls `navigate()` moves the screen
immediately — usually the point: route first, and let the data that is still loading fill in. A failure travels the
same way, up to whichever run has no caller, and is reported there.

### Work the caller does not wait for

---

Sometimes a use case should start something and return — the screen goes back to the list, and the new row appears
when the work lands. That is `detach`:

```ts
protected detach(UseCaseClass: UseCaseClass<T>, params?: unknown): void
```

It takes the **class**, not an instance — the library constructs it — and returns `void`. There is nothing to await,
which is the point.

```ts
class SubmitRequestUseCase extends BaseUseCase {
  protected async runLogic() {
    const form = this.getState().form;
    form.errors = validateRequest(form.values); // awaited: the screen needs the answer
    if (form.errors.size > 0) return;

    this.detach(CreateRequestUseCase, form.values);
  }
}
```

```tsx
const { execute: submit, isLoading } = useUseCase(SubmitRequestUseCase);

await submit(); // resolves as soon as validation passes
close(); // the modal shuts; the row appears when the work lands
```

**Validate first, then detach.** Anything the screen needs an answer about has to happen before the detached call —
the caller returns immediately, and after that nobody is listening for a verdict.

#### What a detached run is


Not nested. It never holds its starter open, so the starter announces its own changes right away and the detached run
announces its own when it finishes. Nobody is waiting on it either, which is why **its failure is reported rather than
thrown** — it reaches `ErrorHandler` like any other, and there is no rejection left dangling for Node to complain
about.

De-duplication still applies: detaching a use case that is already running with the same parameters joins the run in
flight rather than starting a second.

#### When to reach for it


- A background refresh where the screen already has something to show.
- Work that outlives the screen that started it — the modal closes, the upload continues.
- Fire-and-forget reporting: analytics, a read receipt, a "last seen" ping.

#### When not to


- **Anything the user watches.** A detached run has no caller, so `isLoading`, `didSucceed` and `progress` describe
  only the starter. A tenant uploading four photos should see the bar move, so that one is awaited.
- **Anything a later step depends on.** Detaching breaks the sequence — that is its whole purpose — so a step whose
  result the next one needs must be awaited.
- **Anything whose failure should stop the flow.** A detached failure is reported, not thrown, so it cannot abort
  anything.

#### Testing it


The work finishes after `execute()` resolves, so a test waits for the result rather than for a clock — see [Work that
outlives the call](#work-that-outlives-the-call).

## 4. Application state

The one truth. A plain, mutable object holding everything the app knows — not what it is doing, not how the last
request went. Only a use case may write to it; everything else reads.

```ts
export interface AppState {
  tenants: Tenant[];
  selectedLeaseId?: string; // what the screen is asking for
  selectedLease?: Lease; // what has been loaded for it
}

export const createAppState = (): AppState => ({ tenants: [] });
```

How writing to it works — when you may, what happens when you do, and how it comes into being:

Being **mutable** — not a reducer, not a frozen tree, not an action log — tends to raise an eyebrow, so it is worth
saying why it is safe here.

```ts
this.getState().tenants.push(tenant);
this.getState().selectedLease = lease;
```

Immutability is usually adopted to buy three things: knowing _when_ something changed, stopping code from changing it
behind your back, and being safe when several things are in flight at once. The first two arrive here by other means —
writes are confined to a running use case, and every change is announced when the app goes quiet. The guarantees come
through the boundary rather than through the data structure.

The third is worth separating into the part that is free and the part that is not. **A reader can never see a
half-written state**, because JavaScript runs one thing at a time: nothing interleaves inside a synchronous block, so
a presentation always derives its model from a state that is whole. A frozen tree buys you nothing there that the
runtime has not already given you, and the readonly view a presentation receives means it cannot be changed underneath
a screen mid-render either.

**Where it does cost you something is a run that writes on both sides of an** `await`**.** Giving up the thread lets
another run write in the gap, so the object ends up holding a field from each:

```ts
protected async runLogic(edit: Edit) {
  this.getState().form.name = edit.name;
  const email = await addressBook.resolve(edit.name); // another run writes the form here
  this.getState().form.email = email;                 // ...and this lands on top of it
}
```

Be honest about the comparison: **this is the one thing a frozen tree really does buy.** A reducer commits a whole
value in a single synchronous step, so you get one run's form or the other's and never a blend. It still does not
decide *which* — the second commit wins either way, and the loser is the slower request rather than the later one —
but it does rule out the mixture.

You get the same guarantee here by writing the way a reducer does: **do the waiting first, then write in one
uninterrupted block.** Nothing can interleave inside it, because nothing yields inside it.

```ts
protected async runLogic(edit: Edit) {
  const email = await addressBook.resolve(edit.name); // all the waiting, up front
  const form = this.getState().form;                  // ...then nothing yields
  form.name = edit.name;
  form.email = email;
}
```

> [!WARNING] **Do not carry a reference to part of state across an** `await`**.** If another run replaces that branch
> while you are gone, your reference is left pointing at the object it replaced, and your writes go somewhere nothing
> reads — no error, no event, no clue. Reach for `getState()` again after every `await` rather than holding what it
> returned.

Beyond that, the rest is sequencing, and it is fixed by sequencing: `await` your use cases, and key state by what it
describes so two runs cannot land in the same place at all. [One run, not five](#one-run-not-five) is that argument in
full.

What you save is the ceremony: no action types, no reducer per slice, no `{...state, a: {...state.a, b: {...state.a.b,
c}}}` to change one nested field — which is where a surprising share of state bugs actually live.

You _can_ work immutably, and the library supports it fully (see below). It earns its keep in narrow cases —
time-travel debugging, reference equality as a memoization shortcut across a very large tree, or a branch that several
runs really do write across their awaits. For most applications it is effort without a return, and the honest default
is to mutate.

`getState()` returns a deep proxy that accepts writes only while a use case is running. Anywhere else — a component, a
presentation, a module holding a reference — the write throws:

```
[magic-use-case] Cannot call .push() on Array outside a use case.
```

This exists because a write made outside a use case emits no state-change event, so presentations keep rendering stale
data. That is a silent desync; the guard turns it into an error at the offending line.

Presentations are covered by a second, stricter rule: one receives a fully readonly view, and anything it passes
through to the view model stays readonly. That view never accepts a write, independently of whether a use case happens
to be running — so a presentation cannot write state even when a nested use case has left the mutation window open.

A presentation is only ever called with state. `resetAppState()` empties every model directly, so a presentation never
has to guard against the absence of the state its signature promises. One that throws anyway is reported to the
console and leaves its model empty, rather than failing the render or the emit that other screens are waiting on.

### Mutate in place, or replace immutably — your choice

---

The library takes no position on how state is shaped. Mutating in place is fully supported, and so is a Redux-style
approach where branches are replaced with new values. Both are allowed in the same state tree, even in the same use
case:

```ts
interface AppState {
  log: string[]; // mutated in place
  tenants: readonly Tenant[]; // replaced wholesale
}

class AddTenantUseCase extends BaseUseCase {
  protected async runLogic(tenant: Tenant) {
    const state = this.getState();

    state.log.push(`adding ${tenant.name}`);
    state.tenants = Object.freeze([...state.tenants, tenant]);
  }
}
```

The only rule is the one above: the write happens inside a use case.

The two styles differ in how presentations detect change. An in-place mutation keeps the branch's identity, so a
presentation comparing references sees nothing and must diff structurally — which is what the reconciled store does. A
replacement yields a new reference, so reference comparison is enough.

The root object itself stays stable either way: it is adopted once from `initializeState()`, and there is no API to
swap it wholesale.

### Bootstrapping

---

`initializeState()` is declared on `UseCase` but called exactly once per app run — by whichever use case executes
first. Put it on a single base class that every use case extends, and you write it once.

Core decides when to bootstrap, by checking whether state exists. A use case cannot force a re-initialization and
replace live state; concurrent first executions bootstrap once between them. `resetAppState()` is the only way back to
an uninitialized state.

### Resetting state

---

`resetAppState()` is `protected` on `UseCase`, so only a use case can trigger a reset — a component or presentation
has no access to it. Put it in a use case that represents the event:

```ts
class LogOutUseCase extends BaseUseCase {
  protected async runLogic() {
    await authGateway.logOut();
    this.resetAppState();
  }
}
```

It clears application state, the event bus's retained copy, the in-flight deduplication map, and any bootstrap still
in flight — all four, since leaving one behind resurrects the old state. Presentations are rerun so the UI clears, and
the next `execute()` bootstraps through `initializeState()` again.

`protected` is a compile-time boundary, so JavaScript can still reach the method. Calling it outside a running use
case throws, which is the same mutation window that governs every other write.

### State is adopted, not borrowed

---

The object returned from `initializeState()` is deep-cloned. The caller keeps their reference, but it is no longer
application state — writing to it has no effect and emits nothing:

```ts
const original = createAppState();
// ...after the use case has run
original.tenants.push(tenant); // legal, but changes nothing
```

`getState()` is the only way to reach live state. The clone preserves prototypes, so a class works if you want one:
`instanceof` holds and methods still work.

> [!WARNING] **A class rules out handing state to the browser.** Prototypes cannot be serialized, so a server render
> that reaches [handing state to the browser](#handing-the-state-to-the-browser) throws rather than shipping the fields
> without the behavior. The page still renders on the server — it is the handover that fails — but the browser then
> starts from nothing and fetches it all again. Plain objects keep that door open, which is why they are what the
> examples use.

> [!NOTE] `#private` **fields cannot be cloned.** There is no reflection for them, so a method reading `this.#field`
> on the clone throws `Cannot read private member`. Use TypeScript's `private` or a `_` prefix — both are ordinary
> properties and clone correctly.

One limit remains: **the mutation window is time-based, not call-based.** While a use case awaits, any code that
happens to run is inside the window and may write. The guard catches mistakes; it is not a security boundary.

## 5. Gateways

Crosses the process boundary — HTTP, storage, a database, a third-party SDK — and comes back with **your** types. It
never writes state and never touches the UI: it returns a value to the use case that asked, and the use case decides
what that means.

```ts
class TenantGateway extends Gateway {           // your base class, not the library's
  async list(): Promise<Tenant[]> {
    const response = await this.sendRequest({
      url: "/api/tenants",
      method: "GET",
    });
    return (await response.json()).map(toTenant); // never the wire shape
  }
}
```

This one is yours to write: the library has no `Gateway` type, so what follows is convention rather than API. It is
the half of the architecture most often skipped, which is why this is mostly design advice — and every gateway in it
is built on a single shared network manager, which is where it starts.

### Every gateway is built on one network manager

---

Not "each gateway does its own `fetch`". There are three layers, and each knows one thing.

> [!IMPORTANT]
> **Everything named in this chapter is yours to write.** `Gateway`,
> `NetworkManager`, `NetworkRequest`, `AuthTokenStore`, `RenderContext` — none of
> them come from the library, and none of them are importable. They are the shape
> that has worked, shown so you can copy it, not an API to call.
>
> `NetworkRequest` in particular is worth defining yourself rather than passing the
> platform's `Request` around: it is a plain object you own, so it can carry
> whatever your transport needs — a retry budget, a trace id, a timeout, an abort
> signal — and it stays inspectable in a test.
>
> ```ts
> export interface NetworkRequest {
>   url: string;
>   method: RequestMethod;
>   headers: Headers;
>   body?: BodyInit;
>   signal?: AbortSignal;
> }
> ```
>
> A `Response` is the one place the platform type is reasonable, because it never
> leaves the gateway — the gateway maps it and returns your own types.

#### 1. The network manager — the only place a request leaves the process


```ts
export interface NetworkManager {
  sendRequest(request: NetworkRequest): Promise<Response>;
}

export class BaseNetworkManager implements NetworkManager {
  constructor(private readonly context: RenderContext = renderContext) {}

  sendRequest = async (request: NetworkRequest): Promise<Response> => {
    const url = request.url.startsWith('http') ? request.url : `${BASE}${request.url}`;
    return fetch(this.resolve(url), { method: request.method, headers: request.headers, … });
  };

  /** A relative url means nothing on a server: there it dials the service directly. */
  private resolve = (uri: string) =>
    this.context.isServer ? `http://api-service${uri}` : uri;
}

export const networkManager = new BaseNetworkManager();
```

It knows about urls and `fetch`. It does not know about auth, status codes, retries, or your types.

#### 2. The base gateway — everything true of every request


```ts
export class Gateway {
  constructor(
    private readonly network: NetworkManager,
    protected readonly tokens?: AuthTokenStore,
  ) {}

  private static refreshing?: Promise<void>; // shared: one refresh, not one per gateway

  protected sendRequest = async (request: NetworkRequest): Promise<Response> => {
    let response = await this.transmit(request);

    if (response.status === 401) {
      try {
        await this.refreshTokens(); // once, under a cross-tab lock
      } catch {
        throw new UnauthorizedError();
      }
      response = await this.transmit(request);
    }
    if (response.status === 401) throw new UnauthorizedError();
    if (!response.ok) throw errorFor(response.status, await bodyOf(response));

    return response;
  };

  private transmit = async (request: NetworkRequest): Promise<Response> => {
    const token = (await this.tokens?.getAuthInfo())?.token;
    if (token) request.headers.set("Authorization", `Bearer ${token}`);

    try {
      return await this.network.sendRequest(request);
    } catch {
      throw new FailedToReachServer(); // offline, DNS, CORS — one name for all of it
    }
  };
}
```

This is where **authentication stops being anybody's problem.** Every request reads the token from the
`AuthTokenStore` and attaches it here, so no gateway method mentions a token, no use case passes one, and no component
has ever held one. A 401 is answered the same way and just as invisibly: refresh once — under a lock every gateway
shares, so ten requests failing together produce one refresh, not ten — then replay the request that failed. The use
case that called `list()` is never told any of it happened. It gets its tenants, or it gets an `UnauthorizedError`
it can act on.

Which leaves signing in and out as ordinary writes to the store — a use case puts tokens in, or clears them — and
every request after that picks up the change on its own. The store is the only thing in your application that knows
what a token is, and the only place to change how one is kept:

```ts
export interface AuthTokenStore {
  getAuthInfo(): AuthInfo | Promise<AuthInfo>;
  setAuthInfo(info: AuthInfo): void | Promise<void>;
}
```

Its `Promise` returns are what let it be something other than `localStorage` — a cookie read on the server, a keychain
on a native shell — without a single gateway changing.

#### 3. The concrete gateways — one per subject, each given the same instance


```ts
export const chatGateway = new ChatGateway(networkManager, tokenStore);
export const tenantGateway = new TenantGateway(networkManager, tokenStore);
```

### Why it is built this way

---

**It isolates you from the communication framework entirely.** Nothing above the gateway knows how the data arrives.
Not that it is HTTP, not that it is REST, not that `fetch` exists. Move to GraphQL, gRPC, a WebSocket, `axios`, or a
native bridge in a mobile shell, and the change stops at these two classes — the use cases, application state, the
presentations and every one of their tests carry on untouched, because none of them ever named the transport.

That is the same argument as [What this buys you](#what-this-buys-you), pointed the other way. Your code is
independent of the UI framework at the top and of the communication framework at the bottom, and what is left in
between is your application.

**One seam for the entire test suite.** Every gateway holds the _same_ `networkManager` object, so stubbing its one
method answers the server for all of them — and every gateway still runs its real code: url building, query
parameters, header construction, status handling, mapping. That is why this codebase has no gateway tests and still
covers gateways completely. The alternative — each gateway calling `fetch` itself — leaves you stubbing `fetch`
globally, or stubbing gateway methods and skipping the mapping that matters most.

**Auth is written once.** Attaching the token, noticing a 401, refreshing, and retrying is perhaps twenty lines.
Multiply it by thirty gateways and it is not twenty lines any more, it is thirty chances to get the refresh lock
subtly wrong. `refreshing` being `static` is the point: two gateways that 401 at the same moment wait on one refresh
instead of racing to spend the same refresh token twice.

**Failures become names before they leave.** A status code is an HTTP fact, and nothing above the gateway should ever
see one. `401` becomes `UnauthorizedError`, a `fetch` that throws — offline, DNS, CORS, a canceled request — becomes
`FailedToReachServer`, and a body carrying an error code becomes the error that code names. A use case branches on
`instanceof`, never on a number.

**Cross-cutting concerns get one home.** Retries, timeouts, a trace header, request logging, a circuit breaker — each
belongs in one of these two classes. Without them, each arrives as a pull request that touches every gateway.

**The network manager is injected, not imported.** `Gateway` takes a `NetworkManager`, so it depends on the interface
rather than on `fetch`. That is what lets a server build swap the transport, and what keeps the gateway free of the
environment it happens to run in — note that even the "am I on a server" question is passed in as `RenderContext`
rather than reached for, so nothing in this layer imports your UI framework.

### Map the response. Always.

---

```ts
class TenantGateway extends Gateway {
  async list(): Promise<Tenant[]> {
    const response = await this.sendRequest({
      url: "/api/tenants",
      method: "GET",
    });
    const body = (await response.json()) as { id: string; full_name: string }[];

    return body.map((row) => ({ id: row.id, name: row.full_name })); // your shape, not theirs
  }
}
```

`return response.json()` **is the mistake.** It hands the backend's shape to the whole app, and the day a field is
renamed you get `undefined` on a screen instead of a compile error. Mapping is what makes that rename a one-line
change in one file.

Name the mapped result after the concept — `Tenant`, `PaymentMethod`. Do not name it `TenantDto`; the DTO is the thing
you just mapped _away from_, and it does not survive the gateway.

**Plain data is the default worth reaching for.** `Tenant` here is an `interface` and the gateway returns object
literals — no constructor, no methods, nothing but the fields. What it returns is on its way into application state,
and state made of plain data is what can be [handed to the browser](#handing-the-state-to-the-browser) after a server
render.

A class works too, and the clone that adopts your state preserves prototypes, so `instanceof` holds and methods still
run. It costs you that one thing — a class instance cannot be serialized, so the handover throws and the browser
starts from nothing. Worth it for a domain type that genuinely earns its methods; not worth it for a bag of fields
with a constructor around it.

### Generated clients stop at the gateway

---

Swagger, OpenAPI, gRPC, a vendor SDK's types — use them if they save you work, **inside the gateway only**. The moment
a generated type appears in a use case, a presentation, application state or a component, the backend's schema has
become your domain model, and regenerating it becomes a refactor of your whole app.

**A wire shape is a poor domain shape.** JSON has objects, arrays, strings and numbers, and nothing else. It cannot
carry a `Set`, a `Map`, a tree with parent links, a `Date`, a `bigint`, or a class with behavior — so a generated type
never has one, and if you adopt it as your model you inherit that poverty everywhere:

```ts
// what the wire gives you
interface TenantResponse {
  id: string;
  tags: string[]; // duplicates possible, order meaningless
  leases: LeaseResponse[]; // you will look these up by id, every time
  moved_in: string; // a string that is really a date
}

// what your app actually wants
class Tenant {
  constructor(
    readonly id: string,
    readonly tags: Set<string>, // membership, which is what you ask
    readonly leases: Map<string, Lease>, // lookup, not a scan
    readonly movedIn: Date,
  ) {}

  hasTag(tag: string) {
    return this.tags.has(tag);
  }
}
```

An array is the default because JSON has no alternative, not because it is right. If every read is `leases.find((l) =>
l.id === id)`, the type is telling you it wants to be a `Map`. Mapping at the gateway is where that choice gets made —
once, in one file, instead of being re-derived at every call site.

**And server APIs change.** A field gets renamed, a flat list becomes paginated, a number becomes a string, an enum
gains a member. If the generated type is your model, that is a hundred edits across use cases, presentations, state
and components, and the compiler only finds the ones that happen to break. If the gateway owns the mapping, it is one
edit in one function, and everything above it never learns the wire changed at all.

The rule is worth enforcing rather than remembering:

```js
// eslint.config.js
{
  files: ['src/**/*.ts'],
  ignores: ['src/gateways/**'],
  rules: {
    'no-restricted-imports': ['error', { patterns: ['**/swagger/**', '**/generated/**'] }],
  },
}
```

The same goes for a third-party SDK's objects. A Stripe or Plaid handle belongs behind a gateway; what comes out is
yours.

### Third-party SDKs

---

An SDK is a gateway, and the same rule applies: **nothing it gives you may escape.** But SDKs break the shape in ways
a REST call does not, so they are worth their own chapter.

A payment SDK, a realtime client, a maps library, an analytics tag — each tends to be stateful, imperative,
callback-driven, and to want the DOM. None of those belong in a use case.

#### Wrap it, and return your own types


```ts
class PaymentGateway {
  async createMethod(details: CardDetails): Promise<PaymentMethod> {
    const result = await stripe.createPaymentMethod(toStripeShape(details));

    if (result.error) throw declineFor(result.error.code); // your error
    return {
      id: result.paymentMethod.id,
      last4: result.paymentMethod.card.last4,
    };
  }
}
```

A `Stripe.PaymentMethod`, a Plaid handle, a SignalR connection: these stop here. What the use case receives is a
`PaymentMethod` you defined, and what it catches is an error you named. Nothing above the gateway should be able to
tell which vendor you chose — that is the point, and it is what makes replacing one a change in a single file.

#### The DOM is still not the gateway's


Many SDKs load by injecting a `<script>`. That is the browser's runtime, not the process boundary, and a gateway that
reaches for `document` has stopped being portable. Put the loading behind a small interface and hand it in:

```ts
export interface ScriptLoader {
  load(url: string): Promise<void>;      // implemented in the UI layer, where the DOM lives
}

class PlaidGateway {
  constructor(private readonly scripts: ScriptLoader) {}

  async openLink(token: string) {
    try {
      await this.scripts.load(PLAID_SCRIPT_URL);
    } catch {
      throw new PlaidUnavailable();
    }
    …
  }
}
```

Now the gateway is testable without a DOM, and the one file that knows about `document.createElement` is the one whose
job that is.

#### An SDK that calls you back calls a use case


Realtime clients push. The callback is an event arriving from outside, and it is handled the way every other event is
— by running a use case:

```ts
await signalRGateway.onMessage(() => void new LoadMessagesUseCase().execute());
```

The callback must not write state. It has no mutation window, so the write would throw — which is the guard doing its
job, telling you the handler belongs in a use case.

#### Replace the SDK at its own module, in tests


Never stub your own wrapper. Mock the vendor's module once for the whole suite, in `setupFiles`, so your gateway's
real code — the mapping, the error translation, the retry — still runs. See [Testing](#testing).

## Errors

`ErrorHandler` **is the single place every failure in the app arrives.** Not one of several — the only one. Whatever
throws, wherever it throws, and however deep it was nested, it surfaces there: a gateway rejecting a bad response, a
use case throwing a domain error, a validation rule refusing a value, a detached run failing with nobody waiting on
it. There is one funnel.

That is what lets error handling be a policy rather than a habit. Returning `false` from `onWillReportError`
suppresses the dialog for a failure you have dealt with another way; everything else is shown, and nothing is silently
lost.

The corollary is what you _stop_ writing: no try/catch in components, and no error prop threaded through a tree. A use
case catches only when it has something to decide.

This chapter is the rest of that road: where a failure goes, who decides what it means, and how the screen shows it.

### When a use case fails

---

`execute()` rejects. A nested failure therefore aborts its caller, which is what makes a [higher-order use
case](#higher-order-use-cases) a sequence rather than a list of attempts.

The failure is reported to `onError` **exactly once**, by the outermost run, so the screen hears about it whether it
happened at the top or five levels down. A caller that catches decides what it means, and only what that caller throws
is reported — the next section is the four ways that goes.

Two rules underneath it. Catching and _not_ rethrowing reports nothing at all, because the failure was handled — so a
handled failure the user still has to see belongs in state, where a presentation can put it next to the thing that
failed. And a use case that writes state and then throws still announces what it wrote, so anything it managed before
failing — a partial result, a cleared selection — reaches the screen rather than being lost with the run.

### The use case decides what a gateway failure means

---

A gateway throwing is not a verdict, it is information. The use case is what knows whether that failure matters, and
it has four answers:

```ts
class LoadDashboardUseCase extends BaseUseCase {
  protected async runLogic() {
    // 1. let it through — nobody can do better than the dialog
    this.getState().leases = await leaseGateway.list();

    // 2. swallow it — the page is still worth showing without this
    try {
      this.getState().tips = await tipsGateway.list();
    } catch {
      this.getState().tips = [];
    }

    // 3. record it — the user is the one who has to act on it
    try {
      this.getState().avatars = await fileGateway.resolve(ids);
    } catch {
      this.getState().avatarsFailed = true; // a presentation turns this into a retry prompt
    }

    // 4. translate it — the caller needs a different name for it
    try {
      this.getState().balance = await ledgerGateway.balance();
    } catch (error) {
      if (error instanceof NotFound) throw new NoLedgerForThisLease();
      throw error;
    }
  }
}
```

The same `NotFound` from the same gateway is fatal in one use case and irrelevant in another. That decision is
business logic, which is why it lives here and not in the gateway — a gateway that decided for you would have to know
which caller it had, and it does not.

Three consequences worth holding on to:

- **Swallowing is a decision, and it is silent.** Catching without rethrowing reports nothing at all — no dialog, no
  `onError`. That is right when the app genuinely copes, and wrong when you merely did not want to think about it.
  When the app copes _and_ the screen should still say something, write that to state and let a presentation phrase
  it: a failure the user can act on belongs next to the thing that failed, not in a dialog over the top of it.
- **Telemetry is not the use case's job.** Sending a failure to Sentry and showing it to the user are different
  decisions, and both are made in one place — `onWillReportError` captures whatever is worth knowing about and
  returns `false` for anything the user should not be interrupted by. A use case throwing the right name is all that
  handler needs to tell them apart. See [Errors the screen shows inline](#errors-the-screen-shows-inline) for the
  three destinations side by side.
- **Rethrowing something else replaces the original.** Only what you throw is reported, so the name you choose is the
  name the user's dialog is built from. Preserve the cause if it matters: `new NoLedgerForThisLease({ cause: error
  })`.

### Define your own errors

---

A use case should branch on what went wrong, not on a number:

```ts
export class UnauthorizedError extends Error {}
export class TenantsUnavailable extends Error {}
export class PaymentDeclined extends Error {
  constructor(readonly reason: DeclineReason) {
    super();
  }
}
```

```ts
try {
  await new PayUseCase().execute(request);
} catch (error) {
  if (error instanceof PaymentDeclined)
    throw new PaymentNeedsAnotherMethod(error.reason);
  throw error;
}
```

Two things follow. A use case never inspects a status code, because it never sees one — the gateway already turned it
into a name. And an error carries a _code_ rather than a message: the wording is the presentation's job, so the same
failure can be phrased one way in a dialog and another in a form field.

### Errors the screen shows inline

---

Not every failure is a dialog. A rejected password, a required field, a payment the processor declined — the user has
to see those _where they are_, next to the field or in the panel that failed, and carry on. Throwing sends them to the
global handler, which is exactly wrong for a failure the user is expected to fix.

So there are three kinds of failure, and the choice is about **who has to act**:

|                          | Where it goes           | How                                               |
| ------------------------ | ----------------------- | ------------------------------------------------- |
| Nobody expected this     | the dialog              | `throw` — it reaches `ErrorHandler`               |
| The app deals with it    | nowhere visible         | `onWillReportError` returns `false`               |
| **The user must fix it** | **inline, on the page** | **written to state, read through a presentation** |

The third one is not an error in the throwing sense at all. It is a fact about the form, so it lives in state like any
other fact:

```ts
// state — codes, never sentences
export class PaymentForm {
  values: PaymentValues = { amount: "", methodId: undefined };
  errors = new Set<PaymentError>();
}

export enum PaymentError {
  AmountRequired,
  AmountBelowMinimum,
  NoMethodSelected,
  Declined,
}
```

The use case owns the rule, states it once, and writes the codes:

```ts
class SubmitPaymentUseCase extends BaseUseCase {
  protected async runLogic() {
    const form = this.getState().paymentForm;
    form.errors = validate(form.values);
    if (form.errors.size > 0) return; // no throw: the screen will say so

    try {
      await new PayUseCase().execute(form.values);
    } catch (error) {
      if (error instanceof PaymentDeclined) {
        form.errors.add(PaymentError.Declined); // shown on the payment screen
        return;
      }
      throw error; // anything else is the dialog's
    }
  }
}
```

An editing use case clears the codes belonging to the fields it changes, so an error disappears as the user corrects
it:

```ts
class EditPaymentUseCase extends BaseUseCase {
  protected async runLogic(patch: Partial<PaymentValues>) {
    const form = this.getState().paymentForm;
    form.values = { ...form.values, ...patch };
    if ("amount" in patch) {
      form.errors.delete(PaymentError.AmountRequired);
      form.errors.delete(PaymentError.AmountBelowMinimum);
    }
  }
}
```

The presentation turns codes into what the screen renders — this is where the wording lives, and why the code carries
no message:

```ts
export const presentPaymentForm: Presentation<
  AppState,
  PresentablePaymentForm
> = (state) => {
  const { values, errors } = state.paymentForm;

  return {
    amount: values.amount,
    amountError: errors.has(PaymentError.AmountBelowMinimum)
      ? { key: "AMOUNT_BELOW_MINIMUM", params: { min: "$5.00" } }
      : errors.has(PaymentError.AmountRequired)
        ? { key: "AMOUNT_REQUIRED" }
        : undefined,
    declined: errors.has(PaymentError.Declined),
    canSubmit: values.amount !== "" && values.methodId !== undefined,
  };
};
```

```tsx
<AmountInput
  value={model.amount}
  error={model.amountError}
  onInput={(v) => edit({ amount: v })}
/>
```

The component renders an error; it never decides one. And because the codes are state, the same failure can be phrased
one way in a field and another in a summary, translated per locale, without the use case knowing any of it.

**A form library would undo all of this.** It is a second state container beside yours: two owners per field to
hand-sync, validation copied into the component, and a view model derived somewhere your presentations cannot see.
Field values are application state — write them through a use case, read them through a presentation, like everything
else.

### Listening from outside a component

---

`ErrorHandler` and `Navigator` cover the two things an application does with these events, and both are built on the
same pair of subscriptions the library exports:

```ts
const stopListening = onError((error) => Sentry.captureException(error));
const stopNavigating = onNavigation((url) => router.go(url));
```

They hand back an unsubscribe function and nothing else — there is no way to reach the bus itself, or to emit on it. A
use case puts a url on one channel with `navigate()`, and an error on the other by throwing; everything else listens.
(`report()` emits on that same error channel without throwing, for a use case that recovers and still wants the
dialog — rare, and worth a moment's thought each time, since a failure the user has to act on belongs in state.) Tests
use the same pair, so what they observe is what a screen would have been told.

## Quick start

All five players, in one feature, in five steps. Nothing here is pseudo-code — it is a complete, working feature, and
every piece of it belongs to one of the chapters above.

### 1. Describe the state

---

Application state is an ordinary object: a type describing the shape, and a function that builds an empty one.

```ts
// state.ts
export interface AppState {
  tenants: Tenant[];
}

export const createAppState = (): AppState => ({ tenants: [] });

export const appState = createAppState();
```

A factory rather than a literal, because a server renders many requests and a test runs many cases — each one needs
its own state, and only a function can hand out a fresh one.

### 2. Give every use case that state, once

---

One base class per app supplies the initial state. Every use case extends it, so the state type is named once rather
than on every use case you write.

```ts
// baseUseCase.ts
import { UseCase } from "@magicdoor/magic-use-case-react";
import { AppState, appState } from "./state";

export abstract class BaseUseCase extends UseCase<AppState> {
  protected async initializeState() {
    return appState;
  }
}
```

Then tell the library which type that is, so a presentation cannot quietly declare a different one:

```ts
declare module "@magicdoor/magic-use-case-react" {
  interface MagicUseCaseTypes {
    state: AppState;
  }
}
```

`usePresenter` now accepts only presentations written against `AppState`. Without it, a presentation's state type is
whatever the presentation claims, so one written against the wrong shape compiles cleanly and throws at runtime — on
the screen, not in the tests.

### 3. Write what the app does

---

A use case owns one piece of behavior. `runLogic` is the whole of it, and `getState()` is the only way to reach live
state.

```ts
// loadTenantsUseCase.ts
export class LoadTenantsUseCase extends BaseUseCase {
  protected async runLogic() {
    this.getState().tenants = await tenantGateway.list();
  }
}
```

No try/catch **here**, because this use case has nothing to add: if the gateway throws, the failure propagates,
`didSucceed` goes false, and `ErrorHandler` shows it — all of which you get already. A `try` that catches and
rethrows the same error is pure ceremony.

Catch when the use case has something to _decide_ — and it often does. Reclassifying is the usual reason: a `NotFound`
from the ledger means nothing to a screen, and `NoLedgerForThisLease` means everything, so catch it and throw the name
that carries the meaning. Recording a failure the user has to act on, or carrying on without what failed, are the
other two. [The use case decides what a gateway failure
means](#the-use-case-decides-what-a-gateway-failure-means) sets out all four answers with examples.

`tenantGateway` is your code — the library does not provide one. It is simply the module that owns the `fetch`, and it
returns your own types rather than the API's:

```ts
// tenantGateway.ts
export const tenantGateway = {
  async list(): Promise<Tenant[]> {
    const response = await fetch("/api/tenants");
    if (!response.ok) throw new TenantsUnavailable();
    const body = (await response.json()) as { id: string; full_name: string }[];
    return body.map((row) => ({ id: row.id, name: row.full_name }));
  },
};
```

### 4. Say what the screen shows

---

A presentation is a **pure function from state to a view model**. All formatting, filtering, sorting and labeling
happens here — never in the component.

```ts
// presentTenants.ts
import type { Presentation } from "@magicdoor/magic-use-case-react";

export interface PresentableTenants {
  names: string[];
  countLabel: string;
  isEmpty: boolean;
}

export const presentTenants: Presentation<AppState, PresentableTenants> = (
  state,
) => ({
  names: state.tenants.map((tenant) => tenant.name).sort(),
  countLabel: `${state.tenants.length} tenants`,
  isEmpty: state.tenants.length === 0,
});
```

Export it at module scope. Sharing is by function identity, so every screen that passes this same function shares one
run of it — see [Presentations](#2-presentations).

### 5. Render it

---

The component does two things: run use cases, and render a model.

```tsx
function TenantList() {
  const { execute: load, isLoading } = useUseCase(LoadTenantsUseCase);
  const { model } = usePresenter(presentTenants);

  useEffect(() => void load(), []);

  if (isLoading) return <Spinner />;
  if (!model) return null;

  return (
    <>
      <h2>{model.countLabel}</h2>
      <ul>
        {model.names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </>
  );
}
```

Notice what the component does _not_ contain: no `fetch`, no `.sort()`, no `.map()` to a label, no `tenants.length ===
0` check, and no try/catch. Each of those has a home, and it is not here. The next chapter is what that discipline
buys you; the rest of the document is each player in detail.

**You rarely need to track in state whether a use case worked.** `useUseCase` already reports `isLoading`,
`didSucceed` and `progress` for the run it started, and the failure itself already reaches `ErrorHandler` — so reach
for those first and let application state hold what the app _knows_, which here is the tenants.

Sometimes you do need it, and that is fine: a fact that must outlive the run, because something loaded on one screen
is reported on another, or because the panel has to keep saying "couldn't load" long after the hook that ran it has
gone. Then it is a fact about the app like any other and belongs in state. Just reach for it when the run's own status
genuinely cannot answer, rather than by default.

### Wire the two events once, at the root

---

A use case can navigate and can report a failure. Two components deliver those to your app, and you mount them once —
this is the whole of `app.tsx`:

```tsx
// app.tsx
import { ErrorHandler, Navigator } from "@magicdoor/magic-use-case-react";

/** Inside the router, because that is where `useNavigate` is available. */
function NavigationHandler() {
  const navigate = useNavigate();

  return (
    <Navigator
      onNavigate={(url) =>
        // a use case may send the tenant off-site — to an identity provider, say
        url.startsWith("http") ? (window.location.href = url) : navigate(url)
      }
    />
  );
}

function ErrorDialog({
  error,
  onClose,
}: {
  error: Error;
  onClose: () => void;
}) {
  return (
    <dialog open>
      <p>{messageFor(error)}</p>
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}

/** Every failure in the app arrives here. One rule per kind, in one place. */
function willReport(error: Error): boolean {
  if (error instanceof UnauthorizedError) {
    signOut(window.location.pathname); // handled: sign out and come back here
    return false; // ...so no dialog
  }
  if (!(error instanceof ValidationFailed)) {
    Sentry.captureException(error); // worth knowing about; still shown
  }
  return true;
}

export function App() {
  const { execute: initialize } = useUseCase(InitializeAppUseCase);

  useEffect(() => void initialize(), []);

  return (
    <ErrorHandler
      onWillReportError={willReport}
      renderErrorDialog={ErrorDialog}
    >
      <Router>
        <NavigationHandler />
        <Routes />
      </Router>
    </ErrorHandler>
  );
}
```

`messageFor(error)` is yours: a lookup from error type to copy, which is where the wording lives. The error itself
carries a _code_, never a sentence — see [Define your own errors](#define-your-own-errors).

`ErrorHandler` **is the single place every failure in the app arrives** — see [Errors](#errors) for what that buys you
and how to use it.

In Solid the same file differs only in the JSX and in `useNavigate` coming from `@solidjs/router`; `ErrorHandler` and
`Navigator` take the same props.

## What this buys you

Look back at what you just wrote. Four of the five players — the gateway, the use case, application state and the
presentation — contain **no React, no Solid, no JSX, no hooks**: no reference to a rendering technology at all. They
are plain TypeScript classes and functions. Only the component knows what framework you are using.

Which means the boundary is not a diagram, it is a directory you can move:

```
src/
  gateways/     ─┐
  use-cases/     │  plain TypeScript. Copy this into any TypeScript app,
  state/         │  on any front end, and it works.
  presenters/   ─┘
  components/      the only part that is React or Solid
```

Porting a screen to another framework means rewriting the component and changing one import —
`@magicdoor/magic-use-case-react` for `@magicdoor/magic-use-case-solid`. The behavior, the network layer, the state
shape and every formatting rule come across untouched, **and so do their tests**, because none of them ever rendered
anything.

**Navigation travels too.** A use case says _where to go_, never how to get there:

```ts
this.navigate("/tenants/42"); // no router imported, no router installed
```

The one place that knows about React Router, or Solid Router, or `window.location`, is the `<Navigator
onNavigate={…}>` you mount once. Swap the router and you change that one line.

That is also the honest test of whether you are following the architecture. If moving your `use-cases/` folder to a
Solid app would break it, something has leaked into it that does not belong.

The same independence holds at the other end. Because every gateway is built on [one network manager](#5-gateways),
nothing above it knows whether the data arrives over REST, GraphQL, a socket or a native bridge. Your application is
insulated from the UI framework above and the communication framework below, and what is left between them is the part
worth keeping.

## What is enforced, and what is yours

Some of the rules in the chapters above the library enforces for you; the rest are yours to hold. It is worth knowing
which is which.

**What the library enforces for you:**

- **Only a use case may write state.** `getState()` returns a proxy that refuses writes outside a running use case —
  at runtime, at the offending line.
- **A presentation can never write.** It receives a fully readonly view, whatever else is running.
- **A component can never write the model.** `usePresenter` returns `DeepReadonly<TModel>`, so it is a compile error
  before it is a runtime one.
- **A use case cannot replace live state.** Bootstrapping happens once; `resetAppState()` is the only way back.
- **Server rendering cannot leak one user's state into another's.** Both server builds resolve a scope per request,
  so two requests never share state, the event bus, or a model — and rendering outside a request throws rather than
  falling back to a shared one.
- **A presentation cannot read a shape the app never emits.** Once the app names its state type through
  `MagicUseCaseTypes`, `usePresenter` rejects any presentation written against a different one, at compile time.

**What is convention, and yours to hold:**

- **Gateways.** The library has no `Gateway` type. Anything crossing the process boundary belongs behind one — see
  [Gateways](#5-gateways) and [Third-party SDKs](#third-party-sdks).
- **Components call use cases, not each other's helpers.** If a screen needs a value, the value belongs in the model.
- **Validation lives in the use case that owns the rule**, stated once. A form surfaces validation; it does not
  re-implement it.
- **Form state is application state**, and so are the errors on it — see [Errors the screen shows
  inline](#errors-the-screen-shows-inline).
- **Enumerable business values are enums or** `as const`, never repeated string literals, and never compared against
  display text.
- **Either layer may navigate, and the question is whose decision it is.** The use case navigates when _going there is
  the outcome_ — sign-in succeeded, the session expired, the deep link is honored. The UI navigates when the route is
  a consequence of what is on screen: a row click, a tab, a back button. Derive the path in the presentation, call the
  router in the component. The test is whether the rule survives a redesign — "after paying, go to the receipt" does,
  "clicking this row opens that page" does not.
- **Timers belong to the UI**, which calls a use case when one fires — a debounce, an animation, a screen that
  refreshes on an interval. The exception is a timer pacing a request or a connection, which belongs in the gateway.
  Neither belongs in a use case.
- **Sequencing use cases is itself a use case** — not a hook, not a context, not a component effect. See [Higher-order
  use cases](#higher-order-use-cases).
- **Don't abstract early.** "Several pages use it" is not a reason; leave the duplication until the business boundary
  is stable.

## Testing

The architecture decides the test strategy, and it comes out as **two kinds of test**. This is the conclusion of years
of trying the alternatives — a test file per class, mocked gateways, component tests, snapshot suites — rather than a
preference. Every one of those either pinned tests to the shape of the code or left the interesting part unexercised.

**1. Presentation tests — what the screen shows.** Put values into application state, call the presentation, assert
the model. No mocks. A presentation is a pure function of state, so the test is a table of inputs and expected view
models.

**2. Use case tests — what the app does.** Answer the server, execute the use case, then assert two things: **what
request reached the server**, and **what ended up in application state**. Nothing else is mocked — the real gateway
builds the request and maps the reply on the way past.

**Everything else is tested implicitly**, and deliberately has no test file of its own: gateways, the transport
beneath them, mappers, formatters, helpers. Each one is exercised by the use cases and presentations that use it,
which is also the only way to find out whether it is used correctly.

The exception is narrow and real: something intricate enough and critical enough to deserve a suite of its own — a
pricing engine, a date-recurrence rule, a retry policy with subtle timing. Give it one. But that is the exception, and
reaching for it routinely is how a suite ends up testing its own structure.

Followed properly, these two **guarantee 100% statement, branch and function coverage of your entire business logic
and presentation layer** — not as a target chased with extra tests, but as a by-product. Which is what makes an
uncovered line informative rather than a chore: see [Coverage is a floor](#coverage-is-a-floor-not-a-target).

Vitest on the **node** environment. There is no browser environment because components hold no logic to render and
assert.

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    // nothing renders: the suite tests use cases and presentations, and the only
    // browser api it reaches for is storage, which a setup file fakes
    environment: "node",
    // the suite is bound by transforming the module graph rather than by the
    // assertions, and workers sharing a process pay less of that than forks do
    pool: "threads",
    // test files in a worker share one module registry, so nothing may outlive
    // the file that made it: seed state per test, never at module load
    isolate: false,
    setupFiles: ["tests/mocks/webStorage.ts", "tests/mocks/sdks.ts"],
    coverage: {
      provider: "v8",
      include: ["src/use-cases/**", "src/presenters/**", "src/gateways/**"],
    },
  },
});
```

`isolate: false` is the one to understand before you use it. It is what makes the suite quick, and it means a module
mocked or a value cached in one file is still there in the next. Seed state with `givenAppState()` in a `beforeEach`
and answer the server inside each test — never at module load.

### Give each test its own state

---

`createScope()` and `setScopeResolver()` are the seam. A scope is everything that makes up one running application —
its state, the event bus, the bookkeeping — so handing a test its own means the real use case runs against a state
object the test owns, with nothing left over from the test before:

```ts
// tests/utils/testUtils.ts
import {
  createScope,
  setScopeResolver,
  onError,
  onNavigation,
} from "@magicdoor/magic-use-case-react";

export const givenAppState = (): AppState => {
  const state = createAppState();
  const scope = createScope(state);
  setScopeResolver(() => scope);
  return state;
};
```

Nothing is mocked here. The use case, the presentation and the gateway all run their real code.

### Stub the server, not your own gateway

---

Build every gateway on **one** transport object, and stub that. It is the single seam the whole suite uses:

```ts
// the app's one transport, which every gateway is constructed with
export const networkManager = {
  async send(request: Request): Promise<Response> { … },
};
```

```ts
it("stores the quote when the server returns a fee breakdown", async () => {
  const appState = givenAppState();
  vi.spyOn(networkManager, "send").mockResolvedValue(
    new Response(JSON.stringify({ amount: 1500, fee: 12.5 }), { status: 200 }),
  );

  await new GetQuoteUseCase().execute({ leaseId: "lease-1" });

  expect(appState.quote).toEqual({ amount: 1500, fees: 12.5 }); // the gateway renamed it
});
```

Stubbing the _gateway method_ instead would skip the mapping — which is exactly where a backend field rename breaks
the app. Mocking one layer lower turns that rename into a failing test instead of an `undefined` on a screen. It also
means the gateway's url building, query parameters and error handling are all under test without a gateway test
existing.

The same rule covers third-party SDKs: **replace the SDK at its own module**, in `setupFiles`, so your gateway
wrapping it still runs. Never stub your own wrapper. Mock a shared module once for the whole suite, never in a single
test file — a second, partial mock of the same module is how an assertion comes to depend on which other file ran
first.

### Execute the use case directly

---

```ts
await expect(new PayUseCase().execute({ amount: -1 })).rejects.toBeInstanceOf(
  AmountTooLow,
);
```

Run `execute()` rather than going through `useUseCase`. The hook catches what a use case throws so a component never
sees a rejection, which also means a test running through it cannot assert on one.

### Watch what the screen would have been told

---

`onError` and `onNavigation` are the same subscriptions `ErrorHandler` and `Navigator` use, so a test observes exactly
what a screen would:

```ts
export const givenTheScreenIsListening = () => {
  const screen = { navigatedTo: [] as string[], errorsRaised: [] as Error[] };
  onNavigation((url) => screen.navigatedTo.push(url));
  onError((error) => screen.errorsRaised.push(error));
  return screen;
};

it("sends a signed-out tenant to the sign-in screen", async () => {
  givenAppState();
  const screen = givenTheScreenIsListening();

  await new InitializeAppUseCase().execute({ host: "tenants.example.com" });

  expect(screen.navigatedTo).toEqual(["/auth/signin"]);
});
```

Call it **after** `givenAppState()`: the subscriptions belong to the scope that call installs.

### Presentations are pure functions

---

Call the presentation with a state and assert the whole model. There is no need to construct a `Presenter` — that only
adds a subscription and a teardown no test asserts on.

```ts
it("formats the balance and labels an ended lease closed", () => {
  const state = createAppState();
  state.selectedLease = { id: "l1", currentBalance: 1240, isActive: false };

  expect(presentLease(state)).toEqual({
    id: "l1",
    balance: "$1,240.00",
    statusLabel: "CLOSED",
  });
});
```

Assert the whole model rather than a field at a time, and cover the cases that actually differ: empty state, missing
optional data, each branch of a label.

### Work that outlives the call

---

A `detach`ed run finishes after its starter returns, so wait for the result rather than for a timer:

```ts
await new SubmitRequestUseCase().execute(); // returns immediately

await vi.waitFor(() => expect(appState.requests).toHaveLength(1));
```

A fixed `setTimeout` is a guess about scheduling, and guesses fail on a loaded CI machine.

### Timers

---

**Where they belong first — and usually that is the UI.** A debounce, an animation, a toast that dismisses itself, a
screen that refreshes every thirty seconds: these are presentation concerns. The component owns the timer and calls a
use case when it fires.

```tsx
useEffect(() => {
  const timer = setInterval(() => void refresh(), 30_000);
  return () => clearInterval(timer);
}, []);
```

The use case knows nothing about the schedule — it is simply run again, exactly as it would be by a button.

The exception is a timer that **paces a request or a connection**: a retry backoff, a reconnect delay, polling a
remote job until it reports ready. Those belong in the gateway, beside the thing they pace, because the interval is a
property of talking to that service rather than of any screen.

**Never in a use case.** A use case decides _what_ happens; when it happens is someone else's business. Keeping it
that way is what lets most of the suite run without a clock at all.

**Two different problems in tests, two different tools.** Confusing them is where flaky suites come from:

```ts
// waiting for something to finish: poll the condition
await vi.waitFor(() => expect(appState.requests).toHaveLength(1));

// the code itself waits: control the clock, do not live through it
vi.useFakeTimers();
const ready = gateway.pollUntilReady(); // internally waits 30s between attempts
await vi.advanceTimersByTimeAsync(30_000);
await ready;
```

**Never sleep as a synchronization device.** `await new Promise((r) => setTimeout(r, 50))` is a guess about
scheduling. It is slow when it is right and flaky when it is not — and it is wrong on a loaded CI machine, which is
where you will find out.

**Hand them back.** `vi.useRealTimers()` in `afterEach`. Under `isolate: false` test files share a worker, so fake
timers left installed become the next file's problem, and the failure surfaces somewhere with no timers in sight.

> [!NOTE] `vi.restoreAllMocks()` does not undo `vi.stubGlobal` or `vi.stubEnv`. A stubbed global outlives the test
> that set it, so unstub them in a setup file's `beforeEach` rather than assuming `restoreAllMocks` covers it.

### Test behavior, not structure

---

**A test names something the app does, never how the code is arranged.** The check is a rewrite: change the
implementation, keep the behavior, and the test should still pass. If it breaks, it was pinned to structure.

That rules out asserting which gateway method was called and how often, reaching for `runLogic` or a private helper,
and naming code in the test — `it` states a result and its condition, not `calls authenticate with the right
arguments`.

Do not write component tests. Formatting lives in a presentation and decisions live in a use case; what is left is
markup, which breaks on every design change and catches no defect.

### Coverage is a floor, not a target

---

Aim for 100% of use cases and presentations — statements, branches and functions — and reach it by fixing causes
rather than adding tests to the number. A line you cannot reach through a use case or a presentation is telling you
one of three things:

- **The caller is missing a case.** Write the test that drives it.
- **The line is unreachable from any state the app can produce.** It is dead — delete it.
- **It is in the wrong layer.** Code only a component can reach is code a component should not be calling; move it,
  and it becomes reachable.

## Server-side rendering

`@magicdoor/magic-use-case-solid` ships two bundles: `dist/index.js` compiled with Solid's DOM generator, and
`dist/server.js` compiled with its SSR generator. The exports map routes `node`, `deno`, and `worker` to the server
build automatically, so `renderToString` works with no configuration.

Everything that makes up a running application lives in one scope: state itself, the bootstrap and de-duplication
bookkeeping, the mutation window, the depth of attached runs, the event bus, and the model built for each
presentation. A browser resolves one scope for the life of the page, which is exactly right where there is one process
per user. A server process serves many concurrent requests, and sharing any one of those would serve one user another
user's data.

So a server resolves a scope per request, and each adapter does it the way its framework allows.

**Solid** needs nothing from you. The server build reads the request being rendered from `getRequestEvent()` —
backed by `AsyncLocalStorage` — and holds that request's scope in a `WeakMap` keyed by the request event, so the
scope lives exactly as long as the request does. Importing the package installs it.

**React** has no request context to hang a scope on, so the adapter keeps its own `AsyncLocalStorage` and the host
opens a scope per request:

```tsx
import { runInRequestScope } from '@magicdoor/magic-use-case-react/server';

const html = await runInRequestScope(() => renderToString(<App />));
```

Everything rendered inside resolves to that scope, however many times the render awaits. The import lives behind a
subpath because it reaches for `node:async_hooks`, which no browser bundle should carry.

Two requests rendering at the same moment never touch the same state, the same event bus, or the same models.

### What renders

---

Every component renders, including the ones that read a presenter. What they read depends on whether anything has
run: a scope starts empty, so a page that loads its data in `onMount` — or a React effect — renders the same empty
models the browser would render on its first pass. Server output and the client's first render agree, which is what
makes hydration clean.

To render *with* data, run the use case where the framework will wait for it, and let the presentations read what it
wrote:

```tsx
// Solid: a route's preload, awaited because entry-server runs in async mode
await createUseCase(GetLeasesUseCase).execute();
```

```tsx
// React: the host loads before it renders
const html = await runInRequestScope(async () => {
  await createUseCase(GetLeasesUseCase).execute();
  return renderToString(<App />);
});
```

Nothing about a use case changes on a server. It writes the same state, announces the same change, and its
presentations build the same models — in a scope belonging to that one request.

What a use case cannot do on a server is read the browser: there is no `localStorage` to take a token from. Read what
you need from the request and pass it in, the same way you would pass anything else browser-derived.

### Handing the state to the browser

---

A page rendered with data poses a question the markup cannot answer: the browser starts with an empty scope, renders
its empty models, and hydration finds a tree that does not match — then fetches everything again. So the state that
produced the markup travels with it.

It is opt-in, and it is one line.

```tsx
// Solid: rendered once, anywhere in the tree
<StateTransfer />
```

```ts
// React: the host puts it in the document, outside the hydration root
import { runInRequestScope, serializedStateScript } from '@magicdoor/magic-use-case-react/server';

res.send(`<div id="root">${html}</div>${serializedStateScript()}`);
```

The browser adopts it as the package loads, before anything renders. There is nothing to call and nothing to
configure on that side.

The two shapes differ because the frameworks do. Solid's `useAssets` takes a thunk that runs when the document is
assembled — after the use cases have finished — and puts the script in the head, outside the hydrated tree. React
hydrates the tree it rendered, so a script inside it would be a mismatch; React hosts assemble their own document,
which is the natural place for it.

#### What can cross

Application state has to be data: objects, arrays, sets, maps, dates, primitives, and references shared between them,
including cycles. All of that survives, which is why the payload is not JSON — `JSON.stringify` turns a `Set` into
`{}` with no error, and a page then renders as though the data were empty.

A class instance cannot cross, because its prototype cannot: the browser would receive the fields and none of the
behavior. State holding one raises an error naming the rule rather than the type. Keep behavior in use cases, where
it belongs, and state stays transferable.

#### Two things to know before you rely on it

**Everything in state reaches the browser**, in the page, in plain text, cached wherever that HTML is cached. A token
a use case wrote, a record fetched only to check a permission, an internal id — all of it. That is the trade the one
line makes, and it is why it is opt-in.

**The payload is an inline script**, so a strict `script-src` blocks it unless you supply a nonce. Most Solid
applications already run inline scripts — the framework's own hydration script is one — but if yours does not,
this is a deployment question, not a preference.

### Rendering outside a request

---

The scope belongs to a request, and there has to be one. Constructing a presenter or executing a use case on a server
outside a request throws rather than quietly falling back to a shared scope, because a silent fallback is the leak
this exists to prevent:

```
Error: [magic-use-case] No request scope is available.
```

For React that means the render has to be inside `runInRequestScope`. For Solid there is nothing to open — the
request the framework is already serving is the scope.

### Other hosts

---

`createScope` and `setScopeResolver` are exported so a host neither adapter knows about can do the same:

```ts
const scope = createScope(initialState); // initialState is optional
setScopeResolver(() => scope);
```

`createScope` returns an opaque handle. Giving it to `setScopeResolver` is the only thing an application can do with a
scope — the state, the bookkeeping and the event bus inside it belong to the library.

## Repository layout

```
packages/
  core/    private — shared logic, bundled into each adapter at build time
  solid/   published
  react/   published
```

`@magicdoor/magic-use-case-core` is intentionally **not published**. It is inlined into each adapter at build time, so
the adapters' public exports are the entire supported API surface. This keeps internals — the event bus, the use-case
factory — free to change without a breaking release. CI enforces that no published bundle references core.

## Development

```bash
npm install
npm run build        # build all packages
npm test             # vitest
npm run coverage       # vitest with coverage, which CI gates on at 100%
npm run lint
npm run type-check
npm run check-package  # how the published tarball resolves, before it exists
```

Releases are managed with [changesets](https://github.com/changesets/changesets). Add one with `npm run changeset`;
merging the generated "Version Packages" PR publishes to npm with provenance.

## Credits

Created by Norbert Nemes.

## License

Apache-2.0 © MagicDoor, Inc.
