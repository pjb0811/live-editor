import { useMemo } from 'react';

import { Button, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import type { Section } from '~/types';
import { cn } from '~/utils';

import type { PanelBinding } from '../dnd';
import FieldGroup from './field-group';

// Exported as `Live.Dnd.DefaultPanel` (see index.ts) so a consumer can
// wrap or partially override the built-in panel instead of starting a
// `renderPanel` from zero — see #237. Every field here lines up 1:1 with
// `PanelRenderData` (drop `onChange`, which this panel never needed) with
// one exception: `onNodeChange` isn't part of the public data a
// `renderPanel` receives, because it's the internal, node-level escape
// hatch `Items`/`Children` use to commit a *different* element's edit
// than any single `PanelBinding.onChange` can express (see field.tsx's
// items/children boundary note from step 1). It's optional here — a
// consumer re-embedding `DefaultPanel` outside of `Dnd` itself can omit
// it, at the cost of nested array/children edits not committing.
export interface PanelProps {
  item?: Section;
  onDelete?: (id: string) => void;
  // Reordering by dragging a section on the canvas doesn't work from
  // inside this panel on mobile — the canvas sits behind the Drawer this
  // panel renders in, so there's nothing visible to drag onto. These give
  // an explicit alternative that works regardless of layout.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  // `item`'s editable fields, already resolved to PanelBindings by Dnd's
  // `bindings` useMemo — the same data a custom renderPanel receives, so
  // this panel doesn't re-derive it from DataAttrNode a second time (#237).
  bindings: PanelBinding[];
  onNodeChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: string;
  }) => void;
}

// `bindings` is flat (one entry per bound property, across every editable
// element in the section) — regroup by `id` to render the same "one
// bordered box per element" layout as before. `bindings` is already
// ordered element-by-element, property-by-property (dnd.tsx builds it via
// `fields.flatMap`), so a Map preserves both the element order and each
// element's own property order with no extra sorting.
const groupBindingsById = (bindings: PanelBinding[]): PanelBinding[][] => {
  const groups = new Map<string, PanelBinding[]>();

  for (const binding of bindings) {
    const group = groups.get(binding.id);

    if (group) {
      group.push(binding);
    } else {
      groups.set(binding.id, [binding]);
    }
  }

  return [...groups.values()];
};

const Panel = ({
  item,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  bindings,
  onNodeChange,
}: PanelProps) => {
  const groups = useMemo(() => groupBindingsById(bindings), [bindings]);

  if (!item) {
    return (
      <Typography.Paragraph
        className={cn(
          'p-4 text-sm text-gray-500',
          //
        )}
      >
        Please select a section.
      </Typography.Paragraph>
    );
  }

  return (
    <div
      className={cn(
        'h-full space-y-4 p-4',
        'overflow-x-hidden overflow-y-auto',
        //
      )}
    >
      <div className="flex items-center justify-between">
        <Typography.Title className="text-lg font-semibold">
          {item.name}
        </Typography.Title>
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button
              icon={<ChevronUp />}
              disabled={!canMoveUp}
              onClick={onMoveUp}
              aria-label="Move section up"
            />
          )}
          {onMoveDown && (
            <Button
              icon={<ChevronDown />}
              disabled={!canMoveDown}
              onClick={onMoveDown}
              aria-label="Move section down"
            />
          )}
          {onDelete && (
            <Button
              danger
              icon={<Trash />}
              onClick={() => onDelete(item.id)}
              aria-label="Delete section"
            />
          )}
        </div>
      </div>
      {!groups.length && (
        <Typography.Text className="text-xs text-gray-400">
          No editable elements.
        </Typography.Text>
      )}
      {groups.map(group => (
        <FieldGroup
          key={group[0]!.id}
          bindings={group}
          onNodeChange={onNodeChange}
        />
      ))}
    </div>
  );
};

export default Panel;
