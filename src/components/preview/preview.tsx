import type React from 'react';

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

// A thin wrapper around Client, which does the actual compiling, error
// handling, and frame wrapping. This used to have its own duplicate
// compile-and-render branch for the `code` prop that never wrapped its
// output in <Frame>, so `frame` was silently ignored whenever `code` was
// passed — see #187. Client already handles `code` (falling back to
// context when absent) and `frame`, so there is only one render path now.
const Preview = ({
  code,
  props = {},
  modules = {},
  dynamicTailwind = false,
  provider,
  ...restProps
}: Props) => {
  return (
    <Client
      code={code}
      props={props}
      modules={modules}
      dynamicTailwind={dynamicTailwind}
      provider={provider}
      {...restProps}
    />
  );
};

export default Preview;
