// @vitest-environment jsdom
import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorContext, PreviewContext, useError, usePreview } from './states';

describe('usePreview', () => {
  it('throws when used outside <Live> (ContextProvider)', () => {
    expect(() => renderHook(() => usePreview())).toThrow(
      /usePreview must be used within <Live>/,
    );
  });

  it('returns the context value when wrapped in a provider', () => {
    const setCode = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PreviewContext.Provider value={{ code: 'const a = 1;', setCode }}>
        {children}
      </PreviewContext.Provider>
    );

    const { result } = renderHook(() => usePreview(), { wrapper });
    expect(result.current.code).toBe('const a = 1;');
    expect(result.current.setCode).toBe(setCode);
  });
});

describe('useError', () => {
  it('throws when used outside <Live> (ContextProvider)', () => {
    expect(() => renderHook(() => useError())).toThrow(
      /useError must be used within <Live>/,
    );
  });

  it('returns the context value when wrapped in a provider', () => {
    const setError = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ErrorContext.Provider value={{ error: null, setError }}>
        {children}
      </ErrorContext.Provider>
    );

    const { result } = renderHook(() => useError(), { wrapper });
    expect(result.current.error).toBeNull();
    expect(result.current.setError).toBe(setError);
  });
});
