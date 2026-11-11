// @vitest-environment jsdom
import { createRef } from 'react';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Error from './error';

afterEach(cleanup);

describe('Error', () => {
  // The type accepts every div prop (#721).
  it('applies the div props to its root and merges style over its own', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Error
        message="boom"
        id="err"
        data-testid="e"
        ref={ref}
        style={{ margin: 4 }}
      />,
    );

    const root = container.querySelector<HTMLElement>('#err')!;

    expect(root.dataset.testid).toBe('e');
    expect(ref.current).toBe(root);
    expect(root.style.margin).toBe('4px');
    expect(root.style.padding).toBe('16px');
    expect(root.textContent).toContain('boom');
  });

  it('renders nothing without a message', () => {
    const { container } = render(<Error message={null} id="err" />);

    expect(container.querySelector('#err')).toBeNull();
  });
});
