/**
 * What a browser build renders for `<StateTransfer />`: nothing.
 *
 * Handing state over is something a server render does; there is no request to
 * hand over here, and the browser has already adopted whatever the server left.
 * Keeping this separate from the server version is what leaves the serializer —
 * and the several kilobytes of it — out of the browser bundle entirely.
 */
export const StateTransfer = () => null;
