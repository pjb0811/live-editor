import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useMutationObserver } from '@jbpark/use-hooks';

import { CONTAINER_STYLE_ID } from './auto-height';
import {
  createRootAttributeSync,
  createStyleSyncManager,
  reconcileRootAttributes,
  reconcileStyles,
} from './style-sync';
import { convertViewportUnits } from './viewport-units';

// Copies the host page's styles and root attributes into the iframe while
// `syncStyle` is on, and again whenever the host changes them. Returns
// `applyStyle`, which the document setup calls once the iframe's document
// exists.
export const useHostStyleSync = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  syncStyle: boolean,
) => {
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
  }, [iframeRef, syncStyle]);

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

  return applyStyle;
};
