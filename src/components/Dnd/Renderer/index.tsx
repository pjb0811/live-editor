import { useMemo } from 'react';

import { useElementSize } from '@jax/use-hooks';

import { baseModules, compile, generateSection } from '~/utils';

interface Props {
  fullCode: string;
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  container?: HTMLElement | null;
}

const Renderer = ({ fullCode, code, headers, modules, container }: Props) => {
  const { breakpoint, ref } = useElementSize<HTMLDivElement>();

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
    <div ref={ref} className="w-full overflow-x-hidden">
      <Component
        breakpoint={breakpoint}
        headers={headers}
        container={container}
      />
    </div>
  );
};

export default Renderer;
