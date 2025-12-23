import { useMemo } from 'react';

import generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { cn } from '~/utils';
import { clone } from '~/utils/ast';

interface ItemProperty {
  type:
    | 'boolean'
    | 'number'
    | 'string'
    | 'null'
    | 'array'
    | 'object'
    | 'unknown';
  value: string | number | readonly string[] | undefined | boolean | null;
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
    try {
      const ast = parseExpression(value, {
        plugins: ['jsx', 'typescript'],
      });

      if (!t.isArrayExpression(ast)) {
        return [];
      }

      return ast.elements
        .map((element, itemIndex) => {
          if (!t.isObjectExpression(element)) {
            return null;
          }

          const itemData: ItemData = {
            index: itemIndex,
            editableProperties: {},
            originalElement: element,
          };

          element.properties.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              const key = prop.key.name;

              // children는 제외하고 편집 가능한 속성들만 처리
              if (key !== 'children') {
                let propertyType: ItemProperty['type'] = 'unknown';
                let propertyValue: ItemProperty['value'] = null;

                // 데이터 타입 동적 감지
                if (t.isBooleanLiteral(prop.value)) {
                  propertyType = 'boolean';
                  propertyValue = prop.value.value;
                } else if (t.isNumericLiteral(prop.value)) {
                  propertyType = 'number';
                  propertyValue = prop.value.value;
                } else if (t.isStringLiteral(prop.value)) {
                  propertyType = 'string';
                  propertyValue = prop.value.value;
                } else if (t.isNullLiteral(prop.value)) {
                  propertyType = 'null';
                  propertyValue = null;
                } else if (t.isArrayExpression(prop.value)) {
                  propertyType = 'array';
                  propertyValue = generate(prop.value).code;
                } else if (t.isObjectExpression(prop.value)) {
                  propertyType = 'object';
                  propertyValue = generate(prop.value).code;
                }

                itemData.editableProperties[key] = {
                  type: propertyType,
                  value: propertyValue,
                  astNode: prop.value,
                };
              }
            }
          });

          return itemData;
        })
        .filter(Boolean) as ItemData[];
    } catch (error) {
      console.error('Items 파싱 에러:', error);
      return [];
    }
  }, [value]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    const nextItems = [...extractedItems];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem!);

    const nextAst = t.arrayExpression(
      nextItems.map(item => item.originalElement),
    );
    const nextValue = generate(nextAst).code;

    onChange?.(nextValue);
  };

  const updateProperty = (
    itemIndex: number,
    propertyKey: string,
    value: unknown,
  ) => {
    const item = extractedItems[itemIndex]!;
    const property = item.editableProperties[propertyKey]!;

    let nextAstValue: t.Expression;
    switch (property.type) {
      case 'boolean':
        nextAstValue = t.booleanLiteral(value === true);
        break;
      case 'number':
        nextAstValue = t.numericLiteral(Number(value));
        break;
      case 'string':
        nextAstValue = t.stringLiteral(String(value));
        break;
      default:
        return; // 지원하지 않는 타입
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

    const nextAst = t.arrayExpression(
      extractedItems.map(item => item.originalElement),
    );
    const nextValue = generate(nextAst).code;

    onChange?.(nextValue);
  };

  const deleteItem = (index: number) => {
    if (extractedItems.length <= 1) {
      return;
    }

    const nextItems = extractedItems.filter((_, i) => i !== index);
    const nextAst = t.arrayExpression(
      nextItems.map(item => item.originalElement),
    );
    const nextValue = generate(nextAst).code;

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
          switch (editableProp.type) {
            case 'boolean':
              prop.value = t.booleanLiteral(Boolean(editableProp.value));
              break;
            case 'number':
              prop.value = t.numericLiteral(Number(editableProp.value));
              break;
            case 'string':
              prop.value = t.stringLiteral(String(editableProp.value));
              break;
          }
        }
      }
    });

    const editableProperties = Object.entries(
      firstItem.editableProperties,
    ).reduce(
      (acc, [key, prop]) => {
        const propertyNode = (
          clonedElement as t.ObjectExpression
        ).properties.find(
          objProp =>
            t.isObjectProperty(objProp) &&
            t.isIdentifier(objProp.key) &&
            objProp.key.name === key,
        ) as t.ObjectProperty;

        acc[key] = {
          type: prop.type,
          value: prop.value,
          astNode: propertyNode?.value || t.nullLiteral(),
        };

        return acc;
      },
      {} as Record<string, ItemProperty>,
    );

    const nextItems = [...extractedItems];
    const newItemData: ItemData = {
      index: nextItems.length,
      editableProperties,
      originalElement: clonedElement as t.ObjectExpression,
    };

    nextItems.push(newItemData);

    const nextAst = t.arrayExpression(
      nextItems.map(item => item.originalElement),
    );
    const nextValue = generate(nextAst).code;

    onChange?.(nextValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Items ({extractedItems.length})
        </div>
        <button
          className="rounded bg-blue-500 px-2 py-1 text-xs text-white
            hover:bg-blue-600"
          onClick={addItem}
        >
          + Add Item
        </button>
      </div>

      {extractedItems.map((item, index) => (
        <div key={index} className="space-y-3 rounded border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Item {index + 1}</div>
            <div className="flex space-x-1">
              <button
                title="Move up"
                className={cn(
                  'rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300',
                  'disabled:opacity-50',
                )}
                disabled={index === 0}
                onClick={() => moveItem(index, index - 1)}
              >
                ↑
              </button>
              <button
                title="Move down"
                className={cn(
                  'rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300',
                  'disabled:opacity-50',
                )}
                disabled={index === extractedItems.length - 1}
                onClick={() => moveItem(index, index + 1)}
              >
                ↓
              </button>
              <button
                title={
                  extractedItems.length <= 1
                    ? '최소 1개 아이템은 필요합니다'
                    : 'Delete item'
                }
                className={cn(
                  `rounded bg-red-500 px-2 py-1 text-xs text-white
                  hover:bg-red-600`,
                  'disabled:opacity-50',
                )}
                disabled={extractedItems.length <= 1}
                onClick={() => deleteItem(index)}
              >
                ×
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(item.editableProperties).map(([key, prop]) => (
              <div key={key} className="flex items-center space-x-2">
                <label className="w-20 flex-shrink-0 text-xs font-medium">
                  {key}:
                </label>

                {prop.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={Boolean(prop.value)}
                    onChange={e => updateProperty(index, key, e.target.checked)}
                  />
                )}

                {prop.type === 'number' && (
                  <input
                    type="number"
                    className="w-20 rounded border px-2 py-1 text-xs
                      focus:border-blue-500 focus:outline-none"
                    defaultValue={prop.value as number}
                    onBlur={e => updateProperty(index, key, e.target.value)}
                  />
                )}
                {prop.type === 'string' && (
                  <input
                    type="text"
                    className="flex-1 rounded border px-2 py-1 text-xs
                      focus:border-blue-500 focus:outline-none"
                    defaultValue={prop.value as string}
                    onBlur={e => updateProperty(index, key, e.target.value)}
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
