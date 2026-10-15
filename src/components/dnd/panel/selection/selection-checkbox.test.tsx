// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SelectionCheckbox from './selection-checkbox';

afterEach(cleanup);

describe('SelectionCheckbox', () => {
  it('toggles on click and passes whether Shift was held', () => {
    const onToggle = vi.fn();

    render(<SelectionCheckbox checked={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'), { shiftKey: true });

    expect(onToggle.mock.calls).toEqual([[false], [true]]);
  });

  it('shows the checked state it is given', () => {
    render(<SelectionCheckbox checked onToggle={() => {}} />);

    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('ignores clicks while disabled', () => {
    const onToggle = vi.fn();

    render(<SelectionCheckbox checked={false} disabled onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).not.toHaveBeenCalled();
  });
});
