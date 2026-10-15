// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { syncInjectedAssets } from './inject-assets';

const NONE = { styles: 0, stylesheets: 0 };

describe('syncInjectedAssets', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('frame');
  });

  it('adds one numbered <style> per CSS string and one <link> per URL', () => {
    const counts = syncInjectedAssets(
      doc,
      ['a { color: red }', 'b { color: blue }'],
      ['https://example.com/x.css'],
      NONE,
    );

    expect(doc.getElementById('injected-style-0')?.textContent).toBe(
      'a { color: red }',
    );
    expect(doc.getElementById('injected-style-1')?.textContent).toBe(
      'b { color: blue }',
    );

    const link = doc.getElementById('injected-stylesheet-0') as HTMLLinkElement;

    expect(link.rel).toBe('stylesheet');
    expect(link.href).toBe('https://example.com/x.css');
    expect(counts).toEqual({ styles: 2, stylesheets: 1 });
  });

  it('updates an element in place instead of adding another', () => {
    const counts = syncInjectedAssets(doc, ['a {}'], ['/one.css'], NONE);
    const style = doc.getElementById('injected-style-0');

    syncInjectedAssets(doc, ['b {}'], ['/two.css'], counts);

    expect(doc.getElementById('injected-style-0')).toBe(style);
    expect(style?.textContent).toBe('b {}');
    expect(doc.head.querySelectorAll('style')).toHaveLength(1);
    expect(doc.head.querySelectorAll('link')).toHaveLength(1);
  });

  it('removes the elements a shorter list leaves behind', () => {
    let counts = syncInjectedAssets(
      doc,
      ['a {}', 'b {}', 'c {}'],
      ['/one.css', '/two.css'],
      NONE,
    );

    counts = syncInjectedAssets(doc, ['a {}'], [], counts);

    expect(doc.getElementById('injected-style-0')).not.toBeNull();
    expect(doc.getElementById('injected-style-1')).toBeNull();
    expect(doc.getElementById('injected-style-2')).toBeNull();
    expect(doc.getElementById('injected-stylesheet-0')).toBeNull();
    expect(doc.getElementById('injected-stylesheet-1')).toBeNull();
    expect(counts).toEqual({ styles: 1, stylesheets: 0 });
  });

  it('converts viewport units in the CSS it writes', () => {
    syncInjectedAssets(doc, ['.a { height: 100vh }'], [], NONE);

    const css = doc.getElementById('injected-style-0')?.textContent;

    expect(css).not.toContain('100vh');
    expect(css).toContain('100cqh');
  });
});
