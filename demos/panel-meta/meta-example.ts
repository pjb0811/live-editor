import { DEFAULT_TEMPLATE } from '~/constants';
import type { Section } from '~/types';
import type { BindingKeyMap } from '~/utils/ast';
import { replaceSections } from '~/utils/sections';

// The schema for the section below, with the docs' common `meta` keys:
// `tab`, `group`, `description`, `hint` and `visible`. The library reads
// none of them. They reach the panel in `binding.meta`, and `MetaPanel` in
// panel-meta-demo.tsx decides what they mean. Module-level, since a new map
// on every render makes `Live.Dnd` read every section again.
export const META_BINDING_KEYS = {
  'cta-section': [
    {
      label: 'Tone',
      property: 'data-tone',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
      tab: 'Style',
      description: 'Sets the background and text colors.',
    },
  ],
  'cta-title': [
    {
      label: 'Heading',
      property: 'innerText',
      required: true,
      tab: 'Content',
      description: 'Keep it to one line on a phone.',
    },
  ],
  'cta-body': [
    {
      label: 'Text',
      property: 'innerText',
      tab: 'Content',
      hint: 'Shown under the heading in a lighter color.',
    },
  ],
  'cta-button': [
    {
      label: 'Label',
      property: 'innerText',
      tab: 'Content',
      group: 'Button',
    },
    {
      label: 'Link',
      property: 'data-link',
      options: [
        { label: 'None', value: 'none' },
        { label: 'URL', value: 'url' },
      ],
      tab: 'Content',
      group: 'Button',
    },
    {
      label: 'URL',
      property: 'href',
      type: 'url',
      tab: 'Content',
      group: 'Button',
      description: 'Opens in the same tab.',
      visible: { property: 'data-link', in: ['url'], default: 'none' },
    },
    {
      label: 'Variant',
      property: 'data-variant',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Outline', value: 'outline' },
      ],
      tab: 'Style',
      group: 'Button',
    },
  ],
} satisfies BindingKeyMap;

// Every element names its schema with `data-binding-key`, so the markup
// carries no `data-binding` arrays. The tone and the button variant are
// `data-*` attributes the classes style through Tailwind's data variants.
export const META_EXAMPLE: Section = {
  id: 'cta',
  name: 'Call to action',
  code: `
      <section
        data-name="Call to action"
        data-binding-key="cta-section"
        data-tone="light"
        className="bg-white px-6 py-16 text-center text-gray-900 data-[tone=dark]:bg-gray-900 data-[tone=dark]:text-white"
      >
        <h2 data-id="" data-binding-key="cta-title" className="text-3xl font-bold">
          Start your free trial
        </h2>
        <p data-id="" data-binding-key="cta-body" className="mt-3 opacity-70">
          No credit card needed. Cancel any time.
        </p>
        <a
          data-id=""
          data-binding-key="cta-button"
          data-link="url"
          data-variant="solid"
          href="https://example.com/signup"
          className="mt-6 inline-block rounded-lg border-2 border-blue-600 bg-blue-600 px-5 py-2.5 font-medium text-white data-[variant=outline]:bg-transparent data-[variant=outline]:text-blue-600"
        >
          Sign up
        </a>
      </section>
    `,
};

export const META_DOCUMENT = replaceSections(DEFAULT_TEMPLATE, [
  META_EXAMPLE.code,
]);
