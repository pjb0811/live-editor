import { describe, expect, it } from 'vitest';

import { readDocumentObject, updateDocumentValue } from './document-value';

// A document's settings object, edited key by key (#770).
const DOC = `import { useState } from 'react';

// Settings the panel edits.
const settings = {
  theme: 'dark', // a comment
  autoplay: true,
  delay: 5000,
  onReady: () => start(),
  id: make(),
};

const App = () => {
  const local = { a: 1 };

  return <main id="app-container"></main>;
};

export default App;`;

const edit = (
  property: string,
  value: unknown,
  type?: 'boolean' | 'number' | 'function',
  code = DOC,
  name = 'settings',
) => updateDocumentValue(code, name, { property, type }, value);

describe('readDocumentObject', () => {
  it('lists each key with its source, and the value of a literal', () => {
    expect(readDocumentObject(DOC, 'settings')).toEqual([
      { key: 'theme', source: "'dark'", value: 'dark', isLiteral: true },
      { key: 'autoplay', source: 'true', value: true, isLiteral: true },
      { key: 'delay', source: '5000', value: 5000, isLiteral: true },
      {
        key: 'onReady',
        source: '() => start()',
        value: undefined,
        isLiteral: false,
      },
      { key: 'id', source: 'make()', value: undefined, isLiteral: false },
    ]);
  });

  it('returns null without such an object', () => {
    expect(readDocumentObject(DOC, 'missing')).toBeNull();
  });
});

describe('updateDocumentValue', () => {
  it.each([
    ['theme', 'light', undefined, "'dark'", "'light'"],
    [
      'autoplay',
      false,
      'boolean' as const,
      'autoplay: true',
      'autoplay: false',
    ],
    ['delay', 3000, 'number' as const, '5000', '3000'],
    ['onReady', ' () => go() ', undefined, '() => start()', '() => go()'],
  ])('replaces %s in place', (property, value, type, from, to) => {
    expect(edit(property, value, type)).toEqual({
      success: true,
      code: DOC.replace(from, to),
    });
  });

  it('keeps a value equal to the current one', () => {
    expect(edit('delay', 5000, 'number')).toEqual({ success: true, code: DOC });
  });

  it.each([
    [
      'a function key given a call',
      'onReady',
      "alert('x')",
      'invalid-function',
    ],
    ['a function key given nothing', 'onReady', '', 'invalid-function'],
    ['a key holding a call', 'id', 'x', 'unsupported-syntax'],
    ['a missing key', 'nope', 'x', 'missing-property'],
  ])('refuses %s', (_, property, value, reason) => {
    expect(edit(property, value)).toMatchObject({
      success: false,
      failure: { reason },
    });
  });

  it.each([
    ['a const inside a function', DOC, 'local', 'not-found'],
    ['a missing name', DOC, 'nothing', 'not-found'],
    [
      'a let',
      DOC.replace('const settings', 'let settings'),
      'settings',
      'not-found',
    ],
    [
      'a const that is not an object literal',
      DOC.replace(
        /const settings = \{[\s\S]*?\n\};/,
        'const settings = make();',
      ),
      'settings',
      'not-object',
    ],
    [
      'an object with a spread',
      DOC.replace("theme: 'dark',", "...base, theme: 'dark',"),
      'settings',
      'not-object',
    ],
    [
      'source that does not parse',
      DOC.replace('</main>', ''),
      'settings',
      'parse-error',
    ],
  ])('refuses %s', (_, code, name, reason) => {
    expect(edit('theme', 'x', undefined, code, name)).toMatchObject({
      success: false,
      failure: { reason },
    });
  });

  it('finds an exported const', () => {
    const code = DOC.replace('const settings', 'export const settings');

    expect(edit('theme', 'light', undefined, code)).toEqual({
      success: true,
      code: code.replace("'dark'", "'light'"),
    });
  });
});
