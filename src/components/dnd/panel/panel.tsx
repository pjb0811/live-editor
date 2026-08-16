import { useEffect, useMemo } from 'react';

import { Button, Toast, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import type { Section } from '~/types';
import { cn } from '~/utils';
import { extract, fillIds, update } from '~/utils/ast';

import Node from './node';

interface Props {
  item?: Section;
  onChange?: (next: Partial<Section>) => void;
  onDelete?: (id: string) => void;
  // Reordering by dragging a section on the canvas doesn't work from
  // inside this panel on mobile — the canvas sits behind the Drawer this
  // panel renders in, so there's nothing visible to drag onto. These give
  // an explicit alternative that works regardless of layout.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const Panel = ({
  item,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: Props) => {
  const code = item?.code;

  // Reads only the extracted `code` local, not `item`, so the compiler can
  // verify this dependency array actually matches what the body reads —
  // mixing `item?.code` (the guard) and `item.code` (post-guard reads)
  // made that unprovable and widened the inferred dependency to `item`
  // itself, which would recompute on unrelated `item` identity changes.
  const { dataAttrNodes, updatedCode, parseError } = useMemo(() => {
    if (!code) {
      return { dataAttrNodes: [], updatedCode: '', parseError: false };
    }

    try {
      const updatedCode = fillIds(code);

      const allNodes = extract(updatedCode);
      const filtered = allNodes.filter(node => node.tagName !== 'section');

      return {
        dataAttrNodes: filtered,
        updatedCode: updatedCode !== code ? updatedCode : code,
        parseError: false,
      };
    } catch (e) {
      console.warn('⚠️ Parsing error', e);
      return { dataAttrNodes: [], updatedCode: '', parseError: true };
    }
  }, [code]);

  useEffect(() => {
    if (parseError) {
      Toast.error('Failed to parse this section', {
        description: 'Check the console for details.',
      });
    }
  }, [parseError]);

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
      {!dataAttrNodes.length && (
        <Typography.Text className="text-xs text-gray-400">
          No editable elements.
        </Typography.Text>
      )}
      {dataAttrNodes.map((node, index) => (
        <Node
          key={`${item.id}-${index}`}
          data={node}
          onChange={({ id, label, value }) => {
            const result = update(updatedCode, id, label, value);

            if (!result.success) {
              Toast.error('Failed to update this field', {
                description: 'Check the console for details.',
              });
              return;
            }

            onChange?.({
              ...item,
              code: result.code,
            });
          }}
        />
      ))}
    </div>
  );
};

export default Panel;
