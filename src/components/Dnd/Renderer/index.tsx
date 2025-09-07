import { imports } from '~/components/Preview';
import { compileModule } from '~/utils';

interface Props {
  code: string;
  headers?: Record<string, boolean>;
}

const generateCode = (code: string) => {
  return `
    'use client';

    import { useState } from 'react';

    const App = () => {
      return (
        <>
          ${code}
        </>
      );
    };

    export default App;
  `;
};

const Renderer = ({ code }: Props) => {
  const module = compileModule(generateCode(code), imports);
  const Component = module.exports.default || (() => null);

  return (
    <>
      <Component />
    </>
  );
};

export default Renderer;
