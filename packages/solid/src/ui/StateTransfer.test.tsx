import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SolidWeb from 'solid-js/web';

const assetThunks: Array<() => unknown> = [];

/**
 * The component's whole job happens in a server build, which this project does
 * not run in — so the build is mocked and the asset it registers is captured.
 */
const loadInServerBuild = async () => {
  vi.doMock('solid-js/web', async (importOriginal) => ({
    ...(await importOriginal<typeof SolidWeb>()),
    isServer: true,
    ssr: (markup: string) => markup,
    useAssets: (thunk: () => unknown) => void assetThunks.push(thunk),
  }));

  const { StateTransfer } = await import('./StateTransfer');
  const core = await import('@magicdoor/magic-use-case-core');
  return { StateTransfer, ...core };
};

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('solid-js/web');
  assetThunks.length = 0;
});

describe('handing a server render to the browser', () => {
  it('serializes when the document is assembled, not when it renders', async () => {
    const { StateTransfer, createScope, setScopeResolver, UseCase, createUseCase } = await loadInServerBuild();

    const scope = createScope();
    setScopeResolver(() => scope);

    expect(StateTransfer()).toBeNull();
    expect(assetThunks).toHaveLength(1);

    class Load extends UseCase<{ leases: string[] }> {
      protected async initializeState() {
        return { leases: [] as string[] };
      }
      protected async runLogic() {
        this.getState().leases.push('lease-1');
      }
    }

    // Registered before the use case ran, so a thunk that had already read
    // state would carry none of this.
    await createUseCase(Load).execute();

    expect(assetThunks[0]?.()).toContain('lease-1');
  });

  it('renders nothing in a browser, where there is no request to hand over', async () => {
    const { StateTransfer } = await import('./StateTransfer');

    expect(StateTransfer()).toBeNull();
    expect(assetThunks).toHaveLength(0);
  });

  it('is a bare stub in the browser build, so the serializer never reaches it', async () => {
    const { StateTransfer } = await import('./StateTransfer.browser');

    expect(StateTransfer()).toBeNull();
    expect(assetThunks).toHaveLength(0);
  });
});
