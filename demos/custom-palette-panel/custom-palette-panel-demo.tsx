import { useState } from 'react';

import { Button } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import Context from '~/components/context';
import Dnd, {
  DraggableItem,
  Field,
  type PanelBinding,
  type PanelNodeChange,
  useDndLayout,
  useDndPalette,
  useDndPanel,
  useItemsEditor,
} from '~/components/dnd';
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
          binding.onChange(setEditableValue(binding.rawValue, path, next))
        }
      />
    ))}
  </div>
);

// `binding.widget` is an open string (#236) — a custom panel switches
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
        // A number binding takes a real number now (#238) — commit one
        // directly instead of the numeric string the input event carries.
        onChange={e => binding.onChange(Number(e.target.value))}
      />
      <span className="w-12 text-right text-xs text-gray-500">
        {String(binding.value)}
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
        defaultValue={binding.rawValue}
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

// A deliberately different layout for an `items` binding, built on the
// exported `useItemsEditor`. Nothing here parses JSX or touches Babel: the
// hook hands back `PanelBinding`s and position-translated actions, so this
// only has to decide what it looks like. Compare with the built-in Items
// panel ("Wrap built-in") — same engine, different markup.
const HeadlessItems = ({
  binding,
  onNodeChange,
}: {
  binding: PanelBinding;
  onNodeChange: PanelNodeChange;
}) => {
  const { items, selection, actions } = useItemsEditor(binding.rawValue, {
    render: binding.render,
    onChange: binding.onChange,
    onNodeChange,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{items.length} item(s)</span>
        <div className="flex gap-1">
          {selection.selected.size > 0 && (
            <>
              <button
                type="button"
                className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                onClick={() => actions.moveSelected('up')}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                onClick={() => actions.moveSelected('down')}
              >
                ↓
              </button>
              <button
                type="button"
                className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600"
                onClick={actions.removeSelected}
              >
                Delete {selection.selected.size}
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700"
            onClick={actions.add}
          >
            + Add
          </button>
        </div>
      </div>

      {items.map(item => (
        <details
          key={item.id}
          open
          className="rounded border border-gray-200 px-2 py-1"
        >
          <summary className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selection.isSelected(item.index)}
              onChange={() => selection.toggle(item.index, false)}
              onClick={e => e.stopPropagation()}
            />
            <span className="font-medium">#{item.index + 1}</span>
            <button
              type="button"
              className="ml-auto text-red-500"
              onClick={e => {
                e.preventDefault();
                actions.remove(item.elementIndex);
              }}
            >
              remove
            </button>
          </summary>

          <div className="space-y-1 py-1">
            {/* A primitive array item has a single value binding. */}
            {item.value && (
              <input
                className="w-full rounded border border-gray-300 px-2 py-1
                  text-sm"
                defaultValue={item.value.rawValue}
                onBlur={e => item.value!.onChange(e.target.value)}
              />
            )}

            {item.properties.map(prop => (
              <label key={prop.label} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-gray-500">
                  {prop.label}
                </span>
                <input
                  className="w-full rounded border border-gray-300 px-2 py-1
                    text-sm"
                  defaultValue={prop.rawValue}
                  onBlur={e => prop.onChange(e.target.value)}
                />
              </label>
            ))}

            {/* The nested elements `bindings` alone can't reach. Each one
                already carries its own `onChange`, wired to `onNodeChange`
                by the hook. */}
            {item.nested.map(group =>
              group.fallback ? (
                <Field
                  key={group.property}
                  binding={group.fallback}
                  onNodeChange={onNodeChange}
                />
              ) : (
                group.elements.map(element => (
                  <div
                    key={`${group.property}-${element.id}`}
                    className="space-y-1 rounded bg-gray-50 p-1"
                  >
                    <div className="text-[10px] text-gray-400">
                      {group.property} › &lt;{element.tagName}&gt;
                    </div>
                    {element.bindings.map(nestedBinding => (
                      <label
                        key={nestedBinding.label}
                        className="flex items-center gap-2"
                      >
                        <span className="w-16 shrink-0 text-xs text-gray-500">
                          {nestedBinding.label}
                        </span>
                        {/* Structural bindings still get the built-in
                            control — the hook and `Field` compose. */}
                        <Field
                          binding={nestedBinding}
                          onNodeChange={onNodeChange}
                        />
                      </label>
                    ))}
                  </div>
                ))
              ),
            )}
          </div>
        </details>
      ))}
    </div>
  );
};

type PanelMode = 'custom' | 'wrap' | 'headless';

type LayoutMode = 'built-in' | 'stacked';

// The palette, replaced end to end. `useDndPalette()` hands over the items
// and the `onAdd` that drops one onto the canvas; `Live.Dnd.DraggableItem`
// keeps the dnd-kit wiring, so this only decides what an item looks like.
// `isMobile` comes from `useDndLayout()` — the same signal the built-in
// palette uses to decide that a tap should add rather than start a drag.
const MyPalette = () => {
  const { items, onAdd } = useDndPalette();
  const { isMobile } = useDndLayout();

  return (
    <div className="h-full space-y-2 overflow-y-auto p-2">
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
  );
};

// The panel, replaced end to end. Being a component rather than a callback is
// what lets the fields below hold their own state — `ValidatedField` keeps a
// validation message, `useItemsEditor` keeps a selection — without this
// having to hoist any of it.
const MyPanel = ({ mode }: { mode: PanelMode }) => {
  const {
    item,
    onDelete,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    bindings,
    onNodeChange,
  } = useDndPanel();

  if (!item) {
    return (
      <p className="p-4 text-sm text-gray-500">
        Select a section on the canvas.
      </p>
    );
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto p-4">
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
      {!bindings.length && (
        <p className="text-xs text-gray-400">No editable elements.</p>
      )}
      {/* `bindings` is plain data — switch on each entry's `type` to render
          whatever control you want. onChange commits through the same AST
          pipeline as the built-in panel. */}
      {bindings.map((binding, index) => {
        // An `items`/`children`/array binding holds nested data-bound JSX
        // that `bindings` alone can't reach (see #308). Flattening it gives
        // a wall of tiny inputs at best, a raw source textarea at worst — so
        // hand these back to the built-in control and keep the hand-rolled
        // ones for the simple types. This is the point of `Live.Dnd.Field`:
        // the choice is per binding, not all-or-nothing.
        const isStructural =
          binding.type === 'array' ||
          binding.property === 'items' ||
          binding.property === 'data' ||
          binding.property === 'children';

        const isMultiline =
          binding.type === 'jsx' || binding.type === 'richtext';
        // Some `children` bindings hold a serialized document tree rather
        // than a few simple fields — Features' "Feature Cards" flattens to
        // 240 leaves (tag names, ids, individual attributes...), which is
        // technically correct but useless as a form. Capping the entry count
        // treats those as opaque instead of rendering a wall of tiny inputs;
        // a value long enough to likely be one of these (or just a long
        // plain string) falls back to a textarea rather than the single-line
        // ValidatedField either way.
        const flattened =
          isMultiline || isStructural
            ? null
            : flattenEditableValue(binding.rawValue);
        const entries =
          flattened && flattened.length <= MAX_EDITABLE_ENTRIES
            ? flattened
            : null;
        const useTextarea =
          isMultiline || (!entries && binding.rawValue.length > 120);

        return (
          <label
            key={`${binding.id}-${binding.property}-${index}`}
            className="block space-y-1"
          >
            <span className="text-xs font-semibold text-gray-700">
              {binding.label}
            </span>
            {isStructural ? (
              // Same binding, two ways to render it: the built-in control,
              // or your own markup over the same engine via
              // `useItemsEditor`.
              mode === 'headless' ? (
                <HeadlessItems binding={binding} onNodeChange={onNodeChange} />
              ) : (
                // Renders the control only — the label above is ours, which
                // is why `Field` doesn't draw one.
                <Field binding={binding} onNodeChange={onNodeChange} />
              )
            ) : entries ? (
              <ParsedValueEditor binding={binding} entries={entries} />
            ) : binding.widget === 'slider' ? (
              <SliderField binding={binding} />
            ) : binding.options ? (
              <select
                className="w-full rounded border border-gray-300 px-2 py-1
                  text-sm"
                value={binding.rawValue}
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
                className="w-full rounded border border-gray-300 px-2 py-1
                  text-sm"
                rows={3}
                defaultValue={binding.rawValue}
                onBlur={e => binding.onChange(e.target.value)}
              />
            ) : (
              <ValidatedField binding={binding} />
            )}
          </label>
        );
      })}
    </div>
  );
};

// The other way to replace a region: keep the built-in panel and only add
// around it. `Live.Dnd.Panel` reads `useDndPanel()` itself, so wrapping it
// can't drop a callback on the way through — `onNodeChange` included, which
// nested array/children edits need to commit (#308). `h-auto` overrides the
// region's own `h-full` (className is tailwind-merged over the defaults), so
// the header above it doesn't push it out of view.
const WrappedPanel = () => (
  <div className="h-full overflow-y-auto">
    <p
      className={cn(
        'border-b border-gray-200 bg-gray-50',
        'px-4 py-2 text-xs text-gray-600',
      )}
    >
      Custom header — the built-in panel below is unchanged.
    </p>
    <Dnd.Panel className="h-auto" />
  </div>
);

// A layout `Live.Dnd` doesn't ship: the palette as a strip across the top,
// the canvas filling what's left, the panel as a fixed rail on the right.
// `Canvas` is the one region that has to stay Dnd's (it owns the droppable,
// the sortable list and the scroll container each section's iframe measures
// itself against), so all this has to get right is where things go.
//
// Note this drops the built-in mobile chrome (the floating palette button and
// the two Drawers) along with the built-in Splitter; a layout that needs them
// either builds its own from `useDndLayout()` or goes back to
// `Live.Dnd.Layout` and replaces one region through its slots.
const StackedLayout = ({
  palette,
  panel,
}: {
  palette: React.ReactNode;
  panel: React.ReactNode;
}) => (
  <div className="flex h-full min-h-0 w-full flex-col">
    <div
      className={cn(
        'max-h-32 shrink-0 overflow-y-auto',
        'border-b border-gray-200 p-2',
      )}
    >
      {palette}
    </div>
    <div className="flex min-h-0 flex-1">
      <Dnd.Canvas className="min-w-0 flex-1" />
      <div className="w-72 shrink-0 border-l border-gray-200">{panel}</div>
    </div>
  </div>
);

// Custom Palette & Panel demo. Mirrors the app's `pages/docs/dnd-custom-render`:
// `Live.Dnd` renders its built-in layout until you give it children, and every
// region behind that layout is reachable as data — `useDndPalette()`,
// `useDndPanel()`, `useDndLayout()` — so a replacement is an ordinary
// component rather than a callback. Drag-and-drop keeps working through the
// exported `DraggableItem`, and `useDndPanel()`'s `bindings` (one per editable
// field) keep custom controls committing through the same AST-update pipeline.
//
// The "Wrap built-in" mode shows the other end of the range: keep
// `Live.Dnd.Panel` and only add around it (see `WrappedPanel`).
//
// "Headless items" is the third option: keep your own markup but reuse the
// array-editing engine through `useItemsEditor` (see `HeadlessItems`).
//
// The Layout toggle is the outer layer. "Built-in" keeps the shipped 3-pane
// Splitter and mobile chrome and only fills its `palette`/`panel` slots;
// "Stacked" replaces the arrangement itself (see `StackedLayout`).
const CustomPalettePanelDemo = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);
  const [mode, setMode] = useState<PanelMode>('custom');
  const [layout, setLayout] = useState<LayoutMode>('built-in');

  const palette = <MyPalette />;
  const panel = mode === 'wrap' ? <WrappedPanel /> : <MyPanel mode={mode} />;

  return (
    <Context>
      <div className="flex h-screen flex-col">
        <div
          className={cn(
            'flex items-center justify-end gap-2',
            'border-b border-gray-200 px-4 py-2',
          )}
        >
          <span className="text-xs text-gray-600">Panel</span>
          <Button
            size="small"
            type={mode === 'custom' ? 'primary' : 'default'}
            onClick={() => setMode('custom')}
          >
            Custom fields
          </Button>
          <Button
            size="small"
            type={mode === 'wrap' ? 'primary' : 'default'}
            onClick={() => setMode('wrap')}
          >
            Wrap built-in
          </Button>
          <Button
            size="small"
            type={mode === 'headless' ? 'primary' : 'default'}
            onClick={() => setMode('headless')}
          >
            Headless items
          </Button>
          <span className="ml-4 text-xs text-gray-600">Layout</span>
          <Button
            size="small"
            type={layout === 'built-in' ? 'primary' : 'default'}
            onClick={() => setLayout('built-in')}
          >
            Built-in
          </Button>
          <Button
            size="small"
            type={layout === 'stacked' ? 'primary' : 'default'}
            onClick={() => setLayout('stacked')}
          >
            Stacked
          </Button>
        </div>
        <Dnd
          value={value}
          onChange={setValue}
          frame={{ mode: 'shadow', syncStyle: true }}
          dynamicTailwind
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {layout === 'stacked' ? (
            <StackedLayout palette={palette} panel={panel} />
          ) : (
            <Dnd.Layout palette={palette} panel={panel} />
          )}
        </Dnd>
      </div>
    </Context>
  );
};

export default CustomPalettePanelDemo;
