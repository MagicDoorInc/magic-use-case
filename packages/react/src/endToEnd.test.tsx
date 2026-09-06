/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

const STATE_GLOBAL = '__MAGIC_USE_CASE_STATE__';

interface Leases {
  leases: string[];
}

const presentLeases = (state: Leases) => ({ names: state.leases.join(', ') });

/** The same screen in both passes, built against whichever module instance is loaded. */
const screenFor = (usePresenter: (p: typeof presentLeases) => { model?: { names: string } }) => () => {
  const { model } = usePresenter(presentLeases);
  return <p>{model ? model.names : 'nothing yet'}</p>;
};

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[STATE_GLOBAL];
});

/**
 * The whole round trip: a use case runs on the server, its state reaches the
 * markup, travels in the payload, and the browser renders the same thing from
 * it without running anything.
 */
describe('a page rendered on the server and picked up by the browser', () => {
  it('renders the same markup on both sides, and the browser runs no use case to do it', async () => {
    const server = await import('./server');
    const serverApi = await import('./index');
    const { UseCase, createUseCase } = await import('@magicdoor/magic-use-case-core');

    let runs = 0;

    class LoadLeases extends UseCase<Leases> {
      protected async initializeState() {
        return { leases: [] as string[] };
      }
      protected async runLogic() {
        runs += 1;
        this.getState().leases.push('Hogwarts 4B', 'Hogsmeade 2');
      }
    }

    const ServerScreen = screenFor(serverApi.usePresenter);
    const { markup, script } = await server.runInRequestScope(async () => {
      await createUseCase(LoadLeases).execute();
      return {
        markup: renderToString(<ServerScreen />),
        script: server.serializedStateScript(),
      };
    });

    expect(markup).toContain('Hogwarts 4B, Hogsmeade 2');
    expect(runs).toBe(1);

    // What the browser does with the script the server put in the document.
    const payload = script.replace(`<script>window.${STATE_GLOBAL}=`, '').replace('</script>', '');
    vi.resetModules();
    (globalThis as Record<string, unknown>)[STATE_GLOBAL] = (0, eval)(`(${payload})`);

    const browserApi = await import('./index');
    const BrowserScreen = screenFor(browserApi.usePresenter);
    const browserMarkup = renderToString(<BrowserScreen />);

    expect(browserMarkup).toBe(markup);
    expect(runs).toBe(1);
  });

  it('renders its empty state when the server ran nothing to hand over', async () => {
    const server = await import('./server');
    const serverApi = await import('./index');

    const EmptyScreen = screenFor(serverApi.usePresenter);
    const { markup, script } = server.runInRequestScope(() => ({
      markup: renderToString(<EmptyScreen />),
      script: server.serializedStateScript(),
    }));

    expect(markup).toContain('nothing yet');
    expect(script).toBe('');
  });
});
