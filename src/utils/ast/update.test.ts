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

  it('updates a plain attribute with a numeric expression value', () => {
    const result = update(CODE, 'g', 'Count', '42');

    expect(result.success).toBe(true);
    expect(result.code).toContain('count={42}');
  });

  it('returns success: false and the original code when the data-id is not found', () => {
    const result = update(CODE, 'does-not-exist', 'Text', 'nope');

    expect(result).toEqual({ code: CODE, success: false });
  });

  it('returns success: false and the original code when the label does not match any binding', () => {
    const result = update(CODE, 'a', 'NoSuchLabel', 'nope');

    expect(result).toEqual({ code: CODE, success: false });
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
  });
});
