import generate from '@babel/generator';
import { parse, parseExpression } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP, DATA_ATTR } from '../../enums';

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
}

export interface BindingItem {
  label: string;
  property: string;
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

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return t.jsxExpressionContainer(t.numericLiteral(parseFloat(trimmed)));
  }

  if (/^(true|false|null|undefined)$/.test(trimmed)) {
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

const generateCode = (node: t.Node): string => {
  return generate(node, { jsescOption: { minimal: true } }).code;
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

    const openingElement = t.jsxOpeningElement(
      t.jsxIdentifier(node.tagName),
      attributes,
    );

    const closingElement = t.jsxClosingElement(t.jsxIdentifier(node.tagName));
    const children = buildChildElements(node);

    return t.jsxElement(openingElement, closingElement, children, false);
  } catch (error) {
    console.error('DataAttrNode to JSX 변환 에러:', error);
    return null;
  }
};

/**
 * data-binding 값을 파싱하여 배열로 반환
 */
export const parseBinding = (bindingValue: string | null): BindingItem[] => {
  if (!bindingValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      bindingValue.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'),
    );

    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          item =>
            item && typeof item === 'object' && item.label && item.property,
        )
        .map(item => ({
          label: item.label,
          property: item.property,
        }));
    }
    return [];
  } catch {
    return [];
  }
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

      if (
        value &&
        (value.trim().startsWith('{') || value.trim().startsWith('['))
      ) {
        try {
          const expr = parseExpression(value, {
            plugins: ['jsx', 'typescript'],
          });

          const code = generateCode(expr);
          const evaluated = new Function(`return ${code}`)();

          return JSON.stringify(evaluated);
        } catch {
          // 파싱 실패시 원본 반환
        }
      }

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

export function extract(raw: string): DataAttrNode[] {
  if (extractCache.has(raw)) {
    return extractCache.get(raw)!;
  }

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
      let tagName = '';

      if (t.isJSXIdentifier(opening.name)) {
        tagName = opening.name.name;
      } else if (t.isJSXMemberExpression(opening.name)) {
        const obj = opening.name.object;
        const prop = opening.name.property;
        if (t.isJSXIdentifier(obj) && t.isJSXIdentifier(prop)) {
          tagName = `${obj.name}.${prop.name}`;
        }
      } else {
        return;
      }

      const { allAttrs, dataAttrs } = extractAttributes(opening.attributes);

      if (dataAttrs.length) {
        let childrenNodes: DataAttrNode[] | undefined;

        const bindingAttr = dataAttrs.find(
          attr => attr.name === DATA_ATTR.BINDING,
        );

        if (bindingAttr?.value) {
          const bindings = parseBinding(bindingAttr.value);
          const childrenBinding = bindings.find(
            b => b.property === BINDING_PROP.CHILDREN,
          );

          if (childrenBinding) {
            const jsxChildren = path.node.children.filter(
              child => t.isJSXElement(child) || t.isJSXFragment(child),
            );

            childrenNodes = [];

            jsxChildren.forEach(child => {
              processedNodes.add(child);

              if (t.isJSXElement(child)) {
                const childResults = extractFromNode(child, processedNodes);

                const wrapperNode: DataAttrNode = {
                  tagName: 'div',
                  id: nanoid(6),
                  attributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
                  dataAttributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
                  textContent: collectText(child.children),
                  children: childResults,
                };

                childrenNodes!.push(wrapperNode);
              } else if (t.isJSXFragment(child)) {
                const fragmentChildren: DataAttrNode[] = [];

                child.children.forEach(fragmentChild => {
                  if (t.isJSXElement(fragmentChild)) {
                    processedNodes.add(fragmentChild);
                    const childResults = extractFromNode(
                      fragmentChild,
                      processedNodes,
                    );
                    fragmentChildren.push(...childResults);
                  }
                });

                const fragmentNode: DataAttrNode = {
                  tagName: '',
                  id: nanoid(6),
                  attributes: [],
                  dataAttributes: [],
                  textContent: collectText(child.children),
                  children: fragmentChildren,
                  isFragment: true,
                };

                childrenNodes!.push(fragmentNode);
              }
            });
          }
        }

        results.push({
          tagName,
          attributes: allAttrs,
          dataAttributes: dataAttrs,
          textContent: collectText(path.node.children),
          children: childrenNodes,
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

  if (extractCache.size >= 50) {
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

  let tagName = '';

  if (t.isJSXIdentifier(opening.name)) {
    tagName = opening.name.name;
  } else if (t.isJSXMemberExpression(opening.name)) {
    const obj = opening.name.object;
    const prop = opening.name.property;
    if (t.isJSXIdentifier(obj) && t.isJSXIdentifier(prop)) {
      tagName = `${obj.name}.${prop.name}`;
    }
  }

  const { allAttrs, dataAttrs } = extractAttributes(opening.attributes);

  let childrenNodes: DataAttrNode[] | undefined;

  const bindingAttr = dataAttrs.find(attr => attr.name === DATA_ATTR.BINDING);

  if (bindingAttr?.value) {
    const bindings = parseBinding(bindingAttr.value);
    const childrenBinding = bindings.find(
      b => b.property === BINDING_PROP.CHILDREN,
    );

    if (childrenBinding) {
      const jsxChildren = node.children.filter(
        child => t.isJSXElement(child) || t.isJSXFragment(child),
      );

      childrenNodes = [];

      jsxChildren.forEach(child => {
        if (t.isJSXElement(child)) {
          // processedNodes에 추가하여 루트 레벨에서 중복 처리 방지
          processedNodes?.add(child);

          const childResults = extractFromNode(child, processedNodes);

          const wrapperNode: DataAttrNode = {
            tagName: 'div',
            id: nanoid(6),
            attributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
            dataAttributes: [{ name: DATA_ATTR.ITEM, value: 'true' }],
            textContent: collectText(child.children),
            children: childResults,
          };

          childrenNodes!.push(wrapperNode);
        } else if (t.isJSXFragment(child)) {
          processedNodes?.add(child);

          const fragmentChildren: DataAttrNode[] = [];

          child.children.forEach(fragmentChild => {
            if (t.isJSXElement(fragmentChild)) {
              processedNodes?.add(fragmentChild);
              const childResults = extractFromNode(
                fragmentChild,
                processedNodes,
              );
              fragmentChildren.push(...childResults);
            }
          });

          if (fragmentChildren.length) {
            const fragmentNode: DataAttrNode = {
              tagName: '',
              id: nanoid(6),
              attributes: [],
              dataAttributes: [],
              textContent: collectText(child.children),
              children: fragmentChildren,
              isFragment: true,
            };

            childrenNodes!.push(fragmentNode);
          }
        }
      });
    }
  }

  // children 바인딩이 없는 경우 기존 로직
  if (!childrenNodes) {
    const jsxChildren = node.children.filter(
      child => t.isJSXElement(child) || t.isJSXFragment(child),
    );

    if (jsxChildren.length) {
      childrenNodes = [];

      jsxChildren.forEach(child => {
        if (t.isJSXElement(child)) {
          const childResults = extractFromNode(child, processedNodes);
          childrenNodes!.push(...childResults);
        } else if (t.isJSXFragment(child)) {
          const fragmentChildren: DataAttrNode[] = [];

          child.children.forEach(fragmentChild => {
            if (t.isJSXElement(fragmentChild)) {
              const childResults = extractFromNode(
                fragmentChild,
                processedNodes,
              );
              fragmentChildren.push(...childResults);
            }
          });

          if (fragmentChildren.length) {
            const fragmentNode: DataAttrNode = {
              tagName: '',
              id: nanoid(6),
              attributes: [],
              dataAttributes: [],
              textContent: collectText(child.children),
              children: fragmentChildren,
              isFragment: true,
            };

            childrenNodes!.push(fragmentNode);
          }
        }
      });
    }
  }

  results.push({
    tagName,
    attributes: allAttrs,
    dataAttributes: dataAttrs,
    textContent: collectText(node.children),
    children: childrenNodes,
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
    console.error('Children 업데이트 에러:', error);
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
    customAttr.value = attrValue({
      name: propertyName,
      value,
      isStringLiteral: true,
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

        // data-binding 속성 확인 및 업데이트 로직
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
    console.error('코드 업데이트 에러:', error);
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
