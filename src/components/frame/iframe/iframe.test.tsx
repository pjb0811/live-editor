// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import IFrame from './iframe';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('class');
  document.documentElement.removeAttribute('data-theme');
});

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

// A host rule like `body { overflow: hidden }`, copied in by syncStyle,
// must not stop a fixed-height preview from scrolling.
describe('IFrame scrolling', () => {
  const frameBody = (container: HTMLElement) =>
    container.querySelector('iframe')!.contentDocument!.body;

  it('lets a fixed-height iframe scroll its own document', async () => {
    const { container } = render(<IFrame syncStyle>{() => null}</IFrame>);

    await waitFor(() =>
      expect(frameBody(container).style.overflowY).toBe('auto'),
    );
  });

  it('leaves the body alone with autoHeight', async () => {
    const { container } = render(
      <IFrame syncStyle autoHeight>
        {() => null}
      </IFrame>,
    );

    await waitFor(() =>
      expect(frameBody(container).querySelector('#iframe-root')).not.toBeNull(),
    );
    expect(frameBody(container).style.overflowY).toBe('');
  });
});

// With syncStyle the host's stylesheets come in, but their theme selectors
// need the host's `<html>` class or attribute on the iframe's root (#497).
describe('IFrame syncStyle and the host theme', () => {
  const frameRoot = (container: HTMLElement) =>
    container.querySelector('iframe')!.contentDocument!.documentElement;

  it("mirrors the host <html>'s theme onto the iframe's and follows a switch", async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.className = 'dark';

    const { container } = render(<IFrame syncStyle>{() => null}</IFrame>);

    await waitFor(() =>
      expect(frameRoot(container).getAttribute('data-theme')).toBe('dark'),
    );
    expect(frameRoot(container).classList.contains('dark')).toBe(true);

    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.className = '';

    await waitFor(() =>
      expect(frameRoot(container).getAttribute('data-theme')).toBe('light'),
    );
    expect(frameRoot(container).classList.contains('dark')).toBe(false);
  });

  it('leaves the iframe root alone without syncStyle', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { container } = render(<IFrame>{() => null}</IFrame>);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(frameRoot(container).hasAttribute('data-theme')).toBe(false);
  });
});
