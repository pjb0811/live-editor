import React, { useState } from 'react';

import { baseModules, compile } from '../../utils';
import LiveError from '../Error';
import Client from './Client';

export interface IframeProps {
  title?: string;
  sandbox?: string;
  style?: React.CSSProperties;
}

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  code?: string;
  showError?: boolean;
  props?: Record<string, unknown>;
  container?: HTMLElement | null;
  iframe?: boolean | IframeProps;
  scripts?: string[];
  modules?: Record<string, unknown>;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

const Preview = ({
  code,
  props = {},
  modules = {},
  provider,
  ...restProps
}: Props) => {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  if (runtimeError) {
    return (
      <LiveError
        title="실행 오류"
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
          title="컴파일 에러"
          message={module.error}
          className="mx-5 mt-25"
        />
      );
    }

    const Component = module.exports.default;

    if (!Component) {
      return (
        <LiveError
          message="페이지를 찾을 수 없습니다."
          className="mx-5 mt-25"
        />
      );
    }

    return (
      <LiveError.Boundary
        fallback={message => (
          <LiveError title="렌더링 에러" message={message} />
        )}
      >
        {renderProvider(
          <LiveError.Guard onError={e => setRuntimeError(e.message)}>
            <Component {...props} />
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
