import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { DATA_ATTR } from '../../constants';
import { generateCode } from './helpers';
import { type SourceEdit, applyEdits } from './patch';

export const replaceIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}="[^"]*"`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

// The `data-id` attributes of a JSX element.
export const dataIdAttributes = (
  opening: t.JSXOpeningElement,
): t.JSXAttribute[] =>
  opening.attributes.filter(
    (attr): attr is t.JSXAttribute =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name, { name: DATA_ATTR.ID }),
  );

// Every `data-id="…"` or `data-id='…'` value written in `code`, text
// included, to keep new ids clear of. An extra one only narrows the choice.
export const writtenIds = (code: string): Set<string> =>
  new Set(
    Array.from(
      code.matchAll(new RegExp(`${DATA_ATTR.ID}=(["'])(.*?)\\1`, 'g')),
      match => match[2]!,
    ),
  );

// A copy of a section's code with a new value, in its own quotes, for every
// string-literal `data-id`, and every other byte as written: text, comments
// and attribute values that mention `data-id` stay as they are (#796). An
// expression id is kept, since edits only find elements by a string id, and
// an element without an id gets none. New ids avoid `taken`. Code that
// doesn't parse falls back to `replaceIds`.
export const copySectionCode = (
  code: string,
  taken: ReadonlySet<string> = new Set(),
  generateId: () => string = () => nanoid(6),
): string => {
  let node: t.Expression;

  try {
    node = parseExpression(code, { plugins: ['jsx', 'typescript'] });
  } catch {
    return replaceIds(code, generateId);
  }

  const used = new Set(taken);
  const newId = () => {
    let id = generateId();

    while (used.has(id)) {
      id = generateId();
    }

    used.add(id);

    return id;
  };
  const edits: SourceEdit[] = [];

  t.traverseFast(node, child => {
    if (!t.isJSXOpeningElement(child)) {
      return;
    }

    for (const { value } of dataIdAttributes(child)) {
      if (t.isStringLiteral(value)) {
        const quote = code[value.start!]!;

        edits.push({
          start: value.start!,
          end: value.end!,
          content: `${quote}${newId()}${quote}`,
        });
      }
    }
  });

  return applyEdits(code, edits);
};

export const fillIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}=""`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

// Fills each empty `data-id=""` with `prefix-1`, `prefix-2`, ..., skipping
// ids already in `code`, so the same code always gets the same ids. The
// canvas preview and the panel both fill a section this way, so an element
// in the preview matches its fields before the ids are in the source (#432).
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
