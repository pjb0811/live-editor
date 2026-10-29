// @vitest-environment jsdom
import { Component, forwardRef, memo, useState } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { hookSignature, renderStableComponent } from './stable-component';

afterEach(cleanup);

describe('hookSignature', () => {
  it('lists hook calls in source order, member calls and use() included', () => {
    expect(
      hookSignature(
        'const [a] = useState(0); React.useMemo (() => a, [a]); use(p); user(x); reuse(y);',
      ),
    ).toBe('useState,useMemo,use');
  });

  it('is the same when only values change', () => {
    expect(hookSignature('useState(0); <h1>Hello</h1>')).toBe(
      hookSignature('useState(5); <h1>World</h1>'),
    );
  });
});

describe('renderStableComponent', () => {
  // Two compiles of the same code: different functions, same hooks.
  const compileCounter = (label: string) =>
    function Counter() {
      const [count, setCount] = useState(0);

      return (
        <button type="button" onClick={() => setCount(count + 1)}>
          {label} {count}
        </button>
      );
    };

  it('keeps state across a new function with the same hook calls', () => {
    const code = 'useState(0)';
    const { rerender } = render(
      renderStableComponent(compileCounter('a'), code, {}),
    );

    fireEvent.click(screen.getByRole('button'));
    rerender(renderStableComponent(compileCounter('b'), code, {}));

    expect(screen.getByRole('button').textContent).toBe('b 1');
  });

  it('remounts when the hook calls change', () => {
    const { rerender } = render(
      renderStableComponent(compileCounter('a'), 'useState(0)', {}),
    );

    fireEvent.click(screen.getByRole('button'));
    rerender(
      renderStableComponent(compileCounter('b'), 'useState(0); useMemo()', {}),
    );

    expect(screen.getByRole('button').textContent).toBe('b 0');
  });

  it.each([
    [
      'a class component',
      class Title extends Component<{ text?: string }> {
        render() {
          return <h1>{this.props.text}</h1>;
        }
      },
    ],
    [
      'a memo component',
      memo(({ text }: { text?: string }) => <h1>{text}</h1>),
    ],
    [
      'a forwardRef component',
      forwardRef<HTMLHeadingElement, { text?: string }>(({ text }, ref) => (
        <h1 ref={ref}>{text}</h1>
      )),
    ],
  ])('renders %s as itself', (_case, Title) => {
    render(
      renderStableComponent(
        Title as unknown as React.ComponentType<Record<string, unknown>>,
        '',
        { text: 'Hi' },
      ),
    );

    expect(screen.getByRole('heading').textContent).toBe('Hi');
  });
});
