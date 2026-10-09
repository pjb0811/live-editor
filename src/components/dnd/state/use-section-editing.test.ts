// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';

import { useEditErrors } from './edit-errors';
import { useSectionEditing } from './use-section-editing';

const section: Section = {
  id: 's',
  name: 'S',
  code: `<section data-id="" data-binding={[
    { label: 'Title', property: 'title' },
    { label: 'Alt', property: 'alt' },
  ]} title="Old" alt="A">hi</section>`,
};

const setup = (
  overrides: Partial<Parameters<typeof useSectionEditing>[0]> = {},
) => {
  const onChange = vi.fn();
  const onEditError = vi.fn();
  const hook = renderHook(
    (props: typeof overrides) => {
      const errors = useEditErrors(onEditError);

      return useSectionEditing({
        selectedSection: section,
        stale: false,
        problem: null,
        missingContainer: null,
        getCommittedSection: () => undefined,
        onChange,
        bindingOptions: {},
        ...errors,
        ...props,
      });
    },
    { initialProps: overrides },
  );

  return { ...hook, onChange, onEditError };
};

const bindingOf = (
  bindings: ReturnType<typeof useSectionEditing>['bindings'],
  property: string,
) => bindings.find(binding => binding.property === property)!;

describe('useSectionEditing', () => {
  it("lists the selected section's bound properties", () => {
    const { result } = setup();

    expect(
      result.current.bindings.map(({ label, property, value }) => ({
        label,
        property,
        value,
      })),
    ).toEqual([
      { label: 'Title', property: 'title', value: 'Old' },
      { label: 'Alt', property: 'alt', value: 'A' },
    ]);
  });

  it('has no bindings without a selected section', () => {
    const { result } = setup({ selectedSection: undefined });

    expect(result.current.bindings).toEqual([]);
  });

  it("writes a binding's new value into the section code", () => {
    const { result, onChange } = setup();

    act(() => bindingOf(result.current.bindings, 'title').onChange('New'));

    expect(onChange).toHaveBeenCalledTimes(1);

    const next = onChange.mock.calls[0]![0] as Section;

    expect(next.id).toBe('s');
    expect(next.code).toContain('title="New"');
    expect(next.code).toContain('alt="A"');
  });

  it('does nothing for an empty batch', () => {
    const { result, onChange, onEditError } = setup();

    act(() => result.current.commitChanges([]));

    expect(onChange).not.toHaveBeenCalled();
    expect(onEditError).not.toHaveBeenCalled();
  });

  it('applies a batch of changes in one write', () => {
    const { result, onChange } = setup();
    const { id } = bindingOf(result.current.bindings, 'title');

    act(() =>
      result.current.commitChanges([
        { id, label: 'Title', property: 'title', value: 'T' },
        { id, label: 'Alt', property: 'alt', value: 'B' },
      ]),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].code).toContain('title="T"');
    expect(onChange.mock.calls[0]![0].code).toContain('alt="B"');
  });

  it('reports a failed update with its cause and writes nothing', () => {
    const { result, onChange, onEditError } = setup();
    const { id } = bindingOf(result.current.bindings, 'title');

    act(() =>
      result.current.commitChanges([
        { id, label: 'Missing', property: 'missing', value: 'x' },
      ]),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        label: 'Missing',
        property: 'missing',
        failure: expect.objectContaining({ reason: 'binding-not-declared' }),
      }),
    );
  });

  it('refuses an edit while the source does not parse', () => {
    const { result, onChange, onEditError } = setup({
      stale: true,
      problem: { reason: 'parse-error', error: new Error('bad') },
    });

    act(() => bindingOf(result.current.bindings, 'title').onChange('New'));

    expect(onChange).not.toHaveBeenCalled();
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'document', reason: 'parse-error' }),
    );
  });

  it("builds on an earlier commit's result from the same tick", () => {
    const { result, onChange, rerender } = setup();

    act(() => bindingOf(result.current.bindings, 'title').onChange('Mid'));

    const first = onChange.mock.calls[0]![0] as Section;

    rerender({ getCommittedSection: () => first });
    act(() => bindingOf(result.current.bindings, 'alt').onChange('Z'));

    const second = onChange.mock.calls[1]![0] as Section;

    expect(second.code).toContain('title="Mid"');
    expect(second.code).toContain('alt="Z"');
  });

  it('reports a missing container once, not on every render', () => {
    const { rerender, onEditError } = setup({ missingContainer: 'app' });

    rerender({ missingContainer: 'app' });
    rerender({ missingContainer: 'app' });

    expect(onEditError).toHaveBeenCalledTimes(1);
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'container-not-found',
        containerId: 'app',
      }),
    );
  });

  it('reports a section that does not parse, and lists no bindings', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result, onEditError } = setup({
      selectedSection: { ...section, code: '<section' },
    });

    expect(result.current.bindings).toEqual([]);
    expect(onEditError).toHaveBeenCalledTimes(1);
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parse', target: 'section' }),
    );
  });
});
