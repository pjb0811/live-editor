import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../constants';
import {
  clearDocumentParseCache,
  createSectionPreviewCache,
  fillSectionIds,
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
