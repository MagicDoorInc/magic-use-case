import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Importing the server entry is what makes state belong to the request rather
 * than the process. Nothing else in the package installs a resolver, so these
 * never call `setScopeResolver` themselves.
 */
const loadServerEntry = async () => {
  const entry = await import('./server');
  const core = await import('@magicdoor/magic-use-case-core');
  return { ...entry, ...core };
};

beforeEach(() => {
  vi.resetModules();
});

class Counter {
  value = 0;
}

describe('the server entry', () => {
  it('gives each request its own state once imported', async () => {
    const { runInRequestScope, UseCase, createUseCase } = await loadServerEntry();

    const counted: number[] = [];

    class Count extends UseCase<Counter> {
      protected async initializeState() {
        return new Counter();
      }
      protected async runLogic() {
        const state = this.getState();
        state.value += 1;
        counted.push(state.value);
      }
    }

    await runInRequestScope(async () => {
      await createUseCase(Count).execute();
      await createUseCase(Count).execute();
    });
    await runInRequestScope(async () => {
      await createUseCase(Count).execute();
    });

    expect(counted).toEqual([1, 2, 1]);
  });

  it('refuses to run outside a request rather than sharing one scope', async () => {
    const { UseCase, createUseCase } = await loadServerEntry();

    class Count extends UseCase<Counter> {
      protected async initializeState() {
        return new Counter();
      }
      protected async runLogic() {}
    }

    await expect(createUseCase(Count).execute()).rejects.toThrow(/No request scope is available/);
  });

  it('hands the state a request rendered from to the browser', async () => {
    const { runInRequestScope, serializedStateScript, UseCase, createUseCase } = await loadServerEntry();

    class Load extends UseCase<{ leases: string[] }> {
      protected async initializeState() {
        return { leases: [] as string[] };
      }
      protected async runLogic() {
        this.getState().leases.push('lease-1');
      }
    }

    const script = await runInRequestScope(async () => {
      await createUseCase(Load).execute();
      return serializedStateScript();
    });

    expect(script).toContain('lease-1');
    expect(script.startsWith('<script>')).toBe(true);
  });

  it('hands over nothing when the request rendered without running anything', async () => {
    const { runInRequestScope, serializedStateScript } = await loadServerEntry();

    expect(runInRequestScope(() => serializedStateScript())).toBe('');
  });
});
