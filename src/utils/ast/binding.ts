import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { BINDING_PROP, DATA_ATTR } from '../../enums';
import type {
  BindingItem,
  BindingOption,
  BindingRenderLeaf,
  BindingRenderMap,
  BindingType,
  DataAttrNode,
} from './types';

const parseRenderObject = (
  node: t.ObjectExpression,
): BindingRenderMap | null => {
  const map: BindingRenderMap = {};

  node.properties.forEach(prop => {
    if (
      !t.isObjectProperty(prop) ||
      !t.isIdentifier(prop.key) ||
      !t.isObjectExpression(prop.value)
    ) {
      return;
    }

    const key = prop.key.name;

    const typeProp = prop.value.properties.find(
      p =>
        t.isObjectProperty(p) &&
        t.isIdentifier(p.key) &&
        p.key.name === 'type' &&
        t.isStringLiteral(p.value),
    ) as t.ObjectProperty | undefined;

    if (typeProp) {
      const leaf: BindingRenderLeaf = {
        type: (typeProp.value as t.StringLiteral).value as BindingType,
      };

      const propertyProp = prop.value.properties.find(
        p =>
          t.isObjectProperty(p) &&
          t.isIdentifier(p.key) &&
          p.key.name === 'property' &&
          t.isStringLiteral(p.value),
      ) as t.ObjectProperty | undefined;

      if (propertyProp) {
        leaf.property = (propertyProp.value as t.StringLiteral).value;
      }

      const renderProp = prop.value.properties.find(
        p =>
          t.isObjectProperty(p) &&
          t.isIdentifier(p.key) &&
          p.key.name === 'render' &&
          t.isObjectExpression(p.value),
      ) as t.ObjectProperty | undefined;

      if (renderProp) {
        const nested = parseRenderObject(
          renderProp.value as t.ObjectExpression,
        );
        if (nested) {
          leaf.render = nested;
        }
      }

      map[key] = leaf;
    } else {
      const nested = parseRenderObject(prop.value);
      if (nested) {
        map[key] = nested;
      }
    }
  });

  return Object.keys(map).length > 0 ? map : null;
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

            const optionsProp = element.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === 'options' &&
                t.isArrayExpression(p.value),
            ) as t.ObjectProperty | undefined;

            const typePropEarly = element.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === 'type' &&
                t.isStringLiteral(p.value),
            ) as t.ObjectProperty | undefined;

            const earlyTypeValue = typePropEarly
              ? (typePropEarly.value as t.StringLiteral).value
              : undefined;

            const isRichtext = earlyTypeValue === 'richtext';

            if (labelProp && (propertyProp || isRichtext)) {
              const binding: BindingItem = {
                label: (labelProp.value as t.StringLiteral).value,
                property: propertyProp
                  ? (propertyProp.value as t.StringLiteral).value
                  : BINDING_PROP.INNER_HTML,
              };

              const typeProp = typePropEarly;

              if (typeProp) {
                const typeValue = (typeProp.value as t.StringLiteral).value;
                if (
                  [
                    'array',
                    'object',
                    'string',
                    'number',
                    'boolean',
                    'color',
                    'jsx',
                    'richtext',
                    'date',
                    'url',
                    'icon-picker',
                    'asset-picker',
                  ].includes(typeValue)
                ) {
                  binding.type = typeValue as BindingType;
                }
              }

              const renderProp = element.properties.find(
                p =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'render' &&
                  t.isObjectExpression(p.value),
              ) as t.ObjectProperty | undefined;

              if (renderProp && t.isObjectExpression(renderProp.value)) {
                const renderMap = parseRenderObject(renderProp.value);

                if (renderMap) {
                  binding.render = renderMap;
                }
              }

              if (optionsProp && t.isArrayExpression(optionsProp.value)) {
                const options = optionsProp.value.elements
                  .map(el => {
                    if (t.isObjectExpression(el)) {
                      const labelProp = el.properties.find(
                        p =>
                          t.isObjectProperty(p) &&
                          t.isIdentifier(p.key) &&
                          p.key.name === 'label' &&
                          t.isStringLiteral(p.value),
                      ) as t.ObjectProperty | undefined;

                      const valueProp = el.properties.find(
                        p =>
                          t.isObjectProperty(p) &&
                          t.isIdentifier(p.key) &&
                          p.key.name === 'value' &&
                          t.isStringLiteral(p.value),
                      ) as t.ObjectProperty | undefined;

                      if (labelProp && valueProp) {
                        return {
                          label: (labelProp.value as t.StringLiteral).value,
                          value: (valueProp.value as t.StringLiteral).value,
                        };
                      }
                    }
                    return null;
                  })
                  .filter((item): item is BindingOption => item !== null);

                if (options.length > 0) {
                  binding.options = options;
                }
              }

              const minProp = element.properties.find(
                p =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'min' &&
                  t.isNumericLiteral(p.value),
              ) as t.ObjectProperty | undefined;

              if (minProp) {
                binding.min = (minProp.value as t.NumericLiteral).value;
              }

              const maxProp = element.properties.find(
                p =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'max' &&
                  t.isNumericLiteral(p.value),
              ) as t.ObjectProperty | undefined;

              if (maxProp) {
                binding.max = (maxProp.value as t.NumericLiteral).value;
              }

              const patternProp = element.properties.find(
                p =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'pattern' &&
                  t.isStringLiteral(p.value),
              ) as t.ObjectProperty | undefined;

              if (patternProp) {
                binding.pattern = (patternProp.value as t.StringLiteral).value;
              }

              const requiredProp = element.properties.find(
                p =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'required' &&
                  t.isBooleanLiteral(p.value),
              ) as t.ObjectProperty | undefined;

              if (requiredProp) {
                binding.required = (
                  requiredProp.value as t.BooleanLiteral
                ).value;
              }

              return binding;
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

    case BINDING_PROP.INNER_HTML: {
      // richtext 타입: dangerouslySetInnerHTML={{ __html }} 에서 읽기
      const dsiAttr = node.attributes.find(
        a => a.name === 'dangerouslySetInnerHTML',
      );
      if (dsiAttr?.value) {
        try {
          const expr = parseExpression(dsiAttr.value, {
            plugins: ['jsx', 'typescript'],
          });
          if (t.isObjectExpression(expr)) {
            const htmlProp = expr.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === '__html',
            ) as t.ObjectProperty | undefined;
            if (htmlProp) {
              if (t.isStringLiteral(htmlProp.value)) {
                return htmlProp.value.value;
              }
              if (
                t.isTemplateLiteral(htmlProp.value) &&
                htmlProp.value.expressions.length === 0
              ) {
                return (
                  htmlProp.value.quasis[0]?.value.cooked ??
                  htmlProp.value.quasis[0]?.value.raw ??
                  ''
                );
              }
            }
          }
        } catch {
          // ignore
        }
      }
      return node.rawChildren || node.textContent || '';
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
