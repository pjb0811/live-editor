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

// `anchor`, when given, is an element the synced block has to stay in front
// of. Without it, a first sync appends the block after whatever the target
// already holds, so a rule the target added for itself could end up before
// the host's copies and lose to them on order (#441).
export const reconcileStyles = (
  sourceDocument: Document,
  target: Document | ShadowRoot,
  manager: StyleSyncManager,
  enabled: boolean,
  transformStyle: (content: string) => string = content => content,
  anchor: Node | null = null,
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
      : (Array.from(container.childNodes).find(isSyncedStyle) ??
        (anchor?.parentNode === container ? anchor : null));

    if (clone !== nextSibling) {
      container.insertBefore(clone, nextSibling);
    }

    previous = clone;
  });
};

// What a root-attribute sync has written onto the target, so a later pass
// removes exactly that and never what the target set for itself.
export interface RootAttributeSync {
  attributes: Set<string>;
  classes: Set<string>;
}

export const createRootAttributeSync = (): RootAttributeSync => ({
  attributes: new Set(),
  classes: new Set(),
});

const isMirroredAttribute = (name: string) => name.startsWith('data-');

// Mirrors the host `<html>`'s classes and `data-*` attributes onto an iframe's
// `<html>`. A theme is usually switched there (`.dark`, `data-theme="dark"`),
// and copying the host's stylesheets alone doesn't help an iframe: its
// selectors look for those on an ancestor, and the iframe document has a root
// of its own. A shadow root needs none of this, since it sits under the host's
// `<html>` already (#497).
//
// Classes are synced token by token, so a class the preview put on its own
// root survives. Other attributes (`style`, `lang`, `dir`, ...) are left
// alone: the frame relies on its own root for sizing and layout.
export const reconcileRootAttributes = (
  source: Element,
  target: Element,
  sync: RootAttributeSync,
  enabled: boolean,
) => {
  const attributes = enabled
    ? Array.from(source.attributes).filter(({ name }) =>
        isMirroredAttribute(name),
      )
    : [];
  const classes = enabled ? Array.from(source.classList) : [];
  const attributeNames = new Set(attributes.map(({ name }) => name));
  const classNames = new Set(classes);

  sync.attributes.forEach(name => {
    if (!attributeNames.has(name)) {
      target.removeAttribute(name);
    }
  });
  attributes.forEach(({ name, value }) => {
    if (target.getAttribute(name) !== value) {
      target.setAttribute(name, value);
    }
  });

  sync.classes.forEach(name => {
    if (!classNames.has(name)) {
      target.classList.remove(name);
    }
  });
  classes.forEach(name => target.classList.add(name));

  if (!target.classList.length) {
    target.removeAttribute('class');
  }

  sync.attributes = attributeNames;
  sync.classes = classNames;
};
