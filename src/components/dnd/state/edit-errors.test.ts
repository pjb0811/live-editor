// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { defaultMessages } from '../../context/messages';
import {
  blockedEditError,
  describeUpdateFailure,
  useEditErrors,
} from './edit-errors';

const m = defaultMessages;

describe('describeUpdateFailure', () => {
  it('names the cause of a failure in the description', () => {
    expect(
      describeUpdateFailure(
        { reason: 'attribute-not-found', dataId: 'x', property: 'href' },
        'Link',
        m,
      ),
    ).toEqual({
      title: m.editErrors.updateFailed('Link'),
      description: m.editErrors.attributeNotFound('href'),
    });
  });

  it('says the field cannot be edited for a reserved property', () => {
    expect(
      describeUpdateFailure(
        { reason: 'reserved-property', dataId: 'x', property: 'data-id' },
        'Id',
        m,
      ).title,
    ).toBe(m.editErrors.cannotEdit('Id'));
  });

  it('uses the error message of a parse error, or the console hint without one', () => {
    expect(
      describeUpdateFailure(
        { reason: 'parse-error', error: new Error('bad token') },
        'Title',
        m,
      ).description,
    ).toBe('bad token');
    expect(
      describeUpdateFailure(
        { reason: 'parse-error', error: 'nope' },
        'Title',
        m,
      ).description,
    ).toBe(m.editErrors.checkConsole);
  });

  it('gives only a title when there is no failure', () => {
    expect(describeUpdateFailure(undefined, 'Title', m)).toEqual({
      title: m.editErrors.updateFailed('Title'),
    });
  });
});

describe('blockedEditError', () => {
  it('describes an edit refused because the document does not parse', () => {
    const error = new Error('x');

    expect(blockedEditError(error, m)).toMatchObject({
      type: 'parse',
      target: 'document',
      reason: 'parse-error',
      error,
      title: m.editErrors.syntaxError,
    });
  });
});

describe('useEditErrors', () => {
  it('reports to the handler passed in', () => {
    const onEditError = vi.fn();
    const { result } = renderHook(() => useEditErrors(onEditError));

    result.current.reportLatest(messages => ({
      type: 'parse',
      target: 'items',
      title: messages.editErrors.itemsParseFailed,
    }));

    expect(onEditError).toHaveBeenCalledWith({
      type: 'parse',
      target: 'items',
      title: m.editErrors.itemsParseFailed,
    });
  });

  it('keeps one reportLatest, and reaches the newest handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ handler }) => useEditErrors(handler),
      { initialProps: { handler: first } },
    );
    const reportLatest = result.current.reportLatest;

    rerender({ handler: second });
    result.current.reportLatest(() => ({
      type: 'parse',
      target: 'items',
      title: 't',
    }));

    expect(result.current.reportLatest).toBe(reportLatest);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports a blocked edit only for a parse error', () => {
    const onEditError = vi.fn();
    const { result } = renderHook(() => useEditErrors(onEditError));

    result.current.onBlockedEdit({
      reason: 'container-not-found',
      containerId: 'app',
    });
    expect(onEditError).not.toHaveBeenCalled();

    result.current.onBlockedEdit({ reason: 'parse-error', error: 'x' });
    expect(onEditError).toHaveBeenCalledTimes(1);
    expect(onEditError.mock.calls[0]![0]).toMatchObject({
      target: 'document',
      reason: 'parse-error',
    });
  });
});
