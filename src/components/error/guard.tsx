import { useEffect, useRef, useState } from 'react';

import ErrorComponent from './error';

export interface Props {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

const Guard = ({ children, onError }: Props) => {
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const errorHandled = useRef(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const onError = (event: ErrorEvent) => {
      if (errorHandled.current) {
        return;
      }

      errorHandled.current = true;

      const errorMessage =
        event.error?.message || event.message || 'Unknown error';

      console.error('⚡ [Guard] Event handler error:', errorMessage);

      event.preventDefault();

      setError(errorMessage);
      onError?.(event.error || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);

      return true;
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (errorHandled.current) {
        return;
      }

      errorHandled.current = true;

      const errorMessage = event.reason?.message || 'Promise rejection';

      event.preventDefault();
      setError(errorMessage);
      onError?.(event.reason || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection, true);

    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener(
        'unhandledrejection',
        onUnhandledRejection,
        true,
      );
    };
  }, [onError]);

  if (error) {
    return (
      <ErrorComponent
        title="Runtime Error"
        message={error}
        className="m-4"
        onReset={() => {
          setError(null);
          errorHandled.current = false;
        }}
      />
    );
  }

  return <div ref={containerRef}>{children}</div>;
};

export default Guard;
