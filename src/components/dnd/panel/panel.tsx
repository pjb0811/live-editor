import { Button, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import type { Section } from '~/types';
import { cn } from '~/utils';
import type { DataAttrNode } from '~/utils/ast';

import Node from './node';

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
  // `item`'s editable data-binding fields — extraction (and the AST
  // update + error-toast handling behind onFieldChange) lives in Dnd, so
  // it's shared with a custom renderPanel instead of computed here too.
  fields: DataAttrNode[];
  onFieldChange: (params: {
    id: string;
    label: string;
    property: string;
    value: string;
  }) => void;
}

const Panel = ({
  item,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  fields,
  onFieldChange,
}: Props) => {
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
      {!fields.length && (
        <Typography.Text className="text-xs text-gray-400">
          No editable elements.
        </Typography.Text>
      )}
      {fields.map((node, index) => (
        <Node
          key={`${item.id}-${index}`}
          data={node}
          onChange={onFieldChange}
        />
      ))}
    </div>
  );
};

export default Panel;
