// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';

import DraggableItem from './draggable';
import { paletteDragData, paletteSectionOf } from './palette-drag';

// What `DraggableItem` registers with dnd-kit, captured per render.
const registered = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock('@dnd-kit/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  useDraggable: ({ data }: { data: unknown }) => {
    registered.data = data;

    return {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      isDragging: false,
    };
  },
}));

const hero: Section = { id: 'hero', name: 'Hero', code: '<section />' };

afterEach(cleanup);

describe('palette drag data', () => {
  it('reads back the section it was made for', () => {
    expect(paletteSectionOf({ current: paletteDragData(hero) })).toBe(hero);
  });

  it('reads nothing from another drag', () => {
    expect(paletteSectionOf({ current: { sortable: { index: 0 } } })).toBe(
      undefined,
    );
    expect(paletteSectionOf({ current: undefined })).toBe(undefined);
    expect(paletteSectionOf(undefined)).toBe(undefined);
  });

  it('is what DraggableItem registers', () => {
    render(<DraggableItem item={hero}>{() => null}</DraggableItem>);

    expect(paletteSectionOf({ current: registered.data })).toBe(hero);
  });
});
