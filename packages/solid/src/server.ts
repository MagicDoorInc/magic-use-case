/**
 * The server build's entry. Everything the browser build exports, with the one
 * component that behaves differently on a server: an explicit export takes
 * precedence over a star export, so this is the `StateTransfer` a server render
 * gets, and the browser build never imports the serializer behind it.
 */
export * from './index';
export { StateTransfer } from './ui/StateTransfer';
