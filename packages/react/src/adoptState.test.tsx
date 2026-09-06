/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const STATE_GLOBAL = '__MAGIC_USE_CASE_STATE__';

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[STATE_GLOBAL];
});

afterEach(cleanup);

/**
 * The browser adopts what the server rendered from as the entry loads, before
 * anything renders — which is what keeps hydration from finding an empty tree
 * where the server had a full one.
 */
describe('a page the server rendered with data', () => {
  it('renders from the transferred state without running a use case', async () => {
    (globalThis as Record<string, unknown>)[STATE_GLOBAL] = { leases: ['lease-1'] };

    const { usePresenter } = await import('./index');

    function Leases() {
      const { model } = usePresenter((state: { leases: string[] }) => ({ first: state.leases[0] }));
      return <span data-testid="first">{model ? model.first : 'empty'}</span>;
    }

    render(<Leases />);

    expect(screen.getByTestId('first').textContent).toBe('lease-1');
  });

  it('renders empty when the server transferred nothing', async () => {
    const { usePresenter } = await import('./index');

    function Leases() {
      const { model } = usePresenter((state: { leases: string[] }) => ({ first: state.leases[0] }));
      return <span data-testid="first">{model ? model.first : 'empty'}</span>;
    }

    render(<Leases />);

    expect(screen.getByTestId('first').textContent).toBe('empty');
  });
});
