// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('useFormatCode', () => {
  it('returns the code unformatted when prettier is not installed (optional peer)', async () => {
    // Simulate the peer being absent: the dynamic import rejects, and the
    // hook must degrade to returning the source untouched rather than throw.
    vi.doMock('prettier', () => {
      throw new Error("Cannot find package 'prettier'");
    });

    const { useFormatCode } = await import('./use-format-code');
    const { result } = renderHook(() => useFormatCode());

    const input = 'const  x=1';
    const out = await result.current(input);

    expect(out).toBe(input);

    vi.doUnmock('prettier');
    // Generous timeout: the first import pulls the ~/utils barrel
    // (@babel/standalone + ui-kit) through Vite's transform, which is slow the
    // first time but has nothing to do with the assertion.
  }, 30000);
});
