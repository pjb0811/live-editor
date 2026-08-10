import React, { useEffect, useState } from 'react';

import { baseModules, compile } from '../../utils';
import { generateTailwindCSS } from '../../utils/tailwind';
import LiveError from '../error';
import type { FrameProps } from '../frame';
import Client from './client';

export interface Props extends React.ComponentPropsWithRef<'div'> {
  code?: string;
  showError?: boolean;
  props?: Record<string, unknown>;
  container?: HTMLElement | null;
  frame?: boolean | FrameProps;
  modules?: Record<string, unknown>;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

const Preview = ({
  code,
  props = {},
  modules = {},
  dynamicTailwind = false,
  provider,
  ...restProps
}: Props) => {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [dynamicCSS, setDynamicCSS] = useState('');
  // "Adjusting state when a prop changes" pattern (React docs) rather than
  // a useEffect: resets synchronously within the same render `code`
  // changes in, before Guard/Component render at all, so there's no
  // passive-effect-ordering window where a genuinely new runtime error
  // could get wiped back out right after Guard's onError sets it.
  const [prevCode, setPrevCode] = useState(code);

  if (code !== prevCode) {
    setPrevCode(code);
    setRuntimeError(null);
  }

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  useEffect(() => {
    if (!code || !dynamicTailwind) {
      return;
    }

    generateTailwindCSS(code).then(setDynamicCSS);
  }, [code, dynamicTailwind]);

  if (runtimeError) {
    return (
      <LiveError
        title="Runtime Error"
        message={runtimeError}
        className="mx-5 mt-25"
        onReset={() => setRuntimeError(null)}
      />
    );
  }

  if (code) {
    const module = compile(code, { ...baseModules, ...modules });

    if (module.error) {
      return (
        <LiveError
          title="Compile Error"
          message={module.error}
          className="mx-5 mt-25"
        />
      );
    }

    const Component = module.exports.default;

    if (!Component) {
      return (
        <LiveError message="Component not found." className="mx-5 mt-25" />
      );
    }

    return (
      <LiveError.Boundary
        resetKeys={[code]}
        fallback={message => (
          <LiveError title="Rendering Error" message={message} />
        )}
      >
        {renderProvider(
          <LiveError.Guard onError={e => setRuntimeError(e.message)}>
            <Component {...props} />
            {dynamicCSS && <style>{dynamicCSS}</style>}
          </LiveError.Guard>,
        )}
      </LiveError.Boundary>
    );
  }

  return (
    <Client
      props={props}
      modules={modules}
      provider={provider}
      {...restProps}
    />
  );
};

export default Preview;
