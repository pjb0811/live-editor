import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { type InjectedCounts, syncInjectedAssets } from './inject-assets';
import { useAutoHeight } from './use-auto-height';
import { useHostStyleSync } from './use-host-style-sync';
import { useIframeDocument } from './use-iframe-document';

export interface Props {
  title?: string;
  /** Forwarded to the iframe's `sandbox` attribute for DOM/CSS isolation only — not a security boundary, since preview code executes in the host window's realm (see `compileModule` in `~/utils`). */
  sandbox?: string;
  style?: React.CSSProperties;
  scripts?: string[];
  styles?: string[];
  stylesheets?: string[];
  autoHeight?: boolean;
  syncStyle?: boolean;
  children: (container: HTMLElement) => ReactNode;
  onLoaded?: () => void;
}

const EMPTY_STRING_ARRAY: string[] = [];

const IFrame = ({
  title = 'Live Preview',
  sandbox,
  style = {},
  scripts = EMPTY_STRING_ARRAY,
  styles = EMPTY_STRING_ARRAY,
  stylesheets = EMPTY_STRING_ARRAY,
  autoHeight = false,
  syncStyle = false,
  children,
  onLoaded,
  ...props
}: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shouldAutoHeight = autoHeight && style.height == null;

  const applyStyle = useHostStyleSync(iframeRef, syncStyle);
  const mountNode = useIframeDocument(iframeRef, {
    scripts,
    onLoaded,
    applyStyle,
  });
  const injectedCountsRef = useRef<InjectedCounts>({
    styles: 0,
    stylesheets: 0,
  });

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc?.head) {
      return;
    }

    injectedCountsRef.current = syncInjectedAssets(
      doc,
      styles,
      stylesheets,
      injectedCountsRef.current,
    );
  }, [styles, stylesheets]);

  useAutoHeight(iframeRef, mountNode, shouldAutoHeight);

  const content = mountNode
    ? createPortal(children(mountNode), mountNode)
    : null;

  return (
    <iframe
      ref={iframeRef}
      style={{
        // An iframe is inline by default and leaves a gap below it for text
        // descenders, which added up across canvas sections (#439).
        display: 'block',
        width: '100%',
        height: '100%',
        border: 'none',
        ...style,
      }}
      title={title}
      sandbox={sandbox}
      {...props}
    >
      {content}
    </iframe>
  );
};

export default IFrame;
