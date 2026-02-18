import { useMemo } from 'react';

import Frame, { type FrameProps } from '~/components/Frame';
import { baseModules, compile, generateSection } from '~/utils';

interface Props {
  fullCode: string;
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  frame?: FrameProps;
}

const Renderer = ({
  fullCode,
  code,
  headers,
  modules,
  frame,
  //
}: Props) => {
  const memoizedModules = useMemo(
    () => ({
      ...baseModules,
      ...modules,
    }),
    [modules],
  );

  const memoizedSection = useMemo(
    () => generateSection(code, fullCode),
    [code, fullCode],
  );

  const module = useMemo(
    () => compile(memoizedSection, memoizedModules),
    [memoizedSection, memoizedModules],
  );

  const Component = module.exports.default;

  if (!Component) {
    return null;
  }

  return (
    <Frame {...frame} autoHeight>
      {container => (
        <div className="w-full overflow-x-hidden" data-editor-mode>
          <Component
            headers={headers}
            container={container}
            //
          />
        </div>
      )}
    </Frame>
  );
};

export default Renderer;
