import React from 'react';

import { baseModules, compile } from '../../utils';
import LiveError from '../Error';
import Breakpointer from './Breakpointer';
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
  scripts?: string[];
  iframe?: boolean | IframeProps;
  modules?: Record<string, unknown>;
}

const Preview = ({ code, props = {}, modules = {}, ...restProps }: Props) => {
  if (code) {
    try {
      const module = compile(code, { ...baseModules, ...modules });

      if (!module.exports.default) {
        return (
          <LiveError
            error="페이지를 찾을 수 없습니다."
            className="mx-5 mt-[100px]"
          />
        );
      }

      const Component = module.exports.default;

      return (
        <LiveError.Boundary>
          <Breakpointer>
            {breakpoint => <Component {...props} breakpoint={breakpoint} />}
          </Breakpointer>
        </LiveError.Boundary>
      );
    } catch (e) {
      return (
        <LiveError
          error={e instanceof Error ? e.message : String(e)}
          title="컴파일 오류"
        />
      );
    }
  }

  return <Client props={props} modules={modules} {...restProps} />;
};

export default Preview;
