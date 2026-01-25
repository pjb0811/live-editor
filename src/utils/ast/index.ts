import generate from '@babel/generator';
import { parse, parseExpression } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP, CONFIG, DATA_ATTR, REGEX } from '../../enums';

interface Attribute {
  name: string;
  value: string | null;
  isStringLiteral?: boolean;
}

export interface DataAttrNode {
  id?: string;
  tagName: string;
  attributes: Attribute[];
  dataAttributes: Attribute[];
  textContent: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  children?: DataAttrNode[];
  isFragment?: boolean;
  bindings?: BindingItem[];
}

export interface BindingItem {
  label: string;
  property: string;
}

export type NodeValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'null'
  | 'array'
  | 'object'
  | 'unknown';

export type EditableNodeValueType = 'boolean' | 'number' | 'string' | 'null';

export interface ExtractedNodeValue {
  type: NodeValueType;
  value: string | number | boolean | null;
}

const wrap = (code: string) => {
  return `<>${code}</>`;
};

const unwrap = (generated: string) => {
  return generated
    .replace(/^<>\s*/g, '')
    .replace(/\s*<\/>\s*;?\s*$/g, '')
    .trim();
};

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

const attrValue = ({
  value,
  isStringLiteral,
}: Attribute): t.JSXAttribute['value'] => {
  if (value === null) {
    return null;
  }

  if (isStringLiteral) {
    return t.stringLiteral(value);
  }

  const trimmed = value.trim();

  if (REGEX.NUMBER.test(trimmed)) {
    return t.jsxExpressionContainer(t.numericLiteral(parseFloat(trimmed)));
  }

  if (REGEX.BOOLEAN_OR_NULL.test(trimmed)) {
    const expr = parseExpression(trimmed, {
      plugins: ['jsx', 'typescript'],
    });
    return t.jsxExpressionContainer(expr);
  }

  try {
    const expr = parseExpression(trimmed, {
      plugins: ['jsx', 'typescript'],
    });
    return t.jsxExpressionContainer(expr);
  } catch {
    return t.stringLiteral(trimmed);
  }
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

const hasEditableBindings = (node: DataAttrNode): boolean => {
  const bindingAttr = node.dataAttributes.find(
    attr => attr.name === DATA_ATTR.BINDING,
  );

  if (!bindingAttr?.value) {
    return false;
  }

  const bindings = node.bindings || parseBinding(bindingAttr.value);

  return bindings.length > 0;
};

export const findEditableChildren = (node: DataAttrNode): DataAttrNode[] => {
  const editableChildren: DataAttrNode[] = [];

  const traverse = (children: DataAttrNode[] | undefined) => {
    if (!children) {
      return;
    }

    for (const child of children) {
      if (hasEditableBindings(child)) {
        editableChildren.push(child);
      }
      traverse(child.children);
    }
  };

  traverse(node.children);

  return editableChildren;
};

export const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (REGEX.NUMBER.test(trimmed)) {
    return parseFloat(trimmed);
  }

  if (REGEX.BOOLEAN_OR_NULL.test(trimmed)) {
    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }
    if (trimmed === 'null') {
      return null;
    }
    if (trimmed === 'undefined') {
      return undefined;
    }
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return new Function(`return (${trimmed})`)();
    } catch {
      return value;
    }
  }

  return value;
};

export const generateCode = (node: t.Node): string => {
  return generate(node, { jsescOption: { minimal: true } }).code;
};

export const parseBinding = (bindingValue: string | null): BindingItem[] => {
  if (!bindingValue) {
    return [];
  }

  try {
    const ast = parseExpression(bindingValue, {
      plugins: ['jsx', 'typescript'],
    });

    if (t.isArrayExpression(ast)) {
      return ast.elements
        .map(element => {
          if (t.isObjectExpression(element)) {
            const labelProp = element.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === 'label' &&
                t.isStringLiteral(p.value),
            ) as t.ObjectProperty | undefined;

            const propertyProp = element.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === 'property' &&
                t.isStringLiteral(p.value),
            ) as t.ObjectProperty | undefined;

            if (labelProp && propertyProp) {
              return {
                label: (labelProp.value as t.StringLiteral).value,
                property: (propertyProp.value as t.StringLiteral).value,
              };
            }
          }
          return null;
        })
        .filter((item): item is BindingItem => item !== null);
    }
  } catch (error) {
    console.error('❌ Binding parsing error:', error);
  }

  return [];
};

export const getCurrentValue = (
  node: DataAttrNode,
  property: string,
): string => {
  switch (property) {
    case BINDING_PROP.INNER_TEXT: {
      return node.textContent || '';
    }

    case BINDING_PROP.CHILDREN: {
      return JSON.stringify(node?.children || []);
    }

    default: {
      const customAttr = node.attributes.find(attr => attr.name === property);
      const value = customAttr?.value || '';

      return value;
    }
  }
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

const nodeToJSX = (node: DataAttrNode): t.JSXElement | t.JSXFragment | null => {
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
  wrap: boolean = true,
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

      if (wrap) {
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
): void => {
  const opening = jsxElement.openingElement;

  const itemsAttr = opening.attributes.find(
    attr =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === 'items',
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

        const itemsBinding = bindings.find(
          b => b.property === BINDING_PROP.ITEMS,
        );

        if (itemsBinding) {
          skipItemsChildren(path.node, processedNodes);
        }

        results.push({
          tagName,
          attributes: allAttrs,
          dataAttributes: dataAttrs,
          textContent: collectText(path.node.children),
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

  results.push({
    tagName,
    attributes: allAttrs,
    dataAttributes: dataAttrs,
    textContent: collectText(node.children),
    children: childrenNodes,
    bindings,
  });

  return results;
}

export function clearExtractCache() {
  extractCache.clear();
}

const updateInnerText = (
  path: NodePath<t.JSXElement>,
  value: string,
): boolean => {
  const jsxChildren = path.node.children;

  for (let i = jsxChildren.length - 1; i >= 0; i--) {
    if (t.isJSXText(jsxChildren[i])) {
      jsxChildren.splice(i, 1);
    }
  }

  jsxChildren.push(t.jsxText(value));
  return true;
};

const updateChildren = (
  path: NodePath<t.JSXElement>,
  value: string,
): boolean => {
  try {
    const childrenData = JSON.parse(value) as DataAttrNode[];

    path.node.children.length = 0;

    childrenData.forEach(childData => {
      const jsxElement = nodeToJSX(childData);
      if (jsxElement) {
        path.node.children.push(jsxElement);
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Children update error:', error);
    return false;
  }
};

const updateAttribute = (
  opening: t.JSXOpeningElement,
  propertyName: string,
  value: string,
): boolean => {
  const customAttr = opening.attributes.find(
    attr =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === propertyName,
  );

  if (customAttr && t.isJSXAttribute(customAttr)) {
    const trimmed = value.trim();
    const isExpression =
      trimmed.startsWith('[') ||
      trimmed.startsWith('{') ||
      REGEX.NUMBER.test(trimmed) ||
      REGEX.BOOLEAN_OR_NULL.test(trimmed);

    customAttr.value = attrValue({
      name: propertyName,
      value,
      isStringLiteral: !isExpression,
    });

    return true;
  }

  return false;
};

export const update = (
  code: string,
  dataId: string,
  label: string,
  value: string,
) => {
  try {
    const wrapped = wrap(code);
    const ast = parse(wrapped, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let changed = false;

    traverse(ast, {
      JSXElement(path) {
        const opening = path.node.openingElement;

        const idAttr = opening.attributes.find(attr => {
          return (
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === DATA_ATTR.ID &&
            attr.value &&
            t.isStringLiteral(attr.value) &&
            attr.value.value === dataId
          );
        });

        if (!idAttr) {
          return;
        }

        const bindingAttr = opening.attributes.find(
          (attr): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === DATA_ATTR.BINDING,
        );

        if (!bindingAttr?.value) {
          return;
        }

        let bindingValue = '';

        if (t.isStringLiteral(bindingAttr.value)) {
          bindingValue = bindingAttr.value.value;
        } else if (t.isJSXExpressionContainer(bindingAttr.value)) {
          try {
            bindingValue = generateCode(bindingAttr.value.expression);
          } catch {
            return;
          }
        }

        const bindings = parseBinding(bindingValue);

        const propertyBinding = bindings.find(
          binding => binding.label === label,
        );

        if (!propertyBinding) {
          return;
        }

        switch (propertyBinding.property) {
          case BINDING_PROP.INNER_TEXT: {
            changed = updateInnerText(path, value);
            break;
          }

          case BINDING_PROP.CHILDREN: {
            changed = updateChildren(path, value);
            break;
          }

          default: {
            changed = updateAttribute(opening, propertyBinding.property, value);
            break;
          }
        }
      },
    });

    if (!changed) {
      return code;
    }

    return unwrap(generateCode(ast));
  } catch (error) {
    console.error('❌ Code update error:', error);
    return code;
  }
};

export const bulkUpdate = (
  raw: string,
  entries: { dataId: string; label: string; value: string }[],
): string => {
  let current = raw;
  for (const entry of entries) {
    current = update(current, entry.dataId, entry.label, entry.value);
  }
  return current;
};

export const replaceIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}="[^"]*"`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

export const fillIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}=""`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

export const clone = (
  element: t.Node,
  generateId: () => string = () => nanoid(6),
) => {
  const cloned = t.cloneNode(element, true);
  const generatedCode = generateCode(cloned);
  const code = replaceIds(generatedCode, generateId);

  return parseExpression(code, {
    plugins: ['jsx', 'typescript'],
  });
};

export const extractNodeValue = (node: t.Node): ExtractedNodeValue => {
  if (t.isBooleanLiteral(node)) {
    return { type: 'boolean', value: node.value };
  }
  if (t.isNumericLiteral(node)) {
    return { type: 'number', value: node.value };
  }
  if (t.isStringLiteral(node)) {
    return { type: 'string', value: node.value };
  }
  if (t.isNullLiteral(node)) {
    return { type: 'null', value: null };
  }
  if (t.isArrayExpression(node)) {
    return { type: 'array', value: generateCode(node) };
  }
  if (t.isObjectExpression(node)) {
    return { type: 'object', value: generateCode(node) };
  }

  return { type: 'unknown', value: null };
};

export const createNodeFromValue = (
  type: NodeValueType,
  value: unknown,
): t.Expression | null => {
  switch (type) {
    case 'boolean': {
      return t.booleanLiteral(value === true);
    }
    case 'number': {
      return t.numericLiteral(Number(value));
    }
    case 'string': {
      return t.stringLiteral(String(value));
    }
    case 'null': {
      return t.nullLiteral();
    }
    case 'array':
    case 'object':
    case 'unknown': {
      return null;
    }
    default: {
      return null;
    }
  }
};

export const parseArrayExpression = (value: string) => {
  try {
    const ast = parseExpression(value, {
      plugins: ['jsx', 'typescript'],
    });

    if (!t.isArrayExpression(ast)) {
      return null;
    }

    return ast;
  } catch (error) {
    console.error('❌ Array parsing error:', error);
    return null;
  }
};

export const extractObjectProperties = (
  element: t.ObjectExpression,
): Record<string, ExtractedNodeValue & { astNode: t.Node }> => {
  const properties: Record<string, ExtractedNodeValue & { astNode: t.Node }> =
    {};

  element.properties.forEach(prop => {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      const key = prop.key.name;

      if (key === 'children' || t.isJSXElement(prop.value)) {
        return;
      }

      const extracted = extractNodeValue(prop.value);

      properties[key] = {
        ...extracted,
        astNode: prop.value,
      };
    }
  });

  return properties;
};

export const arrayExpressionToCode = (
  elements: t.ObjectExpression[],
): string => {
  const nextAst = t.arrayExpression(elements);
  return generateCode(nextAst);
};
