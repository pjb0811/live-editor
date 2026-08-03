'use client';

import React, { useEffect, useState } from 'react';

import { DEFAULT_TEMPLATE } from '~/constants';
import { clearCompilationCache } from '~/utils';

import type { ErrorContextType } from './states';
import { ErrorContext, PreviewContext } from './states';

const ContextProvider = ({ children }: { children?: React.ReactNode }) => {
  const [code, setCode] = useState(DEFAULT_TEMPLATE);
  const [error, setError] = useState<ErrorContextType['error']>(null);

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
