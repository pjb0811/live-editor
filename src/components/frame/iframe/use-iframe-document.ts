import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useLatest } from '@jbpark/use-hooks';

import { withScriptBlobs } from '~/utils/scripts';

// Adds each script to the document's head as a `<script>` that loads from a
// blob URL. Not awaited: a script that fails to load becomes an unhandled
// rejection on the host page.
const injectScripts = (doc: Document, srcs: string[]) => {
  void withScriptBlobs(srcs, blobUrls => {
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
};

interface Options {
  scripts: string[];
  onLoaded?: () => void;
  applyStyle: () => void;
}

// Prepares the iframe's document each time it loads: creates the mount node,
// applies the host styles, injects the scripts not yet in it and calls
// `onLoaded`, once per document. Returns the mount node, `null` until the
// first load.
//
// `onLoaded` and `scripts` are read through refs, so an inline callback or
// array doesn't set the document up again on every render (#715).
export const useIframeDocument = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  { scripts, onLoaded, applyStyle }: Options,
) => {
  const onLoadedRef = useLatest(onLoaded);
  const scriptsRef = useLatest(scripts);

  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  // The script srcs already added to this iframe's document, so a src added
  // to `scripts` later still loads.
  const loadedScriptsRef = useRef<Set<string>>(new Set());
  // The document those scripts went into. Moving the iframe, as reordering
  // canvas sections does, reloads it with a new document that has none
  // (#507).
  const loadedScriptsDocRef = useRef<Document | null>(null);
  // The document `onLoaded` was last called for.
  const loadedDocRef = useRef<Document | null>(null);

  const injectPendingScripts = useCallback(
    (doc: Document) => {
      const pendingScripts = scriptsRef.current.filter(
        src => !loadedScriptsRef.current.has(src),
      );

      if (pendingScripts.length) {
        pendingScripts.forEach(src => loadedScriptsRef.current.add(src));
        injectScripts(doc, pendingScripts);
      }
    },
    [scriptsRef],
  );

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
      injectPendingScripts(doc);

      // The effect runs again when `applyStyle` changes; that re-applies the
      // styles but isn't a new load.
      if (loadedDocRef.current !== doc) {
        loadedDocRef.current = doc;
        onLoadedRef.current?.();
      }
    };

    $iframe.addEventListener('load', onLoad);

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
    };
  }, [iframeRef, applyStyle, injectPendingScripts, onLoadedRef]);

  // A src added to `scripts` after the document loaded. Only the ones not in
  // it yet are injected, so an inline array with the same entries does
  // nothing.
  useEffect(() => {
    const doc = loadedScriptsDocRef.current;

    if (doc && doc === iframeRef.current?.contentDocument) {
      injectPendingScripts(doc);
    }
  }, [iframeRef, scripts, injectPendingScripts]);

  return mountNode;
};
