import DndImpl from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';
import type { DndEditError, DndRenderField } from './edit-options';
import {
  type DndInspector,
  type DndNodePick,
  useDndInspector,
} from './inspector';
import {
  Canvas,
  type DndLayoutProps,
  type DndRegionProps,
  Layout,
  Palette,
  Panel,
} from './layout';
import {
  type DndLayout,
  useDndLayout,
  useDndPalette,
  useDndPanel,
} from './layout-context';
import type {
  PanelBinding,
  PanelNodeChange,
  PanelNodesChange,
} from './panel-binding';
import Field, { type FieldProps } from './panel/field';
import {
  type DndChildren,
  type DndChildrenOptions,
  useDndChildren,
} from './panel/use-dnd-children';
import {
  type DndItems,
  type DndItemsActions,
  type DndItemsExpansion,
  type DndItemsItem,
  type DndItemsNestedElement,
  type DndItemsNestedGroup,
  type DndItemsOptions,
  useDndItems,
} from './panel/use-dnd-items';
import type {
  DndRenderSectionFallback,
  DndSectionFallbackArgs,
} from './section-fallback-context';
import type { DndPalette, DndPanel, Props } from './types';

type DndComponent = typeof DndImpl & {
  // Makes a palette item draggable and hands back `ref`, `dragProps` and
  // `isDragging`, so a custom palette only decides how the item looks.
  DraggableItem: typeof DraggableItem;
  // The built-in control for one binding, so a custom panel can use it for
  // some bindings and its own controls for others. Takes a `PanelBinding`
  // and `onNodeChange`, both from `useDndPanel()`. Most useful for `items`
  // and `children`, whose editors reach nested elements that `bindings`
  // doesn't list. Renders the control only, without a label.
  Field: typeof Field;
  // The three built-in regions, each in the container it needs. Place them
  // in `Live.Dnd`'s `children` in any arrangement, with your own components
  // in place of any of them except `Canvas`, which can't be replaced. Render
  // `Canvas` exactly once.
  Palette: typeof Palette;
  Canvas: typeof Canvas;
  Panel: typeof Panel;
  // The built-in arrangement, which `Live.Dnd` renders without children: a
  // three-pane Splitter on desktop, and on mobile the canvas with a button
  // and Drawers. Use it to wrap the editor (a toolbar above it, say) or to
  // replace one region through its `palette` or `panel` slot.
  Layout: typeof Layout;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;
Dnd.Field = Field;
Dnd.Palette = Palette;
Dnd.Canvas = Canvas;
Dnd.Panel = Panel;
Dnd.Layout = Layout;

export { DraggableItem, Field };
export { Palette, Canvas, Panel, Layout };
// The data behind each region, for components in `Live.Dnd`'s children:
// the palette's items and `onAdd`, the panel's section, bindings and
// commits, and the layout state the mobile Drawers run on, which a custom
// layout replaces.
export { useDndPalette, useDndPanel, useDndLayout };
// The element picker: turn it on, and clicking an element in the canvas
// preview selects its section and reports the element's `data-id` (#432).
export { useDndInspector };
// What the built-in Children editor runs on, for your own markup. It works
// on the children as extracted nodes; read their fields with the two
// functions below.
export { useDndChildren };
export type { DndChildren, DndChildrenOptions };
// What the built-in Items editor runs on, for your own markup. Its items'
// fields are `PanelBinding`s, so `Field` can render any of them.
export { useDndItems };
// The two steps behind `useDndPanel().bindings`, for elements the panel
// doesn't list, such as the children `useDndChildren` returns.
// `resolvePanelBindings` reads the bindings; `withPanelCommit` adds
// `onNodeChange`. The result is `PanelBinding`s for `Field`.
export { resolvePanelBindings, withPanelCommit } from './panel-binding';
export type {
  PanelBindingData,
  PanelBindingElement,
  PanelBindingSource,
} from './panel-binding';
// How `Field` picks its built-in control, for a custom panel that sends
// some bindings (often `items` and `children`) to `Field` or a hook.
export { getFieldKind, isStructuralFieldKind } from './panel/field-kind';
export type { FieldKind, FieldKindBinding } from './panel/field-kind';

// The earlier names of these hooks and types, kept as deprecated aliases
// until the next major: `useItemsEditor` → `useDndItems`,
// `useChildrenEditor` → `useDndChildren`, `ItemsEditor*` → `DndItems*`,
// `ChildrenEditor*` → `DndChildren*`.
/** @deprecated Renamed to `useDndItems`. */
export const useItemsEditor = useDndItems;
/** @deprecated Renamed to `useDndChildren`. */
export const useChildrenEditor = useDndChildren;
/** @deprecated Renamed to `DndItems`. */
export type ItemsEditor = DndItems;
/** @deprecated Renamed to `DndItemsActions`. */
export type ItemsEditorActions = DndItemsActions;
/** @deprecated Renamed to `DndItemsItem`. */
export type ItemsEditorItem = DndItemsItem;
/** @deprecated Renamed to `DndItemsNestedElement`. */
export type ItemsEditorNestedElement = DndItemsNestedElement;
/** @deprecated Renamed to `DndItemsNestedGroup`. */
export type ItemsEditorNestedGroup = DndItemsNestedGroup;
/** @deprecated Renamed to `DndItemsOptions`. */
export type ItemsEditorOptions = DndItemsOptions;
/** @deprecated Renamed to `DndChildren`. */
export type ChildrenEditor = DndChildren;
/** @deprecated Renamed to `DndChildrenOptions`. */
export type ChildrenEditorOptions = DndChildrenOptions;
export type {
  Props,
  DndPalette,
  DndPanel,
  DndLayout,
  DndInspector,
  DndNodePick,
  DndLayoutProps,
  DndRegionProps,
  PanelBinding,
  PanelNodeChange,
  PanelNodesChange,
  FieldProps,
  DndEditError,
  DndRenderField,
  DndRenderSectionFallback,
  DndSectionFallbackArgs,
  DndItems,
  DndItemsActions,
  DndItemsExpansion,
  DndItemsItem,
  DndItemsNestedElement,
  DndItemsNestedGroup,
  DndItemsOptions,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
