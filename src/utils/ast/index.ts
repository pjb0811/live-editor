import generate from '@babel/generator';
import { parse, parseExpression } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

export interface DataAttrNode {
  id?: string;
  tagName: string;
  attributes: { name: string; value: string | null }[];
  dataAttributes: { name: string; value: string | null }[];
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

const attrValue = (
  value: string,
): t.StringLiteral | t.JSXExpressionContainer => {
  if (!value) {
    return t.stringLiteral('');
  }

  const trimmed = value.trim();

  if (/^\d+[a-zA-Z]/.test(trimmed)) {
    return t.stringLiteral(value);
  }

  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      JSON.parse(trimmed);
      return t.stringLiteral(value);
    } catch {
      // JSON 파싱 실패 시 계속 진행
    }
  }

  const definitelyString = [
    /^[a-zA-Z0-9\s\-_.,!@#$%^&*()+=<>?/|\\:;"'~`]*$/,
    /^https?:\/\//,
    /^[./]/,
  ];

  if (definitelyString.some(pattern => pattern.test(value))) {
    if (
      !/^(true|false|null|undefined|\d+(\.\d+)?|[a-zA-Z_$][a-zA-Z0-9_$]*\s*\()/.test(
        trimmed,
      )
    ) {
      return t.stringLiteral(value);
    }
  }

  try {
    const expr = parseExpression(trimmed, {
      plugins: ['jsx', 'typescript'],
    });
    return t.jsxExpressionContainer(expr);
  } catch (error) {
    console.error('파싱 에러:', error, 'value:', value);
    return t.stringLiteral(value);
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

      return t.jsxAttribute(attrName, attrValue(attr.value));
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
    case 'innerText': {
      return node.textContent || '';
    }

    case 'children': {
      return JSON.stringify(node?.children || []);
    }

    default: {
      const customAttr = node.attributes.find(attr => attr.name === property);
      return customAttr?.value || '';
    }
  }
};

const extractCache = new Map<string, DataAttrNode[]>();

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

      const allAttrs: { name: string; value: string | null }[] = [];
      const dataAttrs: { name: string; value: string | null }[] = [];

      for (const attr of opening.attributes) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
          continue;
        }

        const name = attr.name.name;
        let value: string | null = null;

        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            value = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            const expression = attr.value.expression;
            try {
              value = generateCode(expression);
            } catch {
              value = null;
            }
          }
        }

        const entry = { name, value };
        allAttrs.push(entry);

        if (name.startsWith('data-')) {
          dataAttrs.push(entry);
        }
      }

      if (dataAttrs.length) {
        let childrenNodes: DataAttrNode[] | undefined;

        const bindingAttr = dataAttrs.find(
          attr => attr.name === 'data-binding',
        );

        if (bindingAttr?.value) {
          const bindings = parseBinding(bindingAttr.value);
          const childrenBinding = bindings.find(b => b.property === 'children');

          if (childrenBinding) {
            const jsxChildren = path.node.children.filter(
              child => t.isJSXElement(child) || t.isJSXFragment(child),
            );

            childrenNodes = [];

            jsxChildren.forEach(child => {
              processedNodes.add(child);

              if (t.isJSXElement(child)) {
                const childResults = extractFromNode(child);

                const wrapperNode: DataAttrNode = {
                  tagName: 'div',
                  id: nanoid(6),
                  attributes: [{ name: 'data-item', value: 'true' }],
                  dataAttributes: [{ name: 'data-item', value: 'true' }],
                  textContent: collectText(child.children),
                  children: childResults,
                };

                childrenNodes!.push(wrapperNode);
              } else if (t.isJSXFragment(child)) {
                const fragmentChildren: DataAttrNode[] = [];

                child.children.forEach(fragmentChild => {
                  if (t.isJSXElement(fragmentChild)) {
                    processedNodes.add(fragmentChild);
                    const childResults = extractFromNode(fragmentChild);
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

function extractFromNode(node: t.JSXElement): DataAttrNode[] {
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

  const allAttrs: { name: string; value: string | null }[] = [];
  const dataAttrs: { name: string; value: string | null }[] = [];

  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      continue;
    }

    const name = attr.name.name;
    let value: string | null = null;

    if (attr.value) {
      if (t.isStringLiteral(attr.value)) {
        value = attr.value.value;
      } else if (t.isJSXExpressionContainer(attr.value)) {
        try {
          value = generateCode(attr.value.expression);
        } catch {
          value = null;
        }
      }
    }

    allAttrs.push({ name, value });
    if (name.startsWith('data-')) {
      dataAttrs.push({ name, value });
    }
  }

  if (dataAttrs.length) {
    let childrenNodes: DataAttrNode[] | undefined;

    const jsxChildren = node.children.filter(
      child => t.isJSXElement(child) || t.isJSXFragment(child),
    );

    if (jsxChildren.length) {
      childrenNodes = [];

      jsxChildren.forEach(child => {
        if (t.isJSXElement(child)) {
          const childResults = extractFromNode(child);
          childrenNodes!.push(...childResults);
        } else if (t.isJSXFragment(child)) {
          const fragmentChildren: DataAttrNode[] = [];

          child.children.forEach(fragmentChild => {
            if (t.isJSXElement(fragmentChild)) {
              const childResults = extractFromNode(fragmentChild);
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

    results.push({
      tagName,
      attributes: allAttrs,
      dataAttributes: dataAttrs,
      textContent: collectText(node.children),
      children: childrenNodes,
    });
  }

  return results;
}

export function clearExtractCache() {
  extractCache.clear();
}

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
            attr.name.name === 'data-id' &&
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
            attr.name.name === 'data-binding',
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
          case 'innerText': {
            const jsxChildren = path.node.children;

            for (let i = jsxChildren.length - 1; i >= 0; i--) {
              if (t.isJSXText(jsxChildren[i])) {
                jsxChildren.splice(i, 1);
              }
            }

            jsxChildren.push(t.jsxText(value));
            changed = true;
            break;
          }

          case 'children': {
            try {
              const childrenData = JSON.parse(value) as DataAttrNode[];

              path.node.children.length = 0;

              childrenData.forEach(childData => {
                const jsxElement = nodeToJSX(childData);
                if (jsxElement) {
                  path.node.children.push(jsxElement);
                }
              });

              changed = true;
            } catch (error) {
              console.error('Children 업데이트 에러:', error);
            }
            break;
          }

          default: {
            const customAttr = opening.attributes.find(
              attr =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === propertyBinding.property,
            );

            if (customAttr && t.isJSXAttribute(customAttr)) {
              customAttr.value = attrValue(value);
              changed = true;
            }

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
  return code.replace(/data-id="[^"]*"/g, () => {
    return `data-id="${generateId()}"`;
  });
};

export const fillIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(/data-id=""/g, () => {
    return `data-id="${generateId()}"`;
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
