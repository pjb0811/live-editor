import { useState } from 'react';

import { Button } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import Context from '~/components/context';
import Dnd, { type PanelBinding } from '~/components/dnd';
import { DEFAULT_TEMPLATE } from '~/constants';
import { cn } from '~/utils';
import { parseValue, validateBindingValue } from '~/utils/ast';

type Primitive = string | number | boolean;

const isPrimitive = (value: unknown): value is Primitive =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

// A binding's declared `type`/`render` (see #225) is one way to know a
// value is structured, but most existing content — e.g. the shipped
// Hero item's "Background Style" binding on `style` — declares neither;
// it's just an object-shaped string because that's what `style` actually
// is. `parseValue` (also exported from utils/ast) recovers the real JS
// value from that string regardless, so inferring structure from the
// *parsed value's own shape* works on binding declared today, not just
// ones authored with a `render` map in mind. Kept intentionally shallow:
// an object/array is only treated as editable here if every one of its
// own values is a primitive — a nested object/array falls back to the
// plain text field below rather than recursing.
interface EditableShape {
  isArray: boolean;
  entries: { key: string; value: Primitive }[];
}

const parseEditableShape = (value: string): EditableShape | null => {
  const parsed = parseValue(value);

  if (Array.isArray(parsed)) {
    return parsed.every(isPrimitive)
      ? {
          isArray: true,
          entries: parsed.map((item, index) => ({
            key: String(index),
            value: item,
          })),
        }
      : null;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const entries = Object.entries(parsed);
    return entries.every(([, v]) => isPrimitive(v))
      ? {
          isArray: false,
          entries: entries.map(([key, value]) => ({
            key,
            value: value as Primitive,
          })),
        }
      : null;
  }

  return null;
};

const ParsedValueField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Primitive;
  onChange: (next: Primitive) => void;
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

// Renders one labeled input per key/index of an object- or array-shaped
// binding value, reconstructing and re-serializing the whole structure on
// each field's change. `shape` is recomputed by the caller from the raw
// string each render, so this always reflects the latest committed value.
const ParsedValueEditor = ({
  binding,
  shape,
}: {
  binding: PanelBinding;
  shape: EditableShape;
}) => {
  const onFieldChange = (key: string, next: Primitive) => {
    const nextEntries = shape.entries.map(entry =>
      entry.key === key ? { ...entry, value: next } : entry,
    );
    const nextValue = shape.isArray
      ? nextEntries.map(entry => entry.value)
      : Object.fromEntries(nextEntries.map(entry => [entry.key, entry.value]));

    binding.onChange(JSON.stringify(nextValue));
  };

  return (
    <div className="space-y-2 rounded border border-gray-200 p-2">
      {shape.entries.map(({ key, value }) => (
        <ParsedValueField
          key={key}
          label={shape.isArray ? `[${key}]` : key}
          value={value}
          onChange={next => onFieldChange(key, next)}
        />
      ))}
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
                      const shape = isMultiline
                        ? null
                        : parseEditableShape(binding.value);

                      return (
                        <label
                          key={`${binding.id}-${binding.property}-${index}`}
                          className="block space-y-1"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {binding.label}
                          </span>
                          {shape ? (
                            <ParsedValueEditor
                              binding={binding}
                              shape={shape}
                            />
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
                          ) : isMultiline ? (
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
