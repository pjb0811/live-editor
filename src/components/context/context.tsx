'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { DEFAULT_TEMPLATE } from '~/constants';
import { clearCompilationCache } from '~/utils';

import type { ErrorContextType, PreviewContextType } from './states';
import { ErrorContext, PreviewContext } from './states';

const ContextProvider = ({ children }: { children?: React.ReactNode }) => {
  const [code, setCodeState] = useState(DEFAULT_TEMPLATE);
  const [error, setError] = useState<ErrorContextType['error']>(null);

  // Clears any stale runtime/compile error in the same update batch that
  // changes `code`, rather than in a separate useEffect — a useEffect here
  // would race with componentDidCatch/Guard's onError firing for the *new*
  // code's own errors within the same commit (layout effects run before
  // passive effects, so a passive-effect reset could wipe out an error the
  // new code just threw). Batching setError(null) into the same update as
  // setCode guarantees stale errors are gone by the time the new code even
  // renders, with nothing left afterward that could clobber a fresh one.
  const setCode = useCallback<PreviewContextType['setCode']>(next => {
    setError(null);
    setCodeState(next);
  }, []);

  useEffect(() => {
    return () => {
      clearCompilationCache();
    };
  }, []);

  return (
    <PreviewContext.Provider value={{ code, setCode }}>
      <ErrorContext.Provider value={{ error, setError }}>
        {children}
      </ErrorContext.Provider>
    </PreviewContext.Provider>
  );
};

export default ContextProvider;
