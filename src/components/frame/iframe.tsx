import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useMutationObserver } from '@jbpark/use-hooks';

import { withScriptBlobs } from '~/utils/scripts';

import { CONTAINER_STYLE_ID } from './auto-height';
import {
  createRootAttributeSync,
  createStyleSyncManager,
  reconcileRootAttributes,
  reconcileStyles,
} from './style-sync';
import { useAutoHeight } from './use-auto-height';
import { convertViewportUnits } from './viewport-units';

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
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  // The script srcs already added to this iframe's document, so a src added
  // to `scripts` later still loads.
  const loadedScriptsRef = useRef<Set<string>>(new Set());
  // The document those scripts went into. Moving the iframe, as reordering
  // canvas sections does, reloads it with a new document that has none
  // (#507).
  const loadedScriptsDocRef = useRef<Document | null>(null);
  const prevStyleCountRef = useRef(0);
  const prevStylesheetCountRef = useRef(0);
  const shouldAutoHeight = autoHeight && style.height == null;

  const styleManagerRef = useRef(createStyleSyncManager());
  const rootAttributeSyncRef = useRef(createRootAttributeSync());

  const applyStyle = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc) {
      return;
    }

    // The container style goes after every copied host style. Both use
    // `!important`, so a host `html { height: 100% !important }` copied in after
    // it would win and fold the frame to a pixel (#441).
    reconcileStyles(
      document,
      doc,
      styleManagerRef.current,
      syncStyle,
      convertViewportUnits,
      doc.getElementById(CONTAINER_STYLE_ID),
    );
    // The host's theme class or attribute, which the copied styles select on
    // (#497).
    reconcileRootAttributes(
      document.documentElement,
      doc.documentElement,
      rootAttributeSyncRef.current,
      syncStyle,
    );
  }, [syncStyle]);

  const applyStyleTimeoutRef = useRef<number>(undefined);

  // Debounced, since a stylesheet swap fires several head mutations in a
  // row.
  const debouncedApplyStyle = useCallback(() => {
    clearTimeout(applyStyleTimeoutRef.current);
    applyStyleTimeoutRef.current = window.setTimeout(applyStyle, 50);
  }, [applyStyle]);

  useEffect(() => {
    return () => clearTimeout(applyStyleTimeoutRef.current);
  }, []);

  useMutationObserver(document.head, debouncedApplyStyle, {
    enabled: syncStyle,
    childList: true,
    subtree: true,
    attributes: true,
  });

  // A theme switch only changes the host's `<html>` attributes, which the head
  // observer above doesn't see.
  useMutationObserver(document.documentElement, debouncedApplyStyle, {
    enabled: syncStyle,
    attributes: true,
  });

  useEffect(() => {
    const $iframe = iframeRef.current;

    if (!$iframe) {
      return;
    }

    const onLoad = () => {
      const doc = $iframe.contentDocument;

      if (!doc) {
        return;
      }

      if (loadedScriptsDocRef.current !== doc) {
        loadedScriptsDocRef.current = doc;
        loadedScriptsRef.current = new Set();
      }

      doc.body.style.overflowX = 'hidden';
      doc.body.style.margin = '0';

      let node = doc.getElementById('iframe-root');

      if (!node) {
        node = doc.createElement('div');
        node.id = 'iframe-root';
        doc.body.appendChild(node);
      }

      setMountNode(node);

      applyStyle();

      const pendingScripts = scripts.filter(
        src => !loadedScriptsRef.current.has(src),
      );

      if (pendingScripts.length) {
        pendingScripts.forEach(src => loadedScriptsRef.current.add(src));

        withScriptBlobs(pendingScripts, blobUrls => {
          if (!doc.head) {
            return;
          }

          const fragment = doc.createDocumentFragment();
          blobUrls.forEach(blobUrl => {
            const script = doc.createElement('script');
            script.src = blobUrl;
            fragment.appendChild(script);
          });
          doc.head.appendChild(fragment);
        });
      }

      onLoaded?.();
    };

    $iframe.addEventListener('load', onLoad);

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
    };
  }, [scripts, onLoaded, applyStyle]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc?.head) {
      return;
    }

    styles.forEach((css, index) => {
      const styleId = `injected-style-${index}`;
      let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;

      if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = styleId;
        doc.head.appendChild(styleEl);
      }

      // The main source of `vh` units in a preview: compiled component CSS,
      // such as Tailwind's `h-screen`. See `ensureContainerStyle` in `auto-height.ts` for
      // why they're converted.
      const convertedCss = convertViewportUnits(css);

      if (styleEl.textContent !== convertedCss) {
        styleEl.textContent = convertedCss;
      }
    });

    // Remove what's left from a longer `styles` or `stylesheets` array.
    for (
      let index = styles.length;
      index < prevStyleCountRef.current;
      index++
    ) {
      doc.getElementById(`injected-style-${index}`)?.remove();
    }
    prevStyleCountRef.current = styles.length;

    stylesheets.forEach((href, index) => {
      const linkId = `injected-stylesheet-${index}`;
      let linkEl = doc.getElementById(linkId) as HTMLLinkElement | null;

      if (!linkEl) {
        linkEl = doc.createElement('link');
        linkEl.id = linkId;
        linkEl.rel = 'stylesheet';
        doc.head.appendChild(linkEl);
      }

      if (linkEl.href !== href) {
        linkEl.href = href;
      }
    });

    for (
      let index = stylesheets.length;
      index < prevStylesheetCountRef.current;
      index++
    ) {
      doc.getElementById(`injected-stylesheet-${index}`)?.remove();
    }
    prevStylesheetCountRef.current = stylesheets.length;
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
