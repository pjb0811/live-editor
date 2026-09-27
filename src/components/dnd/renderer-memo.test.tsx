// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE } from '~/constants';
import { clearCompilationCache } from '~/utils';

import { PreviewContext } from '../context/states';
import type { FrameProps } from '../frame';
import Dnd from './dnd';
import { Canvas } from './layout';

// The frame's iframe/shadow plumbing isn't under test: render sections inline.
vi.mock('~/components/frame', () => ({
  default: ({
    children,
  }: {
    children: (container: HTMLElement) => React.ReactNode;
  }) => <>{children(document.body)}</>,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  clearCompilationCache();
  delete (globalThis as { sectionRenders?: number }).sectionRenders;
});

const renders = () =>
  (globalThis as { sectionRenders?: number }).sectionRenders ?? 0;

// Each section counts its own renders, with nothing but the built-in modules,
// so the default `modules` prop is part of what is measured.
const section = (id: string) =>
  `<section data-id="${id}" data-name="${id}"><p>{(globalThis.sectionRenders = (globalThis.sectionRenders || 0) + 1, '${id}')}</p></section>`;

const value = DEFAULT_TEMPLATE.replace(
  '<main id="app-container"></main>',
  `<main id="app-container">${section('a')}${section('b')}</main>`,
);

const tree = (frame: FrameProps) => (
  <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
    <Dnd value={value} onChange={vi.fn()} frame={frame}>
      <Canvas />
    </Dnd>
  </PreviewContext.Provider>
);

// #348: every section re-rendered on every edit, because the default
// `modules` and a caller's inline `frame` were new objects each render.
describe('canvas sections re-render only when their own inputs change', () => {
  it('skips sections when only a fresh but equal frame object is passed', () => {
    const { rerender } = render(tree({ mode: 'iframe', scripts: ['a.js'] }));
    const before = renders();

    act(() => rerender(tree({ mode: 'iframe', scripts: ['a.js'] })));

    expect(before).toBeGreaterThan(0);
    expect(renders()).toBe(before);
  });

  it('still re-renders sections when the frame configuration changes', () => {
    const { rerender } = render(tree({ mode: 'iframe', scripts: ['a.js'] }));
    const before = renders();

    act(() => rerender(tree({ mode: 'iframe', scripts: ['b.js'] })));

    expect(renders()).toBeGreaterThan(before);
  });
});
