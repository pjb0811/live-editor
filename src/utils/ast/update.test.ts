import { describe, expect, it } from 'vitest';

import { PALETTE_SECTIONS } from '~/constants';

import { getCurrentValue } from './binding';
import { setEditableValue } from './editable-value';
import { extract } from './extract';
import { appendArrayItem, parseItems } from './items';
import type { DataAttrNode } from './types';
import { update, updateAll } from './update';

const CODE = `
<div data-id="a" data-binding="[{label:'Text',property:'innerText'}]">old text</div>
<span data-id="b" data-binding="[{label:'Html',property:'innerHTML'}]"><i>old</i></span>
<p data-id="c" data-binding="[{label:'Rich',property:'innerHTML',type:'richtext'}]">old rich</p>
<ul data-id="d" data-binding="[{label:'Kids',property:'children'}]"><li>x</li></ul>
<Icon data-id="e" data-binding="[{label:'Node',property:'icon',type:'jsx'}]" icon={<Old />} />
<input data-id="f" data-binding="[{label:'Placeholder',property:'placeholder'}]" placeholder="old" />
<input data-id="g" data-binding="[{label:'Count',property:'count'}]" count={1} />
`;

describe('update', () => {
  it.each([
    ['a reference', 'value={externalValue}', 'Changed'],
    ['a call', 'value={getValue()}', 'Changed'],
    [
      'an object spread',
      'value={{ ...defaults, label: "A" }}',
      { label: 'Changed' },
    ],
    ['a sparse array', 'value={[, "A"]}', ['Changed']],
  ])(
    'refuses to rebuild %s from a partial panel value',
    (_, attribute, next) => {
      const code = `<Comp data-id="x" data-binding={[{label:'Value',property:'value'}]} ${attribute} />`;
      const result = update(code, 'x', 'Value', next, 'value');

      expect(result).toEqual({
        code,
        success: false,
        failure: {
          reason: 'unsupported-syntax',
          dataId: 'x',
          property: 'value',
        },
      });
    },
  );

  it('replaces innerText content', () => {
    const result = update(CODE, 'a', 'Text', 'new text');

    expect(result.success).toBe(true);
    expect(result.code).toContain('>new text<');
    expect(result.code).not.toContain('old text');
  });

  it('injects raw HTML as literal children for a plain innerHTML binding, unescaped', () => {
    const result = update(CODE, 'b', 'Html', '<b>new & "quoted"</b>');

    expect(result.success).toBe(true);
    expect(result.code).toContain('<span data-id="b"');
    expect(result.code).toContain('<b>new & "quoted"</b>');
    // The raw value must land as literal markup, not inside a {} expression.
    expect(result.code).not.toContain('{<b>new');
  });

  it('sets dangerouslySetInnerHTML for a richtext binding', () => {
    const result = update(CODE, 'c', 'Rich', 'new <em>rich</em>');

    expect(result.success).toBe(true);
    expect(result.code).toContain('dangerouslySetInnerHTML');
    expect(result.code).toContain('new <em>rich</em>');
    // richtext clears any prior JSX children instead of leaving old markup behind.
    expect(result.code).not.toContain('old rich');
  });

  it('adds dangerouslySetInnerHTML when the attribute did not previously exist', () => {
    const code = `<p data-id="x" data-binding="[{label:'Rich',property:'innerHTML',type:'richtext'}]">plain</p>`;
    const result = update(code, 'x', 'Rich', 'injected');

    expect(result.success).toBe(true);
    expect(result.code).toContain('dangerouslySetInnerHTML={{');
    expect(result.code).toContain('__html: "injected"');
  });

  it('replaces children from a JSON-encoded DataAttrNode array', () => {
    const value = JSON.stringify([
      {
        tagName: 'li',
        attributes: [],
        dataAttributes: [],
        textContent: 'y',
      },
    ]);

    const result = update(CODE, 'd', 'Kids', value);

    expect(result.success).toBe(true);
    expect(result.code).toContain('<li>y</li>');
    expect(result.code).not.toContain('<li>x</li>');
  });

  it('fails gracefully when the children value is not valid JSON', () => {
    const result = update(CODE, 'd', 'Kids', 'not json');

    expect(result.success).toBe(false);
    expect(result.code).toBe(CODE);
  });

  it('injects a jsx-type attribute value as an expression, preserving its own JSX syntax', () => {
    const result = update(
      CODE,
      'e',
      'Node',
      '<NewIcon size={5 > 2 ? 1 : 2} />',
    );

    expect(result.success).toBe(true);
    expect(result.code).toContain('icon={<NewIcon size={5 > 2 ? 1 : 2} />}');
  });

  it('updates a plain string attribute', () => {
    const result = update(CODE, 'f', 'Placeholder', 'new placeholder');

    expect(result.success).toBe(true);
    expect(result.code).toContain('placeholder="new placeholder"');
  });

  // #238: the value crosses the boundary as its real JS type and is
  // serialized once, here, by that type — no first-character guessing.
  it('serializes a real number as a numeric expression', () => {
    const result = update(CODE, 'g', 'Count', 42);

    expect(result.success).toBe(true);
    expect(result.code).toContain('count={42}');
  });

  it('serializes a real boolean as a boolean expression', () => {
    const result = update(CODE, 'g', 'Count', false);

    expect(result.success).toBe(true);
    expect(result.code).toContain('count={false}');
  });

  // The bug #238 fixes: a genuine string whose text begins with `{` used to
  // be misclassified as a JS expression by the `startsWith('{')` heuristic.
  // A string is now always a string literal, whatever it contains.
  it('keeps a string that looks like an expression as a string literal', () => {
    const result = update(CODE, 'f', 'Placeholder', '{not an expression}');

    expect(result.success).toBe(true);
    expect(result.code).toContain('placeholder="{not an expression}"');
    expect(result.code).not.toContain('placeholder={');
  });

  it('serializes a structured object/array binding as an expression', () => {
    const code = `<Chart data-id="h" data-binding="[{label:'Data',property:'data',type:'array'}]" data={[1]} />`;
    const result = update(code, 'h', 'Data', [1, 2, 3], 'data');

    expect(result.success).toBe(true);
    expect(result.code).toContain('data={[1, 2, 3]}');
  });

  // Regression: the shipped `items` bindings declare no `type`
  // (`{ label: 'FAQ Items', property: 'items' }`), so #238's declared-type
  // gate sent their committed source text down the string-literal path and
  // rewrote `items={[...]}` into `items="[{\n  key: ...\"...\" }]"`, which
  // no longer parses as JSX. The panel's array editors always commit source
  // text, so every add/remove/move on a shipped section broke the document.
  describe('an array attribute whose binding declares no type', () => {
    const arrayCode = `<Collapse data-id="i" data-binding={[{ label: 'Items', property: 'items' }]} items={[{ key: '1' }]} />`;

    it('parses committed source text back into an expression', () => {
      const result = update(
        arrayCode,
        'i',
        'Items',
        "[{ key: '1' }, { key: '2' }]",
        'items',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('items={[{');
      expect(result.code).toContain("key: '2'");
      expect(result.code).not.toContain('items="');
    });

    it('keeps the result parseable when the items hold JSX', () => {
      const items = `[{ key: '1', label: <p data-id="j">A</p> }]`;
      const result = update(arrayCode, 'i', 'Items', items, 'items');

      expect(result.success).toBe(true);
      expect(() => extract(result.code)).not.toThrow();
      expect(extract(result.code).length).toBeGreaterThan(0);
    });

    // A leaf edit from setEditableValue has to reach the document with the
    // rest of the value as written (#427).
    it('writes a setEditableValue leaf edit without touching the rest', () => {
      const items = `[
        // first
        { key: 'a', label: <strong>10k</strong>, onClick: () => go() },
      ]`;
      const code = `<Stats data-id="s" data-binding={[{ label: 'Items', property: 'items' }]} items={${items}} />`;
      const result = update(
        code,
        's',
        'Items',
        setEditableValue(items, [0, 'key'], 'b'),
        'items',
      );

      expect(result.success).toBe(true);
      expect(result.code).toBe(code.replace("key: 'a'", "key: 'b'"));
    });

    // The narrow gate: only a value that is itself an array/object literal
    // replaces the expression. Plain text parses as an identifier, and
    // writing `items={nope}` would turn a value into a variable reference.
    it('still quotes a committed value that is not an array or object', () => {
      const result = update(arrayCode, 'i', 'Items', 'nope', 'items');

      expect(result.success).toBe(true);
      expect(result.code).toContain('items="nope"');
    });

    // The #238 guarantee is unchanged for attributes that were never
    // structural: a string committed against a plain text attribute stays a
    // string literal even when it happens to parse as an array.
    it('leaves a non-structural attribute quoted', () => {
      const code = `<Input data-id="k" data-binding={[{ label: 'P', property: 'placeholder' }]} placeholder="x" />`;
      const result = update(code, 'k', 'P', '[1, 2]', 'placeholder');

      expect(result.success).toBe(true);
      expect(result.code).toContain('placeholder="[1, 2]"');
    });
  });

  it('returns success: false and the original code when the data-id is not found', () => {
    const result = update(CODE, 'does-not-exist', 'Text', 'nope');

    expect(result).toEqual({
      code: CODE,
      success: false,
      failure: { reason: 'element-not-found', dataId: 'does-not-exist' },
    });
  });

  it('returns success: false and the original code when the label does not match any binding', () => {
    const result = update(CODE, 'a', 'NoSuchLabel', 'nope');

    expect(result).toEqual({
      code: CODE,
      success: false,
      failure: {
        reason: 'binding-not-declared',
        dataId: 'a',
        label: 'NoSuchLabel',
      },
    });
  });

  // #240: label is a display string, not an identifier — these pin
  // `property` as the real identity, with `label` only as a fallback for
  // callers that don't have `property` on hand.
  describe('identity: property vs. label (#240)', () => {
    const DUPLICATE_LABEL_CODE = `
<div
  data-id="b"
  data-binding="[{label:'Same',property:'title'},{label:'Same',property:'alt'}]"
  title="t"
  alt="a"
>x</div>
`;

    it('matches by property when provided, ignoring which binding the label happens to point at', () => {
      const result = update(
        DUPLICATE_LABEL_CODE,
        'b',
        'Same',
        'new alt',
        'alt',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('alt="new alt"');
      expect(result.code).toContain('title="t"');
    });

    it('resolves a translated label correctly as long as property is unchanged', () => {
      // Simulates i18n: the panel shows a translated label, but the
      // authored `property` — the real identity — never changes.
      const result = update(
        CODE,
        'a',
        '텍스트 (translated)',
        'new text',
        'innerText',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('>new text<');
    });

    it('fails safe instead of silently writing the first match when property is ambiguous on one element', () => {
      const ambiguousPropertyCode = `<div data-id="x" data-binding="[{label:'A',property:'dup'},{label:'B',property:'dup'}]" dup="orig">x</div>`;

      const result = update(ambiguousPropertyCode, 'x', 'A', 'next', 'dup');

      expect(result).toEqual({
        code: ambiguousPropertyCode,
        success: false,
        failure: {
          reason: 'duplicate-binding',
          dataId: 'x',
          label: 'A',
          property: 'dup',
          count: 2,
        },
      });
    });

    it('fails safe on the label fallback too when two bindings share a label — the #240 repro', () => {
      // Previously: `.find()` silently picked the first ("title"),
      // "alt" was never touched, and the caller still got success: true.
      const result = update(DUPLICATE_LABEL_CODE, 'b', 'Same', 'zzz');

      expect(result).toEqual({
        code: DUPLICATE_LABEL_CODE,
        success: false,
        failure: {
          reason: 'duplicate-binding',
          dataId: 'b',
          label: 'Same',
          count: 2,
        },
      });
    });
  });

  // #270: every failure used to collapse into a bare `success: false` with an
  // empty console. Each path now reports a distinct, structured reason.
  describe('failure reasons (#270)', () => {
    // Before #426 this was a failure. A declared property the element
    // doesn't carry is now added when it's given a real value; see the
    // "removing and adding attributes" suite.
    it('A: adds a declared attribute the element does not have yet', () => {
      const code = `<div data-id="a" data-binding="[{label:'Title',property:'nonexistent'}]" title="hi">x</div>`;
      const result = update(code, 'a', 'Title', 'new', 'nonexistent');

      expect(result.success).toBe(true);
      expect(result.code).toContain('title="hi" nonexistent="new"');
    });

    it('B: binding-not-declared when the requested binding is not on the element', () => {
      const code = `<div data-id="a" data-binding="[{label:'Title',property:'title'}]" title="hi">x</div>`;
      const result = update(code, 'a', 'Other', 'new', 'other');

      expect(result.failure).toEqual({
        reason: 'binding-not-declared',
        dataId: 'a',
        label: 'Other',
        property: 'other',
      });
    });

    it('C: element-not-found when no element carries the data-id', () => {
      const code = `<div data-id="a" data-binding="[{label:'Title',property:'title'}]" title="hi">x</div>`;
      const result = update(code, 'zzz', 'Title', 'new', 'title');

      expect(result.failure).toEqual({
        reason: 'element-not-found',
        dataId: 'zzz',
      });
    });

    it('D: duplicate-binding when one element declares the property twice', () => {
      const code = `<div data-id="a" data-binding="[{label:'T1',property:'title'},{label:'T2',property:'title'}]" title="hi">x</div>`;
      const result = update(code, 'a', 'T1', 'new', 'title');

      expect(result.failure).toEqual({
        reason: 'duplicate-binding',
        dataId: 'a',
        label: 'T1',
        property: 'title',
        count: 2,
      });
    });

    it('E: no-binding when the element has no data-binding attribute', () => {
      const code = `<div data-id="a" title="hi">x</div>`;
      const result = update(code, 'a', 'Title', 'new', 'title');

      expect(result.failure).toEqual({ reason: 'no-binding', dataId: 'a' });
    });

    it.each([
      [
        'innerText',
        `<img data-id="a" data-binding="[{label:'Caption',property:'innerText'}]" />`,
      ],
      [
        'innerHTML',
        `<div data-id="a" data-binding="[{label:'Body',property:'innerHTML'}]" />`,
      ],
    ])(
      'F: self-closing when %s is written to a self-closing element (#552)',
      (property, code) => {
        const result = update(code, 'a', '', 'New', property);

        expect(result).toEqual({
          code,
          success: false,
          failure: { reason: 'self-closing', dataId: 'a', property },
        });
      },
    );

    it('F: clearing content on a self-closing element still succeeds', () => {
      const code = `<img data-id="a" data-binding="[{label:'Caption',property:'innerText'}]" />`;

      expect(update(code, 'a', '', '', 'innerText')).toEqual({
        code,
        success: true,
      });
      expect(update(code, 'a', '', undefined, 'innerText').success).toBe(true);
    });

    it('F: richtext on a self-closing element is written to an attribute', () => {
      const code = `<div data-id="a" data-binding="[{label:'Body',property:'innerHTML',type:'richtext'}]" />`;
      const result = update(code, 'a', '', '<b>New</b>', 'innerHTML');

      expect(result.success).toBe(true);
      expect(result.code).toContain('dangerouslySetInnerHTML');
    });

    it('F: updateAll stops at a self-closing element and keeps the source', () => {
      const code = `<div><p data-id="p" data-binding="[{label:'T',property:'innerText'}]">Old</p><img data-id="a" data-binding="[{label:'Caption',property:'innerText'}]" /></div>`;
      const result = updateAll(code, [
        { dataId: 'p', label: 'T', property: 'innerText', value: 'New' },
        { dataId: 'a', label: 'Caption', property: 'innerText', value: 'x' },
      ]);

      expect(result).toMatchObject({
        success: false,
        code,
        index: 1,
        failure: { reason: 'self-closing' },
      });
    });

    it('control: a successful update carries no failure', () => {
      const result = update(CODE, 'a', 'Text', 'new text', 'innerText');

      expect(result.success).toBe(true);
      expect(result.failure).toBeUndefined();
    });
  });

  // #239: `update` patches the original source at the parsed node's offsets
  // instead of re-emitting the section, so anything it didn't explicitly
  // target comes through byte for byte.
  describe('formatting preservation (#239)', () => {
    const FORMATTED = `<section data-name="Hero">
  {/* keep this comment */}
  <h1
    data-id="a"
    data-binding='[{"label":"Title","property":"innerText"}]'
    className={cn(
      'text-4xl',
      // trailing comment inside cn
      'font-bold',
    )}
  >
    Old Title
  </h1>
</section>`;

    it('changes only the edited value and leaves every other byte identical', () => {
      const result = update(FORMATTED, 'a', 'Title', 'New Title');

      expect(result.success).toBe(true);
      expect(result.code).toBe(FORMATTED.replace('Old Title', 'New Title'));
    });

    it('preserves the indentation surrounding a replaced text node', () => {
      const result = update(FORMATTED, 'a', 'Title', 'New Title');

      expect(result.code).toContain('\n  >\n    New Title\n  </h1>');
    });

    // Bindings are authored as JSX expressions now, so whole-node
    // regeneration used to reformat the declaration that drives the edit.
    it('leaves a multi-line data-binding declaration untouched', () => {
      const code = `<div
  data-id="a"
  data-binding={[
    { label: 'Title', property: 'title' },
    { label: 'Alt', property: 'alt' },
  ]}
  title="old"
  alt="keep"
>x</div>`;

      const result = update(code, 'a', 'Title', 'new', 'title');

      expect(result.success).toBe(true);
      expect(result.code).toBe(code.replace('title="old"', 'title="new"'));
    });

    it('re-indents a generated multi-line fragment to the column it lands on', () => {
      const code = `<section>
    <div
      data-id="a"
      data-binding={[{ label: 'Style', property: 'style', type: 'object' }]}
      style={{ color: 'red' }}
    >x</div>
</section>`;

      const result = update(code, 'a', 'Style', { color: 'blue' }, 'style');

      expect(result.success).toBe(true);
      expect(result.code).toContain(
        '      style={{\n        "color": "blue"\n      }}',
      );
    });

    // The old implementation smuggled raw values past the generator as
    // `__HTML_<id>__` placeholders and string-replaced them afterwards,
    // where `$&`/`$$` are special. Source patching inserts them literally.
    it('writes a raw innerHTML value containing $& and $$ verbatim', () => {
      const code = `<div data-id="a" data-binding="[{label:'H',property:'innerHTML'}]">old</div>`;
      const result = update(code, 'a', 'H', '<b>$& and $$</b>');

      expect(result.success).toBe(true);
      expect(result.code).toContain('<b>$& and $$</b>');
    });

    // Patching an attribute reuses the parsed name node rather than building
    // a fresh JSXIdentifier, so dashed and namespaced names survive.
    it('keeps a dashed attribute name intact', () => {
      const code = `<div data-id="a" data-binding="[{label:'L',property:'aria-label'}]" aria-label="old">x</div>`;
      const result = update(code, 'a', 'L', 'new', 'aria-label');

      expect(result.success).toBe(true);
      expect(result.code).toContain('aria-label="new"');
    });

    // Replacing innerText targets the text nodes only — same as the old
    // "splice out every JSXText" mutation, which left other children alone.
    it('replaces text without disturbing sibling non-text children', () => {
      const code = `<div data-id="a" data-binding="[{label:'T',property:'innerText'}]">old{/* keep */}</div>`;
      const result = update(code, 'a', 'T', 'new', 'innerText');

      expect(result.success).toBe(true);
      expect(result.code).toContain('{/* keep */}');
      expect(result.code).not.toContain('old');
    });

    // The text span is measured on the raw source, not on Babel's cooked
    // JSXText value: the cooked value decodes entities and collapses CRLF,
    // so its character counts don't match the raw offsets the span uses.
    it('keeps CRLF line endings and surrounding indentation intact', () => {
      const code =
        '<h1\r\n  data-id="a"\r\n  data-binding="[{label:\'T\',property:\'innerText\'}]"\r\n>\r\n  Old Title\r\n</h1>';

      const result = update(code, 'a', 'T', 'New Title');

      expect(result.success).toBe(true);
      expect(result.code).toBe(code.replace('Old Title', 'New Title'));
    });

    // Same-line whitespace is part of the string value, which the panel
    // trims, so an edit overwrites it. Only whitespace with a line break is
    // layout (#576).
    it.each([
      [' Old ', 'New', 'New'],
      ['\tOld\t', 'New', 'New'],
      [' Old', 'New', 'New'],
      [' Old ', ' New', ' New'],
      ['\n  Old ', 'New', '\n  New'],
      ['\n  Old\n', 'New', '\n  New\n'],
    ])('rewrites %j as the value %j', (children, value, expected) => {
      const open = `<h1 data-id="a" data-binding="[{label:'T',property:'innerText'}]">`;

      const result = update(`${open}${children}</h1>`, 'a', 'T', value);

      expect(result.success).toBe(true);
      expect(result.code).toBe(`${open}${expected}</h1>`);
    });

    it('keeps CRLF layout on both sides byte for byte', () => {
      const open = `<h1 data-id="a" data-binding="[{label:'T',property:'innerText'}]">`;

      const result = update(`${open}\r\n  Old \r\n</h1>`, 'a', 'T', 'New');

      expect(result.code).toBe(`${open}\r\n  New \r\n</h1>`);
    });

    it('replaces text bounded by HTML entities without cutting into them', () => {
      const code = `<div data-id="a" data-binding="[{label:'T',property:'innerText'}]">&nbsp;Old&nbsp;</div>`;

      const result = update(code, 'a', 'T', 'New');

      expect(result.success).toBe(true);
      expect(result.code).toContain('>New<');
      expect(result.code).not.toContain('&New;');
    });

    // A generated fragment is re-indented to the column it lands on, but
    // only when every newline in it is layout. A newline inside a template
    // literal or JSX text belongs to the value, and indenting it would
    // rewrite that value — repeatedly, since the built-in array editor
    // feeds its own serialized output back through `update`.
    it('leaves newlines inside a template literal value alone across repeated edits', () => {
      const items = '[{ id: 1, html: `<p>A</p>\n<p>B</p>` }]';
      const code = `<div
      data-id="a"
      data-binding={[{ label: 'I', property: 'items', type: 'array' }]}
      items={${items}}
    >x</div>`;

      let current = code;

      for (let pass = 0; pass < 3; pass++) {
        const serialized = /items=\{(\[[\s\S]*?\])\}/.exec(current)?.[1];
        current = update(current, 'a', 'I', serialized, 'items').code;

        expect(current).toContain('`<p>A</p>\n<p>B</p>`');
      }
    });

    // Babel re-emits comments it parsed out of the authored value, so an
    // apostrophe in an English comment must not make the indent-safety scan
    // lose track of the backtick that follows it.
    it.each([
      ['a line comment', "[\n  // don't\n  { html: `A\nB` }\n]"],
      ['a block comment', "[{ /* don't */ html: `A\nB` }]"],
      ['a regex literal', '[{ re: /"/, html: `A\nB` }]'],
    ])(
      'leaves a template literal alone when the value also contains %s',
      (_name, items) => {
        const code = `<div
      data-id="a"
      data-binding={[{ label: 'I', property: 'items', type: 'array' }]}
      items={[]}
    >x</div>`;

        const result = update(code, 'a', 'I', items, 'items');

        expect(result.success).toBe(true);
        expect(result.code).toContain('`A\nB`');
      },
    );

    // A backslash before a newline is a line continuation: the newline is
    // part of the string's raw text, even though there is no backtick or
    // `<` anywhere to flag it.
    it('leaves a line-continued string literal byte-identical', () => {
      const code = `<div
      data-id="a"
      data-binding={[{ label: 'I', property: 'items', type: 'array' }]}
      items={[]}
    >x</div>`;

      const result = update(
        code,
        'a',
        'I',
        '[{ id: 1, html: "<p>A</p>\\\n<p>B</p>" }]',
        'items',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('"<p>A</p>\\\n<p>B</p>"');
    });

    it('leaves newlines inside generated JSX text alone', () => {
      const code = `<section>
      <ul data-id="a" data-binding={[{ label: 'K', property: 'children' }]}>
        <li>x</li>
      </ul>
</section>`;

      const value = JSON.stringify([
        {
          tagName: 'pre',
          attributes: [],
          dataAttributes: [],
          textContent: 'a\nb',
        },
      ]);

      const result = update(code, 'a', 'K', value);

      expect(result.success).toBe(true);
      expect(result.code).toContain('<pre>a\nb</pre>');
    });
  });
});

// All of it or none of it, in array order (#425).
describe('updateAll', () => {
  it('applies every entry in array order, across elements', () => {
    const result = updateAll(CODE, [
      { dataId: 'a', label: 'Text', value: 'all text' },
      { dataId: 'f', label: 'Placeholder', value: 'all placeholder' },
      { dataId: 'e', label: 'Node', value: '<All />' },
    ]);

    expect(result).toMatchObject({ success: true });
    expect(result.code).toContain('>all text<');
    expect(result.code).toContain('placeholder="all placeholder"');
    expect(result.code).toContain('icon={<All />}');
  });

  it('gives back the source untouched, and which entry failed, when one is refused', () => {
    const result = updateAll(CODE, [
      { dataId: 'a', label: 'Text', value: 'all text' },
      { dataId: 'missing', label: 'Text', value: 'nope' },
      { dataId: 'f', label: 'Placeholder', value: 'all placeholder' },
    ]);

    expect(result).toEqual({
      success: false,
      code: CODE,
      failure: { reason: 'element-not-found', dataId: 'missing' },
      index: 1,
    });
  });

  it('stops at the first failure', () => {
    const result = updateAll(CODE, [
      { dataId: 'missing', label: 'Text', value: 'x' },
      { dataId: 'also-missing', label: 'Text', value: 'y' },
    ]);

    expect(result).toMatchObject({
      success: false,
      index: 0,
      failure: { reason: 'element-not-found', dataId: 'missing' },
    });
  });

  it('lets a later entry for the same property win', () => {
    const result = updateAll(CODE, [
      { dataId: 'a', label: 'Text', value: 'first' },
      { dataId: 'a', label: 'Text', value: 'second' },
    ]);

    expect(result.code).toContain('>second<');
    expect(result.code).not.toContain('first');
  });

  it('refuses the whole batch for a reserved attribute', () => {
    const section = `<section data-id="s" data-name="N" data-binding="[{label:'Id',property:'data-id'},{label:'Pad',property:'className'}]" className="p-1">x</section>`;
    const result = updateAll(section, [
      { dataId: 's', label: 'Pad', value: 'p-4', property: 'className' },
      { dataId: 's', label: 'Id', value: 'other', property: 'data-id' },
    ]);

    expect(result).toEqual({
      success: false,
      code: section,
      failure: {
        reason: 'reserved-property',
        dataId: 's',
        property: 'data-id',
      },
      index: 1,
    });
  });

  it('matches applying the entries one at a time', () => {
    const code = `<div data-id="a" data-binding={[{ label: 'T', property: 'title' }, { label: 'A', property: 'alt' }]} title="t" alt="a">x</div>`;
    const entries = [
      { dataId: 'a', label: 'T', value: 't2', property: 'title' },
      { dataId: 'a', label: 'A', value: 'a2', property: 'alt' },
    ];

    expect(updateAll(code, entries).code).toBe(
      update(update(code, 'a', 'T', 't2', 'title').code, 'a', 'A', 'a2', 'alt')
        .code,
    );
  });

  it('does nothing for an empty batch', () => {
    expect(updateAll(CODE, [])).toEqual({ success: true, code: CODE });
  });
});

// The reported break, end to end on the shipped sections: the panel's array
// editors (built-in `Items`, or a consumer's own markup over
// `useDndItems`) re-serialize the whole array and commit it as source
// text, so a single "+ Add" has to survive the round trip through `update`.
// Neither shipped `items` binding declares a `type`, which is exactly the
// case #238's gate missed.
describe('adding an item to a shipped section', () => {
  const flatten = (nodes: DataAttrNode[]): DataAttrNode[] =>
    nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);

  it.each([
    ['FAQ', 'FAQ Items'],
    ['Stats', 'Stats Items'],
  ])('keeps the %s section parseable', (name, label) => {
    const section = PALETTE_SECTIONS.find(item => item.name === name)!;
    const node = flatten(extract(section.code)).find(candidate =>
      candidate.bindings?.some(binding => binding.property === 'items'),
    )!;
    const dataId =
      node.dataAttributes.find(attr => attr.name === 'data-id')?.value ?? '';

    const before = parseItems(getCurrentValue(node, 'items'))!;
    let nextId = 0;
    const appended = appendArrayItem(
      getCurrentValue(node, 'items'),
      'object',
      () => `fixed-${nextId++}`,
    );

    expect(appended).not.toBeNull();
    const result = update(section.code, dataId, label, appended, 'items');

    expect(result.success).toBe(true);
    expect(result.code).toContain('items={[');
    expect(result.code).not.toMatch(/items="/);

    // The document still parses, and the panel reads one more item back.
    const reparsed = flatten(extract(result.code)).find(candidate =>
      candidate.bindings?.some(binding => binding.property === 'items'),
    )!;

    expect(parseItems(getCurrentValue(reparsed, 'items'))).toHaveLength(
      before.length + 1,
    );
  });
});

// The editor owns `data-id`, `data-name` and `data-binding`. A binding that
// targets one used to rewrite it, which would break the canvas mapping, a
// section's name, or the declaration the edit was checked against (#429).
describe('update: reserved attributes', () => {
  const SECTION = `<section data-id="s1" data-name="Hero" data-binding="[{label:'Id',property:'data-id'},{label:'Name',property:'data-name'},{label:'Schema',property:'data-binding'},{label:'Pad',property:'className'}]" className="py-8"><p>x</p></section>`;

  it.each([
    ['Id', 'data-id'],
    ['Name', 'data-name'],
    ['Schema', 'data-binding'],
  ])('refuses a binding on %s (%s)', (label, property) => {
    const result = update(SECTION, 's1', label, 'changed', property);

    expect(result.success).toBe(false);
    expect(result.failure).toEqual({
      reason: 'reserved-property',
      dataId: 's1',
      property,
    });
    expect(result.code).toBe(SECTION);
  });

  it('refuses when the binding is found by label alone', () => {
    const result = update(SECTION, 's1', 'Name', 'changed');

    expect(result.failure).toMatchObject({ reason: 'reserved-property' });
  });

  it('still edits an ordinary attribute on the same element', () => {
    const result = update(SECTION, 's1', 'Pad', 'py-16', 'className');

    expect(result.success).toBe(true);
    expect(result.code).toContain('className="py-16"');
    expect(result.code).toContain('data-id="s1"');
  });
});

// `undefined` removes a property and a real value adds a missing one, so an
// optional attribute can be switched off and on again. Writing `undefined`
// used to leave the text "undefined" in the source (#426).
describe('update: removing and adding attributes', () => {
  const EL = `<a
  data-id="a"
  data-binding={[
    { label: 'Title', property: 'title' },
    { label: 'Size', property: 'size', type: 'number' },
    { label: 'Open', property: 'open', type: 'boolean' },
    { label: 'Alt', property: 'alt' },
    { label: 'Needed', property: 'href', required: true },
    { label: 'Text', property: 'innerText' },
    { label: 'Html', property: 'innerHTML' },
    { label: 'Kids', property: 'children' },
    { label: 'Style', property: 'style', type: 'object' },
    { label: 'Icon', property: 'icon', type: 'jsx' },
  ]}
  title="Hi"
  size={2}
  open
  href="/x"
>
  Hello
</a>`;

  it.each([
    ['Title', 'title', 'title="Hi"'],
    ['Size', 'size', 'size={2}'],
    ['Open', 'open', '  open\n'],
  ])(
    'removes %s with undefined, and the line it was on',
    (label, property, gone) => {
      const result = update(EL, 'a', label, undefined, property);

      expect(result.success).toBe(true);
      expect(result.code).not.toContain(gone);
      expect(result.code).not.toContain('undefined');
      // Only that attribute went; its neighbors are byte-for-byte the same.
      expect(result.code.replace(/\n\s*\n/g, '\n')).toBe(result.code);
    },
  );

  it('leaves the source alone when removing an attribute that is already absent', () => {
    const result = update(EL, 'a', 'Alt', undefined, 'alt');

    expect(result).toEqual({ code: EL, success: true });
  });

  it('adds a missing attribute when given a real value', () => {
    const result = update(EL, 'a', 'Alt', 'A picture', 'alt');

    expect(result.success).toBe(true);
    // On its own line, indented like the attribute before it.
    expect(result.code).toContain('  href="/x"\n  alt="A picture"\n>');
  });

  it('adds a missing attribute on the same line when the tag is on one line', () => {
    const img = `<img data-id="i" data-binding={[{ label: 'Alt', property: 'alt' }]} src="x.png" />`;

    expect(update(img, 'i', 'Alt', 'New', 'alt').code).toBe(
      `<img data-id="i" data-binding={[{ label: 'Alt', property: 'alt' }]} src="x.png" alt="New" />`,
    );
  });

  it('adds a missing attribute with its declared type', () => {
    const result = update(EL, 'a', 'Style', { color: 'red' }, 'style');

    expect(result.code).toMatch(/style=\{\{[\s\S]*color[\s\S]*red[\s\S]*\}\}/);
    expect(update(EL, 'a', 'Icon', '<Star />', 'icon').code).toContain(
      'icon={<Star />}',
    );
  });

  it('does not add a missing attribute for an empty string', () => {
    expect(update(EL, 'a', 'Alt', '', 'alt')).toEqual({
      code: EL,
      success: true,
    });
  });

  it('switches an attribute off and on again', () => {
    const off = update(EL, 'a', 'Title', undefined, 'title').code;
    const on = update(off, 'a', 'Title', 'Back', 'title');

    expect(on.success).toBe(true);
    expect(on.code).toContain('title="Back"');
  });

  it('empties text and HTML content instead of writing "undefined"', () => {
    const text = update(EL, 'a', 'Text', undefined, 'innerText');
    const html = update(EL, 'a', 'Html', undefined, 'innerHTML');

    expect(text.code).not.toContain('undefined');
    expect(text.code).not.toContain('Hello');
    expect(html.code).toMatch(/>\s*<\/a>$/);
  });

  it('refuses to remove children as a whole', () => {
    expect(update(EL, 'a', 'Kids', undefined, 'children').failure).toEqual({
      reason: 'unsupported-syntax',
      dataId: 'a',
      property: 'children',
    });
  });

  it('refuses to remove a required property', () => {
    const result = update(EL, 'a', 'Needed', undefined, 'href');

    expect(result).toEqual({
      code: EL,
      success: false,
      failure: { reason: 'required-property', dataId: 'a', property: 'href' },
    });
  });

  it('removes several attributes as one edit through updateAll', () => {
    const result = updateAll(EL, [
      { dataId: 'a', label: 'Title', value: undefined, property: 'title' },
      { dataId: 'a', label: 'Size', value: undefined, property: 'size' },
    ]);

    expect(result.success).toBe(true);
    expect(result.code).not.toContain('title=');
    expect(result.code).not.toContain('size=');
    expect(result.code).toContain('href="/x"');
  });
});

describe('update: removing an attribute with a trailing comment (#577)', () => {
  const B = `data-id="a"\n  data-binding="[{label:'T',property:'title'}]"`;
  const remove = (code: string) => update(code, 'a', 'T', undefined);

  it.each([['// end'], ['/* t */'], ['/* t */ // end']])(
    'removes the whole line with `%s`',
    comment => {
      const code = `<a\n  ${B}\n  title="Hi" ${comment}\n  href="/x"\n>go</a>`;

      expect(remove(code)).toEqual({
        code: `<a\n  ${B}\n  href="/x"\n>go</a>`,
        success: true,
      });
    },
  );

  it('removes the comment of the last attribute too', () => {
    const code = `<a\n  ${B}\n  href="/x"\n  title="Hi" // end\n>go</a>`;

    expect(remove(code).code).toBe(`<a\n  ${B}\n  href="/x"\n>go</a>`);
  });

  it.each([['// end'], ['/* t */'], ['']])(
    'keeps every CRLF with `%s`',
    comment => {
      const code = `<a\r\n  ${B}\r\n  title="Hi" ${comment}\r\n  href="/x"\r\n>go</a>`;

      expect(remove(code).code).toBe(`<a\r\n  ${B}\r\n  href="/x"\r\n>go</a>`);
    },
  );

  it('keeps a comment on the line above', () => {
    const code = `<a\n  ${B}\n  // note\n  title="Hi"\n  href="/x"\n>go</a>`;

    expect(remove(code).code).toBe(
      `<a\n  ${B}\n  // note\n  href="/x"\n>go</a>`,
    );
  });

  it('leaves the comment when the attribute shares its line', () => {
    const code = `<a\n  ${B}\n  rel="n" title="Hi" // end\n  href="/x"\n>go</a>`;

    expect(remove(code).code).toBe(
      `<a\n  ${B}\n  rel="n" // end\n  href="/x"\n>go</a>`,
    );
  });

  it('removes an attribute with no comment as before', () => {
    const code = `<a\n  ${B}\n  title="Hi"\n  href="/x"\n>go</a>`;

    expect(remove(code).code).toBe(`<a\n  ${B}\n  href="/x"\n>go</a>`);
  });
});
