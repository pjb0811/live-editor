import { describe, expect, it } from 'vitest';

import { applyEdits } from './patch';

describe('applyEdits', () => {
  it('returns the source untouched when there are no edits', () => {
    expect(applyEdits('abc', [])).toBe('abc');
  });

  it('replaces a span and copies every other byte verbatim', () => {
    const source = 'const a = 1;\nconst b = 2;\n';
    const start = source.indexOf('1');

    expect(applyEdits(source, [{ start, end: start + 1, content: '42' }])).toBe(
      'const a = 42;\nconst b = 2;\n',
    );
  });

  it('treats a zero-width span as an insertion', () => {
    expect(applyEdits('ac', [{ start: 1, end: 1, content: 'b' }])).toBe('abc');
  });

  it('applies several edits regardless of the order they were recorded in', () => {
    const source = 'aXbYc';
    const edits = [
      { start: 3, end: 4, content: '2' },
      { start: 1, end: 2, content: '1' },
    ];

    expect(applyEdits(source, edits)).toBe('a1b2c');
  });

  it('allows an insertion at the exact end of a preceding replacement', () => {
    const source = 'abc';
    const edits = [
      { start: 0, end: 1, content: '' },
      { start: 1, end: 1, content: 'Z' },
    ];

    expect(applyEdits(source, edits)).toBe('Zbc');
  });

  // A half-applied patch is much harder to diagnose than a thrown error, and
  // an overlap can only mean the caller's offsets are wrong.
  it('throws rather than corrupting the source when two edits overlap', () => {
    const edits = [
      { start: 0, end: 3, content: 'x' },
      { start: 2, end: 4, content: 'y' },
    ];

    expect(() => applyEdits('abcdef', edits)).toThrow(/Overlapping/);
  });

  it('throws on an out-of-bounds or inverted span', () => {
    expect(() =>
      applyEdits('abc', [{ start: 0, end: 99, content: '' }]),
    ).toThrow(/Invalid source edit/);
    expect(() =>
      applyEdits('abc', [{ start: 2, end: 1, content: '' }]),
    ).toThrow(/Invalid source edit/);
  });

  describe('indent', () => {
    it('re-indents a multi-line fragment to the column it lands on', () => {
      const source = '    style={}\n';
      const start = source.indexOf('{}');

      expect(
        applyEdits(source, [
          {
            start,
            end: start + 2,
            content: '{{\n  color: "red"\n}}',
            indent: true,
          },
        ]),
      ).toBe('    style={{\n      color: "red"\n    }}\n');
    });

    it('leaves content byte-for-byte when indent is not set', () => {
      const source = '    style={}\n';
      const start = source.indexOf('{}');

      expect(
        applyEdits(source, [
          { start, end: start + 2, content: '{{\n  color: "red"\n}}' },
        ]),
      ).toBe('    style={{\n  color: "red"\n}}\n');
    });

    it('is a no-op for single-line content', () => {
      const source = '    a\n';

      expect(
        applyEdits(source, [{ start: 4, end: 5, content: 'b', indent: true }]),
      ).toBe('    b\n');
    });

    // Babel escapes newlines inside ordinary string literals, so a `<` that
    // sits inside quotes is still safe to indent around.
    it('still indents when a `<` only appears inside a string literal', () => {
      const source = '    html={}\n';
      const start = source.indexOf('{}');

      expect(
        applyEdits(source, [
          {
            start,
            end: start + 2,
            content: '{{\n  __html: "<em>x</em>"\n}}',
            indent: true,
          },
        ]),
      ).toBe('    html={{\n      __html: "<em>x</em>"\n    }}\n');
    });

    // A newline inside a template literal or JSX text is part of the value,
    // not layout — indenting it would rewrite the value.
    it('skips indenting a fragment containing a template literal', () => {
      const source = '    items={}\n';
      const start = source.indexOf('{}');
      const content = '{[{\n  html: `<p>A</p>\n<p>B</p>`\n}]}';

      expect(
        applyEdits(source, [{ start, end: start + 2, content, indent: true }]),
      ).toBe(`    items=${content}\n`);
    });

    it('skips indenting a fragment containing JSX', () => {
      const source = '    <ul></ul>\n';
      const start = source.indexOf('></ul>') + 1;
      const content = '<pre>a\nb</pre>';

      expect(
        applyEdits(source, [{ start, end: start, content, indent: true }]),
      ).toBe('    <ul><pre>a\nb</pre></ul>\n');
    });

    // A quote inside a comment or a regex must not leave the scanner
    // thinking it is inside a string, or the backtick after it is missed
    // and the template literal's own newlines get indented.
    it.each([
      ['a line comment', "{[\n  // don't\n  { html: `A\nB` }\n]}"],
      ['a block comment', "{[{ /* don't */ html: `A\nB` }]}"],
      ['a regex literal', '{[{ re: /"/, html: `A\nB` }]}'],
    ])('is not fooled by an apostrophe inside %s', (_name, content) => {
      const source = '    items={}\n';
      const start = source.indexOf('{}');

      expect(
        applyEdits(source, [{ start, end: start + 2, content, indent: true }]),
      ).toBe(`    items=${content}\n`);
    });

    // A backslash before a newline is a line continuation, so that newline
    // is part of the string's raw text even though the string carries no
    // backtick and no `<`.
    it('skips indenting a string literal continued onto the next line', () => {
      const source = '    items={}\n';
      const start = source.indexOf('{}');
      const content = '{[{ html: "<p>A</p>\\\n<p>B</p>" }]}';

      expect(
        applyEdits(source, [{ start, end: start + 2, content, indent: true }]),
      ).toBe(`    items=${content}\n`);
    });

    // Babel only ever emits LF, which would leave a CRLF file with mixed
    // endings.
    it('adopts the CRLF line ending the source already uses', () => {
      const source = '<div>\r\n    style={}\r\n</div>';
      const start = source.indexOf('{}');

      expect(
        applyEdits(source, [
          {
            start,
            end: start + 2,
            content: '{{\n  color: "red"\n}}',
            indent: true,
          },
        ]),
      ).toBe('<div>\r\n    style={{\r\n      color: "red"\r\n    }}\r\n</div>');
    });
  });
});
