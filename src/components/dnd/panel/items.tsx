import { Button, Checkbox } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import type { BindingRenderMap } from '~/utils/ast';

import type { PanelNodeChange } from '../dnd';
import BulkActionsBar from './bulk-actions-bar';
import Field from './field';
import {
  type ItemsEditorNestedGroup,
  useItemsEditor,
} from './use-items-editor';

interface Props {
  value: string;
  render?: BindingRenderMap;
  onChange?: (value: string) => void;
  onChildChange?: PanelNodeChange;
}

// The data-bound elements found inside one JSX-valued property, or the
// raw-source fallback when that property declared no binding at all (#298).
const NestedGroup = ({
  group,
  onNodeChange,
}: {
  group: ItemsEditorNestedGroup;
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
        <div
          key={`${group.property}-${element.id}`}
          className="rounded border border-blue-100 bg-blue-50 p-2"
        >
          <div className="mb-1 text-xs text-blue-600">
            &lt;{element.tagName}&gt;
          </div>
          <div className="space-y-2 rounded">
            <div className="space-y-1">
              {element.bindings.map(binding => (
                <div
                  key={`${binding.property}-${binding.label}`}
                  className="space-y-1"
                >
                  <label className="block text-xs font-semibold text-gray-700">
                    {binding.label}
                    <span className="ml-1 text-gray-400">
                      ({binding.property})
                    </span>
                  </label>
                  <Field binding={binding} onNodeChange={onNodeChange} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Presentation for `useItemsEditor`. Everything that reads or writes the
// array source lives in that hook, which is exported so a consumer can put
// their own markup over the same engine — see its doc comment (#237/#308).
const Items = ({ value, render, onChange, onChildChange }: Props) => {
  const { kind, items, selection, actions, parseError } = useItemsEditor(
    value,
    {
      render,
      onChange,
      onNodeChange: onChildChange,
    },
  );

  const header = (
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold">Items ({items.length})</div>
      {/* Add copies an existing item, so it is offered only once there is
          one to copy — see the empty-list notice below (#316). */}
      {items.length > 0 && (
        <Button
          size="small"
          icon={<Plus />}
          variant="solid"
          color="green"
          onClick={actions.add}
        >
          Add Item
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
          This value could not be read as a list. Edit it in the code editor.
        </div>
      </div>
    );
  }

  // An array binding is editable only while it holds at least one item: the
  // panel derives an item's shape from its siblings and will not invent one.
  // `removeArrayItems` already refuses to empty a populated array, so this
  // state means the source itself declared `[]` (or only holes/spreads).
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div
          className="rounded border border-dashed border-gray-200 p-3 text-xs
            text-gray-500"
        >
          No editable items. The panel copies an existing item rather than
          guessing the shape of a new one — add the first item in the code
          editor.
        </div>
      </div>
    );
  }

  const bulkBar = (
    <BulkActionsBar
      count={selection.selected.size}
      onDuplicate={actions.duplicateSelected}
      onMoveUp={() => actions.moveSelected('up')}
      onMoveDown={() => actions.moveSelected('down')}
      onDelete={actions.removeSelected}
      onClear={selection.clear}
    />
  );

  const itemControls = (item: { index: number; elementIndex: number }) => (
    <div className="flex space-x-1">
      <Button
        size="small"
        icon={<ArrowUp />}
        disabled={item.index === 0}
        onClick={() => actions.move(item.elementIndex, item.index - 1)}
      />
      <Button
        size="small"
        icon={<ArrowDown />}
        disabled={item.index === items.length - 1}
        onClick={() => actions.move(item.elementIndex, item.index + 1)}
      />
      <Button
        danger
        size="small"
        icon={<X />}
        disabled={items.length <= 1}
        onClick={() => actions.remove(item.elementIndex)}
      />
    </div>
  );

  if (kind === 'primitive') {
    return (
      <div className="space-y-4">
        {header}

        {bulkBar}

        {items.map(item => (
          <div
            key={item.elementIndex}
            className="space-y-2 rounded border border-gray-100 bg-gray-50 p-2"
          >
            <div className="flex items-center justify-between space-x-1">
              <div
                onClick={e => selection.toggle(item.index, e.shiftKey)}
                className="inline-flex"
              >
                <Checkbox
                  checked={selection.isSelected(item.index)}
                  onChange={() => {}}
                />
              </div>
              {itemControls(item)}
            </div>
            <Field binding={item.value!} onNodeChange={onChildChange} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {bulkBar}

      {items.map(item => (
        <div
          key={item.elementIndex}
          className="space-y-3 rounded border bg-gray-50 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                onClick={e => selection.toggle(item.index, e.shiftKey)}
                className="inline-flex"
              >
                <Checkbox
                  checked={selection.isSelected(item.index)}
                  onChange={() => {}}
                />
              </div>
              <div className="text-xs font-medium">Item {item.index + 1}</div>
            </div>
            {itemControls(item)}
          </div>
          <div className="space-y-2">
            {item.properties.map(binding => (
              <div
                key={`${item.elementIndex}-${binding.property}-${binding.label}`}
              >
                <div className="flex flex-col space-y-2">
                  <label className="w-20 shrink-0 text-xs font-medium">
                    {binding.label}
                  </label>
                  <Field binding={binding} onNodeChange={onChildChange} />
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
                ✓ No JSX bindings found
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Items;
