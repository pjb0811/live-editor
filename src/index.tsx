import './index.css';

import Context from './components/Context';
import LiveDnd from './components/Dnd';
import LiveEditor from './components/Editor';
import LiveError from './components/Error';
import LivePreview from './components/Preview';

const App = ({ children }: { children?: React.ReactNode }) => {
  return <Context>{children}</Context>;
};

export {
  LivePreview,
  LiveError,
  LiveEditor,
  LiveDnd,
  App as LiveProvider,
  //
};

App.Preview = LivePreview;
App.Error = LiveError;
App.Editor = LiveEditor;
App.Dnd = LiveDnd;

export default App;
