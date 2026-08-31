import { useEffect, useMemo } from 'react';

import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { Button, Checkbox, Toast } from '@jbpark/ui-kit';
import { useMultiSelect } from '@jbpark/use-hooks';
import { ArrowDown, ArrowUp, Copy, Plus, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import { BINDING_PROP } from '~/constants';
import {
  type BindingRenderLeaf,
  type BindingRenderMap,
  type DataAttrNode,
  type ExtractedNodeValue,
  type NodeValueType,
  arrayExpressionToCode,
  clone,
  createNodeFromValue,
  extract,
  extractNodeValue,
  extractObjectProperties,
  findEditableChildren,
  generateCode,
  parseArrayExpression,
  parseValue,
} from '~/utils/ast';

import Field from './field';
import Node from './node';
import { moveSelectedIndices, removeIndices } from './selection';

interface ItemProperty extends ExtractedNodeValue {
  astNode: t.Node;
}

interface ItemData {
  id: string;
  index: number;
  editableProperties: Record<string, ItemProperty>;
  originalElement: t.ObjectExpression;
  jsxBindings: Record<string, DataAttrNode[]>;
}

interface PrimitiveItem {
  id: string;
  index: number;
  value: string | number | boolean | null;
  type: NodeValueType;
  astNode: t.Expression;
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
  const { objectItems, primitiveItems, allElements, parseError } =
    useMemo(() => {
      const ast = parseArrayExpression(value);

      if (!ast) {
        return {
          objectItems: [],
          primitiveItems: [],
          allElements: [],
          parseError: true,
        };
      }

      const objectItems: ItemData[] = [];
      const primitiveItems: PrimitiveItem[] = [];
      const allElements = ast.elements.filter(Boolean) as t.Expression[];

      ast.elements.forEach(element => {
        if (!element) {
          return;
        }

        if (!t.isObjectExpression(element)) {
          const extracted = extractNodeValue(element);
          primitiveItems.push({
            id: nanoid(6),
            index: primitiveItems.length,
            value: extracted.value,
            type: extracted.type,
            astNode: element as t.Expression,
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
          editableProperties: extractObjectProperties(element),
          originalElement: element,
          jsxBindings,
        });
      });

      return { objectItems, primitiveItems, allElements, parseError: false };
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

  const updatePrimitive = (index: number, next: unknown) => {
    const ast = parseArrayExpression(value);

    if (!ast) {
      Toast.error('Failed to update this item', {
        description: 'Check the console for details.',
      });
      return;
    }

    const elements = ast.elements.filter(Boolean) as t.Expression[];
    const item = primitiveItems.find(p => p.index === index);

    if (!item) {
      return;
    }

    const newNode = createNodeFromValue(item.type, parseValue(next));

    if (!newNode) {
      return;
    }

    elements[index] = newNode;

    onChange?.(generateCode(t.arrayExpression(elements)));
  };

  const movePrimitive = (fromIndex: number, toIndex: number) => {
    const nextElements = [...allElements];
    const [moved] = nextElements.splice(fromIndex, 1);

    nextElements.splice(toIndex, 0, moved!);
    onChange?.(generateCode(t.arrayExpression(nextElements)));
  };

  const deleteSelectedPrimitives = (indices: Set<number>) => {
    if (allElements.length - indices.size < 1) {
      return;
    }

    const nextElements = removeIndices(allElements, indices);

    onChange?.(generateCode(t.arrayExpression(nextElements)));
  };

  const deletePrimitive = (index: number) =>
    deleteSelectedPrimitives(new Set([index]));

  const addPrimitive = () => {
    const first = primitiveItems[0];

    if (!first) {
      return;
    }

    const newNode = createNodeFromValue(first.type, first.value);

    if (!newNode) {
      return;
    }

    onChange?.(generateCode(t.arrayExpression([...allElements, newNode])));
  };

  const duplicateSelectedPrimitives = (indices: Set<number>) => {
    const clones = [...indices]
      .sort((a, b) => a - b)
      .map(index => allElements[index])
      .filter((node): node is t.Expression => Boolean(node))
      .map(node => clone(node) as t.Expression);

    if (clones.length === 0) {
      return;
    }

    onChange?.(generateCode(t.arrayExpression([...allElements, ...clones])));
  };

  const moveSelectedPrimitives = (
    indices: Set<number>,
    direction: 'up' | 'down',
  ) => {
    const { items: nextElements, indices: nextIndices } = moveSelectedIndices(
      allElements,
      indices,
      direction,
    );

    selection.replace(nextIndices);
    onChange?.(generateCode(t.arrayExpression(nextElements)));
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const nextItems = [...objectItems];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem!);

    const nextValue = arrayExpressionToCode(
      nextItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
  };

  const updateProperty = (
    itemIndex: number,
    propertyKey: string,
    value: unknown,
  ) => {
    const item = objectItems[itemIndex]!;
    const property = item.editableProperties[propertyKey]!;

    const renderLeaf =
      render?.[propertyKey] && 'type' in render[propertyKey]
        ? (render[propertyKey] as BindingRenderLeaf)
        : null;

    const isJsx = renderLeaf?.type === 'jsx';
    const isInnerHTML = renderLeaf?.property === BINDING_PROP.INNER_HTML;
    let nextAstValue: t.Expression | null = null;

    if (isInnerHTML) {
      const str = String(value);
      nextAstValue = t.templateLiteral(
        [t.templateElement({ raw: str, cooked: str }, true)],
        [],
      );
    } else if (property.type === 'array' || property.type === 'object') {
      try {
        nextAstValue = parseExpression(String(value), {
          plugins: ['jsx', 'typescript'],
        });
      } catch {
        return;
      }
    } else if (!isJsx) {
      nextAstValue = createNodeFromValue(property.type, value);
    }

    if (!isJsx && !nextAstValue) {
      return;
    }

    const objectExpression = item.originalElement;
    const targetProperty = objectExpression.properties.find(
      (prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement) =>
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === propertyKey,
    ) as t.ObjectProperty;

    const jsxPlaceholders = new Map<string, string>();
    const originalValues = new Map<t.ObjectProperty, t.Expression>();

    if (isJsx && targetProperty) {
      const trimmed = String(value).trim();
      if (trimmed.startsWith('<')) {
        const placeholder = `__JSX_${nanoid(6)}__`;
        jsxPlaceholders.set(placeholder, trimmed);
        targetProperty.value = t.identifier(placeholder);
      } else {
        targetProperty.value = t.stringLiteral(trimmed);
      }
    } else if (targetProperty && nextAstValue) {
      targetProperty.value = nextAstValue;
    }

    objectItems.forEach(obj => {
      obj.originalElement.properties.forEach(prop => {
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) {
          return;
        }

        if (t.isJSXElement(prop.value) || t.isJSXFragment(prop.value)) {
          const placeholder = `__JSX_${nanoid(6)}__`;
          jsxPlaceholders.set(placeholder, generateCode(prop.value));
          originalValues.set(prop, prop.value);
          prop.value = t.identifier(placeholder);
        }
      });
    });

    let nextValue = arrayExpressionToCode(
      objectItems.map(item => item.originalElement),
    );

    for (const [prop, original] of originalValues) {
      prop.value = original;
    }

    for (const [placeholder, code] of jsxPlaceholders) {
      // 두 번째 인자가 문자열이면 $&, $$ 같은 특수 치환 패턴으로 해석되어
      // code 안에 그런 문자가 있으면 결과가 깨진다 — 함수형 치환자로 방지.
      nextValue = nextValue.replace(placeholder, () => code);
    }

    onChange?.(nextValue);
  };

  const deleteSelectedItems = (indices: Set<number>) => {
    if (objectItems.length - indices.size < 1) {
      return;
    }

    const nextItems = removeIndices(objectItems, indices);
    const nextValue = arrayExpressionToCode(
      nextItems.map((item: ItemData) => item.originalElement),
    );

    onChange?.(nextValue);
  };

  const deleteItem = (index: number) => deleteSelectedItems(new Set([index]));

  const cloneObjectItemElement = (source: ItemData): t.ObjectExpression => {
    const clonedElement = clone(source.originalElement) as t.ObjectExpression;

    clonedElement.properties.forEach(prop => {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        const key = prop.key.name;
        const editableProp = source.editableProperties[key];

        if (key === 'key' && t.isStringLiteral(prop.value)) {
          const originalKey = prop.value.value;
          const uniqueKey = `${originalKey}-${nanoid(6)}`;
          prop.value = t.stringLiteral(uniqueKey);
          return;
        }

        if (editableProp) {
          const nextValue = createNodeFromValue(
            editableProp.type,
            editableProp.value,
          );

          if (nextValue) {
            prop.value = nextValue;
          }
        }
      }
    });

    return clonedElement;
  };

  const addItem = () => {
    const firstItem = objectItems[0];

    if (!firstItem) {
      return;
    }

    const clonedElement = cloneObjectItemElement(firstItem);
    const editableProperties = extractObjectProperties(clonedElement);

    const nextItems = [...objectItems];
    const newItemData: ItemData = {
      id: nanoid(6),
      index: nextItems.length,
      editableProperties,
      originalElement: clonedElement,
      jsxBindings: {},
    };

    nextItems.push(newItemData);

    const nextValue = arrayExpressionToCode(
      nextItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
  };

  const duplicateSelectedItems = (indices: Set<number>) => {
    const sources = [...indices]
      .sort((a, b) => a - b)
      .map(index => objectItems[index])
      .filter((item): item is ItemData => Boolean(item));

    if (sources.length === 0) {
      return;
    }

    const clonedElements = sources.map(cloneObjectItemElement);
    const nextValue = arrayExpressionToCode([
      ...objectItems.map(item => item.originalElement),
      ...clonedElements,
    ]);

    onChange?.(nextValue);
  };

  const moveSelectedItems = (
    indices: Set<number>,
    direction: 'up' | 'down',
  ) => {
    const { items: nextItems, indices: nextIndices } = moveSelectedIndices(
      objectItems,
      indices,
      direction,
    );

    selection.replace(nextIndices);

    const nextValue = arrayExpressionToCode(
      nextItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
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
                  onClick={() => movePrimitive(item.index, item.index - 1)}
                />
                <Button
                  size="small"
                  icon={<ArrowDown />}
                  disabled={i === primitiveItems.length - 1}
                  onClick={() => movePrimitive(item.index, item.index + 1)}
                />
                <Button
                  danger
                  size="small"
                  icon={<X />}
                  disabled={primitiveItems.length <= 1}
                  onClick={() => deletePrimitive(item.index)}
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
                onChange: next => updatePrimitive(item.index, next),
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
                onClick={() => moveItem(item.index, item.index - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                disabled={item.index === objectItems.length - 1}
                onClick={() => moveItem(item.index, item.index + 1)}
              />
              <Button
                danger
                size="small"
                icon={<X />}
                disabled={objectItems.length <= 1}
                onClick={() => deleteItem(item.index)}
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
                        updateProperty(item.index, key, parseValue(next)),
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
