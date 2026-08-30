import DndImpl, {
  type PaletteRenderData,
  type PanelBinding,
  type PanelRenderData,
  type Props,
} from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';
import { ICON_MAP, ICON_OPTIONS } from './panel/icon-map';
import DefaultPanel, { type PanelProps } from './panel/panel';

type DndComponent = typeof DndImpl & {
  DraggableItem: typeof DraggableItem;
  // The built-in property panel, exported so a `renderPanel` can wrap or
  // partially override it instead of starting from zero — see #237. Its
  // props line up with `PanelRenderData` (drop `onChange`; `bindings`
  // is the same array). See panel.tsx's own doc comment for the one
  // exception (`onNodeChange`, optional, internal-only).
  DefaultPanel: typeof DefaultPanel;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;
Dnd.DefaultPanel = DefaultPanel;

export { DraggableItem, DefaultPanel };
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
  PanelProps,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
