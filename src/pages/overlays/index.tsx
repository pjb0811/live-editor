import { useState } from 'react';

import { Radio } from '@jbpark/ui-kit';

import type { FrameProps } from '~/components/frame';
import Live from '~/index';

import { EditorView, ModeSwitch, type ViewMode } from '../shared/editor-view';
import { IFRAME_FRAME, SHADOW_FRAME } from '../shared/frames';
import { OVERLAYS_DOCUMENT } from './document';

const FRAMES: Record<'iframe' | 'shadow', FrameProps> = {
  iframe: IFRAME_FRAME,
  shadow: SHADOW_FRAME,
};

const frameOptions = [
  { label: 'iframe', value: 'iframe' },
  { label: 'shadow', value: 'shadow' },
];

// A Modal and a Drawer in sections, portaled into the preview's `container`,
// in either frame mode. On the canvas, open them with the panel's Open
// switch; in the editor view, with their buttons.
const Overlays = () => {
  const [value, setValue] = useState(OVERLAYS_DOCUMENT);
  const [mode, setMode] = useState<ViewMode>('dnd');
  const [frameMode, setFrameMode] = useState<keyof typeof FRAMES>('iframe');
  const frame = FRAMES[frameMode];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b
          border-gray-200 px-3 py-1.5 text-xs"
      >
        <ModeSwitch value={mode} onChange={setMode} />
        <Radio.Group
          size="small"
          value={frameMode}
          options={frameOptions}
          optionType="button"
          onChange={next => setFrameMode(next as keyof typeof FRAMES)}
        />
      </div>
      <div
        className={mode === 'editor' ? 'min-h-0 flex-1 p-2' : 'min-h-0 flex-1'}
      >
        <Live>
          {mode === 'editor' ? (
            <EditorView
              value={value}
              onChange={setValue}
              frame={frame}
              dynamicTailwind={frameMode === 'shadow'}
            />
          ) : (
            // Keyed by mode, so switching frames mounts fresh sections.
            <Live.Dnd
              key={frameMode}
              frame={frame}
              value={value}
              onChange={setValue}
              dynamicTailwind={frameMode === 'shadow'}
              className="h-full"
            />
          )}
        </Live>
      </div>
    </div>
  );
};

export default Overlays;
