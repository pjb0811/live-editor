'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEFAULT_TEMPLATE } from '~/constants';
import { registerEditorSession } from '~/utils/editor-caches';

import {
  type LiveMessagesInput,
  MessagesContext,
  mergeMessages,
} from './messages';
import type { ErrorContextType, PreviewContextType } from './states';
import { ErrorContext, PreviewContext } from './states';

export interface Props {
  children?: React.ReactNode;
  // Replaces any of the editor's text, group by group; the rest stays
  // English, or the enclosing `Live`'s. Define it outside render or memoize
  // it: a new object re-renders everything that shows text (#524).
  messages?: LiveMessagesInput;
}

const ContextProvider = ({ children, messages }: Props) => {
  const [code, setCodeState] = useState(DEFAULT_TEMPLATE);
  const [error, setError] = useState<ErrorContextType['error']>(null);

  // Clears the last error in the same update that sets the code. An effect
  // would run after the new code's own error was reported, and wipe it.
  const setCode = useCallback<PreviewContextType['setCode']>(next => {
    setError(null);
    setCodeState(next);
  }, []);

  // Counts this editor, so the page-wide caches are released when the last
  // one unmounts (`utils/editor-caches.ts`).
  useEffect(() => registerEditorSession(), []);

  // Memoized, so a parent re-render doesn't re-render every `usePreview()`
  // and `useError()` consumer.
  const previewValue = useMemo<PreviewContextType>(
    () => ({ code, setCode }),
    [code, setCode],
  );

  const errorValue = useMemo<ErrorContextType>(
    () => ({ error, setError }),
    [error, setError],
  );

  // A provider inside another one starts from the outer one's messages, so
  // a page can set them once around several editors.
  const inherited = useContext(MessagesContext);
  const messagesValue = useMemo(
    () => mergeMessages(messages, inherited),
    [messages, inherited],
  );

  return (
    <PreviewContext.Provider value={previewValue}>
      <ErrorContext.Provider value={errorValue}>
        <MessagesContext.Provider value={messagesValue}>
          {children}
        </MessagesContext.Provider>
      </ErrorContext.Provider>
    </PreviewContext.Provider>
  );
};

export default ContextProvider;
