import { describe, it, expect, expectTypeOf, beforeEach, vi } from 'vitest';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase, createUseCase } from '../../src/usecase/useCase';

beforeEach(() => {
  const scope = createScope();
  setScopeResolver(() => scope);
});

class AppState {
  paid: number[] = [];
  loads = 0;
}

interface Payment {
  amount: number;
}

abstract class Base<P = void> extends UseCase<AppState, P> {
  protected async initializeState() {
    return new AppState();
  }
  peek() {
    return this.getState();
  }
}

class Pay extends Base<Payment> {
  protected async runLogic({ amount }: Payment) {
    this.getState().paid.push(amount);
  }
}

class Load extends Base {
  protected async runLogic() {
    this.getState().loads += 1;
  }
}

describe('typed params', () => {
  it('hands execute its params type and passes the value to runLogic', async () => {
    const pay = new Pay();
    expectTypeOf(pay.execute).parameter(0).toEqualTypeOf<Payment>();

    await pay.execute({ amount: 5 });
    expect(pay.peek().paid).toEqual([5]);
  });

  it('lets a use case without params be executed with no argument', async () => {
    const load = createUseCase(Load);
    expectTypeOf(load.execute).toBeCallableWith();

    await load.execute();
    expect(new Load().peek().loads).toBe(1);
  });

  it('lets optional params be left out', async () => {
    class Select extends Base<string | undefined> {
      protected async runLogic(id?: string) {
        this.getState().paid.push(id ? Number(id) : 0);
      }
    }

    await new Select().execute();
    await new Select().execute('3');
    expect(new Select().peek().paid).toEqual([0, 3]);
    const misuse = () => {
      // @ts-expect-error a number is not a string
      void new Select().execute(3);
    };
    expect(misuse).toBeTypeOf('function');
  });

  it('infers the params type through createUseCase', () => {
    expectTypeOf(createUseCase(Pay)).toEqualTypeOf<UseCase<AppState, Payment>>();
  });

  it('rejects params of the wrong shape at compile time', () => {
    const misuse = () => {
      // @ts-expect-error a string is not a Payment
      void new Pay().execute('oops');
      // @ts-expect-error Pay requires a Payment
      void new Pay().execute();
      // @ts-expect-error Load takes no params
      void new Load().execute('x');
    };
    expect(misuse).toBeTypeOf('function');
  });

  it('checks the params a detached run is started with', async () => {
    class PayLater extends Base<Payment> {
      protected async runLogic(payment: Payment) {
        this.detach(Pay, payment);
        this.detach(Load);
      }
      misuse() {
        // @ts-expect-error Pay requires a Payment
        this.detach(Pay);
        // @ts-expect-error a string is not a Payment
        this.detach(Pay, 'oops');
      }
    }

    await new PayLater().execute({ amount: 7 });
    await vi.waitFor(() => expect(new Load().peek()).toMatchObject({ paid: [7], loads: 1 }));
  });
});
