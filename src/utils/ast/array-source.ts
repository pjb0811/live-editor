import * as t from '@babel/types';

import { type SourceEdit, applyEdits } from './patch';
import { parseArrayExpression } from './value';

// Gaps between dense elements contain only whitespace, comments and one
// comma. Scan those gaps, never the expressions (which can contain JSX,
// regexes, templates and nested commas).
const commaIn = (source: string, start: number, end: number): number | null => {
  let comma: number | null = null;

  for (let at = start; at < end; at++) {
    if (/\s/.test(source[at]!)) {
      continue;
    }

    if (source.startsWith('/*', at)) {
      const close = source.indexOf('*/', at + 2);

      if (close < 0 || close + 2 > end) {
        return null;
      }

      at = close + 1;
    } else if (source.startsWith('//', at)) {
      const newline = source.indexOf('\n', at + 2);
      at = newline < 0 ? end : newline;
    } else if (source[at] === ',' && comma === null) {
      comma = at;
    } else {
      return null;
    }
  }

  return comma;
};

export const denseArraySource = (source: string) => {
  const array = parseArrayExpression(source);

  // Holes/spreads have source positions but no stable visible item count.
  // Value edits can preserve them; structural edits deliberately refuse.
  if (
    !array ||
    array.elements.some(
      node => !t.isExpression(node) || node.extra?.parenthesized,
    )
  ) {
    return null;
  }

  const elements = array.elements as t.Expression[];
  const commas = elements
    .slice(0, -1)
    .map((node, index) =>
      commaIn(source, node.end!, elements[index + 1]!.start!),
    );

  if (commas.some(comma => comma === null)) {
    return null;
  }

  const last = elements.at(-1);
  const trailing = last ? commaIn(source, last.end!, array.end! - 1) : null;

  return { array, elements, commas: commas as number[], trailing };
};

// Keep presentation and mutation on the same syntax boundary. Consumers can
// use this before offering structural controls, while every write still calls
// denseArraySource() again so stale source is refused at commit time.
export const canStructurallyEditArray = (source: string) =>
  denseArraySource(source) !== null;

export const validArrayIndices = (indices: Iterable<number>, length: number) =>
  [...indices].every(
    index => Number.isInteger(index) && index >= 0 && index < length,
  );

export const reorderArraySource = (
  source: string,
  elements: t.Expression[],
  next: t.Expression[],
): string =>
  applyEdits(
    source,
    elements.map((node, index) => ({
      start: node.start!,
      end: node.end!,
      content: source.slice(next[index]!.start!, next[index]!.end!),
    })),
  );

export const removeArraySource = (
  source: string,
  data: NonNullable<ReturnType<typeof denseArraySource>>,
  indices: Set<number>,
): string => {
  const edits: SourceEdit[] = [];
  const removedCommas = new Set<number>();
  const { elements, commas, trailing } = data;

  // Each consecutive removed run consumes its following commas. A run
  // ending at the last element consumes the preceding separator instead;
  // a trailing comma, when present, stays a trailing comma.
  for (let index = 0; index < elements.length; index++) {
    if (!indices.has(index)) {
      continue;
    }

    const start = index;

    while (index + 1 < elements.length && indices.has(index + 1)) {
      index++;
    }

    for (let current = start; current <= index; current++) {
      const node = elements[current]!;
      edits.push({ start: node.start!, end: node.end!, content: '' });

      if (current < elements.length - 1) {
        removedCommas.add(commas[current]!);
      }
    }

    if (index === elements.length - 1) {
      if (trailing !== null) {
        removedCommas.add(trailing);
      } else if (start > 0) {
        removedCommas.add(commas[start - 1]!);
      }
    }
  }

  for (const comma of removedCommas) {
    edits.push({ start: comma, end: comma + 1, content: '' });
  }

  return applyEdits(source, edits);
};

export const appendArraySource = (
  source: string,
  data: NonNullable<ReturnType<typeof denseArraySource>>,
  copies: string[],
): string => {
  const last = data.elements.at(-1);

  if (!last || copies.length === 0) {
    return source;
  }

  // Insert before the old trailing gap so line comments cannot swallow a
  // new item, and keep an existing trailing comma in its original role.
  return applyEdits(source, [
    {
      start: last.end!,
      end: last.end!,
      content: `, ${copies.join(', ')}`,
    },
  ]);
};
