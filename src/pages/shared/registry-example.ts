import type { Section } from '~/types';
import type { BindingRegistry } from '~/utils/ast';

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
