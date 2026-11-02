import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import type { Section } from '~/types';

import styles from './panel.module.css';

import Button from '../button';
import { DndInspectorContext } from '../inspector';
import type { PanelBinding, PanelNodeChange } from '../panel-binding';
import ElementFields from './element-fields';
import {
  type ElementSelection,
  ElementSelectionContext,
} from './element-selection';

// Props of the built-in property panel, which `Live.Dnd.Panel` renders from
// `useDndPanel()`. They match that hook's fields, so the built-in panel and
// a custom one use the same data (#237). Without `onNodeChange`, edits
// inside `items` and `children` values aren't saved (#308).
interface PanelProps {
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

  // Marks the fields of an element picked in the preview and keeps them in
  // view, whether they're a top-level group or nested in an Items or
  // Children editor (#432). A collapsed array item hides its nested fields,
  // so nothing is marked then.
  const selection = useMemo<ElementSelection>(
    () => ({
      ids: new Set(pickedId ? [pickedId] : []),
      scrollRootRef: rootRef,
    }),
    [pickedId],
  );

  if (!item) {
    return <p className={styles.empty}>{messages.panel.selectSection}</p>;
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
      className={styles.panel}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>{item.name}</h2>
        <div className={styles.actions}>
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
              tone="danger"
              icon={<Trash />}
              onClick={() => onDelete(item.id)}
              aria-label={messages.section.delete}
            />
          )}
        </div>
      </div>
      {readOnly && (
        <span role="status" className={styles.readOnly}>
          {messages.panel.readOnly}
        </span>
      )}
      {!groups.length && (
        <span className={styles.note}>{messages.panel.noEditableElements}</span>
      )}
      <ElementSelectionContext.Provider value={selection}>
        {groups.map(group => {
          const element = describeElement(group[0]!);

          return (
            <ElementFields
              key={group[0]!.id}
              id={group[0]!.id}
              role="group"
              aria-label={element.label}
              className={styles.element}
              header={
                // Only needed once fields of more than one element share the
                // panel; a single element reads the same as before (#514).
                groups.length > 1 && (
                  <div className={styles.elementHeader}>
                    <code className={styles.elementTag}>{element.tagName}</code>
                    {element.text && (
                      <span className={styles.elementText}>{element.text}</span>
                    )}
                  </div>
                )
              }
              bindings={group}
              onNodeChange={onNodeChange}
            />
          );
        })}
      </ElementSelectionContext.Provider>
    </div>
  );
};

export default Panel;
