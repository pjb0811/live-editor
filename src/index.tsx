import './index.css';

import Context, {
  type Props as ContextProps,
  type LiveMessages,
  type LiveMessagesInput,
} from './components/context';
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
  type PanelBinding,
  type PanelNodeChange,
  type PanelNodesChange,
} from './components/dnd';
import LiveEditor, { type EditorRenderData } from './components/editor';
import LiveError from './components/error';
import { type FrameProps } from './components/frame';
import LivePreview from './components/preview';
import type { Section } from './types';
import type {
  BindingKeyMap,
  BindingOptions,
  BindingRegistry,
  BindingSchema,
} from './utils/ast/types';

const App = ({ children, messages }: ContextProps) => {
  return <Context messages={messages}>{children}</Context>;
};

const LiveRenderer = LivePreview;

// The editor's text, for a host that translates it (#524). This is the
// package entry, which Fast Refresh never reloads.
// eslint-disable-next-line react-refresh/only-export-components
export { defaultMessages, useLiveMessages } from './components/context';

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
  EditorRenderData,
  FrameProps,
  Section,
  BindingRegistry,
  BindingKeyMap,
  BindingOptions,
  BindingSchema,
  LiveMessages,
  LiveMessagesInput,
};

App.Preview = LivePreview;
App.Renderer = LiveRenderer;
App.Error = LiveError;
App.Editor = LiveEditor;
App.Dnd = LiveDnd;

export default App;
