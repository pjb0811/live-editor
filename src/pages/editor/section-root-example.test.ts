import { describe, expect, it } from 'vitest';

import { resolvePanelBindings } from '~/components/dnd/panel-binding';
import { DEFAULT_TEMPLATE } from '~/constants';
import { extract, fillIds, fillSectionIds, update } from '~/utils/ast';
import { extractSections, replaceSections } from '~/utils/sections';

import { SECTION_ROOT_EXAMPLE } from './section-root-example';

// The example the docs demo and the dev page add to the palette. If its
// `data-binding` stopped resolving, both would quietly show a section with
// nothing to edit (#429).
describe('SECTION_ROOT_EXAMPLE', () => {
  // As `Live.Dnd` reads a document: sections get their `data-id` first.
  const document = fillSectionIds(
    replaceSections(DEFAULT_TEMPLATE, [SECTION_ROOT_EXAMPLE.code]),
  );
  const [section] = extractSections(document);

  it('lands in a document as a section with an id', () => {
    expect(section).toMatchObject({ name: 'Banner' });
    expect(section!.id).toBeTruthy();
  });

  it("binds the section's own style, ahead of the elements inside", () => {
    const nodes = extract(fillIds(section!.code));
    const bindings = nodes.flatMap(
      node => resolvePanelBindings(node)?.bindings ?? [],
    );

    expect(bindings.map(binding => binding.label)).toEqual([
      'Section Style',
      'Heading',
      'Text',
    ]);
    expect(bindings[0]).toMatchObject({
      id: section!.id,
      property: 'style',
      type: 'object',
    });
    expect(bindings[0]!.canEditValue).not.toBe(false);
  });

  it('edits the section background without touching its identity', () => {
    const result = update(
      section!.code,
      section!.id,
      'Section Style',
      { backgroundColor: '#059669', paddingBlock: 96 },
      'style',
    );

    expect(result.success).toBe(true);
    expect(result.code).toContain('#059669');
    expect(result.code).toContain(`data-id="${section!.id}"`);
    expect(result.code).toContain('data-name="Banner"');
  });
});
