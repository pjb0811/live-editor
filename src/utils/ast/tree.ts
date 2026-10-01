import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { DATA_ATTR } from '../../constants';
import { generateCode } from './helpers';

export const replaceIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}="[^"]*"`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

export const fillIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}=""`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

// Fills each empty `data-id=""` from `prefix` and the slot's order, skipping
// any id `code` already uses, so the same code always gets the same ids. The
// panel and the canvas preview both fill a section's code this way, which
// is what lets an element in the preview be matched to its fields by
// `data-id` before any edit has written the ids into the source (#432).
export const fillIdsFrom = (code: string, prefix: string): string => {
  const taken = new Set(
    Array.from(
      code.matchAll(new RegExp(`${DATA_ATTR.ID}="([^"]*)"`, 'g')),
      match => match[1],
    ),
  );
  let count = 0;

  return fillIds(code, () => {
    let id: string;

    do {
      count++;
      id = `${prefix}-${count}`;
    } while (taken.has(id));

    return id;
  });
};

export const clone = (
  element: t.Node,
  generateId: () => string = () => nanoid(6),
) => {
  const cloned = t.cloneNode(element, true);
  const generatedCode = generateCode(cloned);
  const code = replaceIds(generatedCode, generateId);

  return parseExpression(code, {
    plugins: ['jsx', 'typescript'],
  });
};
