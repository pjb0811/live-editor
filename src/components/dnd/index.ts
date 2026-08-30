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
import { ICON_MAP } from './panel/icon-map';

type DndComponent = typeof DndImpl & {
  DraggableItem: typeof DraggableItem;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;

export { DraggableItem };
// The built-in panel's own `widget: 'icon-picker'` icon set — exported so a
// custom renderPanel can opt into it (name -> lucide-react component)
// instead of reimplementing an icon library, per #236.
export { ICON_MAP };
export type {
  Props,
  PaletteRenderData,
  PanelRenderData,
  PanelBinding,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
