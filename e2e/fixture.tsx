import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { EditorView } from '@uiw/react-codemirror';

import Live from '../src';
import { useDndPanel } from '../src/components/dnd';
import Items from '../src/components/dnd/panel/items';

const selectionItems = `[{ label: 'A' }, { label: 'B' }, { label: 'C' }]`;
const fallbackItems = `[
  { key: 'a', children: <div>A content</div> },
  { key: 'b', children: <div>B content</div> },
]`;
const documentCode = `const App = () => (
  <main id="app-container">
    <section data-id="section-a" data-name="First">
      <h1 data-id="title-a" data-binding={[{ label: 'Title', property: 'innerText' }]}>A title</h1>
    </section>
    <section data-id="section-b" data-name="Second">
      <h1 data-id="title-b" data-binding={[{ label: 'Title', property: 'innerText' }]}>B title</h1>
    </section>
  </main>
);

export default App;`;

interface EditorSnapshot {
  document: string;
  selection: number;
  hasFocus: boolean;
}

declare global {
  interface Window {
    browserTestEditor: {
      read: (needle: string) => EditorSnapshot | null;
      focusAt: (needle: string, position: number) => void;
    };
  }
}

const findView = (needle: string): EditorView | undefined => {
  const editors = document.querySelectorAll<HTMLElement>('.cm-editor');

  for (const editor of editors) {
    const view = EditorView.findFromDOM(editor);

    if (view?.state.doc.toString().includes(needle)) {
      return view;
    }
  }

  return undefined;
};

window.browserTestEditor = {
  read: needle => {
    const view = findView(needle);

    if (!view) {
      return null;
    }

    return {
      document: view.state.doc.toString(),
      selection: view.state.selection.main.head,
      hasFocus: view.hasFocus,
    };
  },
  focusAt: (needle, position) => {
    const view = findView(needle);

    if (!view) {
      throw new Error(`Editor containing "${needle}" was not found`);
    }

    view.dispatch({ selection: { anchor: position } });
    view.focus();
  },
};

export const ItemsFixture = () => {
  const [value, setValue] = useState(
    new URLSearchParams(window.location.search).get('scenario') === 'fallback'
      ? fallbackItems
      : selectionItems,
  );

  return (
    <main>
      <Items value={value} onChange={setValue} />
      <output data-testid="source">{value}</output>
    </main>
  );
};

export const SurfacePanel = () => {
  const { item, bindings } = useDndPanel();

  return (
    <aside>
      <span data-testid="selected-section">{item?.name ?? 'none'}</span>
      <button
        data-testid="panel-edit"
        disabled={!bindings[0]}
        onClick={() => bindings[0]?.onChange('A panel')}
      >
        Edit selected title
      </button>
    </aside>
  );
};

export const SurfaceFixture = () => {
  const [code, setCode] = useState(documentCode);
  const [mode, setMode] = useState<'dnd' | 'editor'>('dnd');

  return (
    <Live>
      <button onClick={() => setMode('dnd')}>DnD mode</button>
      <button onClick={() => setMode('editor')}>Editor mode</button>
      <button
        onClick={() =>
          setCode(previous => previous.replace('B title', 'B external'))
        }
      >
        External edit of B
      </button>
      {mode === 'dnd' ? (
        <Live.Dnd value={code} onChange={setCode}>
          <Live.Dnd.Canvas />
          <SurfacePanel />
        </Live.Dnd>
      ) : (
        <Live.Editor
          value={code}
          onChange={setCode}
          debounce={0}
          renderEditor={({ value, onChange }) => (
            <textarea
              data-testid="raw-editor"
              value={value}
              onChange={event => onChange(event.target.value)}
            />
          )}
        />
      )}
      <output data-testid="source">{code}</output>
    </Live>
  );
};

const scenario = new URLSearchParams(window.location.search).get('scenario');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {scenario === 'surfaces' ? <SurfaceFixture /> : <ItemsFixture />}
  </StrictMode>,
);
