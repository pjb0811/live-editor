import type { Section } from '~/types';
import type { BindingKeyMap, BindingRegistry } from '~/utils/ast';

// Fields for every element of these components, so the section below needs
// no `data-binding` of its own (#509). HTML elements such as `h2` or `p`
// can't be registry keys. Module-level, since a new registry object
// on every render makes `Live.Dnd` read every section again.
export const REGISTRY = {
  'ui.Typography.Title': [
    { label: 'Heading', property: 'innerText', required: true },
  ],
  'ui.Typography.Paragraph': [{ label: 'Text', property: 'innerText' }],
  'ui.Button': [
    { label: 'Button Text', property: 'innerText' },
    {
      label: 'Button Size',
      property: 'size',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Middle', value: 'middle' },
        { label: 'Large', value: 'large' },
      ],
    },
  ],
} satisfies BindingRegistry;

// A section whose components carry only a `data-id`. With `REGISTRY` passed
// to `Live.Dnd`, the title, the first paragraph and the button get fields
// from their entries. The second paragraph opts out with an empty
// `data-binding`, and the plain `<p>` has no fields, since HTML elements
// aren't covered by the registry.
export const REGISTRY_EXAMPLE: Section = {
  id: 'registry',
  name: 'Registry-bound',
  code: `
      <section data-name="Registry-bound" className="bg-white px-6 py-12 text-center">
        <ui.Typography.Title data-id="" level={2}>
          Fields from the binding registry
        </ui.Typography.Title>
        <ui.Typography.Paragraph data-id="">
          No data-binding here: the registry gives this component its fields.
        </ui.Typography.Paragraph>
        <ui.Typography.Paragraph data-id="" data-binding={[]}>
          This paragraph opts out with an empty data-binding.
        </ui.Typography.Paragraph>
        <p data-id="" className="text-sm text-gray-400">
          A plain p: HTML elements need their own data-binding.
        </p>
        <ui.Button data-id="" type="primary" size="middle" className="mt-6">
          Registry button
        </ui.Button>
      </section>
    `,
};

// Schemas named in the markup with `data-binding-key` (#513). Plain data, as
// if loaded from JSON.
export const BINDING_KEYS = {
  'promo-title': [
    { label: 'Promo Title', property: 'innerText', required: true },
  ],
  'promo-link': [
    { label: 'Link Text', property: 'innerText' },
    { label: 'Link URL', property: 'href', type: 'url' },
  ],
  'promo-button': [{ label: 'Promo Button Text', property: 'innerText' }],
} satisfies BindingKeyMap;

// HTML elements bound by key, and a `ui.Button` whose key takes precedence
// over the registry's `ui.Button` entry.
export const KEYED_EXAMPLE: Section = {
  id: 'keyed',
  name: 'Key-bound',
  code: `
      <section data-name="Key-bound" className="bg-amber-50 px-6 py-12 text-center">
        <h2 data-id="" data-binding-key="promo-title" className="text-3xl font-bold text-amber-900">
          Fields from bindingKeys
        </h2>
        <a data-id="" data-binding-key="promo-link" href="https://example.com" className="mt-3 inline-block text-amber-700 underline">
          A plain link with a schema kept outside the markup
        </a>
        <div className="mt-6">
          <ui.Button data-id="" data-binding-key="promo-button" type="primary">
            Keyed button
          </ui.Button>
        </div>
      </section>
    `,
};
