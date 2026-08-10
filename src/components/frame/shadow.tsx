import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: (hostContainer: HTMLElement | null) => ReactNode;
}

const Shadow = ({ children }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const renderTargetRef = useRef<HTMLDivElement | null>(null);
  const [renderTarget, setRenderTarget] = useState<HTMLDivElement | null>(null);
  const [hostContainer, setHostContainer] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const container = hostRef.current.closest(
      '[data-frame-container]',
    ) as HTMLElement | null;

    setHostContainer(container);

    let shadowRoot = shadowRootRef.current;

    if (!shadowRoot) {
      shadowRoot =
        hostRef.current.shadowRoot ||
        hostRef.current.attachShadow({ mode: 'open' });
      shadowRootRef.current = shadowRoot;
    }

    let target = renderTargetRef.current;

    if (!target) {
      target = document.createElement('div');
      shadowRoot.appendChild(target);
      renderTargetRef.current = target;
      setRenderTarget(target);
    }
    // click/pointerdown/pointerup are `composed: true` by spec, so they
    // already retarget across the shadow boundary and reach listeners
    // outside it (document, this host's ancestors, React's own root
    // listener) on their own - manually redispatching them here used to
    // make every one of those listeners see the interaction twice. Anyone
    // needing the real element inside the shadow tree (not the retargeted
    // host) can still read it via event.composedPath()[0], unaffected by
    // this removal. See #92.
  }, []);

  useLayoutEffect(() => {
    if (renderTargetRef.current && !renderTarget) {
      setRenderTarget(renderTargetRef.current);
    }
  }, [renderTarget]);

  return (
    <div ref={hostRef} style={{ display: 'contents' }}>
      {renderTarget && createPortal(children(hostContainer), renderTarget)}
    </div>
  );
};

export default Shadow;
