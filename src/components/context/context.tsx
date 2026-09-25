'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_TEMPLATE } from '~/constants';
import { registerEditorSession } from '~/utils';

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

  // The provider is the ownership boundary for every editor-owned cache, not
  // just the compilation one it used to clear here: parsed documents,
  // extracted bindings and the blob URLs generated for external scripts all
  // outlive an editing session otherwise, released only when the LRU happens
  // to evict them. registerEditorSession both counts this session and hands
  // back the release, so the caches go when the last provider does.
  useEffect(() => registerEditorSession(), []);

  // Without this, a new object identity on every ContextProvider render
  // (even ones that don't touch code/error at all, e.g. a parent
  // re-rendering) meant every usePreview()/useError() consumer re-rendered
  // too, regardless of whether the values they care about actually changed.
  const previewValue = useMemo<PreviewContextType>(
    () => ({ code, setCode }),
    [code, setCode],
  );

  const errorValue = useMemo<ErrorContextType>(
    () => ({ error, setError }),
    [error, setError],
  );

  return (
    <PreviewContext.Provider value={previewValue}>
      <ErrorContext.Provider value={errorValue}>
        {children}
      </ErrorContext.Provider>
    </PreviewContext.Provider>
  );
};

export default ContextProvider;
