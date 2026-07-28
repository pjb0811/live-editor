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

    const onClick = (e: Event) => {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
      };

      let newEvent: Event;

      if (e instanceof MouseEvent) {
        newEvent = new MouseEvent(e.type, {
          ...eventInit,
          clientX: e.clientX,
          clientY: e.clientY,
          button: e.button,
        });
      } else if (e instanceof PointerEvent) {
        newEvent = new PointerEvent(e.type, {
          ...eventInit,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
        });
      } else {
        newEvent = new Event(e.type, eventInit);
      }

      hostRef.current?.dispatchEvent(newEvent);
    };

    const eventTypes = ['click', 'pointerdown', 'pointerup'];

    eventTypes.forEach(type => {
      target.addEventListener(type, onClick, true);
    });

    return () => {
      eventTypes.forEach(type => {
        target?.removeEventListener(type, onClick, true);
      });
    };
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
