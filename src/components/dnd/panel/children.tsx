import { useMemo } from 'react';

import { Button, Checkbox } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import { type DataAttrNode, findEditableChildren } from '~/utils/ast';

import { BulkActionsBar } from './items';
import Node from './node';
import {
  moveSelectedIndices,
  removeIndices,
  useMultiSelect,
} from './selection';

interface Props {
  value: DataAttrNode[];
  onChange?: (value: string) => void;
  onNodeChange?: (params: { id: string; label: string; value: string }) => void;
}

const Children = ({ value, onChange, onNodeChange }: Props) => {
  const items = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const selection = useMultiSelect(items.length);

  const editableChildrenMap = useMemo(() => {
    const map = new Map<number, DataAttrNode[]>();
    items.forEach((item, index) => {
      const editableNodes = findEditableChildren(item);
      if (editableNodes.length > 0) {
        map.set(index, editableNodes);
      }
    });
    return map;
  }, [items]);

  const moveItem = (fromIndex: number, toIndex: number) => {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem!);

    onChange?.(JSON.stringify(nextItems));
  };

  const moveSelectedItems = (
    indices: Set<number>,
    direction: 'up' | 'down',
  ) => {
    const { items: nextItems, indices: nextIndices } = moveSelectedIndices(
      items,
      indices,
      direction,
    );

    selection.replace(nextIndices);
    onChange?.(JSON.stringify(nextItems));
  };

  const deleteSelectedItems = (indices: Set<number>) => {
    if (items.length - indices.size < 1) {
      return;
    }

    const nextItems = removeIndices(items, indices);
    onChange?.(JSON.stringify(nextItems));
  };

  const deleteItem = (index: number) => deleteSelectedItems(new Set([index]));

  const addItem = () => {
    const template = items[0] || createDefaultItem();
    const newItem = cloneDataAttrNode(template);

    const nextItems = [...items, newItem];
    onChange?.(JSON.stringify(nextItems));
  };

  const duplicateSelectedItems = (indices: Set<number>) => {
    const sources = [...indices]
      .sort((a, b) => a - b)
      .map(index => items[index])
      .filter((item): item is DataAttrNode => Boolean(item));

    if (sources.length === 0) {
      return;
    }

    const clones = sources.map(cloneDataAttrNode);
    onChange?.(JSON.stringify([...items, ...clones]));
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
    ...node,
    id: nanoid(6),
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

      {items.map((item, itemIndex) => (
        <div
          key={item.id || itemIndex}
          className="space-y-2 rounded border border-green-200 bg-green-50 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                onClick={e => selection.toggle(itemIndex, e.shiftKey)}
                className="inline-flex"
              >
                <Checkbox
                  checked={selection.isSelected(itemIndex)}
                  onChange={() => {}}
                />
              </div>
              <div className="text-xs font-medium text-green-800">
                Child {itemIndex + 1} ({item.tagName || 'fragment'})
              </div>
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

          {editableChildrenMap.has(itemIndex) && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-green-700">
                Editable Bindings:
              </div>
              {editableChildrenMap.get(itemIndex)!.map((editableNode, idx) => {
                const nodeId = editableNode.dataAttributes.find(
                  a => a.name === 'data-id',
                )?.value;

                return (
                  <div
                    key={`editable-${itemIndex}-${nodeId || idx}`}
                    className="rounded border border-green-100 bg-white p-2"
                  >
                    <div className="mb-1 text-xs text-green-600">
                      {editableNode.tagName}
                    </div>
                    <Node data={editableNode} onChange={onNodeChange} />
                  </div>
                );
              })}
            </div>
          )}

          {!!item.children && !editableChildrenMap.has(itemIndex) && (
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
