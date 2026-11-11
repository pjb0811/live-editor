import { useRef, useState } from 'react';

import { useEventListener, useLatest } from '@jbpark/use-hooks';

import { useLiveMessages } from '~/components/context/messages';

import ErrorComponent from './error';
import { isIgnoredPageError } from './ignored-page-error';

// Exported although no file imports it: the declaration of `App` in
// `src/index.tsx` names it, and TypeScript can't name a type from another
// module unless it is exported (TS4023).
export interface Props {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

const Guard = ({ children, onError }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const messages = useLiveMessages();

  const errorHandled = useRef(false);
  // Read by the listeners, so new messages don't subscribe them again.
  const messagesRef = useLatest(messages);

  useEventListener(
    'error',
    event => {
      // Checked before `errorHandled` is set, so an ignored notice doesn't
      // drop the real error that follows it.
      if (errorHandled.current || isIgnoredPageError(event.message)) {
        return;
      }

      errorHandled.current = true;

      const errorMessage =
        event.error?.message ||
        event.message ||
        messagesRef.current.errors.unknown;

      // Not `preventDefault()`: the browser still reports the error in the
      // console, with its stack (#714).
      setError(errorMessage);
      onError?.(event.error || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);
    },
    { capture: true },
  );

  useEventListener(
    'unhandledrejection',
    event => {
      if (errorHandled.current) {
        return;
      }

      errorHandled.current = true;

      const errorMessage =
        event.reason?.message || messagesRef.current.errors.unhandledRejection;

      setError(errorMessage);
      onError?.(event.reason || new window.Error(errorMessage));

      setTimeout(() => {
        errorHandled.current = false;
      }, 100);
    },
    { capture: true },
  );

  // The box goes next to the children, not in place of them: the listener
  // can't tell where an error came from, so an error from the host page must
  // not unmount the preview and lose its state (#714). `children` stay the
  // second child, so React keeps them mounted when the box appears.
  return (
    <>
      {error && (
        <ErrorComponent
          title={messages.errors.runtime}
          message={error}
          style={{ margin: 16 }}
          onReset={() => {
            setError(null);
            errorHandled.current = false;
          }}
        />
      )}
      <div>{children}</div>
    </>
  );
};

export default Guard;
