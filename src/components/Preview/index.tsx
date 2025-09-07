import React from 'react';

import * as tanstackQuery from '@tanstack/react-query';
import * as useHooks from '@uidotdev/usehooks';

import { compileModule } from '~/utils';

import LiveError from '../Error';
import Client from './Client';

export const imports = {
  '@tanstack/react-query': tanstackQuery,
  '@uidotdev/usehooks': useHooks,
};

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
}

const Preview = ({ code, props = {}, ...restProps }: Props) => {
  if (code) {
    try {
      const module = compileModule(code, imports);

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
          <Component {...props} />
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

  return <Client props={props} {...restProps} />;
};

export default Preview;
