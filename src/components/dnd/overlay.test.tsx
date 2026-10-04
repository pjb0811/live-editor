// @vitest-environment jsdom
import { DndContext } from '@dnd-kit/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';
import { createDocument, replaceSections } from '~/utils/sections';

import Overlay from './overlay';

// What dnd-kit reports as being dragged, set per test.
const drag = vi.hoisted(() => ({ active: null as unknown }));

vi.mock('@dnd-kit/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  useDndContext: () => ({ active: drag.active }),
}));

// Stands in for the compiled preview, showing what the overlay hands it.
vi.mock('./renderer', () => ({
  default: (props: { preview: string; forceFallback: boolean }) => (
    <div data-testid="renderer" data-forced={String(props.forceFallback)}>
      {props.preview}
    </div>
  ),
}));

const SECTION = '<section data-id="s1" data-name="Hero"><p>hero</p></section>';
const OTHER =
  '<section data-id="s2" data-name="Footer"><p>footer</p></section>';
const sections: Section[] = [
  { id: 's1', name: 'Hero', code: SECTION },
  { id: 's2', name: 'Footer', code: OTHER },
];

const renderOverlay = (isForced?: (section: Section) => boolean) =>
  render(
    <DndContext>
      <Overlay
        sections={sections}
        isForced={isForced}
        renderProps={{
          fullCode: replaceSections(
            createDocument({ containerId: 'root' }),
            [SECTION, OTHER],
            { containerId: 'root' },
          ),
          containerId: 'root',
          modules: {},
        }}
      />
    </DndContext>,
  );

afterEach(() => {
  cleanup();
  drag.active = null;
});

describe('Overlay', () => {
  it('renders nothing while nothing is dragged', () => {
    renderOverlay();

    expect(screen.queryByTestId('renderer')).toBeNull();
  });

  it('shows a palette card for a palette item', () => {
    drag.active = {
      id: 'new',
      data: {
        current: {
          type: 'new-item',
          item: { id: 'p', name: 'Pricing', code: '' },
        },
      },
    };
    renderOverlay();

    expect(screen.getByText('Pricing')).toBeTruthy();
    expect(screen.queryByTestId('renderer')).toBeNull();
  });

  it("previews a canvas section in its document's container", () => {
    drag.active = { id: 's1', data: { current: {} } };
    renderOverlay(section => section.id === 's1');

    const renderer = screen.getByTestId('renderer');

    // The document with only the dragged section in its container. Reading
    // the default container instead finds none and previews nothing useful.
    expect(renderer.textContent).toContain('id="root"');
    expect(renderer.textContent).toContain('hero');
    expect(renderer.textContent).not.toContain('footer');
    expect(renderer.dataset.forced).toBe('true');
  });

  it('renders nothing for an id that is no longer a section', () => {
    drag.active = { id: 'gone', data: { current: {} } };
    renderOverlay();

    expect(screen.queryByTestId('renderer')).toBeNull();
  });
});
