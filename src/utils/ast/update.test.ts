import { describe, expect, it } from 'vitest';

import { bulkUpdate, update } from './update';

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
    it('A: attribute-not-found when the declared property has no matching attribute', () => {
      const code = `<div data-id="a" data-binding="[{label:'Title',property:'nonexistent'}]" title="hi">x</div>`;
      const result = update(code, 'a', 'Title', 'new', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.code).toBe(code);
      expect(result.failure).toEqual({
        reason: 'attribute-not-found',
        dataId: 'a',
        property: 'nonexistent',
      });
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

describe('bulkUpdate', () => {
  it('applies every entry in order and reports overall success', () => {
    const result = bulkUpdate(CODE, [
      { dataId: 'a', label: 'Text', value: 'bulk text' },
      { dataId: 'f', label: 'Placeholder', value: 'bulk placeholder' },
      { dataId: 'e', label: 'Node', value: '<Bulk />' },
    ]);

    expect(result.success).toBe(true);
    expect(result.code).toContain('>bulk text<');
    expect(result.code).toContain('placeholder="bulk placeholder"');
    expect(result.code).toContain('icon={<Bulk />}');
  });

  it('reports success: false if any entry fails, while still applying the ones that succeed', () => {
    const result = bulkUpdate(CODE, [
      { dataId: 'a', label: 'Text', value: 'bulk text' },
      { dataId: 'missing', label: 'Text', value: 'nope' },
    ]);

    expect(result.success).toBe(false);
    expect(result.code).toContain('>bulk text<');
    expect(result.failures).toEqual([
      { reason: 'element-not-found', dataId: 'missing' },
    ]);
  });

  it("threads an entry's optional property through to update, same as calling it directly (#240)", () => {
    const duplicateLabelCode = `<div data-id="b" data-binding="[{label:'Same',property:'title'},{label:'Same',property:'alt'}]" title="t" alt="a">x</div>`;

    const result = bulkUpdate(duplicateLabelCode, [
      { dataId: 'b', label: 'Same', property: 'alt', value: 'bulk alt' },
    ]);

    expect(result.success).toBe(true);
    expect(result.code).toContain('alt="bulk alt"');
    expect(result.code).toContain('title="t"');
  });

  // #239: each entry re-parses the already-patched source, so offsets are
  // always fresh — batching must stay equivalent to applying one at a time.
  it('produces the same result as applying each entry sequentially', () => {
    const code = `<div
  data-id="a"
  data-binding={[{ label: 'T', property: 'title' }, { label: 'A', property: 'alt' }]}
  title="t"
  alt="a"
>x</div>`;

    const batched = bulkUpdate(code, [
      { dataId: 'a', label: 'T', value: 't2', property: 'title' },
      { dataId: 'a', label: 'A', value: 'a2', property: 'alt' },
    ]);

    const sequential = update(
      update(code, 'a', 'T', 't2', 'title').code,
      'a',
      'A',
      'a2',
      'alt',
    );

    expect(batched.success).toBe(true);
    expect(batched.code).toBe(sequential.code);
    expect(batched.code).toBe(
      code.replace('title="t"', 'title="t2"').replace('alt="a"', 'alt="a2"'),
    );
  });
});
