import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { moveSelectedIndices } from '../selection';
import { extract, nodeToJSX } from './extract';
import { generateCode } from './helpers';
import { type SourceEdit, applyEdits } from './patch';
import type { DataAttrNode } from './types';

export type ChildrenAction =
  | { type: 'move'; from: number; to: number }
  | { type: 'move-selected'; indices: number[]; direction: 'up' | 'down' }
  | { type: 'remove' | 'duplicate'; indices: number[] }
  | { type: 'append' };

export interface ChildrenEdit {
  kind: 'children-edit';
  expected: string[];
  action: ChildrenAction;
}

// Signatures address the extracted list, not synthetic wrapper IDs. The
// source editor checks them against the latest parent before using indices.
const modeledSignatures = (nodes: DataAttrNode[]): string[] =>
  nodes.map(node => {
    const jsx = nodeToJSX(node);

    if (!jsx) {
      throw new Error('Invalid child node');
    }

    return generateCode(jsx);
  });

export const getChildrenSignatures = (nodes: DataAttrNode[]): string[] => {
  const modeled = modeledSignatures(nodes);

  return nodes.map((node, index) =>
    JSON.stringify([node.source ?? null, modeled[index]]),
  );
};

const indicesAreValid = (
  indices: unknown,
  count: number,
): indices is number[] =>
  Array.isArray(indices) &&
  new Set(indices).size === indices.length &&
  indices.every(
    index => Number.isInteger(index) && index >= 0 && index < count,
  );

// Only ID attributes are replaced: expressions, spreads, comments and text
// in a copied subtree retain their exact source. Dynamic IDs are ambiguous.
const copySource = (source: string, usedIds: Set<string>): string => {
  const node = parseExpression(source, { plugins: ['jsx', 'typescript'] });
  const edits: SourceEdit[] = [];
  const newId = () => {
    let id = nanoid(12);

    while (usedIds.has(id)) {
      id = nanoid(12);
    }

    usedIds.add(id);

    return id;
  };

  t.traverseFast(node, child => {
    if (!t.isJSXOpeningElement(child)) {
      return;
    }

    const ids = child.attributes.filter(
      (attr): attr is t.JSXAttribute =>
        t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name, { name: 'data-id' }),
    );

    if (ids.length > 1) {
      throw new Error('Duplicate data-id attributes');
    }

    const attr = ids[0];

    if (
      attr &&
      child.attributes
        .slice(child.attributes.indexOf(attr) + 1)
        .some(attribute => t.isJSXSpreadAttribute(attribute))
    ) {
      throw new Error('A spread may override the copied data-id');
    }

    if (attr) {
      const value = attr.value;

      if (
        !t.isStringLiteral(value) ||
        value.start == null ||
        value.end == null
      ) {
        throw new Error('Cannot copy a dynamic data-id');
      }

      edits.push({
        start: value.start,
        end: value.end,
        content: JSON.stringify(newId()),
      });
    } else {
      const at = child.attributes.at(-1)?.end ?? child.name.end;

      if (at == null) {
        throw new Error('Missing opening element span');
      }

      edits.push({
        start: at,
        end: at,
        content: ` data-id="${newId()}"`,
      });
    }
  });

  return applyEdits(source, edits);
};

// Coordinates refer to the caller's wrapped source, just like other update
// editors. Non-element gaps stay at their original positions; moving a JSX
// child moves its entire subtree but never regenerates intervening content.
export const editChildrenSource = (
  source: string,
  parent: t.JSXElement,
  input: unknown,
): SourceEdit[] | null => {
  try {
    if (!parent.closingElement || parent.start == null || parent.end == null) {
      return null;
    }

    const value = typeof input === 'string' ? JSON.parse(input) : input;
    const children = parent.children.filter(
      (child): child is t.JSXElement | t.JSXFragment =>
        t.isJSXElement(child) || t.isJSXFragment(child),
    );
    const raw = children.map(child => source.slice(child.start!, child.end!));
    const models =
      extract(source.slice(parent.start, parent.end))[0]?.children ?? [];

    // The extractor currently omits some empty/expression-only fragments.
    // Never interpret its visible indices as different source children.
    if (models.length !== children.length) {
      return null;
    }

    const signatures = modeledSignatures(models);
    const replaceSlots = (next: string[]): SourceEdit[] => {
      const edits = children.map((child, index) => ({
        start: child.start!,
        end: child.end!,
        content: next[index] ?? '',
      }));

      if (next.length > children.length) {
        const at = parent.closingElement!.start!;
        edits.push({
          start: at,
          end: at,
          content: next.slice(children.length).join(''),
        });
      }

      return edits;
    };

    if (Array.isArray(value)) {
      // Preserve the existing JSON API. Unchanged modeled children reuse
      // their full original source; arbitrary replacements are allowed only
      // when every original child can be represented without information loss.
      const desired = modeledSignatures(value);
      const lossless = raw.every(
        (text, index) =>
          generateCode(
            parseExpression(text, { plugins: ['jsx', 'typescript'] }),
          ) === signatures[index],
      );
      const consumed = new Set<number>();
      const next = desired.map((signature, position) => {
        const index = signatures.findIndex(
          (candidate, i) =>
            candidate === signature &&
            !consumed.has(i) &&
            (value[position].source === undefined ||
              value[position].source === raw[i]),
        );

        if (index >= 0) {
          consumed.add(index);

          return raw[index]!;
        }

        if (
          !lossless ||
          (value[position].source !== undefined &&
            !raw.includes(value[position].source))
        ) {
          throw new Error(
            'Use children commands to copy or edit unsupported source',
          );
        }

        return signature;
      });

      // Legacy callers may supply entirely new modeled children. Do not
      // accept a duplicated identity that would make later edits ambiguous.
      const countIds = (text: string) => {
        const counts = new Map<string, number>();
        t.traverseFast(
          parseExpression(text, { plugins: ['jsx', 'typescript'] }),
          node => {
            if (
              t.isJSXAttribute(node) &&
              t.isJSXIdentifier(node.name, { name: 'data-id' }) &&
              t.isStringLiteral(node.value)
            ) {
              counts.set(
                node.value.value,
                (counts.get(node.value.value) ?? 0) + 1,
              );
            }
          },
        );

        return counts;
      };
      const previousIds = countIds(source);
      const updatedParent = applyEdits(source, replaceSlots(next));
      const nextIds = countIds(updatedParent);

      if (
        [...nextIds].some(
          ([id, count]) => count > 1 && count > (previousIds.get(id) ?? 0),
        )
      ) {
        return null;
      }

      return replaceSlots(next);
    }

    const request = value as ChildrenEdit | null;

    if (
      request?.kind !== 'children-edit' ||
      !Array.isArray(request.expected) ||
      request.expected.length !== signatures.length ||
      !getChildrenSignatures(models).every(
        (signature, index) => signature === request.expected[index],
      ) ||
      !request.action
    ) {
      return null;
    }

    const { action } = request;
    const usedIds = new Set<string>();

    t.traverseFast(parent, node => {
      if (
        t.isJSXAttribute(node) &&
        t.isJSXIdentifier(node.name, { name: 'data-id' }) &&
        t.isStringLiteral(node.value)
      ) {
        usedIds.add(node.value.value);
      }
    });

    switch (action.type) {
      case 'move': {
        if (
          !indicesAreValid([action.from], raw.length) ||
          !indicesAreValid([action.to], raw.length)
        ) {
          return null;
        }

        const next = [...raw];
        const [moved] = next.splice(action.from, 1);
        next.splice(action.to, 0, moved!);

        return replaceSlots(next);
      }
      case 'move-selected': {
        if (
          !indicesAreValid(action.indices, raw.length) ||
          !['up', 'down'].includes(action.direction)
        ) {
          return null;
        }

        return replaceSlots(
          moveSelectedIndices(raw, new Set(action.indices), action.direction)
            .items,
        );
      }
      case 'remove': {
        if (!indicesAreValid(action.indices, raw.length)) {
          return null;
        }

        return action.indices.map(index => ({
          start: children[index]!.start!,
          end: children[index]!.end!,
          content: '',
        }));
      }
      case 'duplicate': {
        if (!indicesAreValid(action.indices, raw.length)) {
          return null;
        }

        const content = [...action.indices]
          .sort((a, b) => a - b)
          .map(index => copySource(raw[index]!, usedIds))
          .join('');
        const at = parent.closingElement.start!;

        return [{ start: at, end: at, content }];
      }
      case 'append': {
        const content = copySource(raw[0] ?? '<div></div>', usedIds);
        const at = parent.closingElement.start!;

        return [{ start: at, end: at, content }];
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
};
