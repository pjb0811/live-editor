import { parse, parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import {
  isEditablePrimitive,
  objectEntrySources,
  setEditableExpression,
  setEditableSource,
  setEditableValue,
} from './editable-value';
import { isFunctionBindingSource, isFunctionSource } from './function-source';
import type { BindingItem } from './types';
import {
  canLosslesslyEvaluateSource,
  evaluateLiteral,
  unwrapExpression,
} from './value';

// A document's settings: a top-level `const` holding an object literal, such
// as `const settings = { theme: 'dark' }`, read and edited key by key for
// `Live.Dnd`'s `documentBindings` (#770). Each key keeps the rest of the
// source as written.

export type DocumentValueFailure =
  | { reason: 'parse-error'; error: unknown }
  // No top-level `const` with that name: missing, inside a function, or a
  // `let` or `var`, which the document could reassign.
  | { reason: 'not-found'; name: string }
  // The `const` doesn't hold an object literal, or one whose keys can't be
  // addressed one by one (a spread, a computed key, a method).
  | { reason: 'not-object'; name: string }
  // The object has no such key. The panel edits keys, it doesn't add them.
  | { reason: 'missing-property'; name: string; property: string }
  // The key holds an expression the panel can't rewrite, such as a call.
  | { reason: 'unsupported-syntax'; name: string; property: string }
  // A function key got a value that isn't a function or a reference.
  | { reason: 'invalid-function'; name: string; property: string };

type DocumentValueResult =
  | { success: true; code: string }
  | { success: false; failure: DocumentValueFailure };

interface DocumentObject {
  start: number;
  end: number;
  source: string;
}

const findDocumentObject = (
  code: string,
  name: string,
): DocumentObject | DocumentValueFailure => {
  let program: t.Program;

  try {
    program = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    }).program;
  } catch (error) {
    return { reason: 'parse-error', error };
  }

  for (const statement of program.body) {
    const declaration = t.isExportNamedDeclaration(statement)
      ? statement.declaration
      : statement;

    if (!t.isVariableDeclaration(declaration) || declaration.kind !== 'const') {
      continue;
    }

    const declarator = declaration.declarations.find(
      item => t.isIdentifier(item.id) && item.id.name === name,
    );

    if (!declarator) {
      continue;
    }

    const init = declarator.init && unwrapExpression(declarator.init);

    if (!init || !t.isObjectExpression(init)) {
      return { reason: 'not-object', name };
    }

    const source = code.slice(init.start!, init.end!);

    if (objectEntrySources(source) === null) {
      return { reason: 'not-object', name };
    }

    return { start: init.start!, end: init.end!, source };
  }

  return { reason: 'not-found', name };
};

const isFailure = (
  found: DocumentObject | DocumentValueFailure,
): found is DocumentValueFailure => 'reason' in found;

interface DocumentEntry {
  key: string;
  // The value's source as written.
  source: string;
  // The value as JS, for a literal; `undefined` for any other expression.
  value: unknown;
  // Whether the value is a literal the panel can rewrite.
  isLiteral: boolean;
}

// The keys of the document's `const name = { ... }`, each with its source
// and, for a literal, its value. `null` when there's no such object.
export const readDocumentObject = (
  code: string,
  name: string,
): DocumentEntry[] | null => {
  const found = findDocumentObject(code, name);

  if (isFailure(found)) {
    return null;
  }

  return (objectEntrySources(found.source) ?? []).map(({ key, source }) => {
    const isLiteral = canLosslesslyEvaluateSource(source);

    return {
      key,
      source,
      value: isLiteral
        ? evaluateLiteral(
            parseExpression(source, { plugins: ['jsx', 'typescript'] }),
          )
        : undefined,
      isLiteral,
    };
  });
};

// Writes `value` to `binding.property` of the document's `const name`
// object, keeping the rest of the document as written.
export const updateDocumentValue = (
  code: string,
  name: string,
  binding: Pick<BindingItem, 'property' | 'type'>,
  value: unknown,
): DocumentValueResult => {
  const found = findDocumentObject(code, name);

  if (isFailure(found)) {
    return { success: false, failure: found };
  }

  const { property } = binding;
  const entry = objectEntrySources(found.source)?.find(
    item => item.key === property,
  );

  if (!entry) {
    return {
      success: false,
      failure: { reason: 'missing-property', name, property },
    };
  }

  let next: string | null;

  if (isFunctionBindingSource(binding.type, entry.source)) {
    const text = typeof value === 'string' ? value.trim() : '';

    if (!isFunctionSource(text)) {
      return {
        success: false,
        failure: { reason: 'invalid-function', name, property },
      };
    }

    next = setEditableExpression(found.source, [property], text);
  } else if (isEditablePrimitive(value)) {
    next = setEditableValue(found.source, [property], value);

    // Unchanged source means the key's value isn't a literal it can
    // rewrite, unless it already held this value.
    if (next === found.source) {
      const current = readDocumentObject(code, name)?.find(
        item => item.key === property,
      );

      next = current && Object.is(current.value, value) ? next : null;
    }
  } else if (typeof value === 'string') {
    next = setEditableSource(found.source, [property], value);
  } else {
    next = null;
  }

  if (next === null) {
    return {
      success: false,
      failure: { reason: 'unsupported-syntax', name, property },
    };
  }

  return {
    success: true,
    code: `${code.slice(0, found.start)}${next}${code.slice(found.end)}`,
  };
};
