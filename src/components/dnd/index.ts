import DndImpl, {
  type PaletteRenderData,
  type PanelRenderData,
  type Props,
} from './dnd';
import DraggableItem, {
  type DraggableItemDragState,
  type DraggableItemProps,
} from './draggable';
import { FieldEditor, type FieldEditorProps } from './panel';

type DndComponent = typeof DndImpl & {
  DraggableItem: typeof DraggableItem;
  FieldEditor: typeof FieldEditor;
};

const Dnd = DndImpl as DndComponent;

Dnd.DraggableItem = DraggableItem;
Dnd.FieldEditor = FieldEditor;

export { DraggableItem, FieldEditor };
export type {
  Props,
  PaletteRenderData,
  PanelRenderData,
  DraggableItemProps,
  DraggableItemDragState,
  FieldEditorProps,
};
export default Dnd;
