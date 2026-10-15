import { Button } from '@jbpark/ui-kit';
import { Plus } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import type { BindingRenderMap } from '~/utils/ast/types';

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
      <div className="space-y-2">
        <div className="text-xs font-medium text-blue-700">
          {group.property}
        </div>
        <Field binding={group.fallback} onNodeChange={onNodeChange} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-blue-700">
        {group.property} Bindings ({group.elements.length}):
      </div>
      {group.elements.map(element => (
        <ElementFields
          key={`${group.property}-${element.id}`}
          id={element.id}
          className="rounded border border-blue-100 bg-blue-50 p-2
            data-[picked]:ring-2 data-[picked]:ring-blue-400"
          header={
            <div className="mb-1 text-xs text-blue-600">
              &lt;{element.tagName}&gt;
            </div>
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
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold">
        {messages.items.heading(items.length)}
      </div>
      {/* Add copies an existing item, so it is offered only once there is
          one to copy — see the empty-list notice below (#316). */}
      {items.length > 0 && canEditStructure && (
        <Button
          size="small"
          icon={<Plus />}
          variant="solid"
          color="green"
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
      <div className="space-y-4">
        {header}
        <div
          className="rounded border border-dashed border-red-200 p-3 text-xs
            text-red-600"
        >
          {messages.items.unreadable}
        </div>
      </div>
    );
  }

  // No items to copy a shape from. The editor never empties an array, so
  // the source itself has `[]`, or only holes and spreads.
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div
          className="rounded border border-dashed border-gray-200 p-3 text-xs
            text-gray-500"
        >
          {messages.items.empty}
        </div>
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
      <div className="space-y-2">
        {item.properties.map(binding => (
          <div key={`${item.id}-${binding.property}-${binding.label}`}>
            <div className="flex flex-col space-y-2">
              <LabeledField
                binding={binding}
                labelClassName="w-20 shrink-0 text-xs font-medium"
                label={binding.label}
              >
                <Field binding={binding} onNodeChange={onChildChange} />
              </LabeledField>
            </div>
            <span className="text-right text-xs text-gray-500">
              ({String(binding.meta?.valueType)})
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t pt-2">
        {item.nested.length ? (
          item.nested.map(group => (
            <NestedGroup
              key={group.property}
              group={group}
              onNodeChange={onChildChange}
            />
          ))
        ) : (
          <div className="text-xs text-gray-500">
            <span aria-hidden="true">✓</span> {messages.items.noNestedBindings}
          </div>
        )}
      </div>
    </>
  );

  const allExpanded = expansion.expandedIds.length === items.length;

  return (
    <div className="space-y-4">
      {header}

      <div className="flex items-center justify-between">
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
        <div
          className="rounded border border-dashed border-amber-200 p-3 text-xs
            text-amber-700"
        >
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
            className={
              kind === 'primitive'
                ? 'space-y-2 rounded border border-gray-100 bg-gray-50 p-2'
                : 'space-y-3 rounded border bg-gray-50 p-3'
            }
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
