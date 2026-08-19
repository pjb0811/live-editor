import { describe, expect, it, vi } from 'vitest';

// utils/index.ts imports @jbpark/ui-kit for baseModules, which pulls in its
// CSS — stub both out since detectTypeScript doesn't touch either.
vi.mock('@jbpark/ui-kit', () => ({}));
vi.mock('@jbpark/ui-kit/utils', () => ({}));

const { compile, detectTypeScript } = await import('./index');

describe('detectTypeScript', () => {
  it('does not flag the default template as TypeScript', () => {
    const code = `
import * as ui from 'ui-kit';
import { cn } from 'ui-kit/utils';

const App = () => {
  return (
    <main id="app-container"></main>
  )
}

export default App;
`;
    expect(detectTypeScript(code)).toBe(false);
  });

  it('does not flag a named import alias as TypeScript', () => {
    const code = `
import { Foo as Bar } from 'ui-kit';
const App = () => <Bar />;
export default App;
`;
    expect(detectTypeScript(code)).toBe(false);
  });

  it('does not flag an `export * as` re-export as TypeScript', () => {
    const code = `
export * as ns from 'ui-kit';
const App = () => <div />;
export default App;
`;
    expect(detectTypeScript(code)).toBe(false);
  });

  it('flags a real `interface` declaration as TypeScript', () => {
    const code = `
interface Props { name: string }
const App = (props: Props) => <div>{props.name}</div>;
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });

  it('flags a real `type` alias as TypeScript', () => {
    const code = `
type Foo = { name: string };
const App = () => <div>hi</div>;
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });

  it('flags a real `as` type assertion as TypeScript', () => {
    const code = `
const App = () => {
  const x = (window as any).foo;
  return <div>{x}</div>;
};
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });

  it('flags a real `enum` declaration as TypeScript', () => {
    const code = `
enum Color { Red, Blue }
const App = () => <div>{Color.Red}</div>;
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });

  it('flags an optional parameter as TypeScript', () => {
    const code = `
const App = (props?: { name: string }) => <div>{props?.name}</div>;
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });

  it('still detects a real `as` assertion on an exported line', () => {
    const code = `
import * as ui from 'ui-kit';
export const x = (5 as unknown) as string;
const App = () => <div>{x}</div>;
export default App;
`;
    expect(detectTypeScript(code)).toBe(true);
  });
});

// #192: TypeScript source used to go through ts.transpileModule and then
// Babel — a double transpile via a peer dependency. It's now a single Babel
// pass with the `typescript` preset. These assert that path actually
// produces a working module, not just that it doesn't throw.
describe('compile (TypeScript source, #192)', () => {
  it('compiles an interface + typed props into a working default export', () => {
    const code = `
interface Props { name: string }
const App = (props: Props) => props.name;
export default App;
`;
    const module = compile(code, {});

    expect(module.error).toBeUndefined();
    expect(module.exports.default).toBeTypeOf('function');
    const App = module.exports.default as unknown as (p: {
      name: string;
    }) => string;
    expect(App({ name: 'hi' })).toBe('hi');
  });

  it('compiles an enum into a working default export', () => {
    const code = `
enum Color { Red, Blue }
const App = () => Color.Blue;
export default App;
`;
    const module = compile(code, {});

    expect(module.error).toBeUndefined();
    expect(module.exports.default).toBeTypeOf('function');
    expect((module.exports.default as unknown as () => number)()).toBe(1);
  });

  it('compiles a generic arrow function and type assertion', () => {
    const code = `
const identity = <T,>(x: T): T => x;
const App = () => identity(5) as number;
export default App;
`;
    const module = compile(code, {});

    expect(module.error).toBeUndefined();
    expect(module.exports.default).toBeTypeOf('function');
    expect((module.exports.default as unknown as () => number)()).toBe(5);
  });
});
