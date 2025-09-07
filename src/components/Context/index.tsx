'use client';

import React, { useState } from 'react';

import type { ErrorContextType } from './states';
import { ErrorContext, PreviewContext } from './states';

const ContextProvider = ({ children }: { children?: React.ReactNode }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<ErrorContextType['error']>(null);

  return (
    <PreviewContext.Provider value={{ code, setCode }}>
      <ErrorContext.Provider value={{ error, setError }}>
        {children}
      </ErrorContext.Provider>
    </PreviewContext.Provider>
  );
};

export default ContextProvider;
