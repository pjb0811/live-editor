import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../constants';
import {
  clearDocumentParseCache,
  createSectionPreviewCache,
  fillSectionIds,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  inspectDocument,
  parseDocument,
  replaceDocumentSections,
} from './document';

const FULL_CODE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <main id="app-container">
      <section data-name="Hero"><h1>Hero</h1></section>
      <section data-name="Features"><p>Features</p></section>
    </main>
  )
}

export default App;
`;

const EMPTY_CODE = `
const App = () => {
  return (
    <main id="app-container"></main>
  )
}

export default App;
`;

describe('parseDocument', () => {
  it('locates the app-container element', () => {
    const doc = parseDocument(FULL_CODE);

    expect(doc?.container).toBeDefined();
  });

  it('returns undefined when no app-container exists', () => {
    const doc = parseDocument(`<main id="other"></main>`);

    expect(doc).toBeUndefined();
  });

  it('returns undefined for unparsable code instead of throwing', () => {
    expect(() => parseDocument('<main id="app-container">')).not.toThrow();
    expect(parseDocument('<main id="app-container">')).toBeUndefined();
  });
});

// A document built around a container id other than `app-container` used to
// have no sections at all, and nothing said why (#449).
describe('containerId and inspectDocument', () => {
  const ROOT_CODE = FULL_CODE.replace('id="app-container"', 'id="root"');

  it('finds the container by the given id', () => {
    const doc = parseDocument(ROOT_CODE, { containerId: 'root' });

    expect(getSections(doc!).map(section => section.name)).toEqual([
      'Hero',
      'Features',
    ]);
  });

  it('caches per container id, not just per source', () => {
    expect(parseDocument(ROOT_CODE)).toBeUndefined();
    expect(parseDocument(ROOT_CODE, { containerId: 'root' })).toBeDefined();
    expect(parseDocument(FULL_CODE, { containerId: 'root' })).toBeUndefined();
    expect(parseDocument(FULL_CODE)).toBeDefined();
  });

  it('says the container is missing, and which one', () => {
    expect(inspectDocument(ROOT_CODE)).toEqual({
      ok: false,
      reason: 'container-not-found',
      containerId: 'app-container',
    });
    expect(inspectDocument('')).toMatchObject({
      ok: false,
      reason: 'container-not-found',
    });
  });

  it('tells a parse error apart from a missing container', () => {
    expect(inspectDocument('<main id="app-container">')).toMatchObject({
      ok: false,
      reason: 'parse-error',
      error: expect.any(Error),
    });
  });

  it('hands back the document when it has the container', () => {
    const inspection = inspectDocument(FULL_CODE);

    expect(inspection.ok && inspection.doc).toBe(parseDocument(FULL_CODE));
  });
});

describe('getSections', () => {
  it('extracts each top-level <section> in document order, as an exact slice of the original source', () => {
    const doc = parseDocument(FULL_CODE)!;
    const sections = getSections(doc);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      id: '0',
      name: 'Hero',
      code: '<section data-name="Hero"><h1>Hero</h1></section>',
    });
    expect(sections[1]).toMatchObject({ id: '1', name: 'Features' });
  });

  // An English default rather than the fixed Korean label it used to be,
  // since the name reaches every consumer (#448).
  it('falls back to a positional name when data-name is missing', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <section><p>x</p></section>
          <section data-name="Named"><p>y</p></section>
          <section><p>z</p></section>
        </main>
      );
    `)!;

    expect(getSections(doc).map(section => section.name)).toEqual([
      'Section 1',
      'Named',
      'Section 3',
    ]);
  });

  it('names unnamed sections with `sectionNameFallback`', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <section><p>x</p></section>
          <section data-name="Named"><p>y</p></section>
        </main>
      );
    `)!;
    const sectionNameFallback = vi.fn((index: number) => `Block ${index}`);

    expect(
      getSections(doc, { sectionNameFallback }).map(section => section.name),
    ).toEqual(['Block 0', 'Named']);
    // Only asked for the section that needs it.
    expect(sectionNameFallback).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for an empty container', () => {
    const doc = parseDocument(EMPTY_CODE)!;

    expect(getSections(doc)).toEqual([]);
  });

  it('ignores non-section children of the container', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <div>not a section</div>
          <section data-name="Real"><p>x</p></section>
        </main>
      );
    `)!;

    expect(getSections(doc)).toHaveLength(1);
    expect(getSections(doc)[0]!.name).toBe('Real');
  });

  it('finds a <section> nested inside a non-section wrapper (#96 point D)', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <div className="wrap">
            <section data-name="래핑됨"><p>1</p></section>
          </div>
        </main>
      );
    `)!;

    expect(getSections(doc)).toHaveLength(1);
    expect(getSections(doc)[0]!.name).toBe('래핑됨');
  });

  it('treats a <section> nested inside another <section> as part of its parent, not a separate entry', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <section data-name="Outer">
            <section data-name="Inner"><p>x</p></section>
          </section>
        </main>
      );
    `)!;

    expect(getSections(doc)).toHaveLength(1);
    expect(getSections(doc)[0]!.name).toBe('Outer');
  });
});

describe('replaceDocumentSections', () => {
  it('replaces the container content with the given sections, in order', () => {
    const next = replaceDocumentSections(FULL_CODE, [
      `<section data-name="About"><p>About</p></section>`,
    ]);

    const sections = getSections(parseDocument(next)!);

    expect(sections).toHaveLength(1);
    expect(sections[0]!.name).toBe('About');
  });

  it('does not reformat any code outside the replaced section span (#96 point A)', () => {
    const code = `import * as ui from 'ui-kit';
const App = ({
  container
}) => {
  return <main id="app-container"><section data-name="Hero"><h1>Hero</h1></section></main>;
};
export default App;
`;

    const next = replaceDocumentSections(code, [
      '<section data-name="Hero2"><h1>Hero2</h1></section>',
    ]);

    expect(next).toBe(
      `import * as ui from 'ui-kit';
const App = ({
  container
}) => {
  return <main id="app-container"><section data-name="Hero2"><h1>Hero2</h1></section></main>;
};
export default App;
`,
    );
  });

  it('keeps non-section content in its original position instead of moving it after the sections (#96 point B)', () => {
    const codeWithHeader = `
      const App = () => (
        <main id="app-container">
          <div className="header">헤더</div>
          {/* keep me */}
          <section data-name="Hero"><h1>Hero</h1></section>
        </main>
      );
    `;

    const next = replaceDocumentSections(codeWithHeader, [
      '<section data-name="Hero2"><h1>Hero2</h1></section>',
    ]);

    expect(next).toContain('keep me');

    const headerIndex = next.indexOf('className="header"');
    const commentIndex = next.indexOf('keep me');
    const sectionIndex = next.indexOf('data-name="Hero2"');

    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(commentIndex);
    expect(commentIndex).toBeLessThan(sectionIndex);
  });

  it('returns the original code unchanged when it fails to parse', () => {
    const broken = '<main id="app-container">';

    expect(replaceDocumentSections(broken, ['<section />'])).toBe(broken);
  });

  it('inserts section strings verbatim without validating them — an invalid one still lands in the output instead of being silently dropped (#96 point C)', () => {
    const next = replaceDocumentSections(FULL_CODE, [
      '<section data-name="Good"><p>Good</p></section>',
      '<not-jsx',
    ]);

    // Landed as-is rather than being filtered out — genuinely invalid, so
    // it can't be re-parsed here either; that failure now surfaces through
    // the normal compile-error path instead of vanishing silently.
    expect(next).toContain('<section data-name="Good"><p>Good</p></section>');
    expect(next).toContain('<not-jsx');
    expect(parseDocument(next)).toBeUndefined();
  });

  it('appends into an empty container instead of discarding what it already holds', () => {
    const codeWithHeaderOnly = `
      const App = () => (
        <main id="app-container">
          <div className="header">헤더</div>
        </main>
      );
    `;

    const next = replaceDocumentSections(codeWithHeaderOnly, [
      '<section data-name="Hero"><h1>Hero</h1></section>',
    ]);

    expect(next).toContain('className="header"');
    expect(getSections(parseDocument(next)!)).toHaveLength(1);
  });
});

describe('replaceDocumentSections diffing (#102)', () => {
  it('a true no-op round-trip is byte-for-byte identical to the input', () => {
    const code = `
      const App = () => (
        <div id="app-container">
          <div className="header">header</div>
          {/* between */}
          <section data-name="s1"><p>1</p></section>
          <div className="mid">middle content</div>
          <section data-name="s2"><p>2</p></section>
          <div className="footer">footer</div>
        </div>
      );
    `;

    const roundTripped = replaceDocumentSections(
      code,
      getSections(parseDocument(code)!).map(s => s.code),
    );

    expect(roundTripped).toBe(code);
  });

  it('editing one section leaves a sibling section in a different wrapper — and its wrapper — untouched', () => {
    const code = `
      const App = () => (
        <div id="app-container">
          <div className="a">
            <section data-name="s1"><p>1</p></section>
          </div>
          <div className="b">
            <section data-name="s2"><p>2</p></section>
          </div>
        </div>
      );
    `;

    const sections = getSections(parseDocument(code)!);

    const next = replaceDocumentSections(code, [
      '<section data-name="s1-edited"><p>1 edited</p></section>',
      sections[1]!.code,
    ]);

    expect(next).toContain('className="a"');
    expect(next).toContain('className="b"');
    expect(next).toContain('<section data-name="s2"><p>2</p></section>');
    expect(getSections(parseDocument(next)!).map(s => s.name)).toEqual([
      's1-edited',
      's2',
    ]);
  });

  it('deleting one section leaves non-section content between the others untouched', () => {
    const code = `
      const App = () => (
        <div id="app-container">
          <section data-name="s1"><p>1</p></section>
          <div className="mid">middle banner</div>
          <section data-name="s2"><p>2</p></section>
          <section data-name="s3"><p>3</p></section>
        </div>
      );
    `;

    const sections = getSections(parseDocument(code)!);

    // Delete s2, keeping s1 and s3 (dnd.tsx's onDelete: filter, preserve order)
    const next = replaceDocumentSections(code, [
      sections[0]!.code,
      sections[2]!.code,
    ]);

    expect(next).toContain('middle banner');
    expect(getSections(parseDocument(next)!).map(s => s.name)).toEqual([
      's1',
      's3',
    ]);
  });

  it('inserting a section in the middle leaves the rest of the document untouched', () => {
    const code = `
      const App = () => (
        <div id="app-container">
          <section data-name="s1"><p>1</p></section>
          <div className="mid">middle banner</div>
          <section data-name="s2"><p>2</p></section>
        </div>
      );
    `;

    const sections = getSections(parseDocument(code)!);

    const next = replaceDocumentSections(code, [
      sections[0]!.code,
      '<section data-name="new"><p>new</p></section>',
      sections[1]!.code,
    ]);

    expect(next).toContain('middle banner');
    expect(getSections(parseDocument(next)!).map(s => s.name)).toEqual([
      's1',
      'new',
      's2',
    ]);
  });

  it('appending a section at the end leaves earlier sections and their wrappers untouched', () => {
    const code = `
      const App = () => (
        <div id="app-container">
          <div className="a">
            <section data-name="s1"><p>1</p></section>
          </div>
        </div>
      );
    `;

    const sections = getSections(parseDocument(code)!);

    const next = replaceDocumentSections(code, [
      sections[0]!.code,
      '<section data-name="s2"><p>2</p></section>',
    ]);

    expect(next).toContain('className="a"');
    expect(getSections(parseDocument(next)!).map(s => s.name)).toEqual([
      's1',
      's2',
    ]);
  });
});

// A reorder keeps everything between sections where it is: comments, other
// elements and wrappers (#598). Sections with a `data-id` are matched by it,
// and only the ones whose order changed move (#794).
describe('replaceDocumentSections reorder (#598)', () => {
  const sec = (id: string) =>
    `<section data-id="${id}" data-name="${id}">${id}</section>`;
  const page = (inner: string) =>
    `const App = () => (\n  <main id="app-container">\n${inner}\n  </main>\n);`;
  const codesOf = (code: string) =>
    getSections(parseDocument(code)!).map(s => s.code);

  it.each([
    ['a comment', '{/* keep me */}'],
    ['an element', '<hr className="divider" />'],
    ['a conditional expression', '{showBanner && <Banner />}'],
    ['text', 'Some intro text'],
  ])('keeps %s in place when the sections around it swap', (_name, between) => {
    const code = page(`    ${sec('a')}\n    ${between}\n    ${sec('b')}`);
    const [a, b] = codesOf(code);

    // A tie: the later section moves.
    expect(replaceDocumentSections(code, [b!, a!])).toBe(
      page(`    ${sec('b')}\n    ${sec('a')}\n    ${between}`),
    );
    expect(replaceDocumentSections(code, [b!, a!], { movedId: 'a' })).toBe(
      page(`    ${between}\n    ${sec('b')}\n    ${sec('a')}`),
    );
  });

  it('moves a section into the wrapper of the section it lands next to', () => {
    const code = page(
      `    <div className="left">\n      ${sec('a')}\n    </div>\n    <div className="right">\n      ${sec('b')}\n    </div>`,
    );
    const [a, b] = codesOf(code);

    expect(replaceDocumentSections(code, [b!, a!])).toBe(
      page(
        `    <div className="left">\n      ${sec('b')}\n      ${sec('a')}\n    </div>\n    <div className="right">\n    </div>`,
      ),
    );
  });

  it('keeps every gap when a section moves several positions', () => {
    const code = page(
      `    ${sec('a')}\n    {/* one */}\n    ${sec('b')}\n    {/* two */}\n    ${sec('c')}`,
    );
    const [a, b, c] = codesOf(code);

    expect(replaceDocumentSections(code, [b!, c!, a!])).toBe(
      page(
        `    {/* one */}\n    ${sec('b')}\n    {/* two */}\n    ${sec('c')}\n    ${sec('a')}`,
      ),
    );
    expect(replaceDocumentSections(code, [c!, b!, a!])).toBe(
      page(
        `    ${sec('c')}\n    ${sec('b')}\n    ${sec('a')}\n    {/* one */}\n    {/* two */}`,
      ),
    );
  });

  it('adds the new sections after the section before them when a reorder also adds', () => {
    const code = page(`    ${sec('a')}\n    {/* gap */}\n    ${sec('b')}`);
    const [a, b] = codesOf(code);

    expect(replaceDocumentSections(code, [b!, a!, sec('n')])).toBe(
      page(
        `    ${sec('b')}\n    ${sec('a')}\n    ${sec('n')}\n    {/* gap */}`,
      ),
    );
  });

  it('removes the sections left over, with their lines, when a reorder also removes', () => {
    const code = page(
      `    ${sec('a')}\n    {/* one */}\n    ${sec('b')}\n    {/* two */}\n    ${sec('c')}`,
    );
    const [a, , c] = codesOf(code);

    expect(replaceDocumentSections(code, [c!, a!])).toBe(
      page(
        `    ${sec('c')}\n    ${sec('a')}\n    {/* one */}\n    {/* two */}`,
      ),
    );
  });

  it('keeps a document byte-for-byte when the order is unchanged', () => {
    const code = page(`    ${sec('a')}\n    {/* gap */}\n    ${sec('b')}`);

    expect(replaceDocumentSections(code, codesOf(code))).toBe(code);
  });
});

// Moving a section past a wrapper leaves the wrapper holding the sections it
// held, except the moved one (#794).
describe('replaceDocumentSections moves past a wrapper (#794)', () => {
  const sec = (id: string) =>
    `<section data-id="${id}" data-name="${id}">${id}</section>`;
  const promo = (...ids: string[]) =>
    [
      '    <div className="promo">',
      ...ids.map(id => `      ${sec(id)}`),
      '    </div>',
    ].join('\n');
  const page = (...lines: string[]) =>
    `const App = () => (\n  <main id="app-container">\n${lines.join('\n')}\n  </main>\n);`;
  const out = (id: string) => `    ${sec(id)}`;

  const code = page(out('a'), promo('b', 'c'), out('d'), out('e'));
  const codes = getSections(parseDocument(code)!).map(s => s.code);
  const [a, b, c, d, e] = codes as [string, string, string, string, string];

  it('moves a section from before the wrapper to the end', () => {
    expect(
      replaceDocumentSections(code, [b, c, d, e, a], { movedId: 'a' }),
    ).toBe(page(promo('b', 'c'), out('d'), out('e'), out('a')));
  });

  it('moves a section from the end to the start', () => {
    expect(
      replaceDocumentSections(code, [e, a, b, c, d], { movedId: 'e' }),
    ).toBe(page(out('e'), out('a'), promo('b', 'c'), out('d')));
  });

  it('moves the same way without a moved id when only one section can have moved', () => {
    expect(replaceDocumentSections(code, [b, c, d, e, a])).toBe(
      page(promo('b', 'c'), out('d'), out('e'), out('a')),
    );
  });

  // `d` up one and `c` down one give the same list; the moved id tells them
  // apart.
  it('moves the section named by movedId in a swap at the wrapper edge', () => {
    const swapped = [a, b, d, c, e];

    expect(replaceDocumentSections(code, swapped, { movedId: 'd' })).toBe(
      page(out('a'), promo('b', 'd', 'c'), out('e')),
    );
    expect(replaceDocumentSections(code, swapped, { movedId: 'c' })).toBe(
      page(out('a'), promo('b'), out('d'), out('c'), out('e')),
    );
  });

  it('moves the later section of a tie without a moved id', () => {
    expect(replaceDocumentSections(code, [a, b, d, c, e])).toBe(
      page(out('a'), promo('b', 'd', 'c'), out('e')),
    );
  });

  it('ignores a moved id that is not in the list', () => {
    expect(
      replaceDocumentSections(code, [a, b, d, c, e], { movedId: 'zzz' }),
    ).toBe(page(out('a'), promo('b', 'd', 'c'), out('e')));
  });

  it('removes the moved line without a blank line in a CRLF document', () => {
    const crlf = code.replace(/\n/g, '\r\n');
    const crlfCodes = getSections(parseDocument(crlf)!).map(s => s.code);
    const [ca, cb, cc, cd, ce] = crlfCodes as [
      string,
      string,
      string,
      string,
      string,
    ];

    expect(
      replaceDocumentSections(crlf, [cb, cc, cd, ce, ca], { movedId: 'a' }),
    ).toBe(
      page(promo('b', 'c'), out('d'), out('e'), out('a')).replace(
        /\n/g,
        '\r\n',
      ),
    );
  });

  it('pairs sections by position when they have no data-id', () => {
    const plain = (id: string) => `<section data-name="${id}">${id}</section>`;
    const noIds = code.replace(
      /<section data-id="(\w)"[^>]*>\w<\/section>/g,
      (_, id: string) => plain(id),
    );
    const [pa, pb, pc, pd, pe] = getSections(parseDocument(noIds)!).map(
      s => s.code,
    ) as [string, string, string, string, string];

    expect(replaceDocumentSections(noIds, [pb, pc, pd, pe, pa])).toBe(
      [
        'const App = () => (',
        '  <main id="app-container">',
        `    ${plain('b')}`,
        '    <div className="promo">',
        `      ${plain('c')}`,
        `      ${plain('d')}`,
        '    </div>',
        `    ${plain('e')}`,
        `    ${plain('a')}`,
        '  </main>',
        ');',
      ].join('\n'),
    );
  });

  it('pairs sections by position when an id is used twice', () => {
    const twice = code.replace('data-id="c"', 'data-id="b"');
    const [ta, tb, tc, td, te] = getSections(parseDocument(twice)!).map(
      s => s.code,
    ) as [string, string, string, string, string];
    const result = replaceDocumentSections(twice, [tb, tc, td, te, ta]);

    // Positional: `d` takes the slot inside the wrapper.
    expect(result).toBe(
      page(out('b'), promo('c', 'd'), out('e'), out('a')).replace(
        'data-id="c"',
        'data-id="b"',
      ),
    );
  });

  it('edits a section in place, with its id unchanged', () => {
    const edited = c.replace('>c<', '>c2<');

    expect(replaceDocumentSections(code, [a, b, edited, d, e])).toBe(
      code.replace(c, edited),
    );
  });
});

// New sections are written on their own lines with the indentation of the
// sections around them, and with the document's line ending (#599).
describe('replaceDocumentSections layout of new sections (#599)', () => {
  const sec = (id: string, eol = '\n') =>
    `<section data-id="${id}" data-name="${id}">${eol}  <h1>${id}</h1>${eol}</section>`;
  // A section as it appears in a document indented by 4 spaces, below the
  // first line: its inner lines carry the document's own indentation.
  const inDoc = (id: string, eol = '\n') =>
    `    <section data-id="${id}" data-name="${id}">${eol}      <h1>${id}</h1>${eol}    </section>`;
  const page = (inner: string, eol = '\n') =>
    [
      'const App = () => (',
      '  <main id="app-container">',
      inner,
      '  </main>',
      ');',
    ].join(eol);
  const codesOf = (code: string) =>
    getSections(parseDocument(code)!).map(s => s.code);

  it.each([
    ['\n', 'LF'],
    ['\r\n', 'CRLF'],
  ])('inserts between two sections at their indentation (%j %s)', eol => {
    const code = page(`${inDoc('a', eol)}${eol}${inDoc('b', eol)}`, eol);
    const [a, b] = codesOf(code);
    const added = sec('n', eol);

    expect(replaceDocumentSections(code, [a!, added, b!])).toBe(
      page(`${inDoc('a', eol)}${eol}    ${added}${eol}${inDoc('b', eol)}`, eol),
    );
  });

  it.each([
    ['\n', 'LF'],
    ['\r\n', 'CRLF'],
  ])(
    "appends on its own line at the last section's indentation (%j %s)",
    eol => {
      const code = page(`${inDoc('a', eol)}${eol}${inDoc('b', eol)}`, eol);
      const [a, b] = codesOf(code);
      const added = sec('n', eol);

      expect(replaceDocumentSections(code, [a!, b!, added])).toBe(
        page(
          `${inDoc('a', eol)}${eol}${inDoc('b', eol)}${eol}    ${added}`,
          eol,
        ),
      );
    },
  );

  it('inserts before the first section and keeps its indentation', () => {
    const code = page(inDoc('a'));
    const [a] = codesOf(code);

    expect(replaceDocumentSections(code, [sec('n'), a!])).toBe(
      page(`    ${sec('n')}\n${inDoc('a')}`),
    );
  });

  it('writes several new sections, each on its own line', () => {
    const code = page(inDoc('a'));
    const [a] = codesOf(code);

    expect(replaceDocumentSections(code, [a!, sec('x'), sec('y')])).toBe(
      page(`${inDoc('a')}\n    ${sec('x')}\n    ${sec('y')}`),
    );
  });

  it('drops the whitespace a template literal puts around a palette section', () => {
    const code = page(inDoc('a'));
    const [a] = codesOf(code);
    const padded = `\n      ${sec('n')}\n    `;

    expect(replaceDocumentSections(code, [a!, padded])).toBe(
      page(`${inDoc('a')}\n    ${sec('n')}`),
    );
  });

  it('adds no bare LF to a CRLF document, even for a section written with LF', () => {
    const eol = '\r\n';
    const code = page(inDoc('a', eol), eol);
    const [a] = codesOf(code);
    const result = replaceDocumentSections(code, [a!, sec('n', '\n')]);

    expect(result.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it("keeps today's layout when the neighbor shares its line with other code", () => {
    const code = `const App = () => (\n  <main id="app-container"><section data-id="a" data-name="a">a</section></main>\n);`;
    const [a] = codesOf(code);

    expect(replaceDocumentSections(code, [a!, sec('n')])).toBe(
      `const App = () => (\n  <main id="app-container"><section data-id="a" data-name="a">a</section>\n${sec('n')}</main>\n);`,
    );
  });
});

describe('generateSectionPreview', () => {
  it('produces a document whose container holds only the given section', () => {
    const preview = generateSectionPreview(
      FULL_CODE,
      `<section data-name="Solo"><p>Solo</p></section>`,
    );

    const sections = getSections(parseDocument(preview)!);

    expect(sections).toHaveLength(1);
    expect(sections[0]!.name).toBe('Solo');
  });

  it('does not reformat code outside the container (#96 point A)', () => {
    const code = `import * as ui from 'ui-kit';
const App = ({
  container
}) => {
  return <main id="app-container"><section data-name="Hero"><h1>Hero</h1></section></main>;
};
export default App;
`;

    const preview = generateSectionPreview(
      code,
      '<section data-name="Solo"><p>Solo</p></section>',
    );

    expect(preview).toBe(
      `import * as ui from 'ui-kit';
const App = ({
  container
}) => {
  return <main id="app-container"><section data-name="Solo"><p>Solo</p></section></main>;
};
export default App;
`,
    );
  });

  it('returns fullCode unchanged when fullCode fails to parse', () => {
    const broken = '<main id="app-container">';

    expect(generateSectionPreview(broken, '<section />')).toBe(broken);
  });
});

describe('generateSectionPreviews', () => {
  it('produces one preview per section code, in order', () => {
    const previews = generateSectionPreviews(FULL_CODE, [
      '<section data-name="A"><p>A</p></section>',
      '<section data-name="B"><p>B</p></section>',
    ]);

    expect(previews).toHaveLength(2);
    expect(getSections(parseDocument(previews[0]!)!)[0]!.name).toBe('A');
    expect(getSections(parseDocument(previews[1]!)!)[0]!.name).toBe('B');
  });

  it('matches generateSectionPreview called once per section (#97)', () => {
    const codes = [
      '<section data-name="A"><p>A</p></section>',
      '<section data-name="B"><p>B</p></section>',
      '<section data-name="C"><p>C</p></section>',
    ];

    const batched = generateSectionPreviews(FULL_CODE, codes);
    const oneAtATime = codes.map(code =>
      generateSectionPreview(FULL_CODE, code),
    );

    expect(batched).toEqual(oneAtATime);
  });

  it('leaves an unrelated section untouched when only one code changes — same string both times (#97)', () => {
    const codes = [
      '<section data-name="A"><p>A</p></section>',
      '<section data-name="B"><p>B</p></section>',
    ];

    const before = generateSectionPreviews(FULL_CODE, codes);

    codes[0] = '<section data-name="A-edited"><p>A edited</p></section>';
    const after = generateSectionPreviews(FULL_CODE, codes);

    expect(after[1]).toBe(before[1]);
    expect(after[0]).not.toBe(before[0]);
  });

  it('returns fullCode for every entry when fullCode fails to parse', () => {
    const broken = '<main id="app-container">';

    expect(
      generateSectionPreviews(broken, ['<section />', '<section />']),
    ).toEqual([broken, broken]);
  });
});

describe('createSectionPreviewCache (#131)', () => {
  it('matches generateSectionPreviews for a first call', () => {
    const cache = createSectionPreviewCache();
    const sections = [
      { id: 'a', code: '<section data-name="A"><p>A</p></section>' },
      { id: 'b', code: '<section data-name="B"><p>B</p></section>' },
    ];

    const cached = cache.compute(FULL_CODE, sections);
    const direct = generateSectionPreviews(
      FULL_CODE,
      sections.map(s => s.code),
    );

    expect(cached).toEqual(direct);
  });

  it('reuses the exact same preview string for a section whose code and container context are unchanged', () => {
    const cache = createSectionPreviewCache();
    const sections = [
      { id: 'a', code: '<section data-name="A"><p>A</p></section>' },
      { id: 'b', code: '<section data-name="B"><p>B</p></section>' },
    ];

    const first = cache.compute(FULL_CODE, sections);

    const edited = [
      sections[0]!,
      {
        id: 'b',
        code: '<section data-name="B-edited"><p>B edited</p></section>',
      },
    ];
    const second = cache.compute(FULL_CODE, edited);

    expect(second[0]).toBe(first[0]); // untouched section: same string
    expect(second[1]).not.toBe(first[1]); // edited section: recomputed
    expect(getSections(parseDocument(second[1]!)!)[0]!.name).toBe('B-edited');
  });

  // The panel fills the selected section's empty element ids the same way,
  // so an element's `data-id` in the preview matches its fields (#432).
  it('fills empty element ids from the section id', () => {
    const cache = createSectionPreviewCache();
    const [preview] = cache.compute(FULL_CODE, [
      {
        id: 'a',
        code: '<section data-id="a"><p data-id="">A</p><p data-id="a-1">B</p></section>',
      },
    ]);

    expect(preview).toContain('<p data-id="a-2">A</p>');
    expect(preview).toContain('<p data-id="a-1">B</p>');
  });

  it('reuses cached previews across drag reorders (matched by id, not position)', () => {
    const cache = createSectionPreviewCache();
    const sections = [
      { id: 'a', code: '<section data-name="A"><p>A</p></section>' },
      { id: 'b', code: '<section data-name="B"><p>B</p></section>' },
      { id: 'c', code: '<section data-name="C"><p>C</p></section>' },
    ];

    const first = cache.compute(FULL_CODE, sections);
    const reordered = [sections[2]!, sections[0]!, sections[1]!];
    const second = cache.compute(FULL_CODE, reordered);

    expect(second[0]).toBe(first[2]); // c
    expect(second[1]).toBe(first[0]); // a
    expect(second[2]).toBe(first[1]); // b
  });

  it('recomputes every entry once the container context changes (e.g. an import added)', () => {
    const cache = createSectionPreviewCache();
    const sections = [
      { id: 'a', code: '<section data-name="A"><p>A</p></section>' },
      { id: 'b', code: '<section data-name="B"><p>B</p></section>' },
    ];

    const first = cache.compute(FULL_CODE, sections);

    const withNewImport = FULL_CODE.replace(
      "import * as ui from 'ui-kit';",
      "import * as ui from 'ui-kit';\nimport { extra } from 'extra';",
    );
    const second = cache.compute(withNewImport, sections);

    // Neither section's own code changed, but the container-context guard
    // must still force a recompute so the new import makes it into both.
    expect(second[0]).not.toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[0]).toContain("import { extra } from 'extra';");
    expect(second[1]).toContain("import { extra } from 'extra';");
  });

  it('computes a fresh preview for a newly added section without disturbing cached ones', () => {
    const cache = createSectionPreviewCache();
    const sections = [
      { id: 'a', code: '<section data-name="A"><p>A</p></section>' },
    ];

    const first = cache.compute(FULL_CODE, sections);

    const withNewSection = [
      sections[0]!,
      { id: 'new', code: '<section data-name="New"><p>New</p></section>' },
    ];
    const second = cache.compute(FULL_CODE, withNewSection);

    expect(second[0]).toBe(first[0]);
    expect(getSections(parseDocument(second[1]!)!)[0]!.name).toBe('New');
  });

  it('returns fullCode for every entry when fullCode fails to parse', () => {
    const cache = createSectionPreviewCache();
    const broken = '<main id="app-container">';

    expect(
      cache.compute(broken, [
        { id: 'a', code: '<section />' },
        { id: 'b', code: '<section />' },
      ]),
    ).toEqual([broken, broken]);
  });
});

describe('parseDocument caching', () => {
  it('reuses the same parsed AST for a repeated source string — safe since nothing ever mutates it', () => {
    clearDocumentParseCache();

    const first = parseDocument(FULL_CODE)!;
    const second = parseDocument(FULL_CODE)!;

    expect(second.ast).toBe(first.ast);
    expect(second.container).toBe(first.container);
  });

  it('clearDocumentParseCache() forces a fresh parse', () => {
    clearDocumentParseCache();

    const first = parseDocument(FULL_CODE)!;

    clearDocumentParseCache();

    const second = parseDocument(FULL_CODE)!;

    expect(second.ast).not.toBe(first.ast);
    expect(getSections(second)).toEqual(getSections(first));
  });

  it('caches a parse failure too, instead of re-parsing the same broken source on every call (#97)', () => {
    clearDocumentParseCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const broken = '<main id="app-container">';

    expect(parseDocument(broken)).toBeUndefined();
    expect(parseDocument(broken)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('evicts old entries once DOCUMENT_CACHE_LIMIT is exceeded — a document that fell out re-parses fresh instead of staying resident forever (#106)', () => {
    clearDocumentParseCache();

    const first = parseDocument(FULL_CODE)!;

    for (let i = 0; i < CONFIG.DOCUMENT_CACHE_LIMIT; i++) {
      parseDocument(`${FULL_CODE}\n// filler ${i}`);
    }

    const second = parseDocument(FULL_CODE)!;

    expect(second.ast).not.toBe(first.ast);
  });
});

describe('fillSectionIds', () => {
  const LEGACY = `
const App = () => {
  return (
    <main id="app-container">
      <section data-name="Hero"><h1>Hero</h1></section>
      <section data-name="Features"><p>Features</p></section>
    </main>
  )
}
`;

  let counter = 0;
  const ids = () => `id${++counter}`;

  beforeEach(() => {
    counter = 0;
    clearDocumentParseCache();
  });

  it('adds data-id to every top-level section that lacks one', () => {
    const filled = fillSectionIds(LEGACY, ids);

    expect(filled).toContain('<section data-id="id1" data-name="Hero">');
    expect(filled).toContain('<section data-id="id2" data-name="Features">');
  });

  it('leaves the rest of the source byte-identical', () => {
    const filled = fillSectionIds(LEGACY, ids);

    expect(
      filled.replace(' data-id="id1"', '').replace(' data-id="id2"', ''),
    ).toBe(LEGACY);
  });

  it('is a no-op when every section already has an id', () => {
    const filled = fillSectionIds(LEGACY, ids);

    expect(fillSectionIds(filled, ids)).toBe(filled);
  });

  it('only fills the sections that are missing an id', () => {
    const partial = `
const App = () => {
  return (
    <main id="app-container">
      <section data-id="kept" data-name="Hero"><h1>Hero</h1></section>
      <section data-name="Features"><p>Features</p></section>
    </main>
  )
}
`;

    const filled = fillSectionIds(partial, ids);

    expect(filled).toContain('data-id="kept"');
    expect(filled).toContain('<section data-id="id1" data-name="Features">');
  });

  it('returns the input unchanged when the document cannot be parsed', () => {
    expect(fillSectionIds('<main id="app-container">', ids)).toBe(
      '<main id="app-container">',
    );
  });
});

describe('getSections identity (#245)', () => {
  beforeEach(() => clearDocumentParseCache());

  const sectionsOf = (code: string) => {
    const doc = parseDocument(code);
    return doc ? getSections(doc) : [];
  };

  const WITH_IDS = `
const App = () => {
  return (
    <main id="app-container">
      <section data-id="hero" data-name="Hero"><h1>Hero</h1></section>
      <section data-id="feat" data-name="Features"><p>Features</p></section>
    </main>
  )
}
`;

  it('uses the section data-id as the id when present', () => {
    expect(sectionsOf(WITH_IDS).map(s => s.id)).toEqual(['hero', 'feat']);
  });

  it('keeps an id pointing at the same section after a reorder', () => {
    const before = sectionsOf(WITH_IDS);
    const reordered = replaceDocumentSections(
      WITH_IDS,
      [before[1]!, before[0]!].map(s => s.code),
    );

    const heroBefore = before.find(s => s.id === 'hero')!;
    const heroAfter = sectionsOf(reordered).find(s => s.id === 'hero')!;

    expect(heroAfter.name).toBe(heroBefore.name);
    expect(heroAfter.code).toBe(heroBefore.code);
  });

  it('falls back to the positional id for documents without section ids', () => {
    const legacy = `
const App = () => {
  return (
    <main id="app-container">
      <section data-name="Hero"><h1>Hero</h1></section>
      <section data-name="Features"><p>Features</p></section>
    </main>
  )
}
`;

    expect(sectionsOf(legacy).map(s => s.id)).toEqual(['0', '1']);
  });
});

describe('fillSectionIds uniqueness', () => {
  let counter = 0;
  const ids = () => `gen${++counter}`;

  beforeEach(() => {
    counter = 0;
    clearDocumentParseCache();
  });

  const sectionsOf = (code: string) => {
    const doc = parseDocument(code);
    return doc ? getSections(doc) : [];
  };

  // Reachable by copy-pasting a section in Editor mode: both modes share one
  // document, so a duplicated `data-id` is ordinary authored text.
  it('re-mints a duplicate id, keeping the first occurrence', () => {
    const dup = `
const App = () => {
  return (
    <main id="app-container">
      <section data-id="same" data-name="A"><h1>A</h1></section>
      <section data-id="same" data-name="B"><h1>B</h1></section>
    </main>
  )
}
`;

    const filled = fillSectionIds(dup, ids);

    expect(filled).toContain('<section data-id="same" data-name="A">');
    expect(filled).toContain('<section data-id="gen1" data-name="B">');
    expect(sectionsOf(filled).map(s => s.id)).toEqual(['same', 'gen1']);
  });

  it('leaves every section with a distinct id', () => {
    const dup = `
const App = () => {
  return (
    <main id="app-container">
      <section data-id="x" data-name="A"><h1>A</h1></section>
      <section data-id="x" data-name="B"><h1>B</h1></section>
      <section data-name="C"><h1>C</h1></section>
    </main>
  )
}
`;

    const idList = sectionsOf(fillSectionIds(dup, ids)).map(s => s.id);

    expect(new Set(idList).size).toBe(idList.length);
  });

  // A non-string `data-id` yields no readable value, so a naive "is it
  // missing?" check would splice a second data-id in beside it.
  it('replaces a non-string data-id instead of adding a second one', () => {
    const expr = `
const App = () => {
  return (
    <main id="app-container">
      <section data-id={dynamic} data-name="A"><h1>A</h1></section>
    </main>
  )
}
`;

    const filled = fillSectionIds(expr, ids);

    expect(filled).toContain('<section data-id="gen1" data-name="A">');
    expect(filled.match(/data-id/g)).toHaveLength(1);
  });
});
