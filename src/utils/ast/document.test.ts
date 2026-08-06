import { describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../constants';
import {
  clearDocumentParseCache,
  generateDocumentCode,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
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

  it('falls back to a positional name when data-name is missing', () => {
    const doc = parseDocument(`
      const App = () => (
        <main id="app-container">
          <section><p>x</p></section>
        </main>
      );
    `)!;

    expect(getSections(doc)[0]!.name).toBe('1번째 컴포넌트');
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

describe('generateDocumentCode', () => {
  it('returns the document code the tree was parsed from', () => {
    const doc = parseDocument(FULL_CODE)!;

    expect(generateDocumentCode(doc)).toBe(FULL_CODE);
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
