// A document whose sections open a ui-kit Modal and Drawer. `App` takes the
// `container` every framed preview receives and passes it on, so the overlay
// opens inside the preview rather than over the host page (#564).
//
// The canvas covers each section to select it, so a section's button can't
// be clicked there. `open` is a boolean binding instead: switch it in the
// panel to open the overlay on the canvas. In the editor view's preview the
// buttons work too.
//
// Each section has a minimum height. A shadow preview has no `autoHeight`,
// so an overlay is laid out in its section's own box, which needs the room.
export const OVERLAYS_DOCUMENT = `
import { useEffect, useState } from 'react';
import * as ui from 'ui-kit';

// Opens from its button, or from \`open\` when the panel switches it.
const useOpen = _open => {
  const [open, setOpen] = useState(_open);

  useEffect(() => setOpen(_open), [_open]);

  return [open, setOpen];
};

const ModalExample = ({ open: _open = false, title, container }) => {
  const [open, setOpen] = useOpen(_open);

  return (
    <>
      <ui.Button type="primary" onClick={() => setOpen(true)}>
        Open modal
      </ui.Button>
      <ui.Modal
        open={open}
        title={title}
        container={container}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        A ui-kit Modal portaled into the preview's container.
      </ui.Modal>
    </>
  );
};

const DrawerExample = ({ open: _open = false, title, container }) => {
  const [open, setOpen] = useOpen(_open);

  return (
    <>
      <ui.Button type="primary" onClick={() => setOpen(true)}>
        Open drawer
      </ui.Button>
      <ui.Drawer
        open={open}
        title={title}
        container={container}
        onClose={() => setOpen(false)}
      >
        A ui-kit Drawer portaled into the preview's container.
      </ui.Drawer>
    </>
  );
};

const App = ({ container }) => {
  return (
    <main id="app-container">
      <section data-name="Modal" className="flex min-h-80 flex-col items-start gap-3 p-8">
        <h2 className="text-xl font-bold">Modal</h2>
        <ModalExample
          data-id=""
          data-binding={[
            { label: 'Open', property: 'open', type: 'boolean' },
            { label: 'Title', property: 'title' },
          ]}
          open={false}
          title="Modal title"
          container={container}
        />
      </section>
      <section data-name="Drawer" className="flex min-h-80 flex-col items-start gap-3 p-8">
        <h2 className="text-xl font-bold">Drawer</h2>
        <DrawerExample
          data-id=""
          data-binding={[
            { label: 'Open', property: 'open', type: 'boolean' },
            { label: 'Title', property: 'title' },
          ]}
          open={false}
          title="Drawer title"
          container={container}
        />
      </section>
    </main>
  );
};

export default App;
`;
