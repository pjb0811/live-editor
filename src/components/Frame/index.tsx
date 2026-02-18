import { type ReactNode } from 'react';

import IFrame, { type Props as IframeProps } from './IFrame';
import Shadow from './Shadow';

export interface FrameProps extends Omit<IframeProps, 'children'> {
  mode?: 'iframe' | 'shadow';
}

interface Props extends FrameProps {
  children: (container: HTMLElement) => ReactNode;
}

const Frame = ({
  mode,
  children,
  onCopyStyles,
  id,
  title,
  sandbox,
  scripts,
  autoHeight,
}: Props) => {
  if (!mode) {
    return children(document.body);
  }

  if (mode === 'shadow') {
    return <Shadow>{container => children(container || document.body)}</Shadow>;
  }

  return (
    <IFrame
      id={id}
      title={title}
      sandbox={sandbox}
      scripts={scripts}
      autoHeight={autoHeight}
      onCopyStyles={onCopyStyles as (doc: Document) => void}
    >
      {children}
    </IFrame>
  );
};

export default Frame;
