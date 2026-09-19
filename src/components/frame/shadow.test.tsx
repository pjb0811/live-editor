// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Shadow from './shadow';

afterEach(cleanup);

describe('Shadow style synchronization', () => {
  it('removes host style clones when synchronization is disabled', async () => {
    const sourceStyle = document.createElement('style');

    sourceStyle.id = 'host-style-probe';
    sourceStyle.textContent = '.probe { color: red; }';
    document.head.appendChild(sourceStyle);

    const { container, rerender } = render(
      <Shadow syncStyle>{() => <div>Preview</div>}</Shadow>,
    );
    const shadowRoot = container.firstElementChild?.shadowRoot;

    await waitFor(() => {
      expect(
        shadowRoot?.querySelector(
          '[data-live-editor-synced-style]#host-style-probe',
        ),
      ).not.toBeNull();
    });

    rerender(<Shadow syncStyle={false}>{() => <div>Preview</div>}</Shadow>);

    expect(
      shadowRoot?.querySelector(
        '[data-live-editor-synced-style]#host-style-probe',
      ),
    ).toBeNull();

    sourceStyle.remove();
  });
});
