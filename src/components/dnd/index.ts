import DndImpl, {
  type PaletteRenderData,
  type PanelRenderData,
  type Props,
} from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';

type DndComponent = typeof DndImpl & {
  DraggableItem: typeof DraggableItem;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;

export { DraggableItem };
export type {
  Props,
  PaletteRenderData,
  PanelRenderData,
  DraggableItemProps,
  DraggableItemDragState,
};
export default Dnd;
