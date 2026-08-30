import { useMemo } from 'react';

import { Button, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import type { Section } from '~/types';
import { cn } from '~/utils';

import type { PanelBinding } from '../dnd';
import FieldGroup from './field-group';

interface Props {
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
  onNodeChange: (params: {
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
}: Props) => {
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
