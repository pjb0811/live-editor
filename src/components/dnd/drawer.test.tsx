// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Drawer from './drawer';

afterEach(cleanup);

const renderDrawer = (open: boolean, onClose = vi.fn()) =>
  render(
    <Drawer open={open} title="Components" closeLabel="Close" onClose={onClose}>
      <p>content</p>
    </Drawer>,
  );

describe('Drawer', () => {
  it('mounts its content only while open', () => {
    const { rerender } = renderDrawer(false);

    expect(screen.queryByText('content')).toBeNull();

    rerender(
      <Drawer open title="Components" closeLabel="Close" onClose={vi.fn()}>
        <p>content</p>
      </Drawer>,
    );

    expect(screen.getByText('content')).not.toBeNull();
  });

  it('is a dialog named by its title', () => {
    renderDrawer(true);

    expect(screen.getByRole('dialog', { name: 'Components' })).not.toBeNull();
  });

  it('closes from its close button, Escape and the backdrop, not its content', () => {
    const onClose = vi.fn();

    renderDrawer(true, onClose);

    const dialog = screen.getByRole('dialog');

    fireEvent.click(screen.getByText('content'));

    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
