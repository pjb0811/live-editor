import { useState } from 'react';

import { Splitter, Switch } from '@jbpark/ui-kit';

import type { FrameProps } from '~/components/frame';
import Live from '~/index';

import { IFRAME_FRAME, SHADOW_FRAME } from '../shared/frames';
import { useEditorTheme } from '../shared/theme';

// ui-kit components take their colors from the theme tokens, so they show
// whether a preview follows the host's light or dark theme. The Tailwind box
// shows whether utility classes typed into the code reach the preview.
const SAMPLE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <div className="space-y-4 p-4">
      <ui.Typography.Title level={4}>Preview sample</ui.Typography.Title>
      <ui.Typography.Paragraph>
        Switch the host theme from the header and compare the three previews.
      </ui.Typography.Paragraph>
      <ui.Space>
        <ui.Button type="primary">Primary</ui.Button>
        <ui.Button>Default</ui.Button>
        <ui.Tag color="success">Tag</ui.Tag>
      </ui.Space>
      <div className="rounded-lg bg-indigo-500 p-3 text-sm text-white">
        Tailwind utility classes
      </div>
    </div>
  );
};

export default App;
`;

interface Mode {
  label: string;
  note: string;
  frame: (syncStyle: boolean) => boolean | FrameProps;
  dynamicTailwind?: boolean;
}

const MODES: Mode[] = [
  {
    label: 'iframe',
    note: 'Own document. Styles and the <html> theme are copied in with syncStyle.',
    frame: syncStyle => ({ ...IFRAME_FRAME, syncStyle }),
  },
  {
    label: 'shadow',
    note: 'Shadow root on the host page. Styles are copied in with syncStyle.',
    frame: syncStyle => ({ ...SHADOW_FRAME, syncStyle }),
    dynamicTailwind: true,
  },
  {
    label: 'in place',
    note: 'No frame. Renders straight into the host DOM and shares its styles.',
    frame: () => false,
    dynamicTailwind: true,
  },
];

// One document rendered in each frame mode side by side, with the code
// editor below, so differences in style isolation and theme sync show up
// next to each other.
const PreviewModes = () => {
  const [code, setCode] = useState(SAMPLE);
  const [syncStyle, setSyncStyle] = useState(true);
  const editorTheme = useEditorTheme();

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5
          text-xs"
      >
        <label className="flex items-center gap-1.5">
          <Switch size="small" checked={syncStyle} onChange={setSyncStyle} />
          syncStyle (iframe, shadow)
        </label>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <Live>
          <Splitter withHandle orientation="vertical">
            <Splitter.Panel defaultSize="65%" minSize="20%">
              <div className="grid h-full gap-2 overflow-auto md:grid-cols-3">
                {MODES.map(mode => (
                  <section
                    key={mode.label}
                    className="flex min-w-0 flex-col rounded border
                      border-gray-200"
                  >
                    <header className="border-b border-gray-200 px-3 py-1.5">
                      <h2 className="text-sm font-semibold">{mode.label}</h2>
                      <p className="text-xs text-gray-500">{mode.note}</p>
                    </header>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <Live.Preview
                        code={code}
                        showError
                        frame={mode.frame(syncStyle)}
                        dynamicTailwind={mode.dynamicTailwind}
                      />
                    </div>
                  </section>
                ))}
              </div>
            </Splitter.Panel>
            <Splitter.Panel minSize="15%">
              <Live.Editor
                value={code}
                theme={editorTheme}
                onChange={setCode}
              />
            </Splitter.Panel>
          </Splitter>
        </Live>
      </div>
    </div>
  );
};

export default PreviewModes;
