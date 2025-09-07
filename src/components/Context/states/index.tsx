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

export const PreviewContext = createContext<PreviewContextType>({
  code: '',
  setCode: () => {},
});

export const ErrorContext = createContext<ErrorContextType>({
  error: null,
  setError: () => {},
});

export const usePreview = () => {
  return useContext(PreviewContext);
};

export const useError = () => {
  return useContext(ErrorContext);
};
