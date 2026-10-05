import { parse, parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import {
  BINDING_PROP,
  DATA_ATTR,
  RESERVED_BINDING_PROPERTIES,
} from '../../constants';
import { STRING_VALUED_TYPES, parseBinding, resolveBindings } from './binding';
import { editChildrenSource } from './children';
import { traverse } from './document';
import { generateCode, unwrap, wrap } from './helpers';
import { getJSXTagName } from './jsx-name';
import { type SourceEdit, applyEdits } from './patch';
import type { BindingItem, BindingOptions, BindingType } from './types';
import {
  isLosslesslyEvaluable,
  unwrapExpression,
  valueToExpression,
} from './value';

// What each editor below returns: the source spans to change, never a
// changed tree, so everything else stays byte-identical (#239). An empty
// array means "handled, nothing to write"; `null` means the edit failed.
type EditResult = SourceEdit[] | null;

// The span between `>` and `</`, i.e. everything the element encloses.
// `null` for a self-closing element, which has nowhere to put children.
const childrenRange = (
  element: t.JSXElement,
): { start: number; end: number } | null => {
  const { openingElement, closingElement } = element;

  if (
    !closingElement ||
    openingElement.end == null ||
    closingElement.start == null
  ) {
    return null;
  }

  return { start: openingElement.end, end: closingElement.start };
};

const findAttribute = (
  opening: t.JSXOpeningElement,
  propertyName: string,
): t.JSXAttribute | undefined => {
  return opening.attributes.find(
    (attr): attr is t.JSXAttribute =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === propertyName,
  );
};

// Where a new attribute goes: after the last attribute, or after the
// element name when there are none.
const attributeInsertPoint = (opening: t.JSXOpeningElement): number | null => {
  const last = opening.attributes[opening.attributes.length - 1];

  return last?.end ?? opening.name.end ?? null;
};

// Replaces the element's text. With a single text child, only the trimmed
// text is replaced, so the line breaks and indentation around it stay
// (#239). Otherwise every text child is removed and `value` is written just
// before the closing tag; nested elements stay.
//
// A self-closing element has nowhere to put text: this returns no edits,
// and `update` reports success without changing anything.
const editInnerText = (
  source: string,
  element: t.JSXElement,
  value: string,
): EditResult => {
  const range = childrenRange(element);

  if (!range) {
    return [];
  }

  const [only] = element.children;

  if (
    element.children.length === 1 &&
    t.isJSXText(only) &&
    only.start != null &&
    only.end != null
  ) {
    // Measure the raw source, not `only.value`: Babel decodes entities and
    // CRLF in `value`, so its lengths don't match the source offsets.
    // `&nbsp;Old&nbsp;` would otherwise become `&New;`.
    const raw = source.slice(only.start, only.end);

    if (raw.trim() !== '') {
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;

      return [
        {
          start: only.start + leading,
          end: only.end - trailing,
          content: value,
        },
      ];
    }
  }

  const edits: SourceEdit[] = [];

  for (const child of element.children) {
    if (t.isJSXText(child) && child.start != null && child.end != null) {
      edits.push({ start: child.start, end: child.end, content: '' });
    }
  }

  edits.push({ start: range.end, end: range.end, content: value });

  return edits;
};

// Replaces the element's children with the raw HTML, as written.
const editInnerHTML = (element: t.JSXElement, value: string): EditResult => {
  const range = childrenRange(element);

  if (!range) {
    return [];
  }

  return [{ start: range.start, end: range.end, content: value }];
};

const editRichtext = (element: t.JSXElement, value: string): EditResult => {
  const edits: SourceEdit[] = [];
  const range = childrenRange(element);

  // richtext owns the element's content, so any prior markup goes.
  if (range && range.start !== range.end) {
    edits.push({ start: range.start, end: range.end, content: '' });
  }

  const opening = element.openingElement;
  const attribute = t.jsxAttribute(
    t.jsxIdentifier('dangerouslySetInnerHTML'),
    t.jsxExpressionContainer(
      t.objectExpression([
        t.objectProperty(t.identifier('__html'), t.stringLiteral(value)),
      ]),
    ),
  );
  const content = generateCode(attribute);
  const existing = findAttribute(opening, 'dangerouslySetInnerHTML');

  if (existing && existing.start != null && existing.end != null) {
    edits.push({
      start: existing.start,
      end: existing.end,
      content,
      indent: true,
    });

    return edits;
  }

  const insertAt = attributeInsertPoint(opening);

  if (insertAt == null) {
    return null;
  }

  edits.push({
    start: insertAt,
    end: insertAt,
    content: ` ${content}`,
    indent: true,
  });

  return edits;
};

// A `type: 'jsx'` value is arbitrary user-authored JSX, so it goes in as
// written rather than being parsed into nodes and printed back out.
const editJsxAttribute = (
  opening: t.JSXOpeningElement,
  propertyName: string,
  value: unknown,
): EditResult => {
  const attribute = findAttribute(opening, propertyName);

  if (!attribute) {
    return null;
  }

  const content = `{${String(value).trim()}}`;

  if (attribute.value?.start != null && attribute.value.end != null) {
    return [
      {
        start: attribute.value.start,
        end: attribute.value.end,
        content,
      },
    ];
  }

  // Valueless shorthand (`<Icon icon />`): there is no value span to
  // overwrite, so append one after the attribute name.
  const insertAt = attribute.name.end;

  if (insertAt == null) {
    return null;
  }

  return [{ start: insertAt, end: insertAt, content: `=${content}` }];
};

// Whether the attribute holds an array or object literal, such as
// `items={[...]}`. Other expressions (`className={cn(...)}`,
// `items={rows}`) don't count: the panel doesn't edit their source, so a
// string committed to them stays a string.
const holdsStructuralExpression = (value?: t.JSXAttribute['value']): boolean =>
  t.isJSXExpressionContainer(value) &&
  (t.isArrayExpression(unwrapExpression(value.expression)) ||
    t.isObjectExpression(unwrapExpression(value.expression)));

// Parses committed text as an array or object literal, or `null`. Only
// those shapes are accepted: `hello` also parses, as an identifier, and
// writing `items={hello}` would turn a value into a variable reference.
const structuralSource = (value: string): t.Expression | null => {
  try {
    const expression = parseExpression(value.trim(), {
      plugins: ['jsx', 'typescript'],
    });

    return t.isArrayExpression(unwrapExpression(expression)) ||
      t.isObjectExpression(unwrapExpression(expression))
      ? expression
      : null;
  } catch {
    return null;
  }
};

// Builds the JSX attribute value for a value and its declared `type`
// (#238). `current` is the value being replaced. Without a declared type,
// as in most `items` bindings, `current` decides whether the value is
// source code or a string, the same way `getStructuredValue` reads it.
const buildAttributeValue = (
  value: unknown,
  type?: BindingType,
  current?: t.JSXAttribute['value'],
): t.JSXAttribute['value'] => {
  // Declared object or array: an expression. A string here is source text
  // from the Items or object editor, so parse it instead of quoting it.
  if (type === 'array' || type === 'object') {
    if (typeof value === 'string') {
      try {
        return t.jsxExpressionContainer(
          parseExpression(value.trim(), { plugins: ['jsx', 'typescript'] }),
        );
      } catch {
        return t.stringLiteral(value);
      }
    }

    const expr = valueToExpression(value);
    return expr ? t.jsxExpressionContainer(expr) : t.stringLiteral('');
  }

  // Otherwise each JS type maps to one kind of literal. A string stays a
  // string literal whatever it contains.
  if (typeof value === 'string') {
    // Except when the attribute holds an array or object literal: then the
    // string is its source text from the array editor. Quoting it would turn
    // `items={[...]}` into a string and break the document.
    if (
      holdsStructuralExpression(current) &&
      !(type && STRING_VALUED_TYPES.has(type))
    ) {
      const structural = structuralSource(value);

      if (structural) {
        return t.jsxExpressionContainer(structural);
      }
    }

    return t.stringLiteral(value);
  }

  const expr = valueToExpression(value);
  return expr ? t.jsxExpressionContainer(expr) : t.stringLiteral(String(value));
};

const editAttribute = (
  opening: t.JSXOpeningElement,
  propertyName: string,
  value: unknown,
  type?: BindingType,
): EditResult => {
  const attribute = findAttribute(opening, propertyName);

  if (!attribute || attribute.start == null || attribute.end == null) {
    return null;
  }

  // Array or object source from the editors: check its shape, then replace
  // only the expression, so the unchanged items keep their formatting.
  if (
    typeof value === 'string' &&
    (type === 'array' ||
      type === 'object' ||
      (holdsStructuralExpression(attribute.value) &&
        !(type && STRING_VALUED_TYPES.has(type))))
  ) {
    const expression = structuralSource(value);

    if (expression && t.isJSXExpressionContainer(attribute.value)) {
      const text = value.trim();
      const lineComment = expression.trailingComments?.some(
        comment => comment.type === 'CommentLine',
      );

      return [
        {
          start: attribute.value.expression.start!,
          end: attribute.value.expression.end!,
          content: `${text}${lineComment ? '\n' : ''}`,
        },
      ];
    }
  }

  // Print the whole attribute, so Babel decides the quoting and escaping.
  // The parsed name node is reused, so namespaced and dashed names stay as
  // written.
  const content = generateCode(
    t.jsxAttribute(
      attribute.name,
      buildAttributeValue(value, type, attribute.value),
    ),
  );

  return [
    { start: attribute.start, end: attribute.end, content, indent: true },
  ];
};

// Removes an attribute and the whitespace before it, leaving no gap. A
// caller asks for this with `undefined`, since React treats an `undefined`
// prop like a missing one (#426).
const removeAttribute = (
  source: string,
  attribute: t.JSXAttribute,
): EditResult => {
  if (attribute.start == null || attribute.end == null) {
    return null;
  }

  let start = attribute.start;

  while (start > 0 && /\s/.test(source[start - 1]!)) {
    start -= 1;
  }

  return [{ start, end: attribute.end, content: '' }];
};

// Adds a missing attribute after the last one. Only for a real value:
// clearing a field never creates the attribute (#426). When the last
// attribute is on its own line, the new one goes on the next line with the
// same indentation.
const addAttribute = (
  source: string,
  opening: t.JSXOpeningElement,
  propertyName: string,
  value: unknown,
  type?: BindingType,
): EditResult => {
  const insertAt = attributeInsertPoint(opening);

  if (insertAt == null) {
    return null;
  }

  // With `indent: true`, a newline is enough to line the new attribute up
  // under the last one.
  const lastStart = opening.attributes[opening.attributes.length - 1]?.start;
  const lineStart =
    lastStart == null ? -1 : source.lastIndexOf('\n', lastStart - 1) + 1;
  const ownLine =
    lastStart != null &&
    lineStart > 0 &&
    /^\s*$/.test(source.slice(lineStart, lastStart));
  const separator = ownLine ? '\n' : ' ';

  const content =
    type === 'jsx'
      ? `${propertyName}={${String(value).trim()}}`
      : generateCode(
          t.jsxAttribute(
            t.jsxIdentifier(propertyName),
            buildAttributeValue(value, type),
          ),
        );

  return [
    {
      start: insertAt,
      end: insertAt,
      content: `${separator}${content}`,
      indent: true,
    },
  ];
};

const canEditAttributeValue = (
  attribute: t.JSXAttribute,
  value: unknown,
  type?: BindingType,
) => {
  if (
    !t.isJSXExpressionContainer(attribute.value) ||
    t.isJSXEmptyExpression(attribute.value.expression) ||
    isLosslesslyEvaluable(attribute.value.expression)
  ) {
    return true;
  }

  // The array and object editors commit checked source text, which keeps
  // every expression, so accept it.
  return (
    typeof value === 'string' &&
    holdsStructuralExpression(attribute.value) &&
    !(type && STRING_VALUED_TYPES.has(type)) &&
    structuralSource(value) !== null
  );
};

// Why an edit failed, with what a caller needs to name the cause (#270).
// The cause is usually a wrong `property` or `label` in the element's
// `data-binding`, not the value just typed.
export type UpdateFailure =
  | { reason: 'element-not-found'; dataId: string }
  | { reason: 'no-binding'; dataId: string }
  // The binding targets an attribute the editor owns (`data-id`,
  // `data-name`, `data-binding`), which a panel edit must not rewrite.
  | { reason: 'reserved-property'; dataId: string; property: string }
  // Asked to remove (`undefined`) a property whose binding is `required`.
  | { reason: 'required-property'; dataId: string; property: string }
  | {
      reason: 'binding-not-declared';
      dataId: string;
      label: string;
      property?: string;
    }
  | {
      reason: 'duplicate-binding';
      dataId: string;
      label: string;
      property?: string;
      count: number;
    }
  | { reason: 'attribute-not-found'; dataId: string; property: string }
  | { reason: 'unsupported-syntax'; dataId: string; property: string }
  | { reason: 'parse-error'; error: unknown };

export interface UpdateResult {
  code: string;
  success: boolean;
  // Set when `success` is false. The deprecated `bulkUpdate` reports
  // per-entry failures in `failures` instead.
  failure?: UpdateFailure;
  failures?: UpdateFailure[];
}

// Sets one bound property of the element with `dataId` to `value`, and
// returns the new source or why it couldn't.
//
// The binding is found by `property` when given, otherwise by `label`.
// Pass `property` when you have it: a label is display text and can repeat
// (#240). `options` are the binding sources the bindings were read with
// (#509, #513).
export const update = (
  code: string,
  dataId: string,
  label: string,
  value: unknown,
  property?: string,
  options: BindingOptions = {},
): UpdateResult => {
  try {
    const wrapped = wrap(code);
    const ast = parse(wrapped, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let changed = false;
    let failure: UpdateFailure | undefined;
    const edits: SourceEdit[] = [];

    // Records an editor's result. `null` is a failure, with the reason from
    // `onNull`; anything else counts as handled, even with no edits.
    const collect = (result: EditResult, onNull: () => UpdateFailure) => {
      if (!result) {
        failure = onNull();
        return;
      }

      edits.push(...result);
      changed = true;
    };

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

        // An attribute with no value declares nothing to check against.
        if (bindingAttr && !bindingAttr.value) {
          failure = { reason: 'no-binding', dataId };
          return;
        }

        let own: BindingItem[] | undefined;

        if (bindingAttr?.value) {
          let bindingValue = '';

          if (t.isStringLiteral(bindingAttr.value)) {
            bindingValue = bindingAttr.value.value;
          } else if (t.isJSXExpressionContainer(bindingAttr.value)) {
            try {
              bindingValue = generateCode(bindingAttr.value.expression);
            } catch (error) {
              failure = { reason: 'parse-error', error };
              return;
            }
          }

          own = parseBinding(bindingValue);
        }

        const keyAttr = opening.attributes.find(
          (attr): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === DATA_ATTR.BINDING_KEY,
        );
        // The same sources, in the same order, that the bindings were read
        // from (#509, #513).
        const bindings = resolveBindings(
          own,
          keyAttr &&
            (keyAttr.value && t.isStringLiteral(keyAttr.value)
              ? keyAttr.value.value
              : null),
          getJSXTagName(opening),
          options,
        );

        if (!own && bindings.length === 0) {
          failure = { reason: 'no-binding', dataId };
          return;
        }

        // By `property` when given, otherwise by `label`. More than one
        // match is an authoring mistake, reported rather than resolved by
        // picking one (#240).
        const matches = bindings.filter(binding =>
          property !== undefined
            ? binding.property === property
            : binding.label === label,
        );

        if (matches.length === 0) {
          failure = { reason: 'binding-not-declared', dataId, label, property };
          return;
        }

        if (matches.length > 1) {
          failure = {
            reason: 'duplicate-binding',
            dataId,
            label,
            property,
            count: matches.length,
          };
          return;
        }

        const propertyBinding = matches[0]!;
        const prop = propertyBinding.property;

        if (RESERVED_BINDING_PROPERTIES.includes(prop)) {
          failure = { reason: 'reserved-property', dataId, property: prop };
          return;
        }

        // `undefined` asks for the property to go: an attribute is removed,
        // content is emptied. A `required` binding can't be removed (#426).
        const unset = value === undefined;

        if (unset && propertyBinding.required) {
          failure = { reason: 'required-property', dataId, property: prop };
          return;
        }

        switch (prop) {
          case BINDING_PROP.INNER_TEXT: {
            collect(
              editInnerText(wrapped, path.node, unset ? '' : String(value)),
              () => ({
                reason: 'parse-error',
                error: new Error(`could not update "${prop}"`),
              }),
            );
            break;
          }

          case BINDING_PROP.INNER_HTML: {
            collect(
              propertyBinding.type === 'richtext'
                ? editRichtext(path.node, unset ? '' : String(value))
                : editInnerHTML(path.node, unset ? '' : String(value)),
              () => ({
                reason: 'parse-error',
                error: new Error(`could not update "${prop}"`),
              }),
            );
            break;
          }

          case BINDING_PROP.CHILDREN: {
            // Children are edited one at a time (move, add, remove), so they
            // can't be removed as a whole.
            if (unset) {
              failure = {
                reason: 'unsupported-syntax',
                dataId,
                property: prop,
              };
              break;
            }

            collect(
              editChildrenSource(wrapped, path.node, value, options),
              () => ({
                reason: 'parse-error',
                error: new Error(
                  'Unsupported or stale children edit; source was preserved',
                ),
              }),
            );
            break;
          }

          default: {
            const attribute = findAttribute(opening, prop);

            if (unset) {
              // Already absent: nothing to remove, and nothing went wrong.
              collect(
                attribute ? removeAttribute(wrapped, attribute) : [],
                () => ({
                  reason: 'parse-error',
                  error: new Error(`could not remove "${prop}"`),
                }),
              );
              break;
            }

            // A declared property the element doesn't have yet is added when
            // it's given a real value, so a field that was switched off can be
            // switched on again. An empty string leaves it absent (#426).
            if (!attribute) {
              collect(
                value === ''
                  ? []
                  : addAttribute(
                      wrapped,
                      opening,
                      prop,
                      value,
                      propertyBinding.type,
                    ),
                () => ({
                  reason: 'attribute-not-found',
                  dataId,
                  property: prop,
                }),
              );
              break;
            }

            if (
              attribute &&
              propertyBinding.type !== 'jsx' &&
              !canEditAttributeValue(attribute, value, propertyBinding.type)
            ) {
              failure = {
                reason: 'unsupported-syntax',
                dataId,
                property: prop,
              };
              break;
            }

            collect(
              propertyBinding.type === 'jsx'
                ? editJsxAttribute(opening, prop, value)
                : editAttribute(opening, prop, value, propertyBinding.type),
              () => ({ reason: 'attribute-not-found', dataId, property: prop }),
            );
            break;
          }
        }
      },
    });

    if (!changed) {
      return {
        code,
        success: false,
        // No specific reason recorded means the traversal never reached the
        // target element at all.
        failure: failure ?? { reason: 'element-not-found', dataId },
      };
    }

    // Patch the original source: everything outside the recorded spans is
    // copied unchanged (#239).
    return { code: unwrap(applyEdits(wrapped, edits)), success: true };
  } catch (error) {
    console.error('❌ Code update error:', error);
    return { code, success: false, failure: { reason: 'parse-error', error } };
  }
};

export interface UpdateEntry {
  dataId: string;
  label: string;
  value: unknown;
  property?: string;
}

// The result of `updateAll`: every entry applied, or none. On failure `code`
// is the source as it came in, `index` says which entry was refused, and
// `failure` says why.
export type UpdateAllResult =
  | { success: true; code: string }
  | { success: false; code: string; failure: UpdateFailure; index: number };

// Applies several edits as one: all of them, in array order, or none. The
// first entry that fails stops the run and the source comes back untouched,
// so a caller can commit the result as a single change (#425). An entry sees
// the source the earlier ones left, and a later entry for the same
// `dataId`/`property` wins.
//
// Each entry re-parses the source the one before it produced, so every offset
// is fresh, and the outcome matches applying the entries one at a time (#239).
export const updateAll = (
  raw: string,
  entries: UpdateEntry[],
  options: BindingOptions = {},
): UpdateAllResult => {
  let current = raw;

  for (const [index, entry] of entries.entries()) {
    const result = update(
      current,
      entry.dataId,
      entry.label,
      entry.value,
      entry.property,
      options,
    );

    if (!result.success) {
      return {
        success: false,
        code: raw,
        failure: result.failure ?? {
          reason: 'element-not-found',
          dataId: entry.dataId,
        },
        index,
      };
    }

    current = result.code;
  }

  return { success: true, code: current };
};

/**
 * @deprecated Not atomic: when an entry fails, the ones before and after it
 * are still applied, and the returned `code` carries them. Use `updateAll`,
 * which applies every entry or none. Will be removed in the next major.
 */
export const bulkUpdate = (
  raw: string,
  entries: UpdateEntry[],
): UpdateResult => {
  let current = raw;
  const failures: UpdateFailure[] = [];

  for (const entry of entries) {
    const result = update(
      current,
      entry.dataId,
      entry.label,
      entry.value,
      entry.property,
    );
    current = result.code;
    if (!result.success && result.failure) {
      failures.push(result.failure);
    }
  }

  return failures.length > 0
    ? { code: current, success: false, failures }
    : { code: current, success: true };
};
