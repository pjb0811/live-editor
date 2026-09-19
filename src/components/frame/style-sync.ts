const SYNCED_STYLE_ATTR = 'data-live-editor-synced-style';

type SourceStyle = HTMLLinkElement | HTMLStyleElement;
type SyncedStyle = HTMLLinkElement | HTMLStyleElement;

export interface StyleSyncManager {
  clones: Map<SourceStyle, SyncedStyle>;
}

export const createStyleSyncManager = (): StyleSyncManager => ({
  clones: new Map(),
});

const isDocument = (target: Document | ShadowRoot): target is Document =>
  target.nodeType === Node.DOCUMENT_NODE;

const sourceStyles = (document: Document): SourceStyle[] =>
  Array.from(
    document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    ),
  );

const copyAttributes = (
  source: SourceStyle,
  clone: SyncedStyle,
  transformStyle: (content: string) => string,
) => {
  Array.from(clone.attributes).forEach(attribute => {
    if (
      attribute.name !== SYNCED_STYLE_ATTR &&
      !source.hasAttribute(attribute.name)
    ) {
      clone.removeAttribute(attribute.name);
    }
  });

  Array.from(source.attributes).forEach(attribute => {
    clone.setAttribute(attribute.name, attribute.value);
  });

  if (source.tagName === 'LINK' && clone.tagName === 'LINK') {
    (clone as HTMLLinkElement).disabled = (source as HTMLLinkElement).disabled;
  }

  clone.textContent =
    source.tagName === 'STYLE'
      ? transformStyle(source.textContent || '')
      : source.textContent;
};

const createClone = (
  source: SourceStyle,
  target: Document | ShadowRoot,
  transformStyle: (content: string) => string,
): SyncedStyle => {
  const ownerDocument = isDocument(target) ? target : target.ownerDocument;
  const clone = ownerDocument.createElement(
    source.tagName.toLowerCase(),
  ) as SyncedStyle;

  clone.setAttribute(SYNCED_STYLE_ATTR, '');
  copyAttributes(source, clone, transformStyle);

  return clone;
};

const targetContainer = (target: Document | ShadowRoot) =>
  isDocument(target) ? target.head : target;

const isSyncedStyle = (node: Node): node is SyncedStyle => {
  const element = node as Element;

  return (
    (element.tagName === 'LINK' || element.tagName === 'STYLE') &&
    element.hasAttribute(SYNCED_STYLE_ATTR)
  );
};

const removeClone = (clone: SyncedStyle) => {
  clone.remove();
};

export const reconcileStyles = (
  sourceDocument: Document,
  target: Document | ShadowRoot,
  manager: StyleSyncManager,
  enabled: boolean,
  transformStyle: (content: string) => string = content => content,
) => {
  if (!enabled) {
    manager.clones.forEach(removeClone);
    manager.clones.clear();

    return;
  }

  const sources = sourceStyles(sourceDocument);
  const sourceSet = new Set(sources);
  const container = targetContainer(target);

  manager.clones.forEach((clone, source) => {
    if (!sourceSet.has(source)) {
      removeClone(clone);
      manager.clones.delete(source);
    }
  });

  let previous: SyncedStyle | null = null;

  sources.forEach(source => {
    let clone = manager.clones.get(source);

    if (!clone) {
      clone = createClone(source, target, transformStyle);
      manager.clones.set(source, clone);
    } else {
      copyAttributes(source, clone, transformStyle);
    }

    const nextSibling = previous
      ? previous.nextSibling
      : (Array.from(container.childNodes).find(isSyncedStyle) ?? null);

    if (clone !== nextSibling) {
      container.insertBefore(clone, nextSibling);
    }

    previous = clone;
  });
};
