import { useEffect, useRef, useState } from 'react';

import { useEventListener } from '@jbpark/use-hooks';

import { useLiveMessages } from '~/components/context/messages';

import ErrorComponent from './error';

export interface Props {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

const Guard = ({ children, onError }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const messages = useLiveMessages();

  const containerRef = useRef<HTMLDivElement>(null);
  const errorHandled = useRef(false);
  // Read by the listeners, so new messages don't subscribe them again.
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  });

  useEventListener(
    'error',
    event => {
      if (errorHandled.current) {
        return;
      }

      errorHandled.current = true;

      const errorMessage =
        event.error?.message ||
        event.message ||
        messagesRef.current.errors.unknown;

      console.error('⚡ [Guard] Event handler error:', errorMessage);

      event.preventDefault();

      setError(errorMessage);
      onError?.(event.error || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);
    },
    { capture: true },
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (errorHandled.current) {
        return;
      }

      errorHandled.current = true;

      const errorMessage =
        event.reason?.message || messagesRef.current.errors.unhandledRejection;

      event.preventDefault();
      setError(errorMessage);
      onError?.(event.reason || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);
    };

    window.addEventListener(
      'unhandledrejection',
      handleUnhandledRejection,
      true,
    );

    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
        true,
      );
    };
  }, [onError]);

  if (error) {
    return (
      <ErrorComponent
        title={messages.errors.runtime}
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
