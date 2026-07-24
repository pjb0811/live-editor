import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP, CONFIG, DATA_ATTR } from '../../enums';
import { parseBinding } from './binding';
import { attrValue, generateCode, wrap } from './helpers';
import type { Attribute, DataAttrNode } from './types';

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

const getTagName = (opening: t.JSXOpeningElement): string => {
  if (t.isJSXIdentifier(opening.name)) {
    return opening.name.name;
  }

  if (t.isJSXMemberExpression(opening.name)) {
    return resolveMemberName(opening.name);
  }

  return '';
};

const resolveMemberName = (expr: t.JSXMemberExpression): string => {
  const parts: string[] = [];

  const traverse = (
    node: t.JSXMemberExpression['object'] | t.JSXMemberExpression['property'],
  ): void => {
    if (t.isJSXIdentifier(node)) {
      parts.push(node.name);
    } else if (t.isJSXMemberExpression(node)) {
      traverse(node.object);

      if (t.isJSXIdentifier(node.property)) {
        parts.push(node.property.name);
      }
    }
  };

  traverse(expr.object);

  if (t.isJSXIdentifier(expr.property)) {
    parts.push(expr.property.name);
  }

  return parts.join('.');
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

const extractCache = new Map<string, DataAttrNode[]>();

const extractAttributes = (
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
): { allAttrs: Attribute[]; dataAttrs: Attribute[] } => {
  const allAttrs: Attribute[] = [];
  const dataAttrs: Attribute[] = [];

  for (const attr of attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      continue;
    }

    const name = attr.name.name;
    let value: string | null = null;
    let isStringLiteral = false;

    if (attr.value) {
      if (t.isStringLiteral(attr.value)) {
        value = attr.value.value;
        isStringLiteral = true;
      } else if (t.isJSXExpressionContainer(attr.value)) {
        try {
          value = generateCode(attr.value.expression);
          isStringLiteral = false;
        } catch {
          value = null;
        }
      }
    }

    const entry = { name, value, isStringLiteral };

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
      const childResults = extractFromNode(child, processedNodes);

      if (shouldWrap) {
        const wrapperNode = createWrapperNode(
          collectText(child.children),
          childResults,
        );
        childrenNodes.push(wrapperNode);
      } else {
        childrenNodes.push(...childResults);
      }
    } else if (t.isJSXFragment(child)) {
      processedNodes?.add(child);

      const fragmentChildren: DataAttrNode[] = [];

      child.children.forEach(fragmentChild => {
        if (t.isJSXElement(fragmentChild)) {
          const childResults = extractFromNode(fragmentChild, processedNodes);
          fragmentChildren.push(...childResults);
        }
      });

      if (fragmentChildren.length) {
        const fragmentNode = createFragmentNode(
          collectText(child.children),
          fragmentChildren,
        );
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

const parseToNodes = (raw: string): DataAttrNode[] => {
  const wrapped = wrap(raw);
  const ast = parse(wrapped, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });

  const results: DataAttrNode[] = [];
  const processedNodes = new WeakSet<t.JSXElement | t.JSXFragment>();

  traverse(ast, {
    JSXElement(path) {
      if (processedNodes.has(path.node)) {
        return;
      }

      const opening = path.node.openingElement;
      const tagName = getTagName(opening);

      if (!tagName) {
        return;
      }

      const { allAttrs, dataAttrs } = extractAttributes(opening.attributes);

      if (dataAttrs.length) {
        let childrenNodes: DataAttrNode[] | undefined;

        const bindingAttr = dataAttrs.find(
          attr => attr.name === DATA_ATTR.BINDING,
        );

        const bindings = bindingAttr?.value
          ? parseBinding(bindingAttr.value)
          : [];
        const childrenBinding = bindings.find(
          b => b.property === BINDING_PROP.CHILDREN,
        );

        if (childrenBinding) {
          childrenNodes = processChildrenBinding(path.node, processedNodes);
        }

        const arrayBindings = bindings.filter(
          b => b.property === BINDING_PROP.ITEMS || b.type === 'array',
        );

        for (const arrayBinding of arrayBindings) {
          skipItemsChildren(path.node, processedNodes, arrayBinding.property);
        }

        const innerHtmlBinding = bindings.find(
          b => b.property === BINDING_PROP.INNER_HTML,
        );

        let rawChildren: string | undefined;
        if (innerHtmlBinding && path.node.children.length > 0) {
          rawChildren = path.node.children
            .map(child => generateCode(child))
            .join('')
            .trim();
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
      }
    },
  });

  return results;
};

export function extract(raw: string): DataAttrNode[] {
  if (extractCache.has(raw)) {
    return extractCache.get(raw)!;
  }

  const results = parseToNodes(raw);

  if (extractCache.size >= CONFIG.CACHE_LIMIT) {
    const firstKey = extractCache.keys().next().value;
    if (firstKey) {
      extractCache.delete(firstKey);
    }
  }

  extractCache.set(raw, results);

  return results;
}

function extractFromNode(
  node: t.JSXElement,
  processedNodes?: WeakSet<t.JSXElement | t.JSXFragment>,
): DataAttrNode[] {
  const results: DataAttrNode[] = [];
  const opening = node.openingElement;

  processedNodes?.add(node);

  const tagName = getTagName(opening);

  const { allAttrs, dataAttrs } = extractAttributes(opening.attributes);

  let childrenNodes: DataAttrNode[] | undefined;

  const bindingAttr = dataAttrs.find(attr => attr.name === DATA_ATTR.BINDING);
  const bindings = bindingAttr?.value ? parseBinding(bindingAttr.value) : [];

  const childrenBinding = bindings.find(
    b => b.property === BINDING_PROP.CHILDREN,
  );

  if (childrenBinding) {
    childrenNodes = processChildrenBinding(node, processedNodes);
  }

  if (!childrenNodes) {
    childrenNodes = processChildrenBinding(node, processedNodes, false);
  }

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

  results.push({
    tagName,
    attributes: allAttrs,
    dataAttributes: dataAttrs,
    textContent: collectText(node.children),
    rawChildren,
    children: childrenNodes,
    bindings,
  });

  return results;
}

export function clearExtractCache() {
  extractCache.clear();
}
