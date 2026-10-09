import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { STRING_VALUED_TYPES } from './binding';
import { generateCode } from './helpers';
import type { SourceEdit } from './patch';
import type { BindingType } from './types';
import { isLosslesslyEvaluable, unwrapExpression } from './value';
import { valueToExpression } from './value-expression';

// The source editors behind `update`: each turns one property edit on one
// element into source spans, and never touches the tree.

// What each editor below returns: the source spans to change, never a
// changed tree, so everything else stays byte-identical (#239). An empty
// array means "handled, nothing to write"; `null` means the edit failed.
export type EditResult = SourceEdit[] | null;

// The span between `>` and `</`, i.e. everything the element encloses.
// `null` for a self-closing element, which has nowhere to put children.
export const childrenRange = (
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

export const findAttribute = (
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
export const editInnerText = (
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
      const leadingSpace = raw.slice(0, raw.length - raw.trimStart().length);
      const trailingSpace = raw.slice(raw.trimEnd().length);
      // Only whitespace with a line break is layout. JSX keeps same-line
      // whitespace in the string while the panel value hides it, so the
      // edit overwrites that.
      const leading = /[\r\n]/.test(leadingSpace) ? leadingSpace.length : 0;
      const trailing = /[\r\n]/.test(trailingSpace) ? trailingSpace.length : 0;

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
export const editInnerHTML = (
  element: t.JSXElement,
  value: string,
): EditResult => {
  const range = childrenRange(element);

  if (!range) {
    return [];
  }

  return [{ start: range.start, end: range.end, content: value }];
};

export const editRichtext = (
  element: t.JSXElement,
  value: string,
): EditResult => {
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
export const editJsxAttribute = (
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

// Whether a string has a control character: a line break, a tab, and so on.
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some(char => char.charCodeAt(0) < 0x20);

// A string as the value of a JSX attribute, which has its own rules: no
// backslash escapes, and `&` starts an entity. Babel prints a string literal
// by JavaScript rules (`"a\"b"`, `"C:\\dir"`), which JSX would read as a
// different value or fail to parse, so the text is written as given
// (`extra.raw`).
//
// - A control character goes in `{"..."}`. A line break in an attribute
//   string followed by spaces compiles to one space, so only the expression
//   form keeps it.
// - Otherwise the quote with fewer escapes: `'` for a value that has `"` and
//   no `'`, else `"` with `&quot;` for any `"` inside.
// - `&` becomes `&amp;` when it starts something entity-like, so a typed
//   `&amp;` stays literal. A lone `&` is written as is.
const jsxStringValue = (
  value: string,
): t.StringLiteral | t.JSXExpressionContainer => {
  if (hasControlCharacter(value)) {
    return t.jsxExpressionContainer(t.stringLiteral(value));
  }

  const quote = value.includes('"') && !value.includes("'") ? "'" : '"';
  const text = value.replace(/&(?=#?[A-Za-z0-9]+;)/g, '&amp;');
  const escaped = quote === '"' ? text.replace(/"/g, '&quot;') : text;
  const literal = t.stringLiteral(value);

  literal.extra = { raw: `${quote}${escaped}${quote}`, rawValue: value };

  return literal;
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
        return jsxStringValue(value);
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

    return jsxStringValue(value);
  }

  const expr = valueToExpression(value);
  return expr ? t.jsxExpressionContainer(expr) : jsxStringValue(String(value));
};

export const editAttribute = (
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

// Up to and including the line break: spaces, single-line block comments
// and one line comment.
const TRAILING_COMMENTS =
  /^[ \t]*(?:\/\*[^\r\n]*?\*\/[ \t]*)*(?:\/\/[^\r\n]*)?\r?\n/;

// Removes an attribute and the whitespace before it, leaving no gap. A
// caller asks for this with `undefined`, since React treats an `undefined`
// prop like a missing one (#426). An attribute alone on its line goes with
// the comments after it, so they don't end up beside the previous attribute.
export const removeAttribute = (
  source: string,
  attribute: t.JSXAttribute,
): EditResult => {
  if (attribute.start == null || attribute.end == null) {
    return null;
  }

  const lineStart = source.lastIndexOf('\n', attribute.start - 1) + 1;
  const rest = TRAILING_COMMENTS.exec(source.slice(attribute.end));

  if (/^[ \t]*$/.test(source.slice(lineStart, attribute.start)) && rest) {
    return [
      { start: lineStart, end: attribute.end + rest[0].length, content: '' },
    ];
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
export const addAttribute = (
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

export const canEditAttributeValue = (
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
