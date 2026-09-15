import { beforeEach, describe, expect, it, vi } from 'vitest';

// utils/index.ts imports @jbpark/ui-kit for baseModules, which pulls in its
// CSS — stub both out since detectTypeScript doesn't touch either.
vi.mock('@jbpark/ui-kit', () => ({}));
vi.mock('@jbpark/ui-kit/utils', () => ({}));

const { compile, clearCompilationCache, detectTypeScript } =
  await import('./index');

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

describe('compile module cache (#329)', () => {
  const code = "import { value } from 'fixture'; export default () => value;";
  const read = (module: ReturnType<typeof compile>) => {
    expect(module.error).toBeUndefined();

    return (module.exports.default as unknown as () => unknown)();
  };

  beforeEach(() => clearCompilationCache());

  it('isolates alternating consumers with different module implementations', () => {
    const firstModules = { fixture: { value: 1 } };
    const secondModules = { fixture: { value: 2 } };
    const first = compile(code, firstModules);
    const second = compile(code, secondModules);

    expect(read(first)).toBe(1);
    expect(read(second)).toBe(2);
    expect(compile(code, firstModules)).toBe(first);
    expect(compile(code, secondModules)).toBe(second);
  });

  it('reuses stable module values across new maps and key insertion orders', () => {
    const fixture = { value: 1 };
    const extra = {};
    const first = compile(code, { fixture, extra });

    expect(compile(code, { extra, fixture })).toBe(first);
  });

  it('snapshots module entries instead of retaining the mutable input map', () => {
    const modules = { fixture: { value: 1 } };
    const first = compile(code, modules);
    modules.fixture = { value: 2 };

    expect(read(compile(code, modules))).toBe(2);
    expect(read(first)).toBe(1);
  });

  it('distinguishes functions with identical source and cyclic objects', () => {
    const make = (value: number) => () => value;
    const functionCode =
      "import get from 'fixture'; export default () => get();";

    expect(read(compile(functionCode, { fixture: make(1) }))).toBe(1);
    expect(read(compile(functionCode, { fixture: make(2) }))).toBe(2);

    const fixture: { value: number; self?: unknown } = { value: 3 };
    fixture.self = fixture;

    expect(read(compile(code, { fixture }))).toBe(3);
  });

  it('compares primitive modules by value without serializing symbols', () => {
    const primitiveCode =
      "import value from 'fixture'; export default () => value;";
    const first = Symbol('same');
    const second = Symbol('same');

    expect(read(compile(primitiveCode, { fixture: first }))).toBe(first);
    expect(read(compile(primitiveCode, { fixture: second }))).toBe(second);
    expect(read(compile(primitiveCode, { fixture: 1 }))).toBe(1);
    expect(read(compile(primitiveCode, { fixture: 2 }))).toBe(2);
  });

  it('does not collide module names containing delimiters', () => {
    const nameCode = "import value from 'a,b'; export default () => value;";

    expect(read(compile(nameCode, { 'a,b': 1 }))).toBe(1);
    expect(compile(nameCode, { a: 1, b: 1 }).error).toBeDefined();
  });

  it('requires explicit clearing for in-place mutation of a module object', () => {
    const snapshotCode =
      "import { value } from 'fixture'; const snapshot = value; export default () => snapshot;";
    const fixture = { value: 1 };
    const first = compile(snapshotCode, { fixture });
    fixture.value = 2;

    expect(compile(snapshotCode, { fixture })).toBe(first);
    expect(read(first)).toBe(1);
    clearCompilationCache();
    expect(read(compile(snapshotCode, { fixture }))).toBe(2);
  });

  it('keeps only 50 module variants and refreshes recency on a hit', () => {
    const fixtures = Array.from({ length: 51 }, (_, value) => ({ value }));
    const results = fixtures
      .slice(0, 50)
      .map(fixture => compile(code, { fixture }));

    expect(compile(code, { fixture: fixtures[0] })).toBe(results[0]);
    compile(code, { fixture: fixtures[50] });
    expect(compile(code, { fixture: fixtures[0] })).toBe(results[0]);
    const evicted = compile(code, { fixture: fixtures[1] });

    expect(evicted).not.toBe(results[1]);
    expect(read(evicted)).toBe(1);
  });
});
