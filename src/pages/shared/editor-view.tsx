import { Radio, Splitter } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';

import type { FrameProps } from '~/components/frame';
import Live from '~/index';

import { IFRAME_FRAME } from './frames';
import { useEditorTheme } from './theme';

export type ViewMode = 'dnd' | 'editor';

const options = [
  { label: 'Drag & Drop', value: 'dnd' },
  { label: 'Editor', value: 'editor' },
];

// Switches a page between its Dnd canvas and the code it edits, so every
// page's document can be read and changed as source.
export const ModeSwitch = ({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) => (
  <Radio.Group
    size="small"
    value={value}
    options={options}
    optionType="button"
    buttonStyle="solid"
    onChange={next => onChange(next as ViewMode)}
  />
);

// The document as code next to its preview. Render it inside `<Live>`: the
// preview reads the code the editor shares through the provider. The preview
// is an iframe unless a page passes another `frame`.
export const EditorView = ({
  value,
  onChange,
  frame = IFRAME_FRAME,
  dynamicTailwind,
}: {
  value: string;
  onChange: (value: string) => void;
  frame?: FrameProps;
  dynamicTailwind?: boolean;
}) => {
  const theme = useEditorTheme();
  const { breakpoint } = useResponsiveSize();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  return (
    <Splitter withHandle orientation={isMobile ? 'vertical' : 'horizontal'}>
      <Splitter.Panel defaultSize="50%" minSize="20%" maxSize="80%" collapsible>
        <div className="h-full overflow-auto p-2">
          <Live.Preview
            showError
            frame={frame}
            dynamicTailwind={dynamicTailwind}
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel collapsible>
        <Live.Editor value={value} theme={theme} onChange={onChange} />
      </Splitter.Panel>
    </Splitter>
  );
};
