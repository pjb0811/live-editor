import { useMemo } from 'react';

import * as t from '@babel/types';
import { Button, Input } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import {
  type ExtractedNodeValue,
  arrayExpressionToCode,
  clone,
  createNodeFromValue,
  extractObjectProperties,
  parseArrayExpression,
} from '~/utils/ast';

interface ItemProperty extends ExtractedNodeValue {
  astNode: t.Node;
}

interface ItemData {
  index: number;
  editableProperties: Record<string, ItemProperty>;
  originalElement: t.ObjectExpression;
}

interface Props {
  value: string;
  onChange?: (value: string) => void;
}

const Items = ({ value, onChange }: Props) => {
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

        const itemData: ItemData = {
          index: itemIndex,
          editableProperties: extractObjectProperties(element),
          originalElement: element,
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
                    ? '최소 1개 아이템은 필요합니다'
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
              <div
                key={`${index}-${key}`}
                className="flex items-center space-x-2"
              >
                <label className="w-20 shrink-0 text-xs font-medium">
                  {key}:
                </label>
                {prop.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={Boolean(prop.value)}
                    onChange={e => updateProperty(index, key, e.target.checked)}
                  />
                )}
                {(prop.type === 'string' || prop.type === 'number') && (
                  <Input
                    type={prop.type === 'number' ? 'number' : 'text'}
                    value={String(prop.value)}
                    onChange={e => updateProperty(index, key, e.target.value)}
                  />
                )}
                <span className="text-xs text-gray-500">({prop.type})</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 text-xs text-gray-500">
            ✓ children: JSX content (read-only)
          </div>
        </div>
      ))}
    </div>
  );
};

export default Items;
