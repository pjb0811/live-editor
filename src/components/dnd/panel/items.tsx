import { useEffect, useMemo } from 'react';

import * as t from '@babel/types';
import { Button, Checkbox, Toast } from '@jbpark/ui-kit';
import { useMultiSelect } from '@jbpark/use-hooks';
import { ArrowDown, ArrowUp, Copy, Plus, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import {
  type BindingRenderLeaf,
  type BindingRenderMap,
  type DataAttrNode,
  type ExtractedNodeValue,
  type NodeValueType,
  appendArrayItem,
  duplicateArrayItems,
  extract,
  extractNodeValue,
  extractObjectProperties,
  findEditableChildren,
  generateCode,
  moveArrayItem,
  moveArrayItems,
  parseArrayExpression,
  parseValue,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from '~/utils/ast';

import Field from './field';
import Node from './node';

interface ItemProperty extends ExtractedNodeValue {
  astNode: t.Node;
}

interface ItemData {
  id: string;
  index: number;
  // Position in the array's elements, which is what `~/utils/ast`'s item
  // functions address. Only differs from `index` when the array mixes
  // objects and primitives.
  elementIndex: number;
  editableProperties: Record<string, ItemProperty>;
  jsxBindings: Record<string, DataAttrNode[]>;
}

interface PrimitiveItem {
  id: string;
  index: number;
  elementIndex: number;
  value: string | number | boolean | null;
  type: NodeValueType;
}

interface Props {
  value: string;
  render?: BindingRenderMap;
  onChange?: (value: string) => void;
  onChildChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }) => void;
}

interface BulkActionsBarProps {
  count: number;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const BulkActionsBar = ({
  count,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClear,
}: BulkActionsBarProps) => {
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between rounded border
        border-blue-200 bg-blue-50 p-2"
    >
      <div className="text-xs font-medium text-blue-700">{count} selected</div>
      <div className="flex items-center space-x-1">
        <Button
          size="small"
          icon={<Copy />}
          title="Duplicate selected"
          onClick={onDuplicate}
        />
        <Button
          size="small"
          icon={<ArrowUp />}
          title="Move selected up"
          onClick={onMoveUp}
        />
        <Button
          size="small"
          icon={<ArrowDown />}
          title="Move selected down"
          onClick={onMoveDown}
        />
        <Button
          danger
          size="small"
          icon={<X />}
          title="Delete selected"
          onClick={onDelete}
        />
        <Button size="small" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
};

const Items = ({ value, render, onChange, onChildChange }: Props) => {
  const { objectItems, primitiveItems, parseError } = useMemo(() => {
    const ast = parseArrayExpression(value);

    if (!ast) {
      return {
        objectItems: [],
        primitiveItems: [],
        parseError: true,
      };
    }

    const objectItems: ItemData[] = [];
    const primitiveItems: PrimitiveItem[] = [];
    const elements = ast.elements.filter((element): element is t.Expression =>
      Boolean(element),
    );

    elements.forEach((element, elementIndex) => {
      if (!t.isObjectExpression(element)) {
        const extracted = extractNodeValue(element);

        primitiveItems.push({
          id: nanoid(6),
          index: primitiveItems.length,
          elementIndex,
          value: extracted.value,
          type: extracted.type,
        });
        return;
      }

      const jsxBindings: Record<string, DataAttrNode[]> = {};

      element.properties.forEach(prop => {
        if (
          !t.isObjectProperty(prop) ||
          !t.isIdentifier(prop.key) ||
          !t.isJSXElement(prop.value)
        ) {
          return;
        }

        const propertyName = prop.key.name;

        try {
          const jsxCode = generateCode(prop.value);
          const nodes = extract(jsxCode);
          const bindings: DataAttrNode[] = [];

          const bindingContainer = nodes.find(node =>
            node.bindings?.some(b => b.property === 'children'),
          );

          if (bindingContainer) {
            bindings.push(bindingContainer);
          } else {
            nodes.forEach(node => {
              if (
                node.bindings &&
                node.bindings.length > 0 &&
                node.dataAttributes.some(a => a.name === 'data-id')
              ) {
                bindings.push(node);
              }
              const editableChildren = findEditableChildren(node);
              bindings.push(...editableChildren);
            });
          }

          if (bindings.length > 0) {
            jsxBindings[propertyName] = bindings;
          }
        } catch (error) {
          console.error(
            `Failed to parse JSX in property '${propertyName}':`,
            error,
          );
        }
      });

      objectItems.push({
        id: nanoid(6),
        index: objectItems.length,
        elementIndex,
        editableProperties: extractObjectProperties(element),
        jsxBindings,
      });
    });

    return { objectItems, primitiveItems, parseError: false };
  }, [value]);

  useEffect(() => {
    if (parseError) {
      Toast.error('Failed to parse items', {
        description: 'Check the console for details.',
      });
    }
  }, [parseError]);

  const isPrimitive = primitiveItems.length > 0 && objectItems.length === 0;

  const selection = useMultiSelect(
    isPrimitive ? primitiveItems.length : objectItems.length,
  );

  // Every mutation goes through `~/utils/ast`'s item functions: the array
  // source is re-parsed there and a new string comes back, so nothing here
  // holds or edits AST nodes across renders. `null` means the edit could
  // not be applied.
  const commit = (next: string | null) => {
    if (next === null) {
      Toast.error('Failed to update this item', {
        description: 'Check the console for details.',
      });
      return;
    }

    onChange?.(next);
  };

  // The panel shows one kind at a time, but the array can hold both, so
  // selection indices (positions among the visible items) are translated to
  // element positions before any edit. Keeping the two apart is what stops
  // an edit from dropping the items that aren't on screen.
  const elementIndicesOf = (
    items: { index: number; elementIndex: number }[],
    indices: Set<number>,
  ) => {
    return new Set(
      items
        .filter(item => indices.has(item.index))
        .map(item => item.elementIndex),
    );
  };

  const updatePrimitive = (elementIndex: number, next: unknown) => {
    commit(updateArrayItemValue(value, elementIndex, next));
  };

  const movePrimitive = (from: number, to: number) => {
    const target = primitiveItems.find(item => item.index === to);

    if (!target) {
      return;
    }

    commit(moveArrayItem(value, from, target.elementIndex));
  };

  const deleteSelectedPrimitives = (indices: Set<number>) => {
    commit(
      removeArrayItems(
        value,
        elementIndicesOf(primitiveItems, indices),
        'primitive',
      ),
    );
  };

  const deletePrimitive = (elementIndex: number) => {
    commit(removeArrayItems(value, new Set([elementIndex]), 'primitive'));
  };

  const addPrimitive = () => {
    commit(appendArrayItem(value, 'primitive'));
  };

  const duplicateSelectedPrimitives = (indices: Set<number>) => {
    commit(
      duplicateArrayItems(value, elementIndicesOf(primitiveItems, indices)),
    );
  };

  const moveSelectedPrimitives = (
    indices: Set<number>,
    direction: 'up' | 'down',
  ) => {
    const result = moveArrayItems(
      value,
      elementIndicesOf(primitiveItems, indices),
      direction,
    );

    if (!result) {
      commit(null);
      return;
    }

    // Element positions, which match selection indices for the all-one-kind
    // arrays the panel is built for.
    selection.replace(result.indices);
    commit(result.code);
  };

  const moveItem = (from: number, to: number) => {
    const target = objectItems.find(item => item.index === to);

    if (!target) {
      return;
    }

    commit(moveArrayItem(value, from, target.elementIndex));
  };

  const updateProperty = (
    elementIndex: number,
    propertyKey: string,
    next: unknown,
  ) => {
    commit(
      updateArrayItemProperty(value, elementIndex, propertyKey, next, render),
    );
  };

  const deleteSelectedItems = (indices: Set<number>) => {
    commit(
      removeArrayItems(value, elementIndicesOf(objectItems, indices), 'object'),
    );
  };

  const deleteItem = (elementIndex: number) => {
    commit(removeArrayItems(value, new Set([elementIndex]), 'object'));
  };

  const addItem = () => {
    commit(appendArrayItem(value, 'object'));
  };

  const duplicateSelectedItems = (indices: Set<number>) => {
    commit(duplicateArrayItems(value, elementIndicesOf(objectItems, indices)));
  };

  const moveSelectedItems = (
    indices: Set<number>,
    direction: 'up' | 'down',
  ) => {
    const result = moveArrayItems(
      value,
      elementIndicesOf(objectItems, indices),
      direction,
    );

    if (!result) {
      commit(null);
      return;
    }

    selection.replace(result.indices);
    commit(result.code);
  };

  if (isPrimitive) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            Items ({primitiveItems.length})
          </div>
          <Button
            size="small"
            icon={<Plus />}
            variant="solid"
            color="green"
            onClick={addPrimitive}
          >
            Add Item
          </Button>
        </div>

        <BulkActionsBar
          count={selection.selected.size}
          onDuplicate={() => duplicateSelectedPrimitives(selection.selected)}
          onMoveUp={() => moveSelectedPrimitives(selection.selected, 'up')}
          onMoveDown={() => moveSelectedPrimitives(selection.selected, 'down')}
          onDelete={() => {
            deleteSelectedPrimitives(selection.selected);
            selection.clear();
          }}
          onClear={selection.clear}
        />

        {primitiveItems.map((item, i) => (
          <div
            key={item.id}
            className="space-y-2 rounded border border-gray-100 bg-gray-50 p-2"
          >
            <div className="flex items-center justify-between space-x-1">
              <div
                onClick={e => selection.toggle(item.index, e.shiftKey)}
                className="inline-flex"
              >
                <Checkbox
                  checked={selection.isSelected(item.index)}
                  onChange={() => {}}
                />
              </div>
              <div className="flex space-x-1">
                <Button
                  size="small"
                  icon={<ArrowUp />}
                  disabled={i === 0}
                  onClick={() =>
                    movePrimitive(item.elementIndex, item.index - 1)
                  }
                />
                <Button
                  size="small"
                  icon={<ArrowDown />}
                  disabled={i === primitiveItems.length - 1}
                  onClick={() =>
                    movePrimitive(item.elementIndex, item.index + 1)
                  }
                />
                <Button
                  danger
                  size="small"
                  icon={<X />}
                  disabled={primitiveItems.length <= 1}
                  onClick={() => deletePrimitive(item.elementIndex)}
                />
              </div>
            </div>
            <Field
              binding={{
                id: `primitive-${item.id}`,
                label: `item-${i}`,
                property: item.type,
                value: item.value ?? '',
                rawValue: String(item.value ?? ''),
                onChange: next => updatePrimitive(item.elementIndex, next),
              }}
              onNodeChange={onChildChange}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Items ({objectItems.length})
        </div>
        <Button
          size="small"
          icon={<Plus />}
          variant="solid"
          color="green"
          disabled={objectItems.length === 0}
          onClick={addItem}
        >
          Add Item
        </Button>
      </div>

      <BulkActionsBar
        count={selection.selected.size}
        onDuplicate={() => duplicateSelectedItems(selection.selected)}
        onMoveUp={() => moveSelectedItems(selection.selected, 'up')}
        onMoveDown={() => moveSelectedItems(selection.selected, 'down')}
        onDelete={() => {
          deleteSelectedItems(selection.selected);
          selection.clear();
        }}
        onClear={selection.clear}
      />

      {objectItems.map(item => (
        <div key={item.id} className="space-y-3 rounded border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                onClick={e => selection.toggle(item.index, e.shiftKey)}
                className="inline-flex"
              >
                <Checkbox
                  checked={selection.isSelected(item.index)}
                  onChange={() => {}}
                />
              </div>
              <div className="text-xs font-medium">Item {item.index + 1}</div>
            </div>
            <div className="flex space-x-1">
              <Button
                size="small"
                icon={<ArrowUp />}
                disabled={item.index === 0}
                onClick={() => moveItem(item.elementIndex, item.index - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                disabled={item.index === objectItems.length - 1}
                onClick={() => moveItem(item.elementIndex, item.index + 1)}
              />
              <Button
                danger
                size="small"
                icon={<X />}
                disabled={objectItems.length <= 1}
                onClick={() => deleteItem(item.elementIndex)}
              />
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(item.editableProperties).map(([key, prop]) => (
              <div key={`${item.id}-${key}`}>
                <div className="flex flex-col space-y-2">
                  <label className="w-20 shrink-0 text-xs font-medium">
                    {key}
                  </label>
                  <Field
                    binding={{
                      id: `item-${item.id}-${key}`,
                      label: key,
                      property:
                        render?.[key] && 'type' in render[key]
                          ? ((render[key] as BindingRenderLeaf).property ??
                            (render[key].type as string))
                          : key,
                      type:
                        render?.[key] && 'type' in render[key]
                          ? (render[key] as BindingRenderLeaf).type
                          : undefined,
                      render:
                        render?.[key] && 'type' in render[key]
                          ? (render[key] as BindingRenderLeaf).render
                          : render?.[key] && !('type' in render[key])
                            ? (render[key] as BindingRenderMap)
                            : undefined,
                      value: parseValue(String(prop.value)),
                      rawValue: String(prop.value),
                      onChange: next =>
                        updateProperty(item.elementIndex, key, next),
                    }}
                    onNodeChange={onChildChange}
                  />
                </div>
                <span className="text-right text-xs text-gray-500">
                  ({prop.type})
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t pt-2">
            {Object.entries(item.jsxBindings).length > 0 ? (
              Object.entries(item.jsxBindings).map(
                ([propertyName, bindings]) => (
                  <div key={propertyName} className="space-y-2">
                    <div className="text-xs font-medium text-blue-700">
                      {propertyName} Bindings ({bindings.length}):
                    </div>
                    {bindings.map((bindingNode, idx) => {
                      const nodeId = bindingNode.dataAttributes.find(
                        a => a.name === 'data-id',
                      )?.value;

                      return (
                        <div
                          key={`binding-${item.id}-${propertyName}-${nodeId || idx}`}
                          className="rounded border border-blue-100 bg-blue-50
                            p-2"
                        >
                          <div className="mb-1 text-xs text-blue-600">
                            &lt;{bindingNode.tagName || 'element'}&gt;
                          </div>
                          <Node data={bindingNode} onChange={onChildChange} />
                        </div>
                      );
                    })}
                  </div>
                ),
              )
            ) : (
              <div className="text-xs text-gray-500">
                ✓ No JSX bindings found
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Items;
export { BulkActionsBar };
