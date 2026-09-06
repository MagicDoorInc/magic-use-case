import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATE_GLOBAL } from './stateGlobal';

const loadTransfer = async () => {
  const core = await import('../index');
  const serializing = await import('./serializeStateScript');
  const adopting = await import('./adoptSerializedState');
  return { ...core, ...serializing, ...adopting };
};

const aBasket = () => ({
  items: ['a'],
  chosen: new Set(['a']),
  perLease: new Map([['lease-1', 2]]),
});

type Basket = ReturnType<typeof aBasket>;

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[STATE_GLOBAL];
});

describe('handing a server render to the browser', () => {
  it('writes nothing when no use case has run', async () => {
    const { serializedStateScript, createScope, setScopeResolver } = await loadTransfer();
    const scope = createScope();
    setScopeResolver(() => scope);

    expect(serializedStateScript()).toBe('');
  });

  it('carries the collections and shared references that JSON would lose', async () => {
    const { serializedStateScript, createScope, setScopeResolver } = await loadTransfer();

    const scope = createScope(aBasket());
    setScopeResolver(() => scope);

    const script = serializedStateScript();
    const payload = script.replace(`<script>window.${STATE_GLOBAL}=`, '').replace('</script>', '');
    const revived = (0, eval)(`(${payload})`) as Basket;

    expect(revived.chosen).toBeInstanceOf(Set);
    expect([...revived.chosen]).toEqual(['a']);
    expect(revived.perLease).toBeInstanceOf(Map);
    expect(revived.perLease.get('lease-1')).toBe(2);
    expect(revived.items).toEqual(['a']);
  });

  it('leaves a string that would close the script tag unable to', async () => {
    const { serializedStateScript, createScope, setScopeResolver } = await loadTransfer();
    const scope = createScope({ note: 'ends with </script> early' });
    setScopeResolver(() => scope);

    const script = serializedStateScript();

    expect(script.indexOf('</script>')).toBe(script.length - '</script>'.length);
  });

  it('adopts what the server left, so the first render is not empty', async () => {
    const { adoptSerializedState, UseCase, createUseCase } = await loadTransfer();

    (globalThis as Record<string, unknown>)[STATE_GLOBAL] = { count: 7 };
    expect(adoptSerializedState()).toBe(true);

    const seen: number[] = [];

    class Read extends UseCase<{ count: number }> {
      protected async initializeState() {
        return { count: 0 };
      }
      protected async runLogic() {
        seen.push(this.getState().count);
      }
    }

    await createUseCase(Read).execute();

    expect(seen).toEqual([7]);
  });

  it('does nothing on a page the server did not render with data', async () => {
    const { adoptSerializedState } = await loadTransfer();

    expect(adoptSerializedState()).toBe(false);
  });

  it('says why state holding a class instance cannot cross, rather than naming a type', async () => {
    const { serializedStateScript, createScope, setScopeResolver } = await loadTransfer();

    class Holder {
      value = 1;
    }

    const scope = createScope(new Holder());
    setScopeResolver(() => scope);

    expect(() => serializedStateScript()).toThrow(/Everything in it has to be data/);
  });
});
