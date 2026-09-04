import { onError } from '@magicdoor/magic-use-case-core';
import React, { useCallback, useEffect, useRef, useState, Component } from 'react';

interface ErrorDialogProps {
  error: Error;
  onClose: () => void;
}

interface ErrorHandlerProps {
  children: React.ReactNode;
  onWillReportError: (error: Error) => boolean;
  onDidReportError?: (error: Error) => void;
  renderErrorDialog: (props: ErrorDialogProps) => React.ReactNode;
}

class ErrorBoundary extends Component<
  {
    children: React.ReactNode;
    onError: (error: Error) => void;
    renderErrorDialog: (props: ErrorDialogProps) => React.ReactNode;
    error?: Error;
    onClose: () => void;
  },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    const error = this.props.error || this.state.error;
    if (error) {
      return this.props.renderErrorDialog({
        error,
        onClose: () => {
          this.setState({ error: undefined });
          this.props.onClose();
        },
      });
    }

    return this.props.children;
  }
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = (props) => {
  const [error, setError] = useState<Error>();
  const propsRef = useRef(props);
  propsRef.current = props;

  const reportError = useCallback((error: Error) => {
    const shouldReport = propsRef.current.onWillReportError(error);
    if (shouldReport) {
      setError(error);
      propsRef.current.onDidReportError?.(error);
    }
  }, []);

  const clearError = () => {
    setError(undefined);
  };

  useEffect(() => {
    return onError(reportError);
  }, [reportError]);

  return (
    <ErrorBoundary 
      onError={reportError}
      renderErrorDialog={props.renderErrorDialog}
      error={error}
      onClose={clearError}
    >
      <>{props.children}</>
    </ErrorBoundary>
  );
}; 