import { onError } from '@magic-use-case/core';
import { createSignal, ErrorBoundary, type JSXElement, onCleanup, Show } from 'solid-js';

export interface ErrorDialogProps {
  error: Error;
  onClose: () => void;
}

export interface ErrorHandlerProps {
  children: JSXElement;
  onWillReportError: (error: Error) => boolean;
  onDidReportError?: (error: Error) => void;
  renderErrorDialog: (props: ErrorDialogProps) => JSXElement;
}

export const ErrorHandler = (props: ErrorHandlerProps) => {
  const [error, setError] = createSignal<Error | undefined>(undefined);

  const reportError = (error: Error) => {
    const shouldReport = props.onWillReportError(error);
    if (shouldReport) {
      setError(error);
      props.onDidReportError?.(error);
    }
  };

  const clearError = () => {
    setError(undefined);
  };

  const unsubscribe = onError(reportError);
  onCleanup(unsubscribe);

  return (
    <ErrorBoundary fallback={(error, reset) => props.renderErrorDialog({ error, onClose: reset })}>
      {props.children}
      <Show when={error()}>{props.renderErrorDialog({ error: error()!, onClose: clearError })}</Show>
    </ErrorBoundary>
  );
};
