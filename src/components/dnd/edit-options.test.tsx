// @vitest-environment jsdom
import { Toast } from '@jbpark/ui-kit';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE } from '~/constants';

import { PreviewContext } from '../context/states';
import Dnd, { type DndPanel, type PanelBinding } from './dnd';
import {
  type DndEditError,
  DndEditOptionsContext,
  type DndRenderField,
} from './edit-options';
import { Canvas } from './layout';
import { useDndPanel } from './layout-context';
import Field from './panel/field';
import Items from './panel/items';
import { useItemsEditor } from './panel/use-items-editor';

vi.mock('./renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const section = `
  <section data-id="s1" data-name="First">
    <div
      data-id="box"
      data-binding={[
        { label: 'Title', property: 'innerText' },
        { label: 'Size', property: 'size', type: 'number', widget: 'slider' },
        {
          label: 'Style',
          property: 'style',
          type: 'object',
          render: { color: { type: 'color', widget: 'swatch' } },
        },
        { label: 'Missing', property: 'missing' },
      ]}
      size={16}
      style={{ color: '#000000' }}
    >
      Hello
    </div>
  </section>`;

const documentCode = DEFAULT_TEMPLATE.replace(
  '<main id="app-container"></main>',
  `<main id="app-container">${section}</main>`,
);

// A custom panel that renders every binding through `Live.Dnd.Field`, the
// way a consumer mixing their own layout with the built-in controls would.
const renderDnd = (props: {
  renderField?: DndRenderField;
  onEditError?: (error: DndEditError) => void;
}) => {
  let data: DndPanel | undefined;

  const Panel = () => {
    data = useDndPanel();

    return (
      <div>
        {data.bindings.map(binding => (
          <div key={binding.label} data-testid={`field-${binding.label}`}>
            <Field binding={binding} onNodeChange={data!.onNodeChange} />
          </div>
        ))}
      </div>
    );
  };

  const { container } = render(
    <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
      <Dnd value={documentCode} onChange={vi.fn()} {...props}>
        <Canvas />
        <Panel />
      </Dnd>
    </PreviewContext.Provider>,
  );

  act(() =>
    container
      .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
      .click(),
  );

  return { getData: () => data! };
};

const field = (label: string) => screen.getByTestId(`field-${label}`);

describe('renderField', () => {
  const byWidget: DndRenderField = ({ binding }) => {
    if (binding.widget?.type === 'slider') {
      return <input data-testid="slider" type="range" />;
    }

    if (binding.widget?.type === 'swatch') {
      return <span data-testid="swatch" />;
    }

    return undefined;
  };

  it('replaces the control a renderer returns, keyed on widget.type', () => {
    renderDnd({ renderField: byWidget });

    expect(
      field('Size').querySelector('[data-testid="slider"]'),
    ).not.toBeNull();
    expect(field('Size').querySelector('input[type="number"]')).toBeNull();
  });

  it('keeps the built-in control when the renderer returns undefined', () => {
    renderDnd({ renderField: byWidget });

    expect(field('Title').querySelector('textarea')).not.toBeNull();
  });

  // Nested keys render `Field` themselves, so the override reaches them with
  // no per-editor wiring.
  it('reaches the keys inside an object value', () => {
    renderDnd({ renderField: byWidget });

    expect(
      field('Style').querySelector('[data-testid="swatch"]'),
    ).not.toBeNull();
  });

  it('can switch on the data type instead of the widget', () => {
    renderDnd({
      renderField: ({ binding }) =>
        binding.type === 'number' ? <output data-testid="number" /> : undefined,
    });

    expect(
      field('Size').querySelector('[data-testid="number"]'),
    ).not.toBeNull();
  });

  it('can wrap the built-in control it is handed', () => {
    renderDnd({
      renderField: ({ binding }, builtin) =>
        binding.label === 'Title' ? (
          <div data-testid="wrapped">{builtin}</div>
        ) : undefined,
    });

    const wrapped = field('Title').querySelector('[data-testid="wrapped"]');

    expect(wrapped).not.toBeNull();
    expect(wrapped!.querySelector('textarea')).not.toBeNull();
  });

  it('renders nothing for a field the renderer returns null for', () => {
    renderDnd({
      renderField: ({ binding }) =>
        binding.label === 'Title' ? null : undefined,
    });

    expect(field('Title').childElementCount).toBe(0);
  });

  it('reaches array item properties', () => {
    const renderField: DndRenderField = ({ binding }) =>
      binding.widget?.type === 'slider' ? (
        <input data-testid={`slider-${binding.property}`} type="range" />
      ) : undefined;

    render(
      <DndEditOptionsContext.Provider
        value={{ renderField, reportError: vi.fn() }}
      >
        <Items
          value="[{ size: 12, title: 'A' }]"
          render={{ size: { type: 'number', widget: { type: 'slider' } } }}
        />
      </DndEditOptionsContext.Provider>,
    );

    expect(screen.getByTestId('slider-size')).not.toBeNull();
    expect(screen.queryByTestId('slider-title')).toBeNull();
  });
});

describe('onEditError', () => {
  it('receives a rejected field update instead of the toast', () => {
    const toast = vi.spyOn(Toast, 'error');
    const onEditError = vi.fn();
    const { getData } = renderDnd({ onEditError });
    const missing = getData().bindings.find(
      binding => binding.label === 'Missing',
    )!;

    act(() => missing.onChange('value'));

    expect(onEditError).toHaveBeenCalledTimes(1);
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        id: 'box',
        label: 'Missing',
        property: 'missing',
        failure: expect.objectContaining({ reason: 'attribute-not-found' }),
        title: 'Failed to update "Missing"',
        description: expect.stringContaining('"missing" attribute'),
      }),
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps the toast when no handler is given', () => {
    const toast = vi.spyOn(Toast, 'error').mockImplementation(() => 'test');
    const { getData } = renderDnd({});
    const missing = getData().bindings.find(
      binding => binding.label === 'Missing',
    )!;

    act(() => missing.onChange('value'));

    expect(toast).toHaveBeenCalledWith(
      'Failed to update "Missing"',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  const itemsBinding = (rawValue: string): PanelBinding => ({
    id: 'list',
    label: 'Items',
    property: 'items',
    type: 'array',
    value: [],
    rawValue,
    onChange: vi.fn(),
  });

  it('reports an items value that fails to parse once, not on every render', () => {
    const toast = vi.spyOn(Toast, 'error');
    const first = vi.fn();
    const second = vi.fn();
    const tree = (reportError: (error: DndEditError) => void) => (
      <DndEditOptionsContext.Provider value={{ reportError }}>
        <Field binding={itemsBinding('not an array')} />
      </DndEditOptionsContext.Provider>
    );
    const { rerender } = render(tree(first));

    // A fresh inline handler on the next render must not re-fire it.
    rerender(tree(second));

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parse', target: 'items' }),
    );
    expect(second).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('reports an array edit that could not be applied', () => {
    const toast = vi.spyOn(Toast, 'error');
    const reportError = vi.fn();
    const onChange = vi.fn();
    const { result } = renderHook(
      () => useItemsEditor("[, { label: 'A' }, { label: 'B' }]", { onChange }),
      {
        wrapper: ({ children }) => (
          <DndEditOptionsContext.Provider value={{ reportError }}>
            {children}
          </DndEditOptionsContext.Provider>
        ),
      },
    );

    // A sparse array refuses structural edits rather than dropping the hole.
    act(() => result.current.actions.remove(1));

    expect(onChange).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'items',
        title: 'Failed to update this item',
      }),
    );
    expect(toast).not.toHaveBeenCalled();
  });
});
