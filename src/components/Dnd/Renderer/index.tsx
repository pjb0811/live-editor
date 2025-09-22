import { useElementSize } from 'use-hooks';

import { baseModules, compileModule } from '~/utils';

interface Props {
  code: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
}

const generateCode = (code: string) => {
  return `
    'use client';

    import { useState } from 'react';

    const App = ({ breakpoint, headers, container }) => {
      return (
        <>
          ${code}
        </>
      );
    };

    export default App;
  `;
};

const Renderer = ({ code, headers, modules }: Props) => {
  const module = compileModule(generateCode(code), {
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
