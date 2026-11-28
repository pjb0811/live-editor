import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { DATA_ATTR } from '../../constants';
import {
  clone,
  copySectionCode,
  fillIds,
  fillIdsFrom,
  replaceIds,
  writtenIds,
} from './tree';

// Deterministic id generator so assertions don't depend on nanoid randomness.
const sequentialIds = () => {
  let n = 0;
  return () => `id${n++}`;
};

describe('replaceIds', () => {
  it('replaces every existing data-id value', () => {
    const code = `<div ${DATA_ATTR.ID}="abc"><span ${DATA_ATTR.ID}="def" /></div>`;
    const result = replaceIds(code, sequentialIds());

    expect(result).toBe(
      `<div ${DATA_ATTR.ID}="id0"><span ${DATA_ATTR.ID}="id1" /></div>`,
    );
  });

  it('rewrites even already-populated ids (unlike fillIds)', () => {
    const code = `<div ${DATA_ATTR.ID}="keep" />`;
    expect(replaceIds(code, () => 'new')).toBe(`<div ${DATA_ATTR.ID}="new" />`);
  });

  it('leaves code without data-id untouched', () => {
    const code = `<div className="x" />`;
    expect(replaceIds(code, sequentialIds())).toBe(code);
  });
});

// The section copy renews only real ids and keeps the rest as written (#796).
describe('copySectionCode', () => {
  const section = [
    '<section data-id="s1" data-name="s1">',
    '  <p data-id="title">Title</p>',
    "  <p data-id='note'>Note</p>",
    '  <img data-id={`img-${index}`} />',
    `  <p title='data-id="keep"'>{'data-id="keep"'}</p>`,
    '  {/* data-id="comment" */}',
    '  <span>no id</span>',
    '</section>',
  ].join('\n');

  it('renews string ids in either quote style and keeps everything else', () => {
    expect(copySectionCode(section, new Set(), sequentialIds())).toBe(
      [
        '<section data-id="id0" data-name="s1">',
        '  <p data-id="id1">Title</p>',
        "  <p data-id='id2'>Note</p>",
        '  <img data-id={`img-${index}`} />',
        `  <p title='data-id="keep"'>{'data-id="keep"'}</p>`,
        '  {/* data-id="comment" */}',
        '  <span>no id</span>',
        '</section>',
      ].join('\n'),
    );
  });

  it('skips ids in taken and ids it already gave', () => {
    const ids = ['a', 'b', 'a', 'c', 'd'];

    expect(
      copySectionCode(
        '<section data-id="x"><p data-id="y" /><p data-id="z" /></section>',
        new Set(['b']),
        () => ids.shift()!,
      ),
    ).toBe('<section data-id="a"><p data-id="c" /><p data-id="d" /></section>');
  });

  it('renews the id after a spread and keeps the spread', () => {
    expect(
      copySectionCode(
        '<section data-id="s"><p data-id="p" {...props} /></section>',
        new Set(),
        sequentialIds(),
      ),
    ).toBe('<section data-id="id0"><p data-id="id1" {...props} /></section>');
  });

  it('keeps the whitespace around a palette section', () => {
    expect(
      copySectionCode(
        '\n  <section data-id="s" />\n',
        new Set(),
        sequentialIds(),
      ),
    ).toBe('\n  <section data-id="id0" />\n');
  });

  it('falls back to replaceIds when the code does not parse', () => {
    expect(
      copySectionCode('<section data-id="s"><p>', new Set(), sequentialIds()),
    ).toBe('<section data-id="id0"><p>');
  });
});

describe('writtenIds', () => {
  it('collects the values written in either quote style, text included', () => {
    expect(
      writtenIds(`<a data-id="x" /><b data-id='y' />{'data-id="z"'}`),
    ).toEqual(new Set(['x', 'y', 'z']));
  });
});

describe('fillIds', () => {
  it('fills only empty data-id attributes', () => {
    const code = `<div ${DATA_ATTR.ID}=""><span ${DATA_ATTR.ID}="kept" /></div>`;
    const result = fillIds(code, sequentialIds());

    expect(result).toBe(
      `<div ${DATA_ATTR.ID}="id0"><span ${DATA_ATTR.ID}="kept" /></div>`,
    );
  });

  it('is a no-op when there are no empty ids', () => {
    const code = `<div ${DATA_ATTR.ID}="a" />`;
    expect(fillIds(code, sequentialIds())).toBe(code);
  });
});

// Same code, same ids: the panel and the canvas preview fill a section this
// way independently, and have to agree on every element's id (#432).
describe('fillIdsFrom', () => {
  it('fills empty ids in order from the prefix', () => {
    const code = `<div ${DATA_ATTR.ID}=""><span ${DATA_ATTR.ID}="" /></div>`;

    expect(fillIdsFrom(code, 's')).toBe(
      `<div ${DATA_ATTR.ID}="s-1"><span ${DATA_ATTR.ID}="s-2" /></div>`,
    );
  });

  it('gives the same code the same ids every time', () => {
    const code = `<div ${DATA_ATTR.ID}=""><p ${DATA_ATTR.ID}="" /></div>`;

    expect(fillIdsFrom(code, 's')).toBe(fillIdsFrom(code, 's'));
  });

  it('keeps filled ids and skips the ones the code already uses', () => {
    const code = `<div ${DATA_ATTR.ID}="s-1"><p ${DATA_ATTR.ID}="" /><p ${DATA_ATTR.ID}="" /></div>`;

    expect(fillIdsFrom(code, 's')).toBe(
      `<div ${DATA_ATTR.ID}="s-1"><p ${DATA_ATTR.ID}="s-2" /><p ${DATA_ATTR.ID}="s-3" /></div>`,
    );
  });

  it('is a no-op when there are no empty ids', () => {
    const code = `<div ${DATA_ATTR.ID}="a" />`;

    expect(fillIdsFrom(code, 's')).toBe(code);
  });
});

describe('clone', () => {
  it('deep-copies the node and reassigns data-id values', () => {
    const source = parseExpression(`<div ${DATA_ATTR.ID}="orig">hi</div>`, {
      plugins: ['jsx', 'typescript'],
    });

    const cloned = clone(source, () => 'fresh');

    // A new node, not the same reference.
    expect(cloned).not.toBe(source);
    expect(t.isJSXElement(cloned)).toBe(true);

    if (t.isJSXElement(cloned)) {
      const idAttr = cloned.openingElement.attributes.find(
        (attr): attr is t.JSXAttribute =>
          t.isJSXAttribute(attr) && attr.name.name === DATA_ATTR.ID,
      );
      expect(
        idAttr && t.isStringLiteral(idAttr.value) && idAttr.value.value,
      ).toBe('fresh');
    }
  });
});
