import { parse } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP, DATA_ATTR, REGEX } from '../../constants';
import { parseBinding } from './binding';
import { traverse } from './document';
import { nodeToJSX } from './extract';
import { attrValue, generateCode, unwrap, wrap } from './helpers';
import type { DataAttrNode } from './types';

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

// Injects a `{__PREFIX_<id>__}` JSX expression container as a placeholder,
// then records how the placeholder's *generated source text* should be
// string-replaced with the real value once generateCode() has run — used
// for values (raw HTML, arbitrary JSX/expressions) that can't be
// represented as AST literals, so we can't just build the real node here.
//
// `asRawContent: true` replaces the placeholder *including* its enclosing
// braces, so the raw value lands as literal children content instead of a
// JS expression (used for innerHTML). Leaving it false replaces only the
// identifier inside the braces, so the value is inserted as the expression
// itself (used for a `type: 'jsx'` attribute value).
const injectPlaceholder = (
  prefix: string,
  value: string,
  placeholders: Map<string, string>,
  { asRawContent = false }: { asRawContent?: boolean } = {},
): t.JSXExpressionContainer => {
  const name = `__${prefix}_${nanoid(6)}__`;
  const container = t.jsxExpressionContainer(t.identifier(name));

  placeholders.set(asRawContent ? `{${name}}` : name, value);

  return container;
};

const updateInnerHTML = (
  path: NodePath<t.JSXElement>,
  value: string,
  placeholders: Map<string, string>,
): boolean => {
  path.node.children = [
    injectPlaceholder('HTML', value, placeholders, { asRawContent: true }),
  ];

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

const updateRichtext = (
  path: NodePath<t.JSXElement>,
  value: string,
): boolean => {
  path.node.children = [];

  const opening = path.node.openingElement;
  const htmlObject = t.objectExpression([
    t.objectProperty(t.identifier('__html'), t.stringLiteral(value)),
  ]);

  const existingAttr = opening.attributes.find(
    a =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name) &&
      a.name.name === 'dangerouslySetInnerHTML',
  );

  if (existingAttr && t.isJSXAttribute(existingAttr)) {
    existingAttr.value = t.jsxExpressionContainer(htmlObject);
  } else {
    opening.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('dangerouslySetInnerHTML'),
        t.jsxExpressionContainer(htmlObject),
      ),
    );
  }

  return true;
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

export interface UpdateResult {
  code: string;
  success: boolean;
}

// `label` is a display string — reworded, duplicated, or translated at
// authors' whim — so it identifies a binding only as a fallback. `property`
// (an actual key, unique per element) is the real identity; pass it
// whenever the caller has it (every internal caller does, via
// PanelBinding.property). See #240: two bindings sharing a label used to
// resolve to whichever `.find()` hit first, silently dropping the other's
// edit while still reporting success.
export const update = (
  code: string,
  dataId: string,
  label: string,
  value: string,
  property?: string,
): UpdateResult => {
  try {
    const wrapped = wrap(code);
    const ast = parse(wrapped, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let changed = false;
    const jsxPlaceholders = new Map<string, string>();

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

        // Prefer `property` (an actual key) over `label` (a display
        // string) — see the module-level comment on `update`. Either way,
        // more than one match on this element is an authoring ambiguity
        // (duplicate labels, or a genuine property collision), not a case
        // to silently resolve by picking the first — see #240.
        const matches = bindings.filter(binding =>
          property !== undefined
            ? binding.property === property
            : binding.label === label,
        );

        if (matches.length !== 1) {
          return;
        }

        const propertyBinding = matches[0]!;

        switch (propertyBinding.property) {
          case BINDING_PROP.INNER_TEXT: {
            changed = updateInnerText(path, value);
            break;
          }

          case BINDING_PROP.INNER_HTML: {
            if (propertyBinding.type === 'richtext') {
              changed = updateRichtext(path, value);
            } else {
              changed = updateInnerHTML(path, value, jsxPlaceholders);
            }
            break;
          }

          case BINDING_PROP.CHILDREN: {
            changed = updateChildren(path, value);
            break;
          }

          default: {
            if (propertyBinding.type === 'jsx') {
              const attr = opening.attributes.find(
                a =>
                  t.isJSXAttribute(a) &&
                  t.isJSXIdentifier(a.name) &&
                  a.name.name === propertyBinding.property,
              );

              if (attr && t.isJSXAttribute(attr)) {
                attr.value = injectPlaceholder(
                  'JSX',
                  value.trim(),
                  jsxPlaceholders,
                );
                changed = true;
              }
            } else {
              changed = updateAttribute(
                opening,
                propertyBinding.property,
                value,
              );
            }

            break;
          }
        }
      },
    });

    if (!changed) {
      return { code, success: false };
    }

    let result = unwrap(generateCode(ast));

    for (const [placeholder, original] of jsxPlaceholders) {
      // 두 번째 인자가 문자열이면 $&, $$ 같은 특수 치환 패턴으로 해석되어
      // original 안에 그런 문자가 있으면 결과가 깨진다 — 함수형 치환자로 방지.
      result = result.replace(placeholder, () => original);
    }

    return { code: result, success: true };
  } catch (error) {
    console.error('❌ Code update error:', error);
    return { code, success: false };
  }
};

export const bulkUpdate = (
  raw: string,
  entries: {
    dataId: string;
    label: string;
    value: string;
    property?: string;
  }[],
): UpdateResult => {
  let current = raw;
  let allSucceeded = true;

  for (const entry of entries) {
    const result = update(
      current,
      entry.dataId,
      entry.label,
      entry.value,
      entry.property,
    );
    current = result.code;
    allSucceeded = allSucceeded && result.success;
  }

  return { code: current, success: allSucceeded };
};
