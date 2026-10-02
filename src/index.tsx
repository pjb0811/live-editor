import './index.css';

import Context from './components/context';
import LiveDnd, {
  type DndEditError,
  type DndInspector,
  type DndItems,
  type DndItemsItem,
  type DndItemsOptions,
  type DndLayout,
  type DndNodePick,
  type DndPalette,
  type DndPanel,
  type DndRenderField,
  type DndRenderSectionFallback,
  type DndSectionFallbackArgs,
  type FieldProps,
  type ItemsEditor,
  type ItemsEditorItem,
  type ItemsEditorOptions,
  type PanelBinding,
  type PanelNodeChange,
  type PanelNodesChange,
} from './components/dnd';
import LiveEditor, { type EditorRenderData } from './components/editor';
import LiveError from './components/error';
import { type FrameProps } from './components/frame';
import LivePreview from './components/preview';
import type { Section } from './types';

const App = ({ children }: { children?: React.ReactNode }) => {
  return <Context>{children}</Context>;
};

const LiveRenderer = LivePreview;

export {
  LivePreview,
  LiveError,
  LiveEditor,
  LiveDnd,
  LiveRenderer,
  App as LiveProvider,
  //
};

export type {
  DndEditError,
  DndRenderField,
  DndRenderSectionFallback,
  DndSectionFallbackArgs,
  DndPalette,
  DndPanel,
  DndLayout,
  DndInspector,
  DndNodePick,
  PanelBinding,
  PanelNodeChange,
  PanelNodesChange,
  FieldProps,
  DndItems,
  DndItemsItem,
  DndItemsOptions,
  // Deprecated aliases of the three above, kept until the next major.
  ItemsEditor,
  ItemsEditorItem,
  ItemsEditorOptions,
  EditorRenderData,
  FrameProps,
  Section,
};

App.Preview = LivePreview;
App.Renderer = LiveRenderer;
App.Error = LiveError;
App.Editor = LiveEditor;
App.Dnd = LiveDnd;

export default App;
