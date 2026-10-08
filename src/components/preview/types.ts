import type React from 'react';

import type { FrameProps } from '../frame';

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
