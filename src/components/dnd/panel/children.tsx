import { useMemo } from 'react';

import { Button, Checkbox } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import { findEditableChildren } from '~/utils/ast/binding';
import { type DataAttrNode } from '~/utils/ast/types';

import type { PanelNodeChange } from '../dnd';
import BulkActionsBar from './bulk-actions-bar';
import Node from './node';
import { useDndChildren } from './use-dnd-children';

interface Props {
  value: DataAttrNode[];
  onChange?: (value: string) => void;
  onNodeChange?: PanelNodeChange;
}

const Children = ({ value, onChange, onNodeChange }: Props) => {
  const items = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const { selection, actions } = useDndChildren(items, { onChange });
  const messages = useLiveMessages();

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
          {messages.children.heading(items.length)}
        </div>
        <Button
          size="small"
          color="green"
          icon={<Plus />}
          onClick={actions.add}
        >
          {messages.children.add}
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
                {messages.children.child(
                  itemIndex + 1,
                  item.tagName || 'fragment',
                )}
              </div>
            </div>

            <div className="flex space-x-1">
              <Button
                size="small"
                icon={<ArrowUp />}
                aria-label={messages.children.moveUp}
                disabled={itemIndex === 0}
                onClick={() => actions.move(itemIndex, itemIndex - 1)}
              />
              <Button
                size="small"
                icon={<ArrowDown />}
                aria-label={messages.children.moveDown}
                disabled={itemIndex === items.length - 1}
                onClick={() => actions.move(itemIndex, itemIndex + 1)}
              />
              <Button
                aria-label={messages.children.delete}
                title={messages.children.delete}
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
                {messages.children.editableBindings}
              </div>
              {editableChildrenMap.get(itemIndex)!.map((editableNode, idx) => {
                const nodeId = editableNode.dataAttributes.find(
                  a => a.name === 'data-id',
                )?.value;

                return (
                  <div
                    key={`editable-${nodeId || idx}`}
                    data-node-id={nodeId}
                    className="rounded border border-green-100 bg-white p-2
                      data-[picked]:ring-2 data-[picked]:ring-blue-400"
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
                {messages.children.childNodes}
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
