import { useCallback, useEffect, useState } from 'react';

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
  // The element a panel field points at (`inspector.highlight`), and its box
  // in the viewport while it's on screen.
  const [fieldTarget, setFieldTarget] = useState<string | null>(null);
  const [fieldRect, setFieldRect] = useState<DOMRect | null>(null);

  if (picked && picked.sectionId !== selectedId) {
    setPicked(null);
  }

  const stopInspecting = useCallback(() => {
    setInspecting(false);
    setHoverRect(null);
  }, []);

  useEffect(() => {
    if (!inspecting) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopInspecting();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspecting, stopInspecting]);

  // Follows the element a panel field points at, through canvas scrolls and
  // resizes, since the outline is drawn in fixed viewport coordinates.
  useEffect(() => {
    const section = selectedId === null ? null : sectionNodes.get(selectedId);

    if (!fieldTarget || !section) {
      return;
    }

    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = findElementById(section, fieldTarget);

        setFieldRect(element ? viewportRect(element) : null);
      });
    };

    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [fieldTarget, selectedId, sectionNodes]);

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
