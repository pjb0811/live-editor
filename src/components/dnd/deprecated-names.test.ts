import { describe, expect, expectTypeOf, it } from 'vitest';

import type * as Root from '~/index';

import * as Dnd from '.';

// The pre-`useDnd*` names stay exported as aliases until the next major, so
// an existing import keeps compiling and keeps getting the same hook.
describe('deprecated hook names', () => {
  it('alias the renamed hooks rather than wrapping them', () => {
    expect(Dnd.useItemsEditor).toBe(Dnd.useDndItems);
    expect(Dnd.useChildrenEditor).toBe(Dnd.useDndChildren);
  });

  it('alias the renamed types', () => {
    expectTypeOf<Dnd.ItemsEditor>().toEqualTypeOf<Dnd.DndItems>();
    expectTypeOf<Dnd.ItemsEditorActions>().toEqualTypeOf<Dnd.DndItemsActions>();
    expectTypeOf<Dnd.ItemsEditorItem>().toEqualTypeOf<Dnd.DndItemsItem>();
    expectTypeOf<Dnd.ItemsEditorNestedElement>().toEqualTypeOf<Dnd.DndItemsNestedElement>();
    expectTypeOf<Dnd.ItemsEditorNestedGroup>().toEqualTypeOf<Dnd.DndItemsNestedGroup>();
    expectTypeOf<Dnd.ItemsEditorOptions>().toEqualTypeOf<Dnd.DndItemsOptions>();
    expectTypeOf<Dnd.ChildrenEditor>().toEqualTypeOf<Dnd.DndChildren>();
    expectTypeOf<Dnd.ChildrenEditorOptions>().toEqualTypeOf<Dnd.DndChildrenOptions>();

    expectTypeOf<Root.ItemsEditor>().toEqualTypeOf<Root.DndItems>();
    expectTypeOf<Root.ItemsEditorItem>().toEqualTypeOf<Root.DndItemsItem>();
    expectTypeOf<Root.ItemsEditorOptions>().toEqualTypeOf<Root.DndItemsOptions>();
  });
});
