import { parse } from '@babel/parser';
import * as t from '@babel/types';

import {
  BINDING_PROP,
  DATA_ATTR,
  RESERVED_BINDING_PROPERTIES,
} from '../../constants';
import { parseBinding, resolveBindings } from './binding';
import { editChildrenSource } from './children';
import { traverse } from './document';
import {
  type EditResult,
  addAttribute,
  canEditAttributeValue,
  childrenRange,
  editAttribute,
  editInnerHTML,
  editInnerText,
  editJsxAttribute,
  editRichtext,
  findAttribute,
  removeAttribute,
} from './edit-source';
import { generateCode, unwrap, wrap } from './helpers';
import { getJSXTagName } from './jsx-name';
import { type SourceEdit, applyEdits } from './patch';
import type { BindingItem, BindingOptions } from './types';

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
  // `innerText` or `innerHTML` written to a self-closing element, which has
  // nowhere between its tags to put them (#552).
  | { reason: 'self-closing'; dataId: string; property: string }
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

// What one `update` call asks for.
interface UpdateRequest {
  dataId: string;
  label: string;
  value: unknown;
  property?: string;
  options: BindingOptions;
}

// One element's outcome: the spans to write (possibly none, which still
// counts as handled), or why it was refused.
type ElementEdit = { edits: SourceEdit[] } | { failure: UpdateFailure };

const hasDataId = (opening: t.JSXOpeningElement, dataId: string) =>
  opening.attributes.some(
    attr =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === DATA_ATTR.ID &&
      attr.value &&
      t.isStringLiteral(attr.value) &&
      attr.value.value === dataId,
  );

const findJSXAttribute = (opening: t.JSXOpeningElement, name: string) =>
  opening.attributes.find(
    (attr): attr is t.JSXAttribute =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === name,
  );

// Step 1: the element's binding for the request, from the same sources
// `extract` reads (#509, #513). Found by `property` when given, otherwise by
// `label`. More than one match is an authoring mistake, reported rather than
// resolved by picking one (#240).
const findBinding = (
  opening: t.JSXOpeningElement,
  { dataId, label, property, options }: UpdateRequest,
): { binding: BindingItem } | { failure: UpdateFailure } => {
  const bindingAttr = findJSXAttribute(opening, DATA_ATTR.BINDING);

  // An attribute with no value declares nothing to check against.
  if (bindingAttr && !bindingAttr.value) {
    return { failure: { reason: 'no-binding', dataId } };
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
        return { failure: { reason: 'parse-error', error } };
      }
    }

    own = parseBinding(bindingValue);
  }

  const keyAttr = findJSXAttribute(opening, DATA_ATTR.BINDING_KEY);
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
    return { failure: { reason: 'no-binding', dataId } };
  }

  const matches = bindings.filter(binding =>
    property !== undefined
      ? binding.property === property
      : binding.label === label,
  );

  if (matches.length === 0) {
    return {
      failure: { reason: 'binding-not-declared', dataId, label, property },
    };
  }

  if (matches.length > 1) {
    return {
      failure: {
        reason: 'duplicate-binding',
        dataId,
        label,
        property,
        count: matches.length,
      },
    };
  }

  return { binding: matches[0]! };
};

// Step 2: what no edit may do, whatever the property: rewrite an attribute
// the editor owns, or remove a `required` one (#426).
const checkEdit = (
  binding: BindingItem,
  { dataId, value }: UpdateRequest,
): UpdateFailure | undefined => {
  const property = binding.property;

  if (RESERVED_BINDING_PROPERTIES.includes(property)) {
    return { reason: 'reserved-property', dataId, property };
  }

  if (value === undefined && binding.required) {
    return { reason: 'required-property', dataId, property };
  }

  return undefined;
};

// An editor's result as an `ElementEdit`: `null` becomes `onNull`'s failure.
const toElementEdit = (
  result: EditResult,
  onNull: () => UpdateFailure,
): ElementEdit => (result ? { edits: result } : { failure: onNull() });

// Step 3: the spans that set `binding`'s property on `element`. `undefined`
// asks for the property to go: an attribute is removed, content is emptied.
const editProperty = (
  source: string,
  element: t.JSXElement,
  binding: BindingItem,
  { dataId, value, options }: UpdateRequest,
): ElementEdit => {
  const opening = element.openingElement;
  const prop = binding.property;
  const unset = value === undefined;
  const couldNotUpdate = (): UpdateFailure => ({
    reason: 'parse-error',
    error: new Error(`could not update "${prop}"`),
  });

  // Text and HTML go between the tags, so a self-closing element can't take
  // them. Clearing them is fine: there's nothing to clear (#552).
  const contentWithoutSlot =
    !unset && String(value) !== '' && !childrenRange(element);

  switch (prop) {
    case BINDING_PROP.INNER_TEXT: {
      if (contentWithoutSlot) {
        return { failure: { reason: 'self-closing', dataId, property: prop } };
      }

      return toElementEdit(
        editInnerText(source, element, unset ? '' : String(value)),
        couldNotUpdate,
      );
    }

    case BINDING_PROP.INNER_HTML: {
      // `richtext` is written to an attribute, so it doesn't need one.
      if (contentWithoutSlot && binding.type !== 'richtext') {
        return { failure: { reason: 'self-closing', dataId, property: prop } };
      }

      return toElementEdit(
        binding.type === 'richtext'
          ? editRichtext(element, unset ? '' : String(value))
          : editInnerHTML(element, unset ? '' : String(value)),
        couldNotUpdate,
      );
    }

    case BINDING_PROP.CHILDREN: {
      // Children are edited one at a time (move, add, remove), so they can't
      // be removed as a whole.
      if (unset) {
        return {
          failure: { reason: 'unsupported-syntax', dataId, property: prop },
        };
      }

      return toElementEdit(
        editChildrenSource(source, element, value, options),
        () => ({
          reason: 'parse-error',
          error: new Error(
            'Unsupported or stale children edit; source was preserved',
          ),
        }),
      );
    }

    default: {
      const attribute = findAttribute(opening, prop);

      if (unset) {
        // Already absent: nothing to remove, and nothing went wrong.
        return toElementEdit(
          attribute ? removeAttribute(source, attribute) : [],
          () => ({
            reason: 'parse-error',
            error: new Error(`could not remove "${prop}"`),
          }),
        );
      }

      // A declared property the element doesn't have yet is added when it's
      // given a real value, so a field that was switched off can be switched
      // on again. An empty string leaves it absent (#426).
      if (!attribute) {
        return toElementEdit(
          value === ''
            ? []
            : addAttribute(source, opening, prop, value, binding.type),
          () => ({ reason: 'attribute-not-found', dataId, property: prop }),
        );
      }

      if (
        binding.type !== 'jsx' &&
        !canEditAttributeValue(attribute, value, binding.type)
      ) {
        return {
          failure: { reason: 'unsupported-syntax', dataId, property: prop },
        };
      }

      return toElementEdit(
        binding.type === 'jsx'
          ? editJsxAttribute(opening, prop, value)
          : editAttribute(opening, prop, value, binding.type),
        () => ({ reason: 'attribute-not-found', dataId, property: prop }),
      );
    }
  }
};

// The three steps for one element.
const editElement = (
  source: string,
  element: t.JSXElement,
  request: UpdateRequest,
): ElementEdit => {
  const found = findBinding(element.openingElement, request);

  if ('failure' in found) {
    return found;
  }

  const refused = checkEdit(found.binding, request);

  if (refused) {
    return { failure: refused };
  }

  return editProperty(source, element, found.binding, request);
};

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
  const request: UpdateRequest = { dataId, label, value, property, options };

  try {
    const wrapped = wrap(code);
    const ast = parse(wrapped, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let changed = false;
    let failure: UpdateFailure | undefined;
    const edits: SourceEdit[] = [];

    // Every element carrying `dataId` is edited, so a duplicated id edits
    // each copy; the last refusal is the one reported.
    traverse(ast, {
      JSXElement(path) {
        if (!hasDataId(path.node.openingElement, dataId)) {
          return;
        }

        const result = editElement(wrapped, path.node, request);

        if ('failure' in result) {
          failure = result.failure;

          return;
        }

        edits.push(...result.edits);
        changed = true;
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
