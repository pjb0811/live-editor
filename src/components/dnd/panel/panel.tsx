import { useContext, useEffect, useRef, useState } from 'react';

import { Button, Typography } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import type { Section } from '~/types';
import { cn } from '~/utils/cn';

import { DndInspectorContext } from '../inspector';
import type { PanelBinding, PanelNodeChange } from '../panel-binding';
import FieldGroup from './field-group';

// Props of the built-in property panel, which `Live.Dnd.Panel` renders from
// `useDndPanel()`. They match that hook's fields, so the built-in panel and
// a custom one use the same data (#237). Without `onNodeChange`, edits
// inside `items` and `children` values aren't saved (#308).
export interface PanelProps {
  item?: Section;
  onDelete?: (id: string) => void;
  // Move the section. On mobile the panel covers the canvas, so these
  // replace dragging there.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  // `item`'s editable fields, the same `bindings` a custom panel gets
  // (#237).
  bindings: PanelBinding[];
  onNodeChange?: PanelNodeChange;
  // The document doesn't parse, so these fields are from the last version
  // that did and edits are refused (#433).
  readOnly?: boolean;
}

// Groups the flat `bindings` by element `id`, keeping their order, for one
// box per element. Not memoized: `bindings` is new every render (#336),
// and the walk is cheap.
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

// How a group's header names its element: the tag name, and its text when it
// has some. Also the group's accessible name.
const describeElement = (binding: PanelBinding) => {
  const { tagName = 'element', text = '' } = binding.element ?? {};

  return { tagName, text, label: text ? `${tagName} "${text}"` : tagName };
};

// The element a panel event happened in: the nearest group or nested
// element marked with `data-node-id`.
const nodeIdOf = (target: EventTarget | null) =>
  (target instanceof Element &&
    target.closest('[data-node-id]')?.getAttribute('data-node-id')) ||
  null;

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
  const messages = useLiveMessages();
  const groups = groupBindingsById(bindings);
  const rootRef = useRef<HTMLDivElement>(null);
  // Read without the throwing hook: this panel also renders outside
  // `Live.Dnd`, read-only, where there's no picker.
  const inspector = useContext(DndInspectorContext);
  const picked = inspector?.picked ?? null;
  const pickedId = picked?.id;
  const highlight = inspector?.highlight;
  // The element under the pointer wins over the focused one, so moving the
  // pointer over another group shows that one while typing in a field.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const targetId = hoveredId ?? focusedId;

  // Outlines on the canvas the element the field under the pointer or focus
  // edits, so fields that share a label can be told apart (#514).
  useEffect(() => {
    if (!highlight) {
      return;
    }

    highlight(targetId);

    return () => highlight(null);
  }, [highlight, targetId]);

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
        {messages.panel.selectSection}
      </Typography.Paragraph>
    );
  }

  return (
    <div
      ref={rootRef}
      onPointerOver={e => setHoveredId(nodeIdOf(e.target))}
      onPointerLeave={() => setHoveredId(null)}
      onFocus={e => setFocusedId(nodeIdOf(e.target))}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setFocusedId(null);
        }
      }}
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
              aria-label={messages.section.moveUp}
            />
          )}
          {onMoveDown && (
            <Button
              icon={<ChevronDown />}
              disabled={!canMoveDown}
              onClick={onMoveDown}
              aria-label={messages.section.moveDown}
            />
          )}
          {onDelete && (
            <Button
              danger
              icon={<Trash />}
              onClick={() => onDelete(item.id)}
              aria-label={messages.section.delete}
            />
          )}
        </div>
      </div>
      {readOnly && (
        <Typography.Text role="status" className="block text-xs text-amber-700">
          {messages.panel.readOnly}
        </Typography.Text>
      )}
      {!groups.length && (
        <Typography.Text className="text-xs text-gray-400">
          {messages.panel.noEditableElements}
        </Typography.Text>
      )}
      {groups.map(group => {
        const element = describeElement(group[0]!);

        return (
          <div
            key={group[0]!.id}
            data-node-id={group[0]!.id}
            role="group"
            aria-label={element.label}
            className="rounded data-[picked]:ring-2 data-[picked]:ring-blue-400
              data-[picked]:ring-offset-2"
          >
            {/* Only needed once fields of more than one element share the
                panel; a single element reads the same as before (#514). */}
            {groups.length > 1 && (
              <div
                className="mb-2 flex min-w-0 items-baseline gap-1.5 border-b
                  border-gray-100 pb-1 text-xs"
              >
                <code className="shrink-0 text-gray-500">
                  {element.tagName}
                </code>
                {element.text && (
                  <span className="truncate text-gray-400">{element.text}</span>
                )}
              </div>
            )}
            <FieldGroup bindings={group} onNodeChange={onNodeChange} />
          </div>
        );
      })}
    </div>
  );
};

export default Panel;
