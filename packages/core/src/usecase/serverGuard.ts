/**
 * Application state is deliberately process-global: on the client there is one
 * process per user, so a single shared store is the intended design.
 *
 * That assumption does not hold on a server, where one process serves many
 * concurrent requests and the globals in `useCase.ts` and `eventEmitter.ts`
 * would be shared between them. Rather than let that surface as one user seeing
 * another's data, the server build refuses the operation outright.
 *
 * Enabled by the adapters, which know whether they are running on a server.
 */
let serverGuardEnabled = false;

export function enableServerGuard(): void {
  serverGuardEnabled = true;
}

export function isServerGuardEnabled(): boolean {
  return serverGuardEnabled;
}

export function assertNotOnServer(operation: string): void {
  if (!serverGuardEnabled) return;

  throw new Error(
    `[magic-use-case] ${operation} is not available during server-side rendering.\n\n` +
      'Application state is process-global by design, which is safe in a browser ' +
      '(one process per user) but not on a server, where concurrent requests would ' +
      'share it — one user could be served another user\'s data.\n\n' +
      'Server-side rendering of static markup is supported. To render per-user ' +
      'state, fetch it in your server framework and render on the client, or ' +
      'await request-scoped state support.',
  );
}
