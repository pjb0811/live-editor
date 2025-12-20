import { useElementSize } from 'use-hooks';

import { baseModules, compileModule, generateSection } from '~/utils';

interface Props {
  fullCode: string;
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
}

const Renderer = ({ fullCode, code, headers, modules }: Props) => {
  const module = compileModule(generateSection(code, fullCode), {
    ...baseModules,
    ...modules,
  });

  const Component = module.exports.default || (() => null);

  const { breakpoint, elementRef } = useElementSize<HTMLDivElement>();

  return (
    <>
      <div ref={elementRef} className="w-full" />
      <Component breakpoint={breakpoint} headers={headers} />
    </>
  );
};

export default Renderer;
