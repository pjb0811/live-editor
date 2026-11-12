// @vitest-environment jsdom
import { useState } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IFrame from './iframe';

// Hands each script straight to the iframe as `blob:<src>`, without fetching.
vi.mock('~/utils/scripts', () => ({
  withScriptBlobs: async (
    srcs: string[],
    inject: (blobUrls: string[]) => void,
  ) => inject(srcs.map(src => `blob:${src}`)),
}));

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

// `onLoaded` runs once per document, and an inline callback or `scripts`
// array doesn't set the document up again on every render (#715).
describe('IFrame onLoaded and scripts', () => {
  const frameDocument = (container: HTMLElement) =>
    container.querySelector('iframe')!.contentDocument!;

  const injected = (container: HTMLElement) =>
    [...frameDocument(container).head.querySelectorAll('script')].map(script =>
      script.getAttribute('src'),
    );

  // Re-renders the frame on each click, with whatever props `frame` gives.
  const Host = ({ frame }: { frame: () => React.ReactElement }) => {
    const [count, setCount] = useState(0);

    return (
      <>
        <button type="button" onClick={() => setCount(count + 1)}>
          render {count}
        </button>
        {frame()}
      </>
    );
  };

  const renderFiveTimes = async () => {
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button'));
    }

    await act(() => new Promise(resolve => setTimeout(resolve, 20)));
  };

  it('calls an inline onLoaded once, however often the host renders', async () => {
    const onLoaded = vi.fn();

    render(
      <Host
        frame={() => (
          <IFrame onLoaded={() => onLoaded()}>{() => <p>x</p>}</IFrame>
        )}
      />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledOnce());
    await renderFiveTimes();

    expect(onLoaded).toHaveBeenCalledOnce();
  });

  it('calls onLoaded once with an inline scripts array', async () => {
    const onLoaded = vi.fn();

    render(
      <Host
        frame={() => (
          <IFrame scripts={[]} onLoaded={onLoaded}>
            {() => <p>x</p>}
          </IFrame>
        )}
      />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledOnce());
    await renderFiveTimes();

    expect(onLoaded).toHaveBeenCalledOnce();
  });

  // Moving the iframe, as reordering canvas sections does, gives it a new
  // document (#507).
  it('calls onLoaded again for a new document, and injects the scripts into it', async () => {
    const onLoaded = vi.fn();
    const { container } = render(
      <div>
        <IFrame scripts={['a.js']} onLoaded={onLoaded}>
          {() => <p>x</p>}
        </IFrame>
      </div>,
    );

    await waitFor(() => expect(onLoaded).toHaveBeenCalledOnce());

    const before = frameDocument(container);
    const elsewhere = document.createElement('div');

    document.body.appendChild(elsewhere);
    elsewhere.appendChild(container.querySelector('iframe')!);

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(2));
    expect(frameDocument(elsewhere)).not.toBe(before);
    expect(injected(elsewhere)).toEqual(['blob:a.js']);

    elsewhere.remove();
  });

  it('injects a script added to scripts later, once', async () => {
    const Scripts = () => {
      const [scripts, setScripts] = useState(['a.js']);

      return (
        <>
          <button type="button" onClick={() => setScripts(['a.js', 'b.js'])}>
            add
          </button>
          <IFrame scripts={[...scripts]}>{() => <p>x</p>}</IFrame>
        </>
      );
    };
    const { container } = render(<Scripts />);

    await waitFor(() => expect(injected(container)).toEqual(['blob:a.js']));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() =>
      expect(injected(container)).toEqual(['blob:a.js', 'blob:b.js']),
    );
  });
});
