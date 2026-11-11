import { type ReactNode } from 'react';

import IFrame, { type Props as IframeProps } from './iframe/iframe';
import Shadow from './shadow';
import { useIsClient } from './use-is-client';

export interface FrameProps extends Omit<IframeProps, 'children'> {
  mode?: 'iframe' | 'shadow';
}

interface Props extends FrameProps {
  children: (container: HTMLElement) => ReactNode;
}

const Frame = ({ mode, children, ...restProps }: Props) => {
  const isClient = useIsClient();

  // Every mode renders into a node of the document, which the server doesn't
  // have. The preview appears once the page is on the client (#716).
  if (!isClient) {
    return null;
  }

  if (!mode) {
    return children(document.body);
  }

  if (mode === 'shadow') {
    return (
      <Shadow syncStyle={restProps.syncStyle}>
        {container => children(container || document.body)}
      </Shadow>
    );
  }

  return <IFrame {...restProps}>{children}</IFrame>;
};

export default Frame;
