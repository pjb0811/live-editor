import { useState } from 'react';

import { Button } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import Context from '~/components/context';
import Dnd, { type PanelBinding } from '~/components/dnd';
import { DEFAULT_TEMPLATE } from '~/constants';
import { cn } from '~/utils';
import {
  type EditablePrimitive,
  type EditableValueEntry,
  flattenEditableValue,
  setEditableValue,
  validateBindingValue,
} from '~/utils/ast';

// Above this many leaves, `flattenEditableValue`'s result is more likely a
// serialized document tree (tag names, ids, individual attributes...) than
// a form a person would want to fill in field-by-field — see the "Feature
// Cards" binding below.
const MAX_EDITABLE_ENTRIES = 20;

const ParsedValueField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EditablePrimitive;
  onChange: (next: EditablePrimitive) => void;
}) => {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-600">{label}</span>
        <input
          type="checkbox"
          checked={value}
          onChange={e => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-600">{label}</span>
        <input
          type="number"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
          defaultValue={value}
          onBlur={e => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
        defaultValue={value}
        onBlur={e => onChange(e.target.value)}
      />
    </label>
  );
};

// Renders one labeled input per leaf `flattenEditableValue` (utils/ast)
// found in the binding's current value — including a leaf nested inside
// an array of objects, e.g. the shipped Stats/FAQ sections' `items` array
// of `{ key, children }`, where `children` is itself a further, separately
// data-bound element and is treated as an opaque text leaf here rather
// than decomposed. Each field commits through `setEditableValue`, which
// replaces just that one leaf and re-serializes the whole structure back
// into the string `binding.onChange` expects.
const ParsedValueEditor = ({
  binding,
  entries,
}: {
  binding: PanelBinding;
  entries: EditableValueEntry[];
}) => (
  <div className="space-y-2 rounded border border-gray-200 p-2">
    {entries.map(({ path, value }) => (
      <ParsedValueField
        key={path.join('.')}
        label={path.join('.')}
        value={value}
        onChange={next =>
          binding.onChange(setEditableValue(binding.value, path, next))
        }
      />
    ))}
  </div>
);

// `binding.widget` is an open string (#236) — a custom renderPanel switches
// on it to render whatever control it wants; the built-in panel only knows
// `icon-picker`/`asset-picker`, so anything else (like `'slider'` here) is
// exclusively this demo's own choice, not a value the library defines.
//
// `step`/`unit` aren't fields PanelBinding declares either — they're
// whatever this demo's own binding happened to author (see the Hero
// section's "Content Spacing" field), carried through under `binding.meta`
// instead of being stripped during parsing (#234). `meta`'s values are
// `unknown` on purpose (the library can't know what shape a consumer's own
// metadata takes), so narrow them before use rather than trusting the type.
const SliderField = ({ binding }: { binding: PanelBinding }) => {
  const metaStep = binding.meta?.step;
  const step = typeof metaStep === 'number' ? metaStep : 1;
  const metaUnit = binding.meta?.unit;
  const unit = typeof metaUnit === 'string' ? metaUnit : '';

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={binding.min ?? 0}
        max={binding.max ?? 100}
        step={step}
        defaultValue={Number(binding.value) || 0}
        className="w-full"
        onChange={e => binding.onChange(e.target.value)}
      />
      <span className="w-12 text-right text-xs text-gray-500">
        {binding.value}
        {unit}
      </span>
    </div>
  );
};

// The plain-input fallback field, running `binding.min`/`max`/`pattern`/
// `required` through the exported `validateBindingValue` before
// committing — those constraints reach here as of #225, but nothing
// calls them automatically; a custom panel still has to invoke the
// helper itself.
const ValidatedField = ({ binding }: { binding: PanelBinding }) => {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <input
        className={cn(
          'w-full rounded border px-2 py-1 text-sm',
          error ? 'border-red-400' : 'border-gray-300',
        )}
        defaultValue={binding.value}
        onBlur={e => {
          const next = e.target.value;
          const result = validateBindingValue(binding, next);

          if (!result.valid) {
            setError(result.message ?? 'Invalid value.');
            return;
          }

          setError(null);
          binding.onChange(next);
        }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

// Custom Palette & Panel demo. Mirrors the app's `pages/docs/dnd-custom-render`:
// `Dnd`'s `renderPalette`/`renderPanel` fully replace the built-in layouts.
// Drag-and-drop keeps working through the exported `DraggableItem`, and
// `renderPanel` hands over `bindings` (one per editable field) so custom
// controls still commit through the same AST-update pipeline.
const CustomPalettePanelDemo = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);

  return (
    <Context>
      <div className="h-screen overflow-y-auto">
        <Dnd
          value={value}
          onChange={setValue}
          frame={{ mode: 'shadow', syncStyle: true }}
          dynamicTailwind
          renderPalette={({ items, onAdd, DraggableItem, isMobile }) => (
            <div className="space-y-2 p-2">
              {items.map(item => (
                <DraggableItem key={item.id} item={item}>
                  {({ ref, dragProps, isDragging }) => (
                    <div
                      ref={ref}
                      {...dragProps}
                      onClick={isMobile ? () => onAdd(item) : undefined}
                      onDoubleClick={() => onAdd(item)}
                      className={cn(
                        'cursor-grab rounded-lg',
                        'border border-dashed border-blue-300',
                        'bg-blue-50 px-3 py-2',
                        'text-sm font-medium text-blue-700',
                        isDragging && 'opacity-50',
                      )}
                    >
                      {item.name}
                    </div>
                  )}
                </DraggableItem>
              ))}
            </div>
          )}
          renderPanel={({
            item,
            onDelete,
            onMoveUp,
            onMoveDown,
            canMoveUp,
            canMoveDown,
            bindings,
          }) => (
            <div className="space-y-3 p-4">
              {item ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="small"
                        icon={<ChevronUp />}
                        disabled={!canMoveUp}
                        onClick={onMoveUp}
                        aria-label="Move section up"
                      />
                      <Button
                        size="small"
                        icon={<ChevronDown />}
                        disabled={!canMoveDown}
                        onClick={onMoveDown}
                        aria-label="Move section down"
                      />
                      <Button
                        danger
                        size="small"
                        icon={<Trash />}
                        onClick={() => onDelete(item.id)}
                        aria-label="Delete section"
                      />
                    </div>
                  </div>
                  {bindings.length ? (
                    // `bindings` is plain data — switch on each entry's `type`
                    // to render whatever control you want. onChange commits
                    // through the same AST pipeline as the built-in panel.
                    bindings.map((binding, index) => {
                      const isMultiline =
                        binding.type === 'jsx' || binding.type === 'richtext';
                      // Some `children` bindings hold a serialized document
                      // tree rather than a few simple fields — Features'
                      // "Feature Cards" flattens to 240 leaves (tag names,
                      // ids, individual attributes...), which is technically
                      // correct but useless as a form. Capping the entry
                      // count treats those as opaque instead of rendering a
                      // wall of tiny inputs; a value long enough to likely be
                      // one of these (or just a long plain string) falls
                      // back to a textarea rather than the single-line
                      // ValidatedField either way.
                      const flattened = isMultiline
                        ? null
                        : flattenEditableValue(binding.value);
                      const entries =
                        flattened && flattened.length <= MAX_EDITABLE_ENTRIES
                          ? flattened
                          : null;
                      const useTextarea =
                        isMultiline || (!entries && binding.value.length > 120);

                      return (
                        <label
                          key={`${binding.id}-${binding.property}-${index}`}
                          className="block space-y-1"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {binding.label}
                          </span>
                          {entries ? (
                            <ParsedValueEditor
                              binding={binding}
                              entries={entries}
                            />
                          ) : binding.widget === 'slider' ? (
                            <SliderField binding={binding} />
                          ) : binding.options ? (
                            <select
                              className="w-full rounded border border-gray-300
                                px-2 py-1 text-sm"
                              value={binding.value}
                              onChange={e => binding.onChange(e.target.value)}
                            >
                              {binding.options.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : useTextarea ? (
                            <textarea
                              className="w-full rounded border border-gray-300
                                px-2 py-1 text-sm"
                              rows={3}
                              defaultValue={binding.value}
                              onBlur={e => binding.onChange(e.target.value)}
                            />
                          ) : (
                            <ValidatedField binding={binding} />
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400">
                      No editable elements.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Select a section on the canvas.
                </p>
              )}
            </div>
          )}
        />
      </div>
    </Context>
  );
};

export default CustomPalettePanelDemo;
