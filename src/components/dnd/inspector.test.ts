// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { findElementById, pickElement, viewportRect } from './inspector';

// jsdom has no layout, so each test says what's under the point.
const stackAt = (root: Document | ShadowRoot, elements: Element[]) => {
  const elementsFromPoint = vi.fn(() => elements);

  Object.defineProperty(root, 'elementsFromPoint', {
    configurable: true,
    value: elementsFromPoint,
  });

  return elementsFromPoint;
};

// A canvas section as Dnd renders it: a wrapper holding the overlay that
// takes the pointer and, under it, the section's preview.
const createSection = (preview: string) => {
  const section = document.createElement('div');
  const overlay = document.createElement('div');
  const content = document.createElement('div');

  content.innerHTML = preview;
  section.append(overlay, content);
  document.body.append(section);

  return { section, overlay, content };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('pickElement', () => {
  it('picks the nearest element with a data-id under the overlay', () => {
    const { section, overlay, content } = createSection(
      '<section data-id="s"><h1 data-id="s-1"><span>Title</span></h1></section>',
    );
    const span = content.querySelector('span')!;
    const h1 = content.querySelector('h1')!;

    stackAt(document, [overlay, span, h1, section, document.body]);

    expect(pickElement(section, overlay, 10, 10)).toBe(h1);
  });

  it('never picks past the section, even onto an id on the host page', () => {
    const page = document.createElement('div');
    const { section, overlay, content } = createSection('<p>No id</p>');
    const p = content.querySelector('p')!;

    page.setAttribute('data-id', 'host');
    page.append(section);
    document.body.append(page);
    stackAt(document, [overlay, p, section, page]);

    expect(pickElement(section, overlay, 10, 10)).toBeNull();
  });

  it('ignores an empty data-id', () => {
    const { section, overlay, content } = createSection(
      '<section data-id="s"><p data-id="">Text</p></section>',
    );
    const p = content.querySelector('p')!;

    stackAt(document, [overlay, p]);

    expect(pickElement(section, overlay, 10, 10)).toBe(
      content.querySelector('section'),
    );
  });

  // Inside a shadow root, `elementsFromPoint` lists the host page's
  // elements too, the overlay first among them.
  it('looks inside a shadow root, skipping the elements outside it', () => {
    const { section, overlay, content } = createSection('');
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML =
      '<section data-id="s"><h1 data-id="s-1">Title</h1></section>';
    content.append(host);
    stackAt(document, [overlay, host, section]);
    stackAt(root, [overlay, root.querySelector('h1')!, section]);

    expect(pickElement(section, overlay, 10, 10)).toBe(
      root.querySelector('h1'),
    );
  });

  it('looks inside an iframe, at the point in its own coordinates', () => {
    const { section, overlay, content } = createSection('');
    const iframe = document.createElement('iframe');

    content.append(iframe);

    const frameDocument = iframe.contentDocument!;

    frameDocument.body.innerHTML =
      '<section data-id="s"><p data-id="s-2">Text</p></section>';
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 50, 400, 300),
    );
    stackAt(document, [overlay, iframe, section]);

    const inner = stackAt(frameDocument, [frameDocument.querySelector('p')!]);

    expect(pickElement(section, overlay, 130, 80)).toBe(
      frameDocument.querySelector('p'),
    );
    expect(inner).toHaveBeenCalledWith(30, 30);
  });
});

describe('viewportRect', () => {
  it('adds the offset of the iframe an element is in', () => {
    const iframe = document.createElement('iframe');

    document.body.append(iframe);

    const p = iframe.contentDocument!.createElement('p');

    iframe.contentDocument!.body.append(p);
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 50, 400, 300),
    );
    vi.spyOn(p, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 20, 30, 40),
    );

    const rect = viewportRect(p);

    expect([rect.left, rect.top, rect.width, rect.height]).toEqual([
      110, 70, 30, 40,
    ]);
  });
});

// The other direction from picking: from a panel field's `data-id` to the
// element it edits, in each frame mode (#514).
describe('findElementById', () => {
  it('finds an element rendered in place', () => {
    const { section, content } = createSection('<p data-id="s-1">x</p>');

    expect(findElementById(section, 's-1')).toBe(content.querySelector('p'));
    expect(findElementById(section, 'nope')).toBeNull();
  });

  it('looks inside a shadow root', () => {
    const { section, content } = createSection('');
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = '<h2 data-id="s-2">Title</h2>';
    content.append(host);

    expect(findElementById(section, 's-2')).toBe(shadow.querySelector('h2'));
  });

  it("looks inside an iframe's document", () => {
    const { section, content } = createSection('');
    const frame = document.createElement('iframe');

    content.append(frame);
    frame.contentDocument!.body.innerHTML = '<a data-id="s-3">Go</a>';

    expect(findElementById(section, 's-3')).toBe(
      frame.contentDocument!.querySelector('a'),
    );
  });

  it('escapes the id', () => {
    const { section, content } = createSection("<p data-id='a\"b'>x</p>");

    expect(findElementById(section, 'a"b')).toBe(content.querySelector('p'));
  });
});
