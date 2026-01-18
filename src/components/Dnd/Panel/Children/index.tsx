import { useMemo } from 'react';

import { Button } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import { type DataAttrNode } from '~/utils/ast';

import Node from '../Node';

interface Props {
  value: DataAttrNode[];
  onChange?: (value: string) => void;
  onNodeChange?: (params: { id: string; label: string; value: string }) => void;
}

const Children = ({ value, onChange, onNodeChange }: Props) => {
  const items = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem!);

    onChange?.(JSON.stringify(nextItems));
  };

  const deleteItem = (index: number) => {
    if (items.length <= 1) {
      return;
    }

    const nextItems = items.filter((_, i) => i !== index);
    onChange?.(JSON.stringify(nextItems));
  };

  const addItem = () => {
    const template = items[0] || createDefaultItem();
    const newItem = cloneDataAttrNode(template);

    const nextItems = [...items, newItem];
    onChange?.(JSON.stringify(nextItems));
  };

  const createDefaultItem = (): DataAttrNode => ({
    id: nanoid(6),
    tagName: 'div',
    attributes: [
      { name: 'data-id', value: nanoid(6) },
      { name: 'data-item', value: 'true' },
    ],
    dataAttributes: [
      { name: 'data-id', value: nanoid(6) },
      { name: 'data-item', value: 'true' },
    ],
    textContent: '',
    children: [],
  });

  const cloneDataAttrNode = (node: DataAttrNode): DataAttrNode => ({
    id: nanoid(6),
    tagName: node.tagName,
    textContent: node.textContent,
    attributes: node.attributes.map(attr => ({
      ...attr,
      value: attr.name === 'data-id' ? nanoid(6) : attr.value,
    })),
    dataAttributes: node.dataAttributes.map(attr => ({
      ...attr,
      value: attr.name === 'data-id' ? nanoid(6) : attr.value,
    })),
    children: node.children?.map(cloneDataAttrNode),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-green-700">
          Children Items ({items.length})
        </div>
        <Button size="small" color="green" icon={<Plus />} onClick={addItem}>
          Add Child
        </Button>
      </div>
      {items.map((item, itemIndex) => (
        <div
          key={item.id || itemIndex}
          className="space-y-2 rounded border border-green-200 bg-green-50 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-green-800">
              Child {itemIndex + 1} ({item.tagName || 'fragment'})
            </div>

            <div className="flex space-x-1">
              <Button
                size="small"
                icon={<ArrowUp />}
                disabled={itemIndex === 0}
                onClick={() => moveItem(itemIndex, itemIndex - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                disabled={itemIndex === items.length - 1}
                onClick={() => moveItem(itemIndex, itemIndex + 1)}
              />
              <Button
                title={
                  items.length <= 1
                    ? 'At least 1 item is required'
                    : 'Delete item'
                }
                danger
                size="small"
                icon={<X />}
                disabled={items.length <= 1}
                onClick={() => deleteItem(itemIndex)}
              />
            </div>
          </div>
          {!!item.children && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-green-700">
                Child Nodes:
              </div>
              {item.children.map((node, nodeIndex) => (
                <div
                  key={`node-${itemIndex}-${nodeIndex}`}
                  className="ml-2 rounded border border-green-100 bg-white p-2"
                >
                  <Node data={node} onChange={onNodeChange} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Children;
