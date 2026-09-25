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

// #374: every section holds the same 400px-tall `position: fixed` element,
// which only autoHeight's descendant walk can account for — nothing about it
// contributes to the document's own scrollHeight.
//
// The fade-in sections use a long `animation-delay` with
// `animation-fill-mode: backwards` rather than a short animation caught
// part-way through. Both put the element at computed `opacity: 0` with a
// `running` animation, which is the state the walk has to get right, but the
// delay phase holds it there indefinitely instead of leaving the assertion
// racing the animation clock. `finish()` from the test then completes them on
// demand.
const fixedBlock = (extra = '') =>
  `<div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 400, background: 'salmon'${extra} }} />`;

const flowBlock = (height: number) =>
  `<p style={{ margin: 0, height: ${height} }}>flow</p>`;

const keyframes = (name: string, from: number, to: number) =>
  `<style>{'@keyframes ${name} { from { opacity: ${from} } to { opacity: ${to} } }'}</style>`;

const autoHeightCode = `const Growing = () => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    ref.current?.animate([{ height: '0px' }, { height: '400px' }], {
      duration: 30000,
      easing: 'linear',
      fill: 'forwards',
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 0, overflow: 'hidden', background: 'salmon' }}
    />
  );
};

const App = () => (
  <main id="app-container">
    <section data-id="s-static" data-name="static">
      ${fixedBlock()}
    </section>
    <section data-id="s-fade" data-name="fade">
      ${keyframes('fadein', 0, 1)}
      ${fixedBlock(", animation: 'fadein 300ms linear 30s backwards'")}
    </section>
    <section data-id="s-fade-flow" data-name="fade-flow">
      ${keyframes('fadein', 0, 1)}
      ${flowBlock(40)}
      ${fixedBlock(", animation: 'fadein 300ms linear 30s backwards'")}
    </section>
    <section data-id="s-closed" data-name="closed">
      ${flowBlock(60)}
      ${fixedBlock(', opacity: 0')}
    </section>
    <section data-id="s-fading-out" data-name="fading-out">
      ${keyframes('fadeout', 1, 0)}
      ${flowBlock(60)}
      ${fixedBlock(", animation: 'fadeout 30s linear forwards'")}
    </section>
    <section data-id="s-waapi" data-name="waapi">
      <Growing />
    </section>
  </main>
);

export default App;`;

// A measurement pass used to cancel every transition in the preview outright,
// so an overlay opened by a class or style change snapped to its end state
// instead of fading. One section, one overlay, driven by the test.
const transitionCode = `const App = () => (
  <main id="app-container">
    <section data-id="s-transition" data-name="transition">
      <p style={{ margin: 0, height: 60 }}>flow</p>
      <div
        id="overlay"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: 0,
          height: 400,
          background: 'salmon',
          opacity: 0,
          transition: 'opacity 5s linear',
        }}
      />
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

export const AutoHeightFixture = () => (
  <Live>
    {/* Tall enough that probeHeight never caps a 400px estimate. */}
    <div style={{ height: 900 }}>
      <Live.Dnd value={autoHeightCode} frame={{ mode: 'iframe' }}>
        <Live.Dnd.Canvas />
      </Live.Dnd>
    </div>
  </Live>
);

export const TransitionFixture = () => (
  <Live>
    <div style={{ height: 900 }}>
      <Live.Dnd value={transitionCode} frame={{ mode: 'iframe' }}>
        <Live.Dnd.Canvas />
      </Live.Dnd>
    </div>
  </Live>
);

const scenario = new URLSearchParams(window.location.search).get('scenario');

const fixtures = {
  surfaces: <SurfaceFixture />,
  autoheight: <AutoHeightFixture />,
  transitions: <TransitionFixture />,
} as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {scenario && scenario in fixtures ? (
      fixtures[scenario as keyof typeof fixtures]
    ) : (
      <ItemsFixture />
    )}
  </StrictMode>,
);
