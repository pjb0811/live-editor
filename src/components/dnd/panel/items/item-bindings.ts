import { type BindingRenderMap } from '~/utils/ast/types';
import { canLosslesslyEvaluateSource, parseValue } from '~/utils/ast/value';

import {
  type PanelBinding,
  type PanelNodeChange,
  resolvePanelBindings,
  resolveRenderEntry,
  toBindingFields,
  withPanelCommit,
} from '../../panel-binding';
import type { RawObjectItem, RawPrimitiveItem } from './items-source';
import type { DndItemsItem, DndItemsNestedGroup } from './use-dnd-items';

interface ItemBindingOptions {
  // The item's stable id from `useDndItems`' identity state.
  id: string;
  // The array source the item was parsed from.
  value: string;
  render?: BindingRenderMap;
  onNodeChange?: PanelNodeChange;
  // Commits a primitive item's new value.
  onValueChange: (next: unknown) => void;
  // Commits a new value for one of an object item's properties.
  onPropertyChange: (property: string, next: unknown) => void;
}

const isPrimitiveItem = (
  item: RawObjectItem | RawPrimitiveItem,
): item is RawPrimitiveItem => !('editableProperties' in item);

// The panel bindings for one parsed item: a primitive item's value, or an
// object item's plain properties through the `render` map and its
// JSX-valued properties as nested elements, or as a `jsx` binding when the
// JSX has none (#298, #308).
export const toItemBindings = (
  item: RawObjectItem | RawPrimitiveItem,
  {
    id,
    value,
    render,
    onNodeChange,
    onValueChange,
    onPropertyChange,
  }: ItemBindingOptions,
): DndItemsItem => {
  if (isPrimitiveItem(item)) {
    return {
      id,
      index: item.index,
      elementIndex: item.elementIndex,
      properties: [],
      nested: [],
      value: {
        id: `primitive-${item.id}`,
        label: `item-${item.index}`,
        property: item.type,
        value: item.value ?? '',
        rawValue:
          item.type === 'unknown' ? item.source : String(item.value ?? ''),
        canEditValue: canLosslesslyEvaluateSource(item.source),
        onChange: onValueChange,
      },
    };
  }

  const properties: PanelBinding[] = Object.entries(
    item.editableProperties,
  ).map(([key, prop]) => {
    const binding = resolveRenderEntry(render, key);
    const propertySource = value.slice(prop.astNode.start!, prop.astNode.end!);

    return {
      ...toBindingFields(binding),
      id: `item-${id}-${key}`,
      // Over the leaf's own `meta`, so the property's real type wins over an
      // authored `valueType`.
      meta: { ...binding.meta, valueType: prop.type },
      value: parseValue(String(prop.value)),
      rawValue: prop.type === 'unknown' ? propertySource : String(prop.value),
      canEditValue: canLosslesslyEvaluateSource(propertySource),
      onChange: next => onPropertyChange(key, next),
    };
  });

  const nested: DndItemsNestedGroup[] = [
    ...Object.entries(item.jsxBindings).map(([property, nodes]) => ({
      property,
      elements: nodes.flatMap(node => {
        const source = resolvePanelBindings(node);

        if (!source) {
          return [];
        }

        return [
          {
            id: source.id,
            tagName: source.tagName,
            bindings: withPanelCommit(source.bindings, onNodeChange),
          },
        ];
      }),
    })),
    ...Object.entries(item.jsxFallbacks).map(([property, code]) => ({
      property,
      elements: [],
      fallback: {
        id: `item-${id}-${property}-jsx`,
        label: property,
        property,
        type: 'jsx' as const,
        value: code,
        rawValue: code,
        canEditValue: true,
        onChange: (next: unknown) => onPropertyChange(property, next),
      },
    })),
  ];

  return {
    id,
    index: item.index,
    elementIndex: item.elementIndex,
    properties,
    nested,
  };
};
