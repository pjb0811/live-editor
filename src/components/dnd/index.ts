import DndImpl, {
  type DndPalette,
  type DndPanel,
  type PanelBinding,
  type PanelNodeChange,
  type Props,
} from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';
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
import Field, { type FieldProps } from './panel/field';
import { ICON_MAP, ICON_OPTIONS } from './panel/icon-map';
import {
  type ItemsEditor,
  type ItemsEditorActions,
  type ItemsEditorItem,
  type ItemsEditorNestedElement,
  type ItemsEditorNestedGroup,
  type ItemsEditorOptions,
  useItemsEditor,
} from './panel/use-items-editor';

type DndComponent = typeof DndImpl & {
  // Owns the dnd-kit wiring for a palette item and hands back `ref` /
  // `dragProps` / `isDragging`, so a custom palette decides how an item
  // *looks* without reimplementing how dragging works.
  DraggableItem: typeof DraggableItem;
  // The built-in control for one binding, exported so a custom panel can mix
  // its own controls with the built-in one per binding rather than choosing
  // all-or-nothing. Takes a `PanelBinding` straight out of `bindings` plus
  // `onNodeChange` — both `useDndPanel()` fields, so nothing internal is
  // needed to drive it. Most useful for `items`/`children` bindings, whose
  // editors find nested data-bound elements a consumer can't reach through
  // `bindings`. Renders the control only — supply your own label.
  Field: typeof Field;
  // The three built-in regions, each in the container it needs. Pass them as
  // `children` of `Live.Dnd` in any arrangement to own the layout, mixing in
  // your own components where you want to replace one. `Canvas` is the one
  // that can't be replaced — the droppable, the sortable list and each
  // section's compiled iframe are Dnd's own machinery — so render it exactly
  // once wherever the canvas belongs.
  Palette: typeof Palette;
  Canvas: typeof Canvas;
  Panel: typeof Panel;
  // The built-in arrangement: the 3-pane desktop Splitter, the stacked
  // mobile canvas, and the mobile FAB/Drawers. What `Live.Dnd` renders when
  // given no children, exported so children can wrap it (a toolbar above it,
  // say) or replace one region through its `palette`/`panel` slots without
  // rebuilding the rest. Also the only way to reach the built-in Splitter
  // layout without importing `@jbpark/ui-kit` directly, which a consumer may
  // not have as a direct dependency.
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
// The data behind each region, so a component placed in `Live.Dnd`'s children
// can replace one without losing what drives it: the palette's items and
// `onAdd`, the panel's selected section/bindings/commit callbacks, and the
// layout state the built-in mobile chrome runs on (`isMobile`, `selectedId` /
// `clearSelection`, the palette Drawer's open state) — needed because
// supplying children replaces that chrome along with the Splitter.
export { useDndPalette, useDndPanel, useDndLayout };
// The array-editing engine behind the built-in Items panel, exposed for a
// consumer who wants their own markup rather than the built-in control
// (`Field` covers the latter). Everything it returns is `PanelBinding`s, so
// the two compose: render the hook's own layout and hand individual
// bindings to `Field` where the built-in control is good enough.
export { useItemsEditor };
// The built-in panel's own `widget: 'icon-picker'` icon set/options —
// exported so a custom panel can reach icon-picker parity (name ->
// lucide-react component, and the same label/value pairs fed to Select)
// instead of reimplementing an icon library, per #236/#237.
export { ICON_MAP, ICON_OPTIONS };
export type {
  Props,
  DndPalette,
  DndPanel,
  DndLayout,
  DndLayoutProps,
  DndRegionProps,
  PanelBinding,
  PanelNodeChange,
  FieldProps,
  ItemsEditor,
  ItemsEditorActions,
  ItemsEditorItem,
  ItemsEditorNestedElement,
  ItemsEditorNestedGroup,
  ItemsEditorOptions,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
