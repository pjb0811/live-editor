import type React from 'react';

import type { FrameProps } from '../frame';

export interface Props extends Omit<
  React.ComponentPropsWithRef<'div'>,
  // The component renders its own content.
  'children' | 'dangerouslySetInnerHTML'
> {
  code?: string;
  showError?: boolean;
  props?: Record<string, unknown>;
  /** @deprecated Has no effect. Will be removed in the next major version. */
  container?: HTMLElement | null;
  frame?: boolean | FrameProps;
  modules?: Record<string, unknown>;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
}
