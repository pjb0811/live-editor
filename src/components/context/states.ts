'use client';

import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface PreviewContextType {
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
}

export interface ErrorContextType {
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
}

// `undefined` (rather than a no-op default) so usePreview/useError can tell
// "no <Live>/ContextProvider ancestor" apart from "a real value" and throw
// instead of silently no-op'ing — forgetting to wrap with <Live> previously
// failed silently (setCode/setError did nothing, code/error just stayed at
// their hardcoded defaults) instead of surfacing as a clear error.
export const PreviewContext = createContext<PreviewContextType | undefined>(
  undefined,
);

export const ErrorContext = createContext<ErrorContextType | undefined>(
  undefined,
);

export const usePreview = () => {
  const context = useContext(PreviewContext);

  if (context === undefined) {
    throw new Error('usePreview must be used within <Live> (ContextProvider)');
  }

  return context;
};

export const useError = () => {
  const context = useContext(ErrorContext);

  if (context === undefined) {
    throw new Error('useError must be used within <Live> (ContextProvider)');
  }

  return context;
};
