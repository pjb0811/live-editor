import { useMemo } from 'react';

import { Plus } from 'lucide-react';

import Button from '~/components/chrome/button';
import { useLiveMessages } from '~/components/context/messages';
import { findEditableChildren } from '~/utils/ast/binding';
import { type DataAttrNode } from '~/utils/ast/types';
import { cn } from '~/utils/cn';

import styles from '../structure.module.css';

import {
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../../panel-binding';
import ElementFields from '../element-fields';
import RowControls from '../row-controls';
import BulkActionsBar from '../selection/bulk-actions-bar';
import SelectAllCheckbox from '../selection/select-all-checkbox';
import SelectionCheckbox from '../selection/selection-checkbox';
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
    <div className={cn(styles.children, styles.stackLoose)}>
      <div className={styles.row}>
        <div className={styles.heading}>
          {messages.children.heading(items.length)}
        </div>
        <Button
          size="small"
          tone="success"
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
        <div key={item.id || itemIndex} className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowStart}>
              <SelectionCheckbox
                checked={selection.isSelected(itemIndex)}
                onToggle={shiftKey => selection.toggle(itemIndex, shiftKey)}
              />
              <div className={styles.label}>
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
            <div className={styles.stack}>
              <div className={styles.label}>
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
                    className={styles.element}
                    header={
                      <div className={styles.elementTag}>
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
            <div className={styles.stackTight}>
              <div className={styles.label}>{messages.children.childNodes}</div>
              {item.children.map((node, nodeIndex) => (
                <ElementFields
                  key={`node-${itemIndex}-${nodeIndex}`}
                  className={cn(styles.element, styles.indented)}
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
