import { useState } from 'react';

// Import the DnD pieces directly rather than the package default (`~/.`), so
// this demo's bundle doesn't statically pull in the standalone Editor
// component that it never renders. Note @jbpark/live-editor/dnd (#194)
// wouldn't meaningfully shrink this further: the property panel's jsx/
// richtext field editing (panel/field.tsx) already reuses the editor's own
// CodeMirror Core + prettier internally, so CodeMirror/prettier are a real
// transitive dependency of Dnd itself, not just an artifact of this import
// path. Context + Dnd is all the drag-and-drop canvas needs.
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
          frame={{ mode: 'shadow' }}
          dynamicTailwind
        />
      </div>
    </Context>
  );
};

export default DndDemo;
