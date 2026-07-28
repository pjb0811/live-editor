import { type ReactNode } from 'react';

import IFrame, { type Props as IframeProps } from './iframe';
import Shadow from './shadow';

export interface FrameProps extends Omit<IframeProps, 'children'> {
  mode?: 'iframe' | 'shadow';
}

interface Props extends FrameProps {
  children: (container: HTMLElement) => ReactNode;
}

const Frame = ({ mode, children, ...restProps }: Props) => {
  if (!mode) {
    return children(document.body);
  }

  if (mode === 'shadow') {
    return <Shadow>{container => children(container || document.body)}</Shadow>;
  }

  return <IFrame {...restProps}>{children}</IFrame>;
};

export default Frame;
