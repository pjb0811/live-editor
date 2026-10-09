import { useCallback, useEffect, useRef } from 'react';

import type { DocumentProblem } from '~/utils/ast/document';
import type { UpdateFailure } from '~/utils/ast/update';

import { type LiveMessages, useLiveMessages } from '../../context/messages';
import { type DndEditError, toastEditError } from '../edit-options';

// Turns an `update` failure into the edit error's title and description.
// The description names the cause, which is usually in the element's
// `data-binding` rather than in the value just typed (#270).
export const describeUpdateFailure = (
  failure: UpdateFailure | undefined,
  label: string,
  { editErrors: m }: LiveMessages,
): { title: string; description?: string } => {
  switch (failure?.reason) {
    case 'attribute-not-found':
      return {
        title: m.updateFailed(label),
        description: m.attributeNotFound(failure.property),
      };
    case 'binding-not-declared':
      return {
        title: m.updateFailed(label),
        description: m.bindingNotDeclared({
          label,
          property: failure.property,
        }),
      };
    case 'duplicate-binding':
      return {
        title: m.updateFailed(label),
        description: m.duplicateBinding({
          count: failure.count,
          label,
          property: failure.property,
        }),
      };
    case 'reserved-property':
      return {
        title: m.cannotEdit(label),
        description: m.reservedProperty(failure.property),
      };
    case 'required-property':
      return {
        title: m.cannotRemove(label),
        description: m.requiredProperty(failure.property),
      };
    case 'no-binding':
      return { title: m.updateFailed(label), description: m.noBinding };
    case 'element-not-found':
      return { title: m.updateFailed(label), description: m.elementNotFound };
    case 'self-closing':
      return {
        title: m.cannotEdit(label),
        description: m.selfClosing(failure.property),
      };
    case 'unsupported-syntax':
      return {
        title: m.cannotEdit(label),
        description: m.unsupportedSyntax(failure.property),
      };
    case 'parse-error':
      return {
        title: m.updateFailed(label),
        description:
          failure.error instanceof Error
            ? failure.error.message
            : m.checkConsole,
      };
    default:
      return { title: m.updateFailed(label) };
  }
};

// An edit refused because the document doesn't parse (#433).
export const blockedEditError = (
  error: unknown,
  { editErrors: m }: LiveMessages,
): DndEditError => ({
  type: 'parse',
  target: 'document',
  reason: 'parse-error',
  error,
  title: m.syntaxError,
  description: m.syntaxErrorDetail,
});

// Builds the error from the messages current at the time it is reported.
export type ReportLatest = (
  build: (messages: LiveMessages) => DndEditError,
) => void;

// The edit-error plumbing of `Live.Dnd`: where an error goes (the host's
// `onEditError`, else a toast) and the messages it is written in.
// `reportLatest` keeps one identity for the life of the component and reads
// the latest handler and messages when it runs, so an effect that reports a
// failure fires once per failure, even when the host passes a new
// `onEditError` or new messages every render.
export const useEditErrors = (onEditError?: (error: DndEditError) => void) => {
  const messages = useLiveMessages();
  const reportError = onEditError ?? toastEditError;

  const reportErrorRef = useRef(reportError);
  const messagesRef = useRef(messages);

  useEffect(() => {
    reportErrorRef.current = reportError;
    messagesRef.current = messages;
  });

  const reportLatest = useCallback<ReportLatest>(
    build => reportErrorRef.current(build(messagesRef.current)),
    [],
  );

  // Reports an edit refused because the source doesn't parse. A source that
  // stops parsing isn't reported by itself: that happens on most keystrokes,
  // and the canvas already says so (#433).
  const onBlockedEdit = useCallback(
    (problem: DocumentProblem) => {
      if (problem.reason === 'parse-error') {
        reportLatest(m => blockedEditError(problem.error, m));
      }
    },
    [reportLatest],
  );

  return { reportError, messages, reportLatest, onBlockedEdit };
};
