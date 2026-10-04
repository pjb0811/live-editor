import { useState } from 'react';

import Live from '~/index';

import { META_DOCUMENT } from '../../../demos/panel-meta/meta-example';
import PanelMetaDemo from '../../../demos/panel-meta/panel-meta-demo';
import { EditorView, ModeSwitch, type ViewMode } from '../shared/editor-view';

// The docs demo for the common `meta` keys, mounted as is: a panel that
// reads `tab`, `group`, `description`, `hint` and `visible` from
// `binding.meta`. The page holds the document, so the Editor view shows the
// same code the demo edits.
const PanelMeta = () => {
  const [value, setValue] = useState(META_DOCUMENT);
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
          <PanelMetaDemo value={value} onChange={setValue} />
        )}
      </div>
    </div>
  );
};

export default PanelMeta;
