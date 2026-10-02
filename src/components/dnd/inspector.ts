import { createContext, useContext } from 'react';

import { DATA_ATTR } from '~/constants';

// What `Live.Dnd` reports when an element is picked in the canvas preview:
// the element's `data-id`, the key its fields carry in `useDndPanel()`, and
// the section it belongs to (#432).
export interface DndNodePick {
  id: string;
  sectionId: string;
}

// The element picker. While `active`, pointing at a section in the canvas
// outlines the element under the pointer, and clicking selects that section
// and reports the element. Section dragging is off for as long as it's on.
export interface DndInspector {
  active: boolean;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  // The last element picked, or `null`. Cleared when the selection moves to
  // another section.
  picked: DndNodePick | null;
}

export const DndInspectorContext = createContext<DndInspector | null>(null);

export const useDndInspector = (): DndInspector => {
  const inspector = useContext(DndInspectorContext);

  if (!inspector) {
    throw new Error('useDndInspector() must be used inside <Live.Dnd>.');
  }

  return inspector;
};

// A shadow root's `elementsFromPoint` lists the host page's elements under
// the point too, the canvas overlay among them, so a nested lookup keeps only
// its own tree's.
const outside = (root: Document | ShadowRoot) => (element: Element) =>
  element.getRootNode() !== root;

// The deepest element at a point, looking into iframes and shadow roots on
// the way down. Every canvas section sits under a transparent overlay that
// takes the pointer, so the hit test has to skip it and go through to the
// preview: in the host document for a section rendered in place, then inside
// the iframe document or shadow root for the other frame modes.
const deepestAt = (
  root: Document | ShadowRoot,
  x: number,
  y: number,
  skip: (element: Element) => boolean,
): Element | null => {
  const element = root
    .elementsFromPoint(x, y)
    .find(candidate => !skip(candidate));

  if (!element) {
    return null;
  }

  if (element instanceof HTMLIFrameElement) {
    const document = element.contentDocument;

    if (!document) {
      return element;
    }

    const rect = element.getBoundingClientRect();

    return (
      deepestAt(document, x - rect.left, y - rect.top, outside(document)) ??
      element
    );
  }

  if (element.shadowRoot && element.shadowRoot !== root) {
    return (
      deepestAt(element.shadowRoot, x, y, outside(element.shadowRoot)) ??
      element
    );
  }

  return element;
};

const hasId = (element: Element) => Boolean(element.getAttribute(DATA_ATTR.ID));

// The picked element inside `section`, as the nearest element at or above the
// point that carries a non-empty `data-id`. `null` outside the section, or
// when nothing there carries an id.
export const pickElement = (
  section: HTMLElement,
  overlay: Element,
  x: number,
  y: number,
): Element | null => {
  let element = deepestAt(
    section.ownerDocument,
    x,
    y,
    candidate =>
      candidate === overlay ||
      candidate === section ||
      !section.contains(candidate),
  );

  // Stops at the section's wrapper, so an id on the host page around the
  // canvas is never picked.
  while (element && element !== section && !hasId(element)) {
    element =
      element.parentElement ??
      // Past a shadow root, carry on from its host.
      (element.parentNode as ShadowRoot | null)?.host ??
      null;
  }

  return element === section ? null : element;
};

// The picked element's box in the host viewport, adding the offset of each
// iframe it's nested in.
export const viewportRect = (element: Element): DOMRect => {
  const rect = element.getBoundingClientRect();
  let x = rect.left;
  let y = rect.top;
  let frame = element.ownerDocument.defaultView?.frameElement ?? null;

  while (frame) {
    const frameRect = frame.getBoundingClientRect();

    x += frameRect.left;
    y += frameRect.top;
    frame = frame.ownerDocument.defaultView?.frameElement ?? null;
  }

  return new DOMRect(x, y, rect.width, rect.height);
};
