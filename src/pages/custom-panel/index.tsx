import { useState } from 'react';

import { DEFAULT_TEMPLATE } from '~/constants';
import Live from '~/index';

import CustomPalettePanelDemo from '../../../demos/custom-palette-panel/custom-palette-panel-demo';
import { EditorView, ModeSwitch, type ViewMode } from '../shared/editor-view';

// The docs demo for custom regions, mounted as is: a custom palette built on
// `DraggableItem`, panels built on `useDndPanel()`, `Field`, `useDndItems()`
// and `useDndChildren()`, and a layout of its own. Reusing it keeps the docs
// example and this check from drifting apart. The page holds the document,
// so the Editor view shows the same code the demo edits.
const CustomPanel = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);
  const [mode, setMode] = useState<ViewMode>('dnd');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-3 py-1.5">
        <ModeSwitch value={mode} onChange={setMode} />
      </div>
      <div className="min-h-0 flex-1">
        {mode === 'editor' ? (
          <div className="h-full p-2">
            <Live>
              <EditorView value={value} onChange={setValue} />
            </Live>
          </div>
        ) : (
          <CustomPalettePanelDemo value={value} onChange={setValue} />
        )}
      </div>
    </div>
  );
};

export default CustomPanel;
