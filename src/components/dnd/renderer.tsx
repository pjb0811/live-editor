import { memo, useMemo } from 'react';

import Frame, { type FrameProps } from '~/components/frame';
import { baseModules, compile } from '~/utils';

interface Props {
  preview: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  frame?: FrameProps;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

// Wrapped in memo() because `preview` is a plain string: for a section that
// didn't change, the parent hands back the same content it computed last
// render (see generateSections()/dnd.tsx), so a shallow prop comparison
// lets React skip both the recompile below and reconciling this section's
// iframe tree at all — see #97.
const Renderer = ({ preview, headers, modules, frame, provider }: Props) => {
  const memoizedModules = useMemo(
    () => ({
      ...baseModules,
      ...modules,
    }),
    [modules],
  );

  const module = useMemo(
    () => compile(preview, memoizedModules),
    [preview, memoizedModules],
  );

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  const Component = module.exports.default;

  if (!Component) {
    return null;
  }

  return (
    <Frame {...frame} autoHeight>
      {container => (
        <div className="w-full overflow-x-hidden" data-editor-mode>
          {renderProvider(
            <Component
              headers={headers}
              container={container}
              //
            />,
          )}
        </div>
      )}
    </Frame>
  );
};

export default memo(Renderer);
