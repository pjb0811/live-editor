// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Dnd from '~/components/dnd';
import { useDndPanel } from '~/components/dnd/layout-context';
import LiveError from '~/components/error';
import { createDocument, replaceSections } from '~/utils/sections';

import ContextProvider from './context';
import {
  type LiveMessagesInput,
  defaultMessages,
  mergeMessages,
} from './messages';

// The canvas only needs to know a section is there, not to compile it.
vi.mock('~/components/dnd/renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const ko = {
  section: { delete: '섹션 삭제' },
  canvas: { empty: '섹션이 없습니다' },
  panel: { selectSection: '섹션을 선택하세요.' },
  errors: { tryAgain: '다시 시도' },
  editErrors: { updateFailed: (label: string) => `"${label}" 수정 실패` },
  validation: { max: (max: number) => `최댓값은 ${max}입니다.` },
} satisfies LiveMessagesInput;

describe('mergeMessages', () => {
  it('keeps every default without input', () => {
    expect(mergeMessages()).toBe(defaultMessages);
  });

  it('replaces the given keys and keeps the rest of each group', () => {
    const merged = mergeMessages(ko);

    expect(merged.section.delete).toBe('섹션 삭제');
    expect(merged.section.moveUp).toBe(defaultMessages.section.moveUp);
    expect(merged.canvas.palette).toBe(defaultMessages.canvas.palette);
    expect(merged.announcements).toBe(defaultMessages.announcements);
  });
});

describe('Live messages', () => {
  const SECTION =
    '<section data-id="s1" data-name="Hero"><h2 data-id="t" data-binding={[{ label: "Size", property: "data-size", type: "number", max: 40 }]} data-size={10}>Hi</h2></section>';

  it('shows the provider messages on the canvas and in the panel', () => {
    render(
      <ContextProvider messages={ko}>
        <Dnd value={createDocument()} />
      </ContextProvider>,
    );

    expect(screen.getAllByText('섹션이 없습니다').length).toBeGreaterThan(0);
  });

  it('labels the section toolbar and validates fields with them', () => {
    render(
      <ContextProvider messages={ko}>
        <Dnd value={replaceSections(createDocument(), [SECTION])}>
          <Dnd.Canvas />
          <Dnd.Panel />
        </Dnd>
      </ContextProvider>,
    );

    expect(screen.getByText('섹션을 선택하세요.')).toBeTruthy();

    fireEvent.click(screen.getByTestId('renderer'));

    expect(screen.getAllByLabelText('섹션 삭제').length).toBeGreaterThan(0);

    const input = screen.getByDisplayValue('10');

    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(screen.getByText('최댓값은 40입니다.')).toBeTruthy();
  });

  it('passes translated text to onEditError', () => {
    const onEditError = vi.fn();
    // Commits to a property the element declares no binding for.
    const BadEdit = () => {
      const { onNodeChange } = useDndPanel();

      return (
        <button
          type="button"
          onClick={() =>
            onNodeChange({ id: 't', label: 'Nope', property: 'nope', value: 1 })
          }
        >
          edit
        </button>
      );
    };

    render(
      <ContextProvider messages={ko}>
        <Dnd
          value={replaceSections(createDocument(), [SECTION])}
          onEditError={onEditError}
        >
          <Dnd.Canvas />
          <BadEdit />
        </Dnd>
      </ContextProvider>,
    );

    fireEvent.click(screen.getByTestId('renderer'));
    fireEvent.click(screen.getByText('edit'));

    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update', title: '"Nope" 수정 실패' }),
    );
  });

  it('translates the error box outside the editor too', () => {
    render(
      <ContextProvider messages={ko}>
        <LiveError message="boom" onReset={() => {}} />
      </ContextProvider>,
    );

    expect(screen.getByText('다시 시도')).toBeTruthy();
    expect(screen.getByText(defaultMessages.errors.default)).toBeTruthy();
  });

  it('inherits an enclosing provider, with its own messages on top', () => {
    render(
      <ContextProvider messages={ko}>
        <ContextProvider messages={{ errors: { tryAgain: 'Retry' } }}>
          <LiveError message="boom" onReset={() => {}} />
        </ContextProvider>
        <ContextProvider>
          <LiveError message="inner" onReset={() => {}} />
        </ContextProvider>
      </ContextProvider>,
    );

    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByText('다시 시도')).toBeTruthy();
  });
});
