import { useState } from 'react';

// Import the DnD pieces directly rather than the package default (`~/.`): the
// default's namespace statically pulls in the CodeMirror/Prettier/TypeScript
// editor stack (~3.4 MB of TypeScript alone) that this demo never uses, and
// that static import defeats tree-shaking. Context + Dnd is all the drag-and-
// drop canvas needs.
import Context from '~/components/context';
import Dnd from '~/components/dnd';
import { DEFAULT_TEMPLATE } from '~/constants';

// The interactive Drag & Drop demo embedded in the docs' DnD page. Mirrors the
// app's own `pages/docs/dnd` (same props, same starting template) so the
// embedded demo matches what the full editor does.
const DndDemo = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);

  return (
    <Context>
      <div className="h-screen overflow-auto">
        <Dnd
          value={value}
          onChange={setValue}
          frame={{
            mode: 'iframe',
            syncStyle: true,
            // Fetched relative to this demo's own base (`/demos/dnd/`), so it
            // resolves to the copy dropped into the bundle's `js/` folder by
            // Vite's publicDir (the repo's `public/`), independent of where the
            // docs site is hosted.
            scripts: ['./js/tailwindcss.js'],
          }}
        />
      </div>
    </Context>
  );
};

export default DndDemo;
