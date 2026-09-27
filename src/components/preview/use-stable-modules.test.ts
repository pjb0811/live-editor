// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStableModules } from './use-stable-modules';

const Chart = () => null;
const Table = () => null;

const setup = (initial: Record<string, unknown> | undefined) =>
  renderHook(({ modules }) => useStableModules(modules), {
    initialProps: { modules: initial },
  });

describe('useStableModules', () => {
  it('keeps the first object while a fresh one has the same entries', () => {
    const first = { Chart };
    const { result, rerender } = setup(first);

    rerender({ modules: { Chart } });

    expect(result.current).toBe(first);
  });

  it.each([
    ['replaced', { Chart: Table }],
    ['added', { Chart, Table }],
    ['removed', {}],
    ['dropped entirely', undefined],
  ])('switches to the new object when a module is %s', (_case, next) => {
    const { result, rerender } = setup({ Chart });

    rerender({ modules: next });

    expect(result.current).toBe(next);
  });

  // A changed module object recompiles (#329): values are never compared
  // deeply, so one with the same shape but a different identity counts.
  it('treats a module with equal contents but a new identity as changed', () => {
    const { result, rerender } = setup({ ui: { Chart } });
    const next = { ui: { Chart } };

    rerender({ modules: next });

    expect(result.current).toBe(next);
  });

  it('tells a key holding undefined apart from a missing key', () => {
    const { result, rerender } = setup({ Chart: undefined });
    const next = { Table: undefined };

    rerender({ modules: next });

    expect(result.current).toBe(next);
  });
});
