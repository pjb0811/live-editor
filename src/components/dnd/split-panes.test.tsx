// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SplitPanes from './split-panes';

afterEach(cleanup);

const renderPanes = () =>
  render(
    <SplitPanes
      start={<div>palette</div>}
      center={<div>canvas</div>}
      end={<div>panel</div>}
      labels={{ start: 'Resize palette', end: 'Resize panel' }}
    />,
  );

const handle = (name: string) => screen.getByRole('separator', { name });
const sizeOf = (name: string) => handle(name).getAttribute('aria-valuenow');

describe('SplitPanes', () => {
  it('renders all three panes with a labeled handle for each side', () => {
    renderPanes();

    expect(screen.getByText('palette')).not.toBeNull();
    expect(screen.getByText('canvas')).not.toBeNull();
    expect(screen.getByText('panel')).not.toBeNull();
    expect(sizeOf('Resize palette')).toBe('20');
    expect(sizeOf('Resize panel')).toBe('20');
  });

  it('resizes a side pane with the arrow keys, toward the center growing it', () => {
    renderPanes();

    fireEvent.keyDown(handle('Resize palette'), { key: 'ArrowRight' });
    fireEvent.keyDown(handle('Resize panel'), { key: 'ArrowRight' });

    expect(sizeOf('Resize palette')).toBe('22');
    expect(sizeOf('Resize panel')).toBe('18');
  });

  it('keeps a keyboard resize within the pane range', () => {
    renderPanes();

    fireEvent.keyDown(handle('Resize palette'), { key: 'End' });
    fireEvent.keyDown(handle('Resize palette'), { key: 'ArrowRight' });

    expect(sizeOf('Resize palette')).toBe('35');

    fireEvent.keyDown(handle('Resize palette'), { key: 'Home' });
    fireEvent.keyDown(handle('Resize palette'), { key: 'ArrowLeft' });

    expect(sizeOf('Resize palette')).toBe('15');
  });

  it('collapses a pane with Enter and restores its size', () => {
    renderPanes();

    fireEvent.keyDown(handle('Resize panel'), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle('Resize panel'), { key: 'Enter' });

    expect(sizeOf('Resize panel')).toBe('0');
    expect(screen.getByText('panel').parentElement!.hidden).toBe(true);

    fireEvent.keyDown(handle('Resize panel'), { key: 'Enter' });

    expect(sizeOf('Resize panel')).toBe('22');
    expect(screen.getByText('panel').parentElement!.hidden).toBe(false);
  });
});
