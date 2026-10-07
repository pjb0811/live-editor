import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP, CONFIG, DATA_ATTR } from '../../constants';
import { type BoundedCache, createBoundedCache } from '../cache';
import { registerEditorCache } from '../editor-caches';
import {
  parseBinding,
  parseBindingExpression,
  resolveBindings,
} from './binding';
import { traverse } from './document';
import { attrValue, generateCode, wrap } from './helpers';
import { getJSXTagName } from './jsx-name';
import type {
  Attribute,
  BindingItem,
  BindingOptions,
  DataAttrNode,
} from './types';
import { unwrapExpression } from './value';

const collectText = (
  children: (
    | t.JSXText
    | t.JSXExpressionContainer
    | t.JSXElement
    | t.JSXFragment
    | t.JSXSpreadChild
  )[],
) => {
  return children
    .filter(c => t.isJSXText(c))
    .map(c => (c as t.JSXText).value.trim())
    .filter(v => v.length)
    .join(' ');
};

const parseJSXName = (
  tagName: string,
): t.JSXIdentifier | t.JSXMemberExpression => {
  const parts = tagName.split('.');

  if (parts.length === 1) {
    return t.jsxIdentifier(parts[0]!);
  }

  let expr: t.JSXIdentifier | t.JSXMemberExpression = t.jsxIdentifier(
    parts[0]!,
  );

  for (let i = 1; i < parts.length; i++) {
    expr = t.jsxMemberExpression(expr, t.jsxIdentifier(parts[i]!));
  }

  return expr;
};

const extractCache = createBoundedCache<string, DataAttrNode[]>(
  CONFIG.CACHE_LIMIT,
);

// One cache per combination of `bindings` and `bindingKeys`, since they
// change what the same source extracts to (#509, #513). An absent map is
// keyed by `NO_MAP`.
const NO_MAP = {};
let optionExtractCaches = new WeakMap<
  object,
  WeakMap<object, BoundedCache<string, DataAttrNode[]>>
>();

const cacheFor = ({ bindings, bindingKeys }: BindingOptions) => {
  if (!bindings && !bindingKeys) {
    return extractCache;
  }

  let byKeys = optionExtractCaches.get(bindings ?? NO_MAP);

  if (!byKeys) {
    byKeys = new WeakMap();
    optionExtractCaches.set(bindings ?? NO_MAP, byKeys);
  }

  let cache = byKeys.get(bindingKeys ?? NO_MAP);

  if (!cache) {
    cache = createBoundedCache<string, DataAttrNode[]>(CONFIG.CACHE_LIMIT);
    byKeys.set(bindingKeys ?? NO_MAP, cache);
  }

  return cache;
};

const extractAttributes = (
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  source?: string,
): { allAttrs: Attribute[]; dataAttrs: Attribute[] } => {
  const allAttrs: Attribute[] = [];
  const dataAttrs: Attribute[] = [];

  for (const attr of attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      continue;
    }

    const name = attr.name.name;
    let value: string | null = null;
    let quoted = false;

    if (attr.value) {
      if (t.isStringLiteral(attr.value)) {
        value = attr.value.value;
        quoted = true;
      } else if (t.isJSXExpressionContainer(attr.value)) {
        try {
          const expression = attr.value.expression;
          const structural =
            t.isArrayExpression(unwrapExpression(expression)) ||
            t.isObjectExpression(unwrapExpression(expression));
          value =
            source &&
            structural &&
            expression.start != null &&
            expression.end != null
              ? source.slice(expression.start, expression.end)
              : generateCode(expression);
          quoted = false;
        } catch {
          value = null;
        }
      }
    }

    const entry = { name, value, isStringLiteral: quoted };

    allAttrs.push(entry);

    if (name.startsWith('data-')) {
      dataAttrs.push(entry);
    }
  }

  return { allAttrs, dataAttrs };
};

const buildChildElements = (
  node: DataAttrNode,
): (t.JSXText | t.JSXElement | t.JSXFragment)[] => {
  const childElements: (t.JSXText | t.JSXElement | t.JSXFragment)[] = [];

  if (node.textContent) {
    childElements.push(t.jsxText(node.textContent));
  }

  node.children?.forEach(child => {
    const childJSX = nodeToJSX(child);
    if (childJSX) {
      childElements.push(childJSX);
    }
  });

  return childElements;
};

export const nodeToJSX = (
  node: DataAttrNode,
): t.JSXElement | t.JSXFragment | null => {
  try {
    if (node.isFragment) {
      const childElements = buildChildElements(node);

      return t.jsxFragment(
        t.jsxOpeningFragment(),
        t.jsxClosingFragment(),
        childElements,
      );
    }

    if (
      node.tagName === 'div' &&
      node.dataAttributes.some(attr => attr.name === 'data-item')
    ) {
      if (node.children) {
        return nodeToJSX(node.children[0]!);
      }
      return null;
    }

    const attributes = node.attributes.map(attr => {
      const attrName = t.jsxIdentifier(attr.name);

      if (!attr.value) {
        return t.jsxAttribute(attrName, null);
      }

      return t.jsxAttribute(attrName, attrValue(attr));
    });

    const elementName = parseJSXName(node.tagName);

    const openingElement = t.jsxOpeningElement(elementName, attributes);

    const closingElement = t.jsxClosingElement(elementName);
    const children = buildChildElements(node);

    return t.jsxElement(openingElement, closingElement, children, false);
  } catch (error) {
    console.error('❌ DataAttrNode to JSX conversion error:', error);
    return null;
  }
};

const createWrapperNode = (
  textContent: string,
  children: DataAttrNode[],
): DataAttrNode => ({
  tagName: 'div',
  id: nanoid(6),
  attributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
  dataAttributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
  textContent,
  children,
});

const createFragmentNode = (
  textContent: string,
  children: DataAttrNode[],
): DataAttrNode => ({
  tagName: '',
  id: nanoid(6),
  attributes: [],
  dataAttributes: [],
  textContent,
  children,
  isFragment: true,
});

const processChildrenBinding = (
  jsxElement: t.JSXElement,
  processedNodes?: WeakSet<t.JSXElement | t.JSXFragment>,
  shouldWrap: boolean = true,
  source?: string,
  options?: BindingOptions,
): DataAttrNode[] | undefined => {
  const jsxChildren = jsxElement.children.filter(
    child => t.isJSXElement(child) || t.isJSXFragment(child),
  );

  if (!jsxChildren.length) {
    return undefined;
  }

  const childrenNodes: DataAttrNode[] = [];

  jsxChildren.forEach(child => {
    if (t.isJSXElement(child)) {
      const childResults = extractFromNode(
        child,
        processedNodes,
        source,
        options,
      );

      if (shouldWrap) {
        const wrapperNode = createWrapperNode(
          collectText(child.children),
          childResults,
        );
        wrapperNode.source = source?.slice(child.start!, child.end!);
        const dataId = childResults[0]?.dataAttributes.find(
          attr => attr.name === DATA_ATTR.ID,
        )?.value;

        if (dataId) {
          wrapperNode.id = `child:${dataId}`;
        }

        childrenNodes.push(wrapperNode);
      } else {
        childrenNodes.push(...childResults);
      }
    } else if (t.isJSXFragment(child)) {
      processedNodes?.add(child);

      const fragmentChildren: DataAttrNode[] = [];

      child.children.forEach(fragmentChild => {
        if (t.isJSXElement(fragmentChild)) {
          const childResults = extractFromNode(
            fragmentChild,
            processedNodes,
            source,
            options,
          );
          fragmentChildren.push(...childResults);
        }
      });

      if (fragmentChildren.length) {
        const fragmentNode = createFragmentNode(
          collectText(child.children),
          fragmentChildren,
        );
        fragmentNode.source = source?.slice(child.start!, child.end!);
        childrenNodes.push(fragmentNode);
      }
    }
  });

  return childrenNodes.length ? childrenNodes : undefined;
};

const skipItemsChildren = (
  jsxElement: t.JSXElement,
  processedNodes: WeakSet<t.JSXElement | t.JSXFragment>,
  propertyName: string = 'items',
): void => {
  const opening = jsxElement.openingElement;

  const itemsAttr = opening.attributes.find(
    attr =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === propertyName,
  );

  if (!itemsAttr || !t.isJSXAttribute(itemsAttr)) {
    return;
  }

  if (
    itemsAttr.value &&
    t.isJSXExpressionContainer(itemsAttr.value) &&
    t.isArrayExpression(itemsAttr.value.expression)
  ) {
    const arrayExpr = itemsAttr.value.expression;

    arrayExpr.elements.forEach(element => {
      if (t.isObjectExpression(element)) {
        element.properties.forEach(prop => {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            t.isJSXElement(prop.value)
          ) {
            markProcessedJSX(prop.value, processedNodes);
          }
        });
      }
    });
  }
};

const markProcessedJSX = (
  node: t.Node,
  processedNodes: WeakSet<t.JSXElement | t.JSXFragment>,
): void => {
  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    processedNodes.add(node as t.JSXElement | t.JSXFragment);
    node.children.forEach(child => markProcessedJSX(child, processedNodes));
    return;
  }

  const expression =
    t.isJSXExpressionContainer(node) || t.isParenthesizedExpression(node);

  if (expression) {
    markProcessedJSX(node.expression, processedNodes);
  }
};

interface NodeBindingInfo {
  tagName: string;
  allAttrs: Attribute[];
  dataAttrs: Attribute[];
  bindings: BindingItem[];
  childrenBinding: BindingItem | undefined;
  arrayBindings: BindingItem[];
  rawChildren: string | undefined;
}

// The `data-binding` array expression, so bindings can be read from the AST
// without printing and parsing it again. `null` when the attribute is
// missing or a plain string, which goes through `parseBinding` instead.
const getBindingExpression = (
  opening: t.JSXOpeningElement,
): t.ArrayExpression | null => {
  for (const attr of opening.attributes) {
    if (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === DATA_ATTR.BINDING &&
      attr.value &&
      t.isJSXExpressionContainer(attr.value)
    ) {
      // Unwrap `satisfies BindingItem[]`, `as const` and parentheses.
      const expression = unwrapExpression(attr.value.expression);

      if (t.isArrayExpression(expression)) {
        return expression;
      }
    }
  }

  return null;
};

// Reads one element's tag name, attributes and bindings. Shared by the
// top-level visitor in `parseToNodes` and by `extractFromNode`.
const readNodeBindingInfo = (
  node: t.JSXElement,
  source?: string,
  options?: BindingOptions,
): NodeBindingInfo => {
  const opening = node.openingElement;
  const tagName = getJSXTagName(opening);
  const { allAttrs, dataAttrs } = extractAttributes(opening.attributes, source);

  const bindingAttr = dataAttrs.find(attr => attr.name === DATA_ATTR.BINDING);
  const bindingExpr = getBindingExpression(opening);
  const keyAttr = dataAttrs.find(attr => attr.name === DATA_ATTR.BINDING_KEY);
  // Its own `data-binding` first, even an empty one (how an element opts
  // out), then its `data-binding-key`, then its component's entry
  // (#509, #513).
  const bindings = resolveBindings(
    bindingExpr
      ? parseBindingExpression(bindingExpr)
      : bindingAttr
        ? parseBinding(bindingAttr.value)
        : undefined,
    keyAttr && (keyAttr.isStringLiteral ? keyAttr.value : null),
    tagName,
    options,
  );

  const childrenBinding = bindings.find(
    b => b.property === BINDING_PROP.CHILDREN,
  );
  const arrayBindings = bindings.filter(
    b => b.property === BINDING_PROP.ITEMS || b.type === 'array',
  );

  const innerHtmlBinding = bindings.find(
    b => b.property === BINDING_PROP.INNER_HTML,
  );

  let rawChildren: string | undefined;
  if (innerHtmlBinding && node.children.length > 0) {
    rawChildren = node.children
      .map(child => generateCode(child))
      .join('')
      .trim();
  }

  return {
    tagName,
    allAttrs,
    dataAttrs,
    bindings,
    childrenBinding,
    arrayBindings,
    rawChildren,
  };
};

const parseToNodes = (
  raw: string,
  options?: BindingOptions,
): DataAttrNode[] => {
  const wrapped = wrap(raw);
  const ast = parse(wrapped, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });

  const results: DataAttrNode[] = [];

  // Elements already recorded as another result's children, or skipped
  // inside an `items` array. `traverse()` visits every element, so the
  // visitor skips these to avoid recording them twice.
  const processedNodes = new WeakSet<t.JSXElement | t.JSXFragment>();

  traverse(ast, {
    JSXElement(path) {
      if (processedNodes.has(path.node)) {
        return;
      }

      const {
        tagName,
        allAttrs,
        dataAttrs,
        bindings,
        childrenBinding,
        arrayBindings,
        rawChildren,
      } = readNodeBindingInfo(path.node, wrapped, options);

      if (!tagName || !dataAttrs.length) {
        return;
      }

      let childrenNodes: DataAttrNode[] | undefined;

      if (childrenBinding) {
        childrenNodes = processChildrenBinding(
          path.node,
          processedNodes,
          true,
          wrapped,
          options,
        );
      }

      for (const arrayBinding of arrayBindings) {
        skipItemsChildren(path.node, processedNodes, arrayBinding.property);
      }

      results.push({
        tagName,
        attributes: allAttrs,
        dataAttributes: dataAttrs,
        textContent: collectText(path.node.children),
        rawChildren,
        children: childrenNodes,
        bindings,
        loc: path.node.loc
          ? {
              start: {
                line: path.node.loc.start.line,
                column: path.node.loc.start.column,
              },
              end: {
                line: path.node.loc.end.line,
                column: path.node.loc.end.column,
              },
            }
          : undefined,
      });
    },
  });

  return results;
};

// The elements of `raw` that carry `data-*` attributes, with their
// bindings, as `DataAttrNode`s. Cached. `options` supplies bindings for
// elements without their own `data-binding` (#509, #513).
export function extract(
  raw: string,
  options: BindingOptions = {},
): DataAttrNode[] {
  const cache = cacheFor(options);

  if (cache.has(raw)) {
    return cache.get(raw)!;
  }

  const results = parseToNodes(raw, options);

  cache.set(raw, results);

  return results;
}

function extractFromNode(
  node: t.JSXElement,
  processedNodes?: WeakSet<t.JSXElement | t.JSXFragment>,
  source?: string,
  options?: BindingOptions,
): DataAttrNode[] {
  processedNodes?.add(node);

  const {
    tagName,
    allAttrs,
    dataAttrs,
    bindings,
    childrenBinding,
    rawChildren,
  } = readNodeBindingInfo(node, source, options);

  let childrenNodes: DataAttrNode[] | undefined;

  if (childrenBinding) {
    childrenNodes = processChildrenBinding(
      node,
      processedNodes,
      true,
      source,
      options,
    );
  }

  if (!childrenNodes) {
    childrenNodes = processChildrenBinding(
      node,
      processedNodes,
      false,
      source,
      options,
    );
  }

  return [
    {
      tagName,
      attributes: allAttrs,
      dataAttributes: dataAttrs,
      textContent: collectText(node.children),
      rawChildren,
      children: childrenNodes,
      bindings,
    },
  ];
}

export function clearExtractCache() {
  extractCache.clear();
  optionExtractCaches = new WeakMap();
}

registerEditorCache(clearExtractCache);
