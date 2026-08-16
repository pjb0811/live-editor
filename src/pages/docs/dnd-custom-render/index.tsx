import { useState } from 'react';

import { Button, Space, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import Live from '~/.';
import { DEFAULT_TEMPLATE } from '~/constants';
import { cn } from '~/utils';

const DndCustomRenderDoc = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);

  return (
    <div className="space-y-4">
      <Space orientation="vertical" align="start">
        <Typography.Title level={1}>Custom Palette & Panel</Typography.Title>
        <Typography.Paragraph className="text-gray-500">
          <code>Live.Dnd</code> accepts <code>renderPalette</code> and{' '}
          <code>renderPanel</code> to fully replace the built-in layouts.
          Drag-and-drop keeps working through the exported{' '}
          <code>DraggableItem</code>, which owns the drag wiring, and editing a
          section&apos;s <code>data-binding</code> fields keeps working through{' '}
          <code>FieldEditor</code> (both passed into the render props below) —
          only the surrounding markup is custom.
        </Typography.Paragraph>
      </Space>
      <Live>
        <div
          className={cn(
            'h-[550px] overflow-y-auto rounded-lg',
            'border border-gray-200',
          )}
        >
          <Live.Dnd
            value={value}
            onChange={setValue}
            frame={{
              mode: 'iframe',
              syncStyle: true,
              scripts: ['/js/tailwindcss.js'],
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
              fields,
              onFieldChange,
              FieldEditor,
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
                    {fields.length ? (
                      // FieldEditor owns rendering each data-binding field
                      // (color pickers, rich text, selects, ...) — the
                      // "custom" part here is just the surrounding layout;
                      // swap this container for your own markup while
                      // still getting the library's field editors for free.
                      fields.map((field, index) => (
                        <FieldEditor
                          key={`${item.id}-${index}`}
                          data={field}
                          onChange={onFieldChange}
                        />
                      ))
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
      </Live>
    </div>
  );
};

export default DndCustomRenderDoc;
