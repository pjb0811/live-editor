// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { compile } from '~/utils/compile';

import { useCompiledModule } from './use-compiled-module';

vi.mock('~/utils/compile', async importOriginal => {
  const actual = await importOriginal<typeof import('~/utils/compile')>();

  return { ...actual, compile: vi.fn(actual.compile) };
});

const CODE = 'export default () => null;';

const Chart = () => null;
const Table = () => null;

const setup = (initial: Record<string, unknown> | undefined) =>
  renderHook(({ modules }) => useCompiledModule(CODE, modules), {
    initialProps: { modules: initial },
  });

beforeEach(() => {
  vi.mocked(compile).mockClear();
});

// A host's inline `modules` object is new each render; only a changed entry
// recompiles (#397).
describe('useCompiledModule modules', () => {
  it('does not recompile for a fresh object with the same entries', () => {
    const { rerender } = setup({ Chart });

    rerender({ modules: { Chart } });

    expect(compile).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['replaced', { Chart: Table }],
    ['added', { Chart, Table }],
    ['removed', {}],
    ['dropped entirely', undefined],
  ])('recompiles when a module is %s', (_case, next) => {
    const { rerender } = setup({ Chart });

    rerender({ modules: next });

    expect(compile).toHaveBeenCalledTimes(2);
  });

  // A changed module object recompiles (#329): values are never compared
  // deeply, so one with the same shape but a different identity counts.
  it('recompiles for a module with equal contents but a new identity', () => {
    const { rerender } = setup({ ui: { Chart } });

    rerender({ modules: { ui: { Chart } } });

    expect(compile).toHaveBeenCalledTimes(2);
  });

  it('tells a key holding undefined apart from a missing key', () => {
    const { rerender } = setup({ Chart: undefined });

    rerender({ modules: { Table: undefined } });

    expect(compile).toHaveBeenCalledTimes(2);
  });
});
