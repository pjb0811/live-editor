import { describe, expect, it } from 'vitest';

import {
  createUiKitDocument,
  uiKitModules,
  uiKitPaletteSections,
} from '~/components/ui-kit';
import { DEFAULT_TEMPLATE, PALETTE_SECTIONS } from '~/constants';
import { extract } from '~/utils/ast';
import type { DataAttrNode } from '~/utils/ast/types';
import { compile } from '~/utils/compile';
import { replaceSections } from '~/utils/sections';

const flatten = (nodes: DataAttrNode[]): DataAttrNode[] =>
  nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);

const bindingLabels = (code: string) =>
  flatten(extract(code)).flatMap(node =>
    (node.bindings ?? []).map(binding => binding.label),
  );

// The default palette needs no modules: a new document has no imports, and
// `Live.Dnd` passes none unless the host does (#683).
describe('the default palette sections', () => {
  it.each(PALETTE_SECTIONS.map(section => [section.name, section] as const))(
    'compiles %s in a new document with no modules',
    (_name, section) => {
      const module = compile(
        replaceSections(DEFAULT_TEMPLATE, [section.code]),
        {},
      );

      expect(module.error).toBeUndefined();
      expect(module.exports.default).toBeTypeOf('function');
    },
  );

  it('keeps the ids and names of the ui-kit sections', () => {
    expect(PALETTE_SECTIONS.map(({ id, name }) => [id, name])).toEqual(
      uiKitPaletteSections.map(({ id, name }) => [id, name]),
    );
  });

  it('gives every section something to edit', () => {
    for (const section of PALETTE_SECTIONS) {
      expect(bindingLabels(section.code).length).toBeGreaterThan(0);
    }
  });

  it('uses no ui-kit component or cn() call', () => {
    for (const section of PALETTE_SECTIONS) {
      expect(section.code).not.toMatch(/\bui\.|\bcn\(/);
    }
  });
});

describe('the ui-kit palette sections', () => {
  it.each(
    uiKitPaletteSections.map(section => [section.name, section] as const),
  )('compiles %s in a ui-kit document with uiKitModules', (_name, section) => {
    const module = compile(
      replaceSections(createUiKitDocument(), [section.code]),
      uiKitModules,
    );

    expect(module.error).toBeUndefined();
  });

  it('cannot load ui-kit without uiKitModules', () => {
    const module = compile(
      replaceSections(createUiKitDocument(), [uiKitPaletteSections[0]!.code]),
      {},
    );

    expect(module.error).toMatch(/ui-kit/);
  });
});
