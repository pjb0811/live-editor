import Live from '~/index';

// A document whose top-level code counts its runs, so a test can tell
// whether the server compiled and ran it.
export const SERVER_DOCUMENT = `globalThis.__serverRuns = (globalThis.__serverRuns ?? 0) + 1;
const App = () => (
  <main id="app-container">
    <section data-id="s1" data-name="One"><p id="previewed">hello</p></section>
  </main>
);
export default App;`;

export const runs = () =>
  (globalThis as { __serverRuns?: number }).__serverRuns ?? 0;

export const resetRuns = () => {
  delete (globalThis as { __serverRuns?: number }).__serverRuns;
};

// Every surface that renders a preview, with each frame mode. `rendersOnServer`
// is whether the server HTML holds the previewed markup.
export const SERVER_CASES: {
  name: string;
  tree: () => React.ReactNode;
  rendersOnServer: boolean;
}[] = [
  {
    name: 'Live.Preview',
    tree: () => <Live.Preview code={SERVER_DOCUMENT} />,
    rendersOnServer: true,
  },
  {
    name: 'Live.Preview showError',
    tree: () => <Live.Preview code={SERVER_DOCUMENT} showError />,
    rendersOnServer: true,
  },
  {
    name: 'Live.Preview frame',
    tree: () => <Live.Preview code={SERVER_DOCUMENT} frame />,
    rendersOnServer: false,
  },
  {
    name: 'Live.Preview shadow frame',
    tree: () => (
      <Live.Preview
        code={SERVER_DOCUMENT}
        frame={{ mode: 'shadow', syncStyle: true }}
      />
    ),
    rendersOnServer: false,
  },
  {
    name: 'Live.Preview iframe frame',
    tree: () => (
      <Live.Preview
        code={SERVER_DOCUMENT}
        frame={{ mode: 'iframe', syncStyle: true }}
      />
    ),
    rendersOnServer: false,
  },
  {
    name: 'Live.Dnd',
    tree: () => <Live.Dnd value={SERVER_DOCUMENT} />,
    rendersOnServer: false,
  },
  {
    name: 'Live.Dnd iframe frame',
    tree: () => (
      <Live.Dnd
        value={SERVER_DOCUMENT}
        frame={{ mode: 'iframe', syncStyle: true }}
      />
    ),
    rendersOnServer: false,
  },
  {
    name: 'Live.Dnd shadow frame',
    tree: () => (
      <Live.Dnd
        value={SERVER_DOCUMENT}
        frame={{ mode: 'shadow', syncStyle: true }}
      />
    ),
    rendersOnServer: false,
  },
];
