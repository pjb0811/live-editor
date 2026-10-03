import type { Section } from '~/types';
import type { BindingRegistry } from '~/utils/ast';

// Fields for every element of these tags, so the section below needs no
// `data-binding` of its own (#509). Module-level, since a new registry object
// on every render makes `Live.Dnd` read every section again.
export const REGISTRY = {
  h2: [{ label: 'Heading', property: 'innerText', required: true }],
  p: [{ label: 'Text', property: 'innerText' }],
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

// A section whose elements carry only a `data-id`. With `REGISTRY` passed to
// `Live.Dnd`, the heading, the first paragraph and the button get fields
// from their tags. The second paragraph opts out with an empty
// `data-binding`.
export const REGISTRY_EXAMPLE: Section = {
  id: 'registry',
  name: 'Registry-bound',
  code: `
      <section data-name="Registry-bound" className="bg-white px-6 py-12 text-center">
        <h2 data-id="" className="text-3xl font-bold text-gray-900">
          Fields from the binding registry
        </h2>
        <p data-id="" className="mt-3 text-gray-600">
          No data-binding here: every p gets its fields from the registry.
        </p>
        <p data-id="" data-binding={[]} className="mt-1 text-sm text-gray-400">
          This paragraph opts out with an empty data-binding.
        </p>
        <ui.Button data-id="" type="primary" size="middle" className="mt-6">
          Registry button
        </ui.Button>
      </section>
    `,
};
