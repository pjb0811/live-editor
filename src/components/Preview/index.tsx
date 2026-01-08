import React from 'react';

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
}

const Preview = ({ code, props = {}, modules = {}, ...restProps }: Props) => {
  if (code) {
    const module = compile(code, { ...baseModules, ...modules });
    const Component = module.exports.default;

    if (!Component) {
      return (
        <LiveError
          message="페이지를 찾을 수 없습니다."
          className="mx-5 mt-[100px]"
        />
      );
    }

    return (
      <LiveError.Boundary
        fallback={message => (
          <LiveError title="컴파일 오류" message={message} />
        )}
      >
        <Component {...props} />
      </LiveError.Boundary>
    );
  }

  return <Client props={props} modules={modules} {...restProps} />;
};

export default Preview;
