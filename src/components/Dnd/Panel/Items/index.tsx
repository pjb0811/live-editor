import { useMemo } from 'react';

import * as t from '@babel/types';
import { Button, Input } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import {
  type DataAttrNode,
  type ExtractedNodeValue,
  arrayExpressionToCode,
  clone,
  createNodeFromValue,
  extract,
  extractObjectProperties,
  findEditableChildren,
  generateCode,
  parseArrayExpression,
} from '~/utils/ast';

import Node from '../Node';

interface ItemProperty extends ExtractedNodeValue {
  astNode: t.Node;
}

interface ItemData {
  index: number;
  editableProperties: Record<string, ItemProperty>;
  originalElement: t.ObjectExpression;
  childrenBindings: DataAttrNode[];
}

interface Props {
  value: string;
  onChange?: (value: string) => void;
  onChildChange?: (params: {
    id: string;
    label: string;
    value: string;
  }) => void;
}

const Items = ({ value, onChange, onChildChange }: Props) => {
  const extractedItems = useMemo(() => {
    const ast = parseArrayExpression(value);

    if (!ast) {
      return [];
    }

    return ast.elements
      .map((element, itemIndex) => {
        if (!t.isObjectExpression(element)) {
          return null;
        }

        const childrenBindings: DataAttrNode[] = [];
        const childrenProp = element.properties.find(
          prop =>
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            prop.key.name === 'children',
        ) as t.ObjectProperty | undefined;

        if (childrenProp && t.isJSXElement(childrenProp.value)) {
          try {
            const jsxCode = generateCode(childrenProp.value);
            const nodes = extract(jsxCode);

            const childrenContainer = nodes.find(node =>
              node.bindings?.some(b => b.property === 'children'),
            );

            if (childrenContainer) {
              childrenBindings.push(childrenContainer);
            } else {
              nodes.forEach(node => {
                if (
                  node.bindings &&
                  node.bindings.length > 0 &&
                  node.dataAttributes.some(a => a.name === 'data-id')
                ) {
                  childrenBindings.push(node);
                }
                const editableChildren = findEditableChildren(node);
                childrenBindings.push(...editableChildren);
              });
            }
          } catch (error) {
            console.error('Failed to parse children JSX:', error);
          }
        }

        const itemData: ItemData = {
          index: itemIndex,
          editableProperties: extractObjectProperties(element),
          originalElement: element,
          childrenBindings,
        };

        return itemData;
      })
      .filter(Boolean) as ItemData[];
  }, [value]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    const nextItems = [...extractedItems];
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
    const item = extractedItems[itemIndex]!;
    const property = item.editableProperties[propertyKey]!;

    const nextAstValue = createNodeFromValue(property.type, value);

    if (!nextAstValue) {
      return;
    }

    const objectExpression = item.originalElement;
    const targetProperty = objectExpression.properties.find(
      prop =>
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === propertyKey,
    ) as t.ObjectProperty;

    if (targetProperty) {
      targetProperty.value = nextAstValue;
    }

    const nextValue = arrayExpressionToCode(
      extractedItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
  };

  const deleteItem = (index: number) => {
    if (extractedItems.length <= 1) {
      return;
    }

    const nextItems = extractedItems.filter((_, i) => i !== index);
    const nextValue = arrayExpressionToCode(
      nextItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
  };

  const addItem = () => {
    const firstItem = extractedItems[0]!;

    const clonedElement = clone(
      firstItem.originalElement,
    ) as t.ObjectExpression;

    clonedElement.properties.forEach(prop => {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
        const key = prop.key.name;
        const editableProp = firstItem.editableProperties[key];

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

    const editableProperties = extractObjectProperties(clonedElement);

    const nextItems = [...extractedItems];
    const newItemData: ItemData = {
      index: nextItems.length,
      editableProperties,
      originalElement: clonedElement,
      childrenBindings: [],
    };

    nextItems.push(newItemData);

    const nextValue = arrayExpressionToCode(
      nextItems.map(item => item.originalElement),
    );

    onChange?.(nextValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Items ({extractedItems.length})
        </div>
        <Button size="small" icon={<Plus />} color="green" onClick={addItem}>
          Add Item
        </Button>
      </div>

      {extractedItems.map((item, index) => (
        <div key={index} className="space-y-3 rounded border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Item {index + 1}</div>
            <div className="flex space-x-1">
              <Button
                size="small"
                icon={<ArrowUp />}
                disabled={index === 0}
                onClick={() => moveItem(index, index - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                disabled={index === extractedItems.length - 1}
                onClick={() => moveItem(index, index + 1)}
              />
              <Button
                title={
                  extractedItems.length <= 1
                    ? 'At least 1 item is required'
                    : 'Delete item'
                }
                danger
                size="small"
                icon={<X />}
                disabled={extractedItems.length <= 1}
                onClick={() => deleteItem(index)}
              />
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(item.editableProperties).map(([key, prop]) => (
              <div key={`${index}-${key}`}>
                <div className="flex items-center space-x-2">
                  <label className="w-20 shrink-0 text-xs font-medium">
                    {key}:
                  </label>
                  {prop.type === 'boolean' && (
                    <input
                      type="checkbox"
                      checked={Boolean(prop.value)}
                      onChange={e =>
                        updateProperty(index, key, e.target.checked)
                      }
                    />
                  )}
                  {(prop.type === 'string' || prop.type === 'number') && (
                    <Input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      value={String(prop.value)}
                      onChange={e => updateProperty(index, key, e.target.value)}
                    />
                  )}
                </div>
                <span className="text-right text-xs text-gray-500">
                  ({prop.type})
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2">
            {item.childrenBindings.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-blue-700">
                  Children Bindings ({item.childrenBindings.length}):
                </div>
                {item.childrenBindings.map((bindingNode, idx) => {
                  const nodeId = bindingNode.dataAttributes.find(
                    a => a.name === 'data-id',
                  )?.value;

                  return (
                    <div
                      key={`binding-${index}-${nodeId || idx}`}
                      className="rounded border border-blue-100 bg-blue-50 p-2"
                    >
                      <div className="mb-1 text-xs text-blue-600">
                        &lt;{bindingNode.tagName || 'element'}&gt;
                      </div>
                      <Node data={bindingNode} onChange={onChildChange} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                ✓ children: JSX content (no bindings)
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Items;
