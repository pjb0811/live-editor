import { useContext, useEffect, useRef } from 'react';

import { Button, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import type { Section } from '~/types';
import { cn } from '~/utils/cn';

import type { PanelBinding, PanelNodeChange } from '../dnd';
import { DndInspectorContext } from '../inspector';
import FieldGroup from './field-group';

// The built-in property panel. Reached publicly as `Live.Dnd.Panel`, which
// is this in the container the desktop pane wants, driven from
// `useDndPanel()` — every field here lines up with what that hook returns
// (drop `onChange`, which this panel never needed), so the built-in panel and
// a custom one run on the same data and the public surface can't drift into a
// subset of it (#237).
//
// `onNodeChange` is the node-level escape hatch `Items`/`Children` use to
// commit a *different* element's edit than any single
// `PanelBinding.onChange` can express (see field.tsx's items/children
// boundary note from step 1). Optional here only so this can be rendered
// read-only for nested edits; leave it out with real data and nested
// array/children edits silently don't commit (#308).
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
  // `item`'s editable fields, already resolved to PanelBindings by Dnd —
  // the same data a custom panel receives, so this panel doesn't re-derive
  // it from DataAttrNode a second time (#237).
  bindings: PanelBinding[];
  onNodeChange?: PanelNodeChange;
  // The document doesn't parse, so these fields are from the last version
  // that did and edits are refused (#433).
  readOnly?: boolean;
}

// `bindings` is flat (one entry per bound property, across every editable
// element in the section) — regroup by `id` to render the same "one
// bordered box per element" layout as before. `bindings` is already
// ordered element-by-element, property-by-property (dnd.tsx builds it by
// flat-mapping the extracted fields), so a Map preserves both the element
// order and each element's own property order with no extra sorting.
//
// Not memoized: Dnd rebinds `bindings` every render so its commit callbacks
// can't go stale against the document (#336), which means a dependency on
// it would miss every time. This is a single pass over an already-parsed
// list, so the miss costs more than the walk.
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
  readOnly = false,
}: PanelProps) => {
  const groups = groupBindingsById(bindings);
  const rootRef = useRef<HTMLDivElement>(null);
  // Read without the throwing hook: this panel also renders outside
  // `Live.Dnd`, read-only, where there's no picker.
  const picked = useContext(DndInspectorContext)?.picked ?? null;
  const pickedId = picked?.id;

  // Brings the fields of an element picked in the preview into view and
  // marks them, whether they're a top-level group or nested in an Items or
  // Children editor (#432). A collapsed array item hides its nested fields,
  // so there's nothing to scroll to then.
  useEffect(() => {
    const root = rootRef.current;

    if (!root || !pickedId) {
      return;
    }

    const target = root.querySelector(
      `[data-node-id="${CSS.escape(pickedId)}"]`,
    );

    if (!target) {
      return;
    }

    target.setAttribute('data-picked', '');

    // Fields above the target can still grow for a moment after it renders
    // (a rich-text editor mounting, for one), pushing it back out of view.
    // So keep it in view for the first few hundred milliseconds.
    const until = performance.now() + 600;
    let frame = 0;

    const keepInView = () => {
      const box = target.getBoundingClientRect();
      const view = root.getBoundingClientRect();

      if (box.top < view.top || box.bottom > view.bottom) {
        target.scrollIntoView?.({ block: 'nearest' });
      }

      if (performance.now() < until) {
        frame = requestAnimationFrame(keepInView);
      }
    };

    keepInView();

    return () => {
      cancelAnimationFrame(frame);
      target.removeAttribute('data-picked');
    };
  }, [pickedId, groups.length]);

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
      ref={rootRef}
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
      {readOnly && (
        <Typography.Text role="status" className="block text-xs text-amber-700">
          The document has a syntax error. These fields are from the last
          version that parsed, and can&apos;t be edited until it parses again.
        </Typography.Text>
      )}
      {!groups.length && (
        <Typography.Text className="text-xs text-gray-400">
          No editable elements.
        </Typography.Text>
      )}
      {groups.map(group => (
        <div
          key={group[0]!.id}
          data-node-id={group[0]!.id}
          className="rounded data-[picked]:ring-2 data-[picked]:ring-blue-400
            data-[picked]:ring-offset-2"
        >
          <FieldGroup bindings={group} onNodeChange={onNodeChange} />
        </div>
      ))}
    </div>
  );
};

export default Panel;
