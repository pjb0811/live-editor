import { useState } from 'react';

import { Button } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import Context from '~/components/context';
import Dnd from '~/components/dnd';
import { DEFAULT_TEMPLATE } from '~/constants';
import { cn } from '~/utils';

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
          frame={{
            mode: 'iframe',
            syncStyle: true,
            scripts: ['../js/tailwindcss.js'],
          }}
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

                      return (
                        <label
                          key={`${binding.id}-${binding.property}-${index}`}
                          className="block space-y-1"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {binding.label}
                          </span>
                          {binding.options ? (
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
                            <input
                              className="w-full rounded border border-gray-300
                                px-2 py-1 text-sm"
                              defaultValue={binding.value}
                              onBlur={e => binding.onChange(e.target.value)}
                            />
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
