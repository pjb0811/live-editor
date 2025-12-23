import { useMemo } from 'react';

import { useElementSize } from 'use-hooks';

import { baseModules, compile, generateSection } from '~/utils';

interface Props {
  fullCode: string;
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
}

interface Props {
  fullCode: string;
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
}

const Renderer = ({ fullCode, code, headers, modules }: Props) => {
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

  const Component = useMemo(
    () => module.exports.default || (() => null),
    [module.exports.default],
  );

  return (
    <div ref={ref} className="w-full overflow-x-hidden">
      <Component breakpoint={breakpoint} headers={headers} />
    </div>
  );
};

export default Renderer;
