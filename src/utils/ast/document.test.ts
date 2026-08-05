import { describe, expect, it } from 'vitest';

import {
  generateDocumentCode,
  generateSectionPreview,
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
  it('extracts each top-level <section> in document order', () => {
    const doc = parseDocument(FULL_CODE)!;
    const sections = getSections(doc);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ id: '0', name: 'Hero' });
    expect(sections[1]).toMatchObject({ id: '1', name: 'Features' });
    expect(sections[0]!.code).toContain('<h1>Hero</h1>');
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

  it('preserves non-section children of the container', () => {
    const codeWithComment = `
      const App = () => (
        <main id="app-container">
          {/* keep me */}
          <section data-name="Hero"><h1>Hero</h1></section>
        </main>
      );
    `;

    const next = replaceDocumentSections(codeWithComment, [
      `<section data-name="Hero2"><h1>Hero2</h1></section>
`,
    ]);

    expect(next).toContain('keep me');
    expect(getSections(parseDocument(next)!)[0]!.name).toBe('Hero2');
  });

  it('returns the original code unchanged when it fails to parse', () => {
    const broken = '<main id="app-container">';

    expect(replaceDocumentSections(broken, ['<section />'])).toBe(broken);
  });

  it('skips section strings that fail to parse instead of throwing', () => {
    const next = replaceDocumentSections(FULL_CODE, [
      '<section data-name="Good"><p>Good</p></section>',
      '<not-jsx',
    ]);

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

  it('returns fullCode unchanged when the section fails to parse', () => {
    expect(generateSectionPreview(FULL_CODE, '<not-jsx')).toBe(FULL_CODE);
  });

  it('returns fullCode unchanged when fullCode fails to parse', () => {
    const broken = '<main id="app-container">';

    expect(generateSectionPreview(broken, '<section />')).toBe(broken);
  });
});

describe('generateDocumentCode', () => {
  it('regenerates code that still contains the surrounding module scaffold', () => {
    const doc = parseDocument(FULL_CODE)!;
    const code = generateDocumentCode(doc);

    expect(code).toContain("import * as ui from 'ui-kit'");
    expect(code).toContain('export default App');
  });
});
