import '@jbpark/ui-kit/style.css';

import './index.css';

import Context from './components/context';
import LiveDnd from './components/dnd';
import LiveEditor from './components/editor';
import LiveError from './components/error';
import LivePreview from './components/preview';

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

App.Preview = LivePreview;
App.Renderer = LiveRenderer;
App.Error = LiveError;
App.Editor = LiveEditor;
App.Dnd = LiveDnd;

export default App;
