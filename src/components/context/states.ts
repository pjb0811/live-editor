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

// `undefined` outside a provider, so `usePreview` and `useError` can throw
// there instead of silently doing nothing.
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
