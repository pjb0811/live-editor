import { useMemo } from 'react';

import { Button, Checkbox } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import { type DataAttrNode, findEditableChildren } from '~/utils/ast';

import type { PanelNodeChange } from '../dnd';
import BulkActionsBar from './bulk-actions-bar';
import Node from './node';
import { useChildrenEditor } from './use-children-editor';

interface Props {
  value: DataAttrNode[];
  onChange?: (value: string) => void;
  onNodeChange?: PanelNodeChange;
}

const Children = ({ value, onChange, onNodeChange }: Props) => {
  const items = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const { selection, actions } = useChildrenEditor(items, { onChange });

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-green-700">
          Children Items ({items.length})
        </div>
        <Button
          size="small"
          color="green"
          icon={<Plus />}
          onClick={actions.add}
        >
          Add Child
        </Button>
      </div>

      <BulkActionsBar
        count={selection.selected.size}
        onDuplicate={actions.duplicateSelected}
        onMoveUp={() => actions.moveSelected('up')}
        onMoveDown={() => actions.moveSelected('down')}
        onDelete={actions.removeSelected}
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
                onClick={() => actions.move(itemIndex, itemIndex - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                disabled={itemIndex === items.length - 1}
                onClick={() => actions.move(itemIndex, itemIndex + 1)}
              />
              <Button
                title="Delete item"
                danger
                size="small"
                icon={<X />}
                onClick={() => actions.remove(itemIndex)}
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
                    key={`editable-${nodeId || idx}`}
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
