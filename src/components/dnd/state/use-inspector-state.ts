import { useCallback, useState } from 'react';

import { useElementPosition, useKeyPress } from '@jbpark/use-hooks';

import { DATA_ATTR } from '~/constants';

import {
  type DndInspector,
  type DndNodePick,
  findElementById,
  pickElement,
  viewportRect,
} from '../inspector';
import type { SectionNodes } from './use-dnd-keyboard';

interface Options {
  selectedId: string | null;
  selectOnly: (id: string) => void;
  sectionNodes: SectionNodes;
  onNodePick?: (pick: DndNodePick) => void;
}

// The element picker (#432) and the outline a panel field draws on its
// element (#514). Returns the `useDndInspector()` value, the handlers a
// section's overlay calls while picking, and the box to outline, if any.
export const useInspectorState = ({
  selectedId,
  selectOnly,
  sectionNodes,
  onNodePick,
}: Options) => {
  // `picked` follows the selection: picking selects the element's section,
  // and selecting another section clears it.
  const [inspecting, setInspecting] = useState(false);
  const [picked, setPicked] = useState<DndNodePick | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  // The element a panel field points at (`inspector.highlight`).
  const [fieldTarget, setFieldTarget] = useState<string | null>(null);

  if (picked && picked.sectionId !== selectedId) {
    setPicked(null);
  }

  const stopInspecting = useCallback(() => {
    setInspecting(false);
    setHoverRect(null);
  }, []);

  useKeyPress('esc', stopInspecting, { enabled: inspecting });

  // Follows the element a panel field points at, through canvas scrolls,
  // resizes and re-renders, measuring its box in viewport coordinates. The
  // section is looked up when measuring, since `sectionNodes` is filled by
  // ref callbacks after render.
  const fieldRect = useElementPosition(
    () => {
      const section =
        selectedId === null ? undefined : sectionNodes.get(selectedId);

      return fieldTarget && section
        ? findElementById(section, fieldTarget)
        : null;
    },
    { measure: viewportRect },
  );

  const inspector: DndInspector = {
    active: inspecting,
    activate: () => setInspecting(true),
    deactivate: stopInspecting,
    toggle: () => (inspecting ? stopInspecting() : setInspecting(true)),
    picked,
    highlight: setFieldTarget,
  };

  const onInspectMove = (
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => {
    const element = pickElement(section, overlay, x, y);

    setHoverRect(element ? viewportRect(element) : null);
  };

  const onInspectPick = (
    sectionId: string,
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => {
    const id = pickElement(section, overlay, x, y)?.getAttribute(DATA_ATTR.ID);

    if (!id) {
      return;
    }

    const pick = { id, sectionId };

    selectOnly(sectionId);
    setPicked(pick);
    stopInspecting();
    onNodePick?.(pick);
  };

  return {
    inspector,
    inspecting,
    onInspectMove,
    onInspectPick,
    onInspectLeave: () => setHoverRect(null),
    // The picker's hover box while picking, otherwise the field's element.
    // `fieldRect` is only read while a field points somewhere, so a stale
    // box from the last target never shows.
    highlightRect: inspecting ? hoverRect : fieldTarget ? fieldRect : null,
  };
};
