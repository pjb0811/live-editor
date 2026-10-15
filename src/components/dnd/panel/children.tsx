import { useMemo } from 'react';

import { Button } from '@jbpark/ui-kit';
import { Plus } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import { findEditableChildren } from '~/utils/ast/binding';
import { type DataAttrNode } from '~/utils/ast/types';

import {
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../panel-binding';
import BulkActionsBar from './bulk-actions-bar';
import ElementFields from './element-fields';
import RowControls from './row-controls';
import SelectAllCheckbox from './select-all-checkbox';
import SelectionCheckbox from './selection-checkbox';
import { useDndChildren } from './use-dnd-children';

// A child node's bindings, committing through `onChange` by its own
// `data-id`. Empty for a node with nothing bound.
const bindingsOf = (node: DataAttrNode, onChange?: PanelNodeChange) => {
  const source = resolvePanelBindings(node);

  return source ? withPanelCommit(source.bindings, onChange) : [];
};

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

      {items.length > 0 && (
        <SelectAllCheckbox
          total={items.length}
          selected={selection.selected.size}
          onSelectAll={() =>
            selection.replace(new Set(items.map((_, index) => index)))
          }
          onClear={selection.clear}
        />
      )}

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
              <SelectionCheckbox
                checked={selection.isSelected(itemIndex)}
                onToggle={shiftKey => selection.toggle(itemIndex, shiftKey)}
              />
              <div className="text-xs font-medium text-green-800">
                {messages.children.child(
                  itemIndex + 1,
                  item.tagName || 'fragment',
                )}
              </div>
            </div>

            <RowControls
              index={itemIndex}
              count={items.length}
              labels={messages.children}
              onMove={toIndex => actions.move(itemIndex, toIndex)}
              onDelete={() => actions.remove(itemIndex)}
            />
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
                  <ElementFields
                    key={`editable-${nodeId || idx}`}
                    id={nodeId ?? undefined}
                    className="rounded border border-green-100 bg-white p-2
                      data-[picked]:ring-2 data-[picked]:ring-blue-400"
                    header={
                      <div className="mb-1 text-xs text-green-600">
                        {editableNode.tagName}
                      </div>
                    }
                    bindings={bindingsOf(editableNode, onNodeChange)}
                    onNodeChange={onNodeChange}
                  />
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
                <ElementFields
                  key={`node-${itemIndex}-${nodeIndex}`}
                  className="ml-2 rounded border border-green-100 bg-white p-2"
                  bindings={bindingsOf(node, onNodeChange)}
                  onNodeChange={onNodeChange}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Children;
