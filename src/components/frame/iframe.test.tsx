// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import IFrame from './iframe';

afterEach(cleanup);

describe('IFrame layout', () => {
  // Inline-level by default, an iframe leaves a descender gap below it that
  // stacks up across the canvas's per-section frames (#439).
  it('lays the frame out as a block', () => {
    const { container } = render(<IFrame>{() => null}</IFrame>);

    expect(container.querySelector('iframe')!.style.display).toBe('block');
  });

  it('still lets the caller override the display', () => {
    const { container } = render(
      <IFrame style={{ display: 'inline-block' }}>{() => null}</IFrame>,
    );

    expect(container.querySelector('iframe')!.style.display).toBe(
      'inline-block',
    );
  });
});
