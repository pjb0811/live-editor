import DndImpl, {
  type PaletteRenderData,
  type PanelBinding,
  type PanelNodeChange,
  type PanelRenderData,
  type Props,
} from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';
import Field, { type FieldProps } from './panel/field';
import { ICON_MAP, ICON_OPTIONS } from './panel/icon-map';
import DefaultPanel, { type PanelProps } from './panel/panel';

type DndComponent = typeof DndImpl & {
  DraggableItem: typeof DraggableItem;
  // The built-in property panel, exported so a `renderPanel` can wrap or
  // partially override it instead of starting from zero — see #237. Its
  // props line up with `PanelRenderData` (drop `onChange`; `bindings` and
  // `onNodeChange` are the same), so `<DefaultPanel {...data} />` inside a
  // `renderPanel` is lossless. See panel.tsx's own doc comment for why
  // `onNodeChange` is optional there but required in `PanelRenderData`.
  DefaultPanel: typeof DefaultPanel;
  // The built-in control for one binding, exported so a custom panel can
  // mix its own controls with the built-in one per binding instead of
  // choosing all-or-nothing between `renderPanel` and `DefaultPanel`. Takes
  // a `PanelBinding` straight out of `bindings` plus `onNodeChange` — both
  // public `PanelRenderData` fields, so nothing internal is needed to drive
  // it. Most useful for `items`/`children` bindings, whose editors find
  // nested data-bound elements a consumer can't reach through `bindings`.
  // Renders the control only — supply your own label.
  Field: typeof Field;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;
Dnd.DefaultPanel = DefaultPanel;
Dnd.Field = Field;

export { DraggableItem, DefaultPanel, Field };
// The built-in panel's own `widget: 'icon-picker'` icon set/options —
// exported so a custom renderPanel can reach icon-picker parity (name ->
// lucide-react component, and the same label/value pairs fed to Select)
// instead of reimplementing an icon library, per #236/#237.
export { ICON_MAP, ICON_OPTIONS };
export type {
  Props,
  PaletteRenderData,
  PanelRenderData,
  PanelBinding,
  PanelNodeChange,
  PanelProps,
  FieldProps,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
