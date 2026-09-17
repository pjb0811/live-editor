// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Context from '../context';
import Editor from './editor';

afterEach(cleanup);

const renderValue = (props: React.ComponentProps<typeof Editor>) =>
  render(
    <Context>
      <Editor
        {...props}
        renderEditor={({ value }) => (
          <output data-testid="value">{value}</output>
        )}
      />
    </Context>,
  );

describe('Editor code fallback', () => {
  it('preserves an explicitly empty value', () => {
    renderValue({ value: '', defaultValue: 'const App = () => null;' });

    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('uses defaultValue only when value is omitted', () => {
    renderValue({ defaultValue: 'const App = () => null;' });

    expect(screen.getByTestId('value').textContent).toBe(
      'const App = () => null;',
    );
  });

  it('preserves an explicitly empty defaultValue', () => {
    renderValue({ defaultValue: '' });

    expect(screen.getByTestId('value').textContent).toBe('');
  });
});
