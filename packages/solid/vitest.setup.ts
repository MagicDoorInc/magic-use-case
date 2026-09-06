import { beforeEach } from 'vitest';

/**
 * Solid marks itself as loaded on `globalThis` and warns when it finds that
 * marker already set, which catches an application bundling two copies.
 *
 * These tests reset the module registry on purpose — the scope resolver is
 * process-wide, so a test that installs one needs its own copy of the library —
 * and that re-evaluates Solid every time. The marker is cleared with the
 * registry rather than the warning silenced, so a genuine duplicate would still
 * be reported.
 */
beforeEach(() => {
  delete (globalThis as Record<string, unknown>).Solid$$;
});
