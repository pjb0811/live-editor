// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE, DRAGGABLE_ITEMS } from '~/constants';

import { PreviewContext } from '../context/states';
import Dnd from './dnd';
import Layout, { Canvas, Palette, Panel } from './layout';
import { useDndLayout, useDndPalette, useDndPanel } from './layout-context';

// Same reason as dnd.test.tsx: each section compiles into an iframe, none of
// which jsdom needs to do for us to see where the regions landed.
vi.mock('./renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// `useResponsiveSize` with no options measures `document.body.offsetWidth`,
// which jsdom reports as 0 — so the default breakpoint is `xs` and Dnd takes
// the mobile branch unless a test says otherwise. Stubbing the width is
// enough to get the desktop Splitter, since the hook measures the body on
// mount (useLayoutEffect) rather than only on resize.
const withViewportWidth = (width: number) => {
  Object.defineProperty(document.body, 'offsetWidth', {
    value: width,
    configurable: true,
  });
};

afterEach(() => {
  withViewportWidth(0);
});

const stats = DRAGGABLE_ITEMS.find(item => item.id === 'stats')!;

const document_ = DEFAULT_TEMPLATE.replace(
  '<main id="app-container"></main>',
  `<main id="app-container">${stats.code}</main>`,
);

const renderDnd = (children?: React.ReactNode) =>
  render(
    <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
      <Dnd value={document_}>{children}</Dnd>
    </PreviewContext.Provider>,
  );

describe('the built-in layout', () => {
  it('renders the 3-pane arrangement on desktop', () => {
    withViewportWidth(1280);

    const { container } = renderDnd();

    // Palette (a draggable per DRAGGABLE_ITEMS entry), canvas, and the
    // property panel's unselected state — one assertion per pane.
    expect(container.textContent).toContain(stats.name);
    expect(container.querySelector('[data-frame-container]')).not.toBeNull();
    expect(container.textContent).toContain('Please select a section.');
    expect(
      container.querySelector('[aria-roledescription="sortable"]'),
    ).not.toBeNull();
  });

  it('stacks the canvas and keeps the palette in a Drawer on mobile', () => {
    const { container } = renderDnd();

    expect(container.querySelector('[data-frame-container]')).not.toBeNull();
    // The FAB that opens the palette Drawer, and nothing of the palette
    // itself until it does.
    expect(container.querySelector('[aria-label="Components"]')).not.toBeNull();
    expect(container.textContent).not.toContain(stats.name);
  });
});

describe("the built-in layout's slots", () => {
  it('swaps one region out and keeps the rest of the arrangement', () => {
    withViewportWidth(1280);

    const MyPanel = () => {
      const { item } = useDndPanel();

      return <div data-testid="my-panel">{item?.name ?? 'nothing picked'}</div>;
    };

    const { container } = renderDnd(<Layout panel={<MyPanel />} />);

    expect(container.querySelector('[data-testid="my-panel"]')).not.toBeNull();
    // The built-in panel is gone, but the other two panes are untouched.
    expect(container.textContent).not.toContain('Please select a section.');
    expect(container.textContent).toContain(stats.name);
    expect(container.querySelector('[data-frame-container]')).not.toBeNull();
  });

  it('reuses the same slot for the pane and the mobile Drawer', () => {
    const MyPalette = () => {
      const { items, onAdd } = useDndPalette();

      return (
        <button data-testid="my-palette" onClick={() => onAdd(items[0]!)}>
          {items.length} items
        </button>
      );
    };

    const { container } = renderDnd(<Layout palette={<MyPalette />} />);

    // Mobile: the palette lives in the Drawer the built-in layout still owns,
    // so the slot has to reach it without the consumer rebuilding the chrome.
    const fab = container.querySelector<HTMLElement>(
      '[aria-label="Components"]',
    )!;

    act(() => fab.click());

    // The Drawer portals out of Dnd's own subtree, so look for the slot in
    // the whole document rather than the render container.
    const slot = document.body.querySelector('[data-testid="my-palette"]')!;

    expect(slot).not.toBeNull();
    expect(slot.textContent).toBe(`${DRAGGABLE_ITEMS.length} items`);
  });
});

describe('a layout supplied as children', () => {
  it('places each region where the children put it', () => {
    withViewportWidth(1280);

    const { container } = renderDnd(
      <div data-testid="custom">
        <Panel />
        <Canvas />
        <Palette />
      </div>,
    );

    const custom = container.querySelector('[data-testid="custom"]')!;

    expect(custom.querySelector('[data-frame-container]')).not.toBeNull();
    expect(custom.textContent).toContain(stats.name);
    expect(custom.textContent).toContain('Please select a section.');
  });

  it('replaces the built-in chrome rather than rendering alongside it', () => {
    withViewportWidth(1280);

    const { container } = renderDnd(<Canvas />);

    // Anything still rendering the default layout here would double up the
    // palette — two draggables per item, sharing their drag ids.
    expect(container.querySelector('[aria-label="Components"]')).toBeNull();
    expect(container.textContent).not.toContain(stats.name);
    expect(container.querySelectorAll('[data-frame-container]').length).toBe(1);
  });

  it('keeps selection flowing from the canvas to the panel', () => {
    const { container } = renderDnd(
      <>
        <Canvas />
        <Panel />
      </>,
    );

    const sortable = container.querySelector<HTMLElement>(
      '[aria-roledescription="sortable"]',
    );

    expect(sortable).not.toBeNull();

    act(() => sortable!.click());

    // Both regions read Dnd's state through the layout context, so selecting
    // on the canvas has to reach the panel wherever the two sit in the tree.
    expect(container.textContent).not.toContain('Please select a section.');
    expect(container.textContent).toContain('Stats Items');
  });

  it('can wrap the built-in layout instead of rebuilding it', () => {
    withViewportWidth(1280);

    const { container } = renderDnd(
      <div data-testid="wrapper" className="flex flex-col">
        <div>toolbar</div>
        <Layout />
      </div>,
    );

    const wrapper = container.querySelector('[data-testid="wrapper"]')!;

    expect(wrapper.textContent).toContain('toolbar');
    expect(wrapper.querySelector('[data-frame-container]')).not.toBeNull();
    expect(wrapper.textContent).toContain(stats.name);
  });

  it('falls back to the built-in layout when the children render nothing', () => {
    withViewportWidth(1280);

    // What `{condition && <MyLayout />}` collapses to. Honouring it literally
    // would leave an editor with no regions at all, which reads as a broken
    // build rather than a mistake in the layout.
    const { container } = renderDnd(false);

    expect(container.querySelector('[data-frame-container]')).not.toBeNull();
    expect(container.textContent).toContain(stats.name);
  });

  it('reports the mobile state a custom layout has to branch on', () => {
    const Probe = () => {
      const { isMobile } = useDndLayout();

      return <div data-testid="probe">{String(isMobile)}</div>;
    };

    const { container } = renderDnd(<Probe />);

    // Supplying children drops the built-in mobile chrome, so a custom layout
    // needs the same signal the built-in one branches on to replace it.
    expect(container.querySelector('[data-testid="probe"]')!.textContent).toBe(
      'true',
    );
  });
});

describe('rendering outside Dnd', () => {
  it.each([
    ['<Live.Dnd.Palette>', () => <Palette />],
    ['<Live.Dnd.Canvas>', () => <Canvas />],
    ['<Live.Dnd.Panel>', () => <Panel />],
    ['<Live.Dnd.Layout>', () => <Layout />],
  ])('names the offending region: %s', (subject, Region) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Region />)).toThrow(
      `${subject} must be used inside <Live.Dnd>.`,
    );

    error.mockRestore();
  });

  it.each([
    ['useDndPalette()', useDndPalette],
    ['useDndPanel()', useDndPanel],
    ['useDndLayout()', useDndLayout],
  ])('names the offending hook: %s', (subject, hook) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const Probe = () => {
      hook();

      return null;
    };

    expect(() => render(<Probe />)).toThrow(
      `${subject} must be used inside <Live.Dnd>.`,
    );

    error.mockRestore();
  });
});
