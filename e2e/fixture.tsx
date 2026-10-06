import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { EditorView } from '@uiw/react-codemirror';

import Live from '../src';
import { useDndPanel } from '../src/components/dnd';
import FieldGroup from '../src/components/dnd/panel/field-group';
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

// #564: a ui-kit Modal portaled into the `container` a shadow preview
// receives, in a preview box placed away from the page's corner. The counter
// shows whether the overlay layer lets clicks through while nothing is open.
const overlayCode = `import { useState } from 'react';
import * as ui from 'ui-kit';

const App = ({ container }) => {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 16 }}>
      <button id="count" onClick={() => setCount(count + 1)}>Count {count}</button>
      <button id="open" onClick={() => setOpen(true)}>Open</button>
      <ui.Modal
        open={open}
        title="Overlay"
        container={container}
        footer={<button id="close" onClick={() => setOpen(false)}>Close</button>}
        onCancel={() => setOpen(false)}
      >
        <p id="modal-body">Modal body</p>
      </ui.Modal>
    </div>
  );
};

export default App;`;

export const OverlayFixture = () => (
  <Live>
    <div
      id="preview-box"
      style={{
        position: 'absolute',
        left: 300,
        top: 200,
        width: 500,
        height: 400,
      }}
    >
      <Live.Preview
        code={overlayCode}
        frame={{ mode: 'shadow', syncStyle: true }}
      />
    </div>
  </Live>
);

// #565: overlays placed by `top`, `bottom` or a percentage `height`, which
// resolve against the iframe's viewport. A bottom sheet half the viewport
// tall, a dialog centred with `top: 50%` and `translateY(-50%)`, and a sheet
// moved below the viewport, as a closed drawer is. Each section also has
// 40px of flow content.
const positionedOverlay = (style: string) =>
  `<div style={{ position: 'fixed', left: 0, right: 0, ${style}, background: 'salmon' }} />`;

const positionedCode = `const App = () => (
  <main id="app-container">
    <section data-id="s-sheet" data-name="sheet">
      ${flowBlock(40)}
      ${positionedOverlay("bottom: 0, height: '50%'")}
    </section>
    <section data-id="s-dialog" data-name="dialog">
      ${flowBlock(40)}
      ${positionedOverlay("top: '50%', transform: 'translateY(-50%)', height: 300")}
    </section>
    <section data-id="s-offscreen" data-name="offscreen">
      ${flowBlock(40)}
      ${positionedOverlay("bottom: 0, height: '50%', transform: 'translateY(100%)'")}
    </section>
  </main>
);

export default App;`;

export const PositionedFixture = () => (
  <Live>
    <div style={{ height: 900 }}>
      <Live.Dnd value={positionedCode} frame={{ mode: 'iframe' }}>
        <Live.Dnd.Canvas />
      </Live.Dnd>
    </div>
  </Live>
);

// A healthy section beside one that throws while rendering, in either frame
// mode. The host drives two things a real frame has to get right: fixing the
// broken section's code (recovery without tearing its frame down), and
// adding, changing and removing a host stylesheet (`syncStyle`, #338).
const framesCode = `const App = () => (
  <main id="app-container">
    <section data-id="s-healthy" data-name="Healthy">
      <p id="themed" className="themed">themed text</p>
    </section>
    <section data-id="s-broken" data-name="Broken">
      <p id="broken">{brokenValue}</p>
    </section>
  </main>
);

export default App;`;

const HOST_STYLE_ID = 'host-theme';

const setHostStyle = (color: string | null) => {
  const existing = document.getElementById(HOST_STYLE_ID);

  if (color === null) {
    existing?.remove();

    return;
  }

  const style = existing ?? document.createElement('style');

  style.id = HOST_STYLE_ID;
  style.textContent = `.themed { color: ${color}; }`;
  document.head.append(style);
};

export const FramesFixture = () => {
  const [code, setCode] = useState(framesCode);
  const mode =
    new URLSearchParams(window.location.search).get('mode') === 'shadow'
      ? 'shadow'
      : 'iframe';

  return (
    <Live>
      <button
        onClick={() =>
          setCode(previous =>
            previous.replace('{brokenValue}', 'fixed section'),
          )
        }
      >
        Fix broken section
      </button>
      <button onClick={() => setHostStyle('rgb(255, 0, 0)')}>
        Add host style
      </button>
      <button onClick={() => setHostStyle('rgb(0, 0, 255)')}>
        Change host style
      </button>
      <button onClick={() => setHostStyle(null)}>Remove host style</button>
      <div style={{ height: 700 }}>
        <Live.Dnd
          value={code}
          onChange={setCode}
          frame={{ mode, syncStyle: true }}
        >
          <Live.Dnd.Canvas />
        </Live.Dnd>
      </div>
    </Live>
  );
};

// Two iframe sections with a script and a style injected through `frame`.
// Reordering them moves an iframe in the DOM, which reloads its document, and
// whatever was injected into the old document has to reach the new one.
const reorderSection = (id: string, name: string) => `
    <section data-id="${id}" data-name="${name}">
      <p id="${id}-text" className="injected">${name} section</p>
    </section>`;

const reorderCode = (first: string, second: string) => `const App = () => (
  <main id="app-container">${first}${second}
  </main>
);

export default App;`;

const firstSection = reorderSection('s-first', 'First');
const secondSection = reorderSection('s-second', 'Second');

const reorderFrame = {
  mode: 'iframe' as const,
  scripts: ['/e2e/frame-script.js'],
  styles: ['.injected { color: rgb(0, 128, 0); }'],
};

export const ReorderFixture = () => {
  const [code, setCode] = useState(reorderCode(firstSection, secondSection));

  return (
    <Live>
      <button onClick={() => setCode(reorderCode(secondSection, firstSection))}>
        Swap sections
      </button>
      <div style={{ height: 700 }}>
        <Live.Dnd value={code} onChange={setCode} frame={reorderFrame}>
          <Live.Dnd.Canvas />
        </Live.Dnd>
      </div>
    </Live>
  );
};

// The real CodeMirror editor, so its own undo history is what's under test,
// with the same probe panel as `SurfaceFixture` for the DnD side.
export const HistoryFixture = () => {
  const [code, setCode] = useState(documentCode);
  const [mode, setMode] = useState<'dnd' | 'editor'>('editor');

  return (
    <Live>
      <button onClick={() => setMode('dnd')}>DnD mode</button>
      <button onClick={() => setMode('editor')}>Editor mode</button>
      {mode === 'dnd' ? (
        <Live.Dnd value={code} onChange={setCode}>
          <Live.Dnd.Canvas />
          <SurfacePanel />
        </Live.Dnd>
      ) : (
        <Live.Editor value={code} onChange={setCode} debounce={0} />
      )}
      <output data-testid="source">{code}</output>
    </Live>
  );
};

// #409: the built-in panel's validation error, rendered with only the
// library's own stylesheet — no preflight, as in a consumer that doesn't run
// Tailwind's base layer. The field below it shows whether the error's margin
// leaks past `FieldGroup`'s `space-y-1`.
const fieldErrorBindings = [
  {
    id: 'link',
    label: 'Link',
    property: 'href',
    type: 'url' as const,
    value: 'https://example.com',
    rawValue: 'https://example.com',
    onChange: () => {},
  },
  {
    id: 'link',
    label: 'Text',
    property: 'innerText',
    value: 'Next',
    rawValue: 'Next',
    onChange: () => {},
  },
];

export const FieldErrorFixture = () => (
  <FieldGroup bindings={fieldErrorBindings} />
);

const scenario = new URLSearchParams(window.location.search).get('scenario');

const fixtures = {
  surfaces: <SurfaceFixture />,
  autoheight: <AutoHeightFixture />,
  transitions: <TransitionFixture />,
  positioned: <PositionedFixture />,
  frames: <FramesFixture />,
  overlay: <OverlayFixture />,
  reorder: <ReorderFixture />,
  history: <HistoryFixture />,
  'field-error': <FieldErrorFixture />,
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
