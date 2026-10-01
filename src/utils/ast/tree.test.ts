import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { DATA_ATTR } from '../../constants';
import { clone, fillIds, fillIdsFrom, replaceIds } from './tree';

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
