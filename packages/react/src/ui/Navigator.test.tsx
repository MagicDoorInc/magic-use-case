/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { UseCase, createUseCase } from '@magicdoor/magic-use-case-core';
import { Navigator } from './Navigator';

class AppState {}

class GoTo extends UseCase<AppState> {
  protected async initializeState() {
    return new AppState();
  }
  protected async runLogic(url: unknown) {
    this.navigate(url as string);
  }
}

const goTo = (url: string) => createUseCase(GoTo).execute(url);

afterEach(() => {
  cleanup();
});

describe('Navigator', () => {
  it('hands a url a use case navigated to over to the router', async () => {
    const wentTo: string[] = [];
    render(<Navigator onNavigate={(url) => wentTo.push(url)} />);

    await goTo('/tenants');

    expect(wentTo).toEqual(['/tenants']);
  });

  it('stops listening once it is gone, so a screen cannot navigate after unmounting', async () => {
    const wentTo: string[] = [];
    render(<Navigator onNavigate={(url) => wentTo.push(url)} />);

    await goTo('/first');
    cleanup();
    await goTo('/second');

    expect(wentTo).toEqual(['/first']);
  });

  it('does nothing when no router is wired up', async () => {
    render(<Navigator />);

    await expect(goTo('/tenants')).resolves.toBeUndefined();
  });
});
