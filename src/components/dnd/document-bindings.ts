import { getKeyBindings } from '~/utils/ast/binding';
import {
  type DocumentValueFailure,
  readDocumentObject,
} from '~/utils/ast/document-value';
import { isFunctionBindingSource } from '~/utils/ast/function-source';
import type { BindingKeyMap } from '~/utils/ast/types';

import type { LiveMessages } from '../context/messages';
import { type PanelBindingData, toBindingFields } from './panel-binding';

// The fields `Live.Dnd`'s `documentBindings` declares for the document's
// settings objects (#770). Each name is a top-level `const` holding an
// object literal; each binding's `property` is one of its keys. A binding's
// `id` is that name, which no element's `data-id` is read as.
export const resolveDocumentBindings = (
  document: string,
  documentBindings: BindingKeyMap | undefined,
): PanelBindingData[] => {
  if (!documentBindings) {
    return [];
  }

  return Object.keys(documentBindings).flatMap(name => {
    const entries = readDocumentObject(document, name);

    if (!entries) {
      return [];
    }

    return (getKeyBindings(documentBindings, name) ?? []).map(binding => {
      const entry = entries.find(item => item.key === binding.property);
      const isFunction =
        entry !== undefined &&
        isFunctionBindingSource(binding.type, entry.source);
      const value =
        isFunction || !entry?.isLiteral ? entry?.source : entry.value;

      return {
        ...toBindingFields(binding),
        ...(isFunction && { type: 'function' as const }),
        id: name,
        value: value ?? '',
        rawValue:
          entry === undefined
            ? ''
            : entry.isLiteral &&
                !isFunction &&
                (typeof entry.value !== 'object' || entry.value === null)
              ? String(entry.value)
              : entry.source,
        // A key that isn't there, or holds an expression other than a
        // function, is shown but can't be edited from the panel.
        ...(!(entry && (entry.isLiteral || isFunction)) && {
          canEditValue: false,
        }),
        ...(entry === undefined && { present: false }),
      };
    });
  });
};

// The toast's text for a refused document setting edit.
export const describeDocumentFailure = (
  failure: DocumentValueFailure,
  label: string,
  messages: LiveMessages['editErrors'],
): { title: string; description?: string } => {
  const title = messages.cannotEdit(label);

  switch (failure.reason) {
    case 'not-found':
      return { title, description: messages.documentNotFound(failure.name) };
    case 'not-object':
      return { title, description: messages.documentNotObject(failure.name) };
    case 'missing-property':
      return {
        title,
        description: messages.documentMissingKey(
          failure.name,
          failure.property,
        ),
      };
    case 'unsupported-syntax':
      return {
        title,
        description: messages.unsupportedSyntax(failure.property),
      };
    case 'invalid-function':
      return { title, description: messages.invalidFunction(failure.property) };
    case 'parse-error':
      return {
        title: messages.syntaxError,
        description: messages.syntaxErrorDetail,
      };
  }
};
