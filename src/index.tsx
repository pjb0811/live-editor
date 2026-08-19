import '@jbpark/ui-kit/style.css';

import './index.css';

import Context from './components/context';
import LiveDnd, {
  type PaletteRenderData,
  type PanelBinding,
  type PanelRenderData,
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
  PaletteRenderData,
  PanelBinding,
  PanelRenderData,
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
