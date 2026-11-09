import { Plus } from 'lucide-react';

import Button from '~/components/chrome/button';
import { useLiveMessages } from '~/components/context/messages';
import type { BindingRenderMap } from '~/utils/ast/types';
import { cn } from '~/utils/cn';

import styles from '../structure.module.css';

import type { PanelNodeChange } from '../../panel-binding';
import ElementFields from '../element-fields';
import Field from '../field';
import LabeledField from '../fields/labeled-field';
import RowControls from '../row-controls';
import BulkActionsBar from '../selection/bulk-actions-bar';
import SelectAllCheckbox from '../selection/select-all-checkbox';
import SelectionCheckbox from '../selection/selection-checkbox';
import { ItemCard, SortableItems } from './sortable-items';
import {
  type DndItemsItem,
  type DndItemsNestedGroup,
  useDndItems,
} from './use-dnd-items';

interface Props {
  value: string;
  render?: BindingRenderMap;
  minItems?: number;
  maxItems?: number;
  onChange?: (value: string) => void;
  onChildChange?: PanelNodeChange;
}

// The data-bound elements found inside one JSX-valued property, or the
// raw-source fallback when that property declared no binding at all (#298).
const NestedGroup = ({
  group,
  onNodeChange,
}: {
  group: DndItemsNestedGroup;
  onNodeChange?: PanelNodeChange;
}) => {
  if (group.fallback) {
    return (
      <div className={styles.stack}>
        <div className={styles.label}>{group.property}</div>
        <Field binding={group.fallback} onNodeChange={onNodeChange} />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.label}>
        {group.property} Bindings ({group.elements.length}):
      </div>
      {group.elements.map(element => (
        <ElementFields
          key={`${group.property}-${element.id}`}
          id={element.id}
          className={styles.element}
          header={
            <div className={styles.elementTag}>&lt;{element.tagName}&gt;</div>
          }
          bindings={element.bindings}
          onNodeChange={onNodeChange}
        />
      ))}
    </div>
  );
};

// The built-in Items editor: markup over `useDndItems`, which does all the
// reading and writing.
const Items = ({
  value,
  render,
  minItems,
  maxItems,
  onChange,
  onChildChange,
}: Props) => {
  const messages = useLiveMessages();
  const {
    kind,
    items,
    selection,
    expansion,
    actions,
    canEditStructure,
    canAddItems,
    canRemoveItems,
    parseError,
  } = useDndItems(value, {
    render,
    onChange,
    onNodeChange: onChildChange,
    minItems,
    maxItems,
  });

  const header = (
    <div className={styles.row}>
      <div className={styles.heading}>
        {messages.items.heading(items.length)}
      </div>
      {/* Add copies an existing item, so it is offered only once there is
          one to copy — see the empty-list notice below (#316). */}
      {items.length > 0 && canEditStructure && (
        <Button
          size="small"
          icon={<Plus />}
          variant="solid"
          tone="success"
          disabled={!canAddItems()}
          onClick={actions.add}
        >
          {messages.items.add}
        </Button>
      )}
    </div>
  );

  if (parseError) {
    return (
      <div className={cn(styles.items, styles.stackLoose)}>
        {header}
        <div className={styles.noticeDanger}>{messages.items.unreadable}</div>
      </div>
    );
  }

  // No items to copy a shape from. The editor never empties an array, so
  // the source itself has `[]`, or only holes and spreads.
  if (items.length === 0) {
    return (
      <div className={cn(styles.items, styles.stackLoose)}>
        {header}
        <div className={styles.notice}>{messages.items.empty}</div>
      </div>
    );
  }

  const bulkBar = (
    <BulkActionsBar
      count={selection.selected.size}
      disabled={!canEditStructure}
      duplicateDisabled={!canAddItems(selection.selected.size)}
      deleteDisabled={!canRemoveItems(selection.selected.size)}
      onDuplicate={actions.duplicateSelected}
      onMoveUp={() => actions.moveSelected('up')}
      onMoveDown={() => actions.moveSelected('down')}
      onDelete={actions.removeSelected}
      onClear={selection.clear}
    />
  );

  const objectBody = (item: DndItemsItem) => (
    <>
      <div className={styles.stack}>
        {item.properties.map(binding => (
          <div key={`${item.id}-${binding.property}-${binding.label}`}>
            <div className={styles.stack}>
              <LabeledField
                binding={binding}
                labelClassName={styles.propertyLabel}
                label={binding.label}
              >
                <Field binding={binding} onNodeChange={onChildChange} />
              </LabeledField>
            </div>
            <span className={styles.valueType}>
              ({String(binding.meta?.valueType)})
            </span>
          </div>
        ))}
      </div>
      <div className={styles.nested}>
        {item.nested.length ? (
          item.nested.map(group => (
            <NestedGroup
              key={group.property}
              group={group}
              onNodeChange={onChildChange}
            />
          ))
        ) : (
          <div className={styles.muted}>
            <span aria-hidden="true">✓</span> {messages.items.noNestedBindings}
          </div>
        )}
      </div>
    </>
  );

  const allExpanded = expansion.expandedIds.length === items.length;

  return (
    <div className={cn(styles.items, styles.stackLoose)}>
      {header}

      <div className={styles.row}>
        <SelectAllCheckbox
          total={items.length}
          selected={selection.selected.size}
          disabled={!canEditStructure}
          onSelectAll={() =>
            selection.replace(new Set(items.map(item => item.index)))
          }
          onClear={selection.clear}
        />
        {items.length > 1 && (
          <Button
            size="small"
            variant="text"
            onClick={() =>
              expansion.setExpanded(
                allExpanded ? [] : items.map(item => item.id),
              )
            }
          >
            {allExpanded
              ? messages.items.collapseAll
              : messages.items.expandAll}
          </Button>
        )}
      </div>

      {bulkBar}

      {!canEditStructure && (
        <div className={styles.noticeWarning}>
          {messages.items.structureLocked}
        </div>
      )}

      <SortableItems
        items={items}
        disabled={!canEditStructure}
        onMove={(item, toIndex) => actions.move(item.elementIndex, toIndex)}
      >
        {item => (
          <ItemCard
            key={item.id}
            id={item.id}
            title={messages.items.item(item.index + 1)}
            disabled={!canEditStructure}
            expanded={expansion.isExpanded(item.id)}
            onToggle={() => expansion.toggle(item.id)}
            checkbox={
              <SelectionCheckbox
                checked={selection.isSelected(item.index)}
                disabled={!canEditStructure}
                onToggle={shiftKey => selection.toggle(item.index, shiftKey)}
              />
            }
            controls={
              <RowControls
                index={item.index}
                count={items.length}
                labels={messages.items}
                disabled={!canEditStructure}
                deleteDisabled={!canRemoveItems()}
                onMove={toIndex => actions.move(item.elementIndex, toIndex)}
                onDelete={() => actions.remove(item.elementIndex)}
              />
            }
            className={cn(
              styles.card,
              kind === 'primitive' && styles.cardCompact,
            )}
          >
            {kind === 'primitive' ? (
              <Field binding={item.value!} onNodeChange={onChildChange} />
            ) : (
              objectBody(item)
            )}
          </ItemCard>
        )}
      </SortableItems>
    </div>
  );
};

export default Items;
