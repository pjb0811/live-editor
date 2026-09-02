import { parse, parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { BINDING_PROP, DATA_ATTR } from '../../constants';
import { parseBinding } from './binding';
import { traverse } from './document';
import { nodeToJSX } from './extract';
import { generateCode, unwrap, wrap } from './helpers';
import { type SourceEdit, applyEdits } from './patch';
import type { BindingType, DataAttrNode } from './types';
import { valueToExpression } from './value';

// Every editor below returns the source spans it wants to change rather
// than mutating the tree, so `update` can patch the original text and leave
// untouched bytes byte-identical. An empty array means "nothing to write,
// but this counts as handled"; `null` means the edit failed. See #239.
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

// Where a brand-new attribute should be inserted: after the last existing
// attribute, or straight after the element name when there are none.
const attributeInsertPoint = (opening: t.JSXOpeningElement): number | null => {
  const last = opening.attributes[opening.attributes.length - 1];

  return last?.end ?? opening.name.end ?? null;
};

// Drops the element's JSXText children and writes `value` just before the
// closing tag — the positional equivalent of the previous "splice out every
// JSXText, then push a new one" mutation, including its handling of mixed
// children (a nested element stays, the text around it doesn't).
//
// The common case — a single text child — is narrowed further: only the
// text's *trimmed* span is replaced, so the author's line breaks and
// indentation around it survive. Rewriting the whole children region would
// collapse
//
//   >
//     Old Title
//   </h1>
//
// down to `>New Title</h1>`, which is exactly the formatting loss #239 is
// about, just at a smaller scale.
//
// A self-closing element yields no edits: there is no children region to
// write into. That matches the old behaviour, which pushed onto a `children`
// array the generator then ignored — a silent no-op still reported as
// success. Left as-is here deliberately; it is a reporting bug, tracked
// with the rest of that class in #270.
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
    // Measured on the raw source slice, never on `only.value`: the latter is
    // Babel's *cooked* text, with HTML entities decoded and CRLF collapsed
    // to LF, so its character counts don't line up with the raw offsets the
    // span is built from. `&nbsp;Old&nbsp;` would put the span six bytes
    // inside the entity (yielding `&New;`), and a CRLF file would lose a
    // byte off each end of every innerText edit.
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

// Raw HTML replaces the children region verbatim. This is what the old
// `__HTML_<id>__` placeholder existed to achieve: the value can't be
// represented as an AST literal, so it had to be smuggled past the
// generator and string-substituted back in afterwards. Writing directly
// into the source removes that round-trip — and with it the `$&`/`$$`
// substitution hazard that the replacement step had to guard against.
const editInnerHTML = (element: t.JSXElement, value: string): EditResult => {
  const range = childrenRange(element);

  if (!range) {
    return [];
  }

  return [{ start: range.start, end: range.end, content: value }];
};

const editChildren = (element: t.JSXElement, value: unknown): EditResult => {
  try {
    const childrenData = (
      typeof value === 'string' ? JSON.parse(value) : value
    ) as DataAttrNode[];

    const range = childrenRange(element);

    if (!range) {
      return [];
    }

    // These children are new, so there is no source text to preserve —
    // generating the fragment is correct here. The point of #239 is to
    // generate *only* the fragment, never the enclosing tree.
    const content = childrenData
      .map(childData => nodeToJSX(childData))
      .filter((node): node is t.JSXElement | t.JSXFragment => node !== null)
      .map(node => generateCode(node))
      .join('');

    return [{ start: range.start, end: range.end, content, indent: true }];
  } catch (error) {
    console.error('❌ Children update error:', error);
    return null;
  }
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

// Serialize a structured value into a JSX attribute value, once, at the AST
// boundary — the single point where the declared `type` is known. Replaces
// the old first-character heuristic (`startsWith('{')` ...) that guessed
// string-vs-expression and then let `attrValue` guess again. See #238.
const buildAttributeValue = (
  value: unknown,
  type?: BindingType,
): t.JSXAttribute['value'] => {
  // Declared object/array bindings: an expression container. A string here
  // is already-serialized source text (from the built-in Items/flatten
  // editor, which re-emits the whole array/object as code) — parse it back
  // to an expression rather than quoting it as a literal.
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

  // Everything else maps one JS type to one literal kind — no guessing. A
  // string stays a string literal whatever it contains, so a genuine
  // `"{not an expression}"` no longer becomes a JSX expression container.
  if (typeof value === 'string') {
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

  // Generate the whole attribute rather than just its value, so Babel's
  // JSX-attribute printing path decides the quoting and escaping — the same
  // path that produced this text before, when the enclosing tree was
  // regenerated. Reuses the parsed name node instead of building a fresh
  // identifier so namespaced/dashed names survive untouched.
  const content = generateCode(
    t.jsxAttribute(attribute.name, buildAttributeValue(value, type)),
  );

  return [
    { start: attribute.start, end: attribute.end, content, indent: true },
  ];
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
  value: unknown,
  property?: string,
): UpdateResult => {
  try {
    const wrapped = wrap(code);
    const ast = parse(wrapped, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let changed = false;
    const edits: SourceEdit[] = [];

    // Records an editor's outcome. `null` is a failure (leave `changed`
    // alone so the caller sees success: false); anything else counts as
    // handled, even when it produces no edits.
    const collect = (result: EditResult) => {
      if (!result) {
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
            collect(editInnerText(wrapped, path.node, String(value)));
            break;
          }

          case BINDING_PROP.INNER_HTML: {
            collect(
              propertyBinding.type === 'richtext'
                ? editRichtext(path.node, String(value))
                : editInnerHTML(path.node, String(value)),
            );
            break;
          }

          case BINDING_PROP.CHILDREN: {
            collect(editChildren(path.node, value));
            break;
          }

          default: {
            collect(
              propertyBinding.type === 'jsx'
                ? editJsxAttribute(opening, propertyBinding.property, value)
                : editAttribute(
                    opening,
                    propertyBinding.property,
                    value,
                    propertyBinding.type,
                  ),
            );
            break;
          }
        }
      },
    });

    if (!changed) {
      return { code, success: false };
    }

    // Patch the original source instead of re-emitting the tree: every byte
    // outside a recorded span is copied through unchanged, so an edit to
    // one field can no longer reflow the author's formatting elsewhere in
    // the section — including the `data-binding` array itself, which is now
    // authored as a JSX expression. See #239.
    return { code: unwrap(applyEdits(wrapped, edits)), success: true };
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
    value: unknown;
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
