import type React from 'react';

import type { FrameProps } from '../frame';
import Client from './client';
import { NO_MODULES, NO_PROPS } from './defaults';

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

// `Live.Preview`: a thin wrapper around `Client`, which compiles, handles
// errors and wraps the frame. One render path for both `code` and the
// provider's code (#187).
const Preview = ({
  code,
  props = NO_PROPS,
  modules = NO_MODULES,
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
