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
    // (@babel/standalone) through Vite's transform, which is slow the
    // first time but has nothing to do with the assertion.
  }, 30000);

  // One parser for both, as `compile()` uses one preset (#713). The `babel`
  // parser, which a heuristic picked when it missed the TypeScript, threw on
  // the first.
  it.each([
    {
      name: 'TypeScript the old heuristic missed',
      input: 'const m=new Map<string,number>()',
      output: 'const m = new Map<string, number>();\n',
    },
    { name: 'JavaScript', input: 'const  x=1', output: 'const x = 1;\n' },
  ])(
    'formats $name',
    async ({ input, output }) => {
      vi.resetModules();

      const { useFormatCode } = await import('./use-format-code');
      const { result } = renderHook(() => useFormatCode());

      await expect(result.current(input)).resolves.toBe(output);
    },
    30000,
  );
});
